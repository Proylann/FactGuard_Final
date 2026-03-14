import csv
import io
from datetime import datetime, timedelta
from html import escape
import random
import secrets
import time
import uuid
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Body, Depends, File, Header, HTTPException, Request, Response, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy import and_, func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from .. import schemas
from ..config import settings
from ..db import get_db
from ..models import AuditLog, ScanResult, User
from ..repositories import UserRepository
from ..services.ai_text_engine import AITextDetector
from ..services.deepfake_detector import DeepfakeDetector
from ..services.email_service import SMTPEmailService
from ..services.plagiarism_scanner import PlagiarismSettings, WebPlagiarismScanner
from ..services.session_service import SessionService
from ..utils.rate_limiter import (
    get_plagiarism_scan_retry_after,
    get_remaining_attempts,
    get_remaining_lockout_time,
    is_plagiarism_scan_limited,
    is_user_locked_out,
    record_failed_login,
    record_plagiarism_scan_attempt,
    reset_failed_login,
)
from .routers import AuthService

router = APIRouter()

text_detector = AITextDetector()
deepfake_service = DeepfakeDetector()
plagiarism_service = WebPlagiarismScanner(settings)
email_service = SMTPEmailService(settings)
session_service = SessionService(ttl_seconds=settings.SESSION_TTL_SECONDS)
_CAPTCHA_TTL_SECONDS = 5 * 60
_MFA_TTL_SECONDS = 5 * 60
_SIGNUP_OTP_TTL_SECONDS = settings.SIGNUP_OTP_TTL_SECONDS
_PASSWORD_RESET_TTL_SECONDS = settings.PASSWORD_RESET_TTL_SECONDS
_captcha_store: dict[str, dict[str, float | int]] = {}
_mfa_store: dict[int, dict[str, float | int]] = {}
_pending_signup_store: dict[str, dict[str, str | float]] = {}
_password_reset_store: dict[str, dict[str, float | int]] = {}
_mfa_preferences: dict[int, bool] = {}
_admin_session_store: dict[str, dict[str, float | str]] = {}


def _prune_temp_store(store: dict, ttl_key: str = "expires_at") -> None:
    now = time.time()
    expired = [key for key, value in store.items() if float(value.get(ttl_key, 0)) <= now]
    for key in expired:
        store.pop(key, None)


def _extract_bearer_token(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Unauthorized")
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = parts[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return token


def _create_admin_session() -> dict[str, float | str]:
    token = secrets.token_urlsafe(32)
    expires_at = time.time() + settings.SESSION_TTL_SECONDS
    _admin_session_store[token] = {"email": settings.ADMIN_EMAIL.lower(), "expires_at": expires_at}
    return {"access_token": token, "token_type": "bearer", "expires_at": int(expires_at)}


def _validate_admin_session(token: str) -> bool:
    _prune_temp_store(_admin_session_store)
    session = _admin_session_store.get(token)
    return bool(session and str(session.get("email", "")).lower() == settings.ADMIN_EMAIL.lower())


def _require_admin(authorization: Optional[str]) -> dict[str, str]:
    token = _extract_bearer_token(authorization)
    if not _validate_admin_session(token):
        raise HTTPException(status_code=401, detail="Admin session expired or invalid")
    return {
        "token": token,
        "email": settings.ADMIN_EMAIL,
        "username": settings.ADMIN_USERNAME,
    }


def _require_authenticated_user(
    db: Session,
    authorization: Optional[str],
) -> User:
    token = _extract_bearer_token(authorization)
    user_id = session_service.validate(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    user = db.query(User).filter(User.user_id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if not bool(getattr(user, "is_active", True)):
        raise HTTPException(status_code=403, detail="Account is inactive")
    return user


def _safe_write_audit_log(
    db: Session,
    *,
    action: str,
    type: str,
    msg: str,
    user_id: Optional[int] = None,
    ip_address: Optional[str] = None,
) -> None:
    try:
        db.add(
            AuditLog(
                user_id=user_id,
                action=action,
                ip_address=ip_address,
                msg=msg,
                type=type,
            )
        )
        db.commit()
    except SQLAlchemyError:
        db.rollback()


def _normalize_user_role(role: Optional[str]) -> str:
    return role if role in {"admin", "staff", "user"} else "user"


def _normalize_review_status(status_value: Optional[str]) -> str:
    return status_value if status_value in {"pending", "approved", "rejected"} else "pending"


def _format_timestamp(value: Optional[datetime]) -> str:
    return value.isoformat() if value else ""


def _get_last_login_for_user(db: Session, user_id: int) -> Optional[datetime]:
    return (
        db.query(func.max(AuditLog.timestamp))
        .filter(AuditLog.user_id == user_id, AuditLog.action == "login")
        .scalar()
    )


def _serialize_admin_user(db: Session, user: User) -> dict:
    total_scans = db.query(ScanResult).filter(ScanResult.user_id == user.user_id).count()
    flagged_scans = db.query(ScanResult).filter(
        ScanResult.user_id == user.user_id,
        ScanResult.is_synthetic.is_(True),
    ).count()
    last_login = user.last_login or _get_last_login_for_user(db, user.user_id)
    return {
        "user_id": user.user_id,
        "username": user.username,
        "email": user.email,
        "role": _normalize_user_role(getattr(user, "role", "user")),
        "is_active": bool(getattr(user, "is_active", True)),
        "status": "active" if bool(getattr(user, "is_active", True)) else "inactive",
        "last_login": _format_timestamp(last_login),
        "total_scans": total_scans,
        "flagged_scans": flagged_scans,
        "created_at": _format_timestamp(getattr(user, "created_at", None)),
    }


def _serialize_admin_record(scan: ScanResult, username: Optional[str], email: Optional[str]) -> dict:
    return {
        "scan_id": scan.id,
        "user_id": scan.user_id,
        "username": username,
        "email": email,
        "filename": scan.filename,
        "media_type": scan.media_type,
        "confidence_score": round(float(scan.confidence_score), 1),
        "is_synthetic": bool(scan.is_synthetic),
        "review_status": _normalize_review_status(getattr(scan, "review_status", "pending")),
        "artifacts": scan.artifacts or [],
        "created_at": _format_timestamp(scan.created_at),
    }


def _serialize_admin_log(log: AuditLog, username: Optional[str], email: Optional[str]) -> dict:
    return {
        "log_id": log.log_id,
        "timestamp": _format_timestamp(log.timestamp),
        "action": log.action,
        "message": log.msg or log.action,
        "type": log.type if log.type in {"info", "success", "error"} else "info",
        "ip_address": log.ip_address,
        "user_id": log.user_id,
        "username": username,
        "email": email,
    }


def _build_csv_bytes(headers: list[str], rows: list[list[object]]) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(headers)
    writer.writerows(rows)
    return buffer.getvalue().encode("utf-8")


def _build_excel_bytes(title: str, headers: list[str], rows: list[list[object]]) -> bytes:
    thead = "".join(f"<th>{escape(str(header))}</th>" for header in headers)
    tbody_rows = []
    for row in rows:
        cells = "".join(f"<td>{escape(str(cell))}</td>" for cell in row)
        tbody_rows.append(f"<tr>{cells}</tr>")
    html = (
        "<html><head><meta charset='utf-8' /></head><body>"
        f"<h2>{escape(title)}</h2>"
        f"<table border='1'><thead><tr>{thead}</tr></thead><tbody>{''.join(tbody_rows)}</tbody></table>"
        "</body></html>"
    )
    return html.encode("utf-8")


def _pdf_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _build_simple_pdf(title: str, lines: list[str]) -> bytes:
    safe_title = _pdf_escape(title)
    safe_lines = [_pdf_escape(line[:110]) for line in lines]
    content_lines = ["BT", "/F1 18 Tf", "50 780 Td", f"({safe_title}) Tj", "/F1 11 Tf"]
    y = 756
    for line in safe_lines:
        content_lines.extend([f"50 {y} Td", f"({line}) Tj"])
        y -= 18
        if y < 70:
            break
    content_lines.append("ET")
    stream = "\n".join(content_lines).encode("latin-1", errors="replace")

    objects = [
        b"1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n",
        b"2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n",
        b"3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>endobj\n",
        b"4 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n",
        f"5 0 obj<< /Length {len(stream)} >>stream\n".encode("latin-1") + stream + b"\nendstream endobj\n",
    ]

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(len(pdf))
        pdf.extend(obj)
    xref_start = len(pdf)
    pdf.extend(f"xref\n0 {len(offsets)}\n".encode("latin-1"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("latin-1"))
    pdf.extend(
        (
            f"trailer<< /Size {len(offsets)} /Root 1 0 R >>\n"
            f"startxref\n{xref_start}\n%%EOF"
        ).encode("latin-1")
    )
    return bytes(pdf)


@router.post("/signup")
def signup(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    user_repo = UserRepository(db)
    auth = AuthService(user_repo)

    existing = user_repo.get_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    username = payload.username or payload.email.split("@")[0]

    try:
        auth.validate_password_policy(payload.password)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))

    code = f"{random.randint(0, 999999):06d}"
    hashed_password = auth.get_password_hash(payload.password)
    _prune_temp_store(_pending_signup_store)
    _pending_signup_store[payload.email.lower()] = {
        "email": payload.email,
        "username": username,
        "password_hash": hashed_password,
        "code": code,
        "expires_at": time.time() + _SIGNUP_OTP_TTL_SECONDS,
    }

    dev_code: Optional[str] = None
    message = "Activation code sent to your email."
    if email_service.is_configured():
        try:
            email_service.send_signup_otp(payload.email, code)
        except Exception:
            print(f"[FactGuard Signup OTP] SMTP failed; fallback to dev code. email={payload.email} code={code}")
            message = "Activation code generated. Check server logs in development mode."
            dev_code = code
    else:
        print(f"[FactGuard Signup OTP] email={payload.email} code={code}")
        message = "Activation code generated. Check server logs in development mode."
        dev_code = code

    return {
        "status": "pending_verification",
        "email": payload.email,
        "message": message,
        "dev_code": dev_code,
    }


@router.post("/signup/verify", response_model=schemas.UserOut)
def signup_verify(payload: schemas.SignupVerifyRequest, db: Session = Depends(get_db)):
    key = payload.email.lower()
    _prune_temp_store(_pending_signup_store)
    pending = _pending_signup_store.get(key)
    if not pending:
        raise HTTPException(status_code=400, detail="Invalid or expired activation code")
    if str(pending.get("code")) != payload.code:
        raise HTTPException(status_code=400, detail="Invalid or expired activation code")

    user_repo = UserRepository(db)
    if user_repo.get_by_email(payload.email):
        _pending_signup_store.pop(key, None)
        raise HTTPException(status_code=400, detail="User already exists")
    candidate_username = str(pending.get("username") or payload.email.split("@")[0])

    try:
        user = user_repo.create(
            email=str(pending.get("email") or payload.email),
            username=candidate_username,
            hashed_password=str(pending.get("password_hash") or ""),
        )
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Email already exists")
    _pending_signup_store.pop(key, None)
    return user


@router.post("/login")
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    user_repo = UserRepository(db)
    auth = AuthService(user_repo)
    email = payload.email.lower()

    if is_user_locked_out(email):
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={
                "detail": "Invalid credentials",
                "remaining_attempts": 0,
                "lockout_time": get_remaining_lockout_time(email),
                "is_locked": True,
            },
        )

    user = auth.authenticate(email, payload.password)
    if not user:
        record_failed_login(email)
        remaining = get_remaining_attempts(email)
        lockout = get_remaining_lockout_time(email)
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={
                "detail": "Invalid credentials",
                "remaining_attempts": remaining,
                "lockout_time": lockout,
                "is_locked": lockout > 0 and remaining == 0,
            },
        )

    if not bool(getattr(user, "is_active", True)):
        raise HTTPException(status_code=403, detail="This account is deactivated")

    reset_failed_login(email)
    if not _mfa_preferences.get(user.user_id, False):
        session = session_service.create(user.user_id)
        user.last_login = datetime.utcnow()
        db.commit()
        _safe_write_audit_log(
            db,
            user_id=user.user_id,
            action="login",
            type="success",
            msg="User authentication successful",
        )
        return {
            "status": "success",
            "user_id": user.user_id,
            "email": user.email,
            "username": user.username,
            **session,
        }

    _prune_temp_store(_mfa_store)
    code = f"{random.randint(0, 999999):06d}"
    _mfa_store[user.user_id] = {"code": code, "expires_at": time.time() + _MFA_TTL_SECONDS}

    dev_code: Optional[str] = None
    message = "MFA code sent to your email."
    if email_service.is_configured():
        try:
            email_service.send_mfa_code(user.email, code)
        except Exception:
            # Keep local development usable even if SMTP fails.
            print(f"[FactGuard MFA] SMTP failed; fallback to dev code. user_id={user.user_id} email={user.email} code={code}")
            message = "MFA code generated. Check server logs in development mode."
            dev_code = code
    else:
        print(f"[FactGuard MFA] user_id={user.user_id} email={user.email} code={code}")
        message = "MFA code generated. Check server logs in development mode."
        dev_code = code

    return {
        "status": "mfa_required",
        "user_id": user.user_id,
        "email": user.email,
        "message": message,
        "dev_code": dev_code,
    }


@router.post("/admin/login")
def admin_login(payload: schemas.AdminLogin, db: Session = Depends(get_db)):
    if payload.email.lower() != settings.ADMIN_EMAIL.lower() or payload.password != settings.ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")

    session = _create_admin_session()
    _safe_write_audit_log(
        db,
        action="admin_login",
        type="success",
        msg="Administrator authentication successful",
    )
    return {
        "status": "success",
        "role": "admin",
        "email": settings.ADMIN_EMAIL,
        "username": settings.ADMIN_USERNAME,
        **session,
    }


@router.get("/admin/session/validate")
def validate_admin_session(authorization: Optional[str] = Header(default=None)):
    _require_admin(authorization)
    return {
        "valid": True,
        "role": "admin",
        "email": settings.ADMIN_EMAIL,
        "username": settings.ADMIN_USERNAME,
    }


@router.post("/mfa/login")
def mfa_login(payload: dict = Body(...), db: Session = Depends(get_db)):
    user_id = payload.get("user_id")
    code = str(payload.get("code") or "").strip()
    if not user_id or not code:
        raise HTTPException(status_code=400, detail="user_id and code are required")

    _prune_temp_store(_mfa_store)
    record = _mfa_store.get(int(user_id))
    if not record or str(record.get("code")) != code:
        raise HTTPException(status_code=401, detail="Invalid or expired MFA code")

    user = db.query(User).filter(User.user_id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    _mfa_store.pop(int(user_id), None)
    user.last_login = datetime.utcnow()
    db.commit()
    session = session_service.create(user.user_id)
    return {
        "user_id": user.user_id,
        "email": user.email,
        "username": user.username,
        **session,
    }


@router.post("/captcha/generate")
def captcha_generate():
    _prune_temp_store(_captcha_store)
    # Easy mode: always 2-digit + 1-digit arithmetic.
    a = random.randint(10, 99)
    b = random.randint(1, 9)
    op = "+"
    answer = a + b
    session_id = str(uuid.uuid4())
    _captcha_store[session_id] = {"answer": answer, "expires_at": time.time() + _CAPTCHA_TTL_SECONDS}
    return {"session_id": session_id, "captcha": f"{a} {op} {b}"}


@router.post("/captcha/verify")
def captcha_verify(payload: dict = Body(...)):
    session_id = str(payload.get("session_id") or "").strip()
    answer = payload.get("answer")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    _prune_temp_store(_captcha_store)
    record = _captcha_store.get(session_id)
    if not record:
        raise HTTPException(status_code=400, detail="Captcha session expired")

    try:
        provided = int(answer)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid captcha answer")

    if int(record["answer"]) != provided:
        raise HTTPException(status_code=400, detail="Incorrect captcha answer")

    _captcha_store.pop(session_id, None)
    return {"verified": True}


@router.post("/forgot-password")
def forgot_password(payload: dict = Body(...), db: Session = Depends(get_db)):
    email = str(payload.get("email") or "").strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    user_repo = UserRepository(db)
    user = user_repo.get_by_email(email.lower())

    if not user:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"status": "not_found", "message": "No account found for this email address."},
        )

    token = secrets.token_urlsafe(32)
    _prune_temp_store(_password_reset_store)
    _password_reset_store[token] = {
        "user_id": int(user.user_id),
        "expires_at": time.time() + _PASSWORD_RESET_TTL_SECONDS,
    }
    reset_link = f"{settings.FRONTEND_URL}?mode=reset&token={quote(token)}"
    if email_service.is_configured():
        try:
            email_service.send_reset_link(user.email, reset_link)
        except Exception:
            print(f"[FactGuard Reset Link] SMTP send failed for email={user.email} link={reset_link}")
    else:
        print(f"[FactGuard Reset Link] email={user.email} link={reset_link}")

    return {"status": "success", "message": "Reset instructions have been sent."}


@router.post("/reset-password/confirm")
def reset_password_confirm(payload: schemas.PasswordResetConfirmRequest, db: Session = Depends(get_db)):
    _prune_temp_store(_password_reset_store)
    token_data = _password_reset_store.get(payload.token)
    if not token_data:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user_id = int(token_data["user_id"])
    user_repo = UserRepository(db)
    auth = AuthService(user_repo)
    try:
        auth.validate_password_policy(payload.new_password)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))

    updated = user_repo.update_password(user_id=user_id, hashed_password=auth.get_password_hash(payload.new_password))
    _password_reset_store.pop(payload.token, None)
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "success", "message": "Password updated successfully"}


@router.post("/logout")
def logout(db: Session = Depends(get_db), authorization: Optional[str] = Header(default=None)):
    token = _extract_bearer_token(authorization)
    if _validate_admin_session(token):
        _admin_session_store.pop(token, None)
        _safe_write_audit_log(
            db,
            action="admin_logout",
            type="info",
            msg="Administrator signed out",
        )
        return {"status": "success"}

    user_id = session_service.validate(token)
    session_service.delete(token)
    if user_id:
        _safe_write_audit_log(
            db,
            user_id=int(user_id),
            action="logout",
            type="info",
            msg="User signed out",
        )
    return {"status": "success"}


@router.get("/session/validate")
def validate_session(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    user = _require_authenticated_user(db, authorization)
    return {
        "valid": True,
        "user_id": user.user_id,
        "email": user.email,
        "username": user.username,
    }


@router.get("/me/settings")
def me_settings(db: Session = Depends(get_db), authorization: Optional[str] = Header(default=None)):
    user = _require_authenticated_user(db, authorization)
    return {
        "user_id": user.user_id,
        "email": user.email,
        "username": user.username,
        "mfa_enabled": bool(_mfa_preferences.get(user.user_id, False)),
    }


@router.patch("/me/mfa")
def update_mfa_settings(
    payload: schemas.MfaSettingsUpdateRequest,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    user = _require_authenticated_user(db, authorization)
    _mfa_preferences[user.user_id] = bool(payload.enabled)
    return {"status": "success", "mfa_enabled": bool(payload.enabled)}


@router.patch("/me/profile")
def update_profile(
    payload: schemas.ProfileUpdateRequest,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    user = _require_authenticated_user(db, authorization)
    username = payload.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    user.username = username
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Username already exists")
    db.refresh(user)
    return {"status": "success", "username": user.username}


@router.post("/me/change-password")
def change_password(
    payload: schemas.ChangePasswordRequest,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    user = _require_authenticated_user(db, authorization)
    user_repo = UserRepository(db)
    auth = AuthService(user_repo)
    if not auth.verify_password(payload.current_password, user.password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    try:
        auth.validate_password_policy(payload.new_password)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password")

    user.password = auth.get_password_hash(payload.new_password)
    db.commit()
    return {"status": "success", "message": "Password updated successfully"}


@router.post("/detect-ai-text")
def detect_ai_text(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    current_user = _require_authenticated_user(db, authorization)
    text_content = (payload.get("text") or "").strip()
    if not text_content:
        raise HTTPException(status_code=400, detail="No text provided")

    result = text_detector.analyze(text_content)
    if result is None:
        raise HTTPException(status_code=400, detail="Unable to analyze empty text")

    db_id = None
    resolved_user_id = current_user.user_id
    if resolved_user_id is not None:
        try:
            row = ScanResult(
                user_id=resolved_user_id,
                filename="text_analysis",
                media_type="text",
                confidence_score=float(result.get("confidence", 0)),
                is_synthetic=bool(result.get("is_synthetic", False)),
                artifacts=result.get("artifacts", []),
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            db_id = row.id
            _safe_write_audit_log(
                db,
                user_id=resolved_user_id,
                action="scan_text",
                type="success",
                msg=f"AI text analysis completed for text_analysis ({round(float(result.get('confidence', 0)), 1)}%)",
            )
        except SQLAlchemyError:
            db.rollback()

    return {"status": "success", "result": result, "db_id": db_id}


@router.post("/detect-deepfake-image")
async def detect_deepfake_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    current_user = _require_authenticated_user(db, authorization)
    data = await file.read()
    result = deepfake_service.analyze(data)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    db_id = None
    resolved_user_id = current_user.user_id
    if resolved_user_id is not None:
        try:
            row = ScanResult(
                user_id=resolved_user_id,
                filename=file.filename or "image_scan",
                media_type="image",
                confidence_score=float(result.get("confidence", 0)),
                is_synthetic=bool(result.get("is_synthetic", False)),
                artifacts=result.get("artifacts", []),
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            db_id = row.id
            _safe_write_audit_log(
                db,
                user_id=resolved_user_id,
                action="scan_media",
                type="success",
                msg=f"Media analysis completed for {file.filename or 'image_scan'} ({round(float(result.get('confidence', 0)), 1)}%)",
            )
        except SQLAlchemyError:
            db.rollback()

    return {"status": "success", "result": result, "db_id": db_id}


@router.post("/plagiarism/scan")
def scan_plagiarism(
    payload: schemas.PlagiarismScanRequest,
    request: Request,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    current_user = _require_authenticated_user(db, authorization)
    limiter_key = f"{current_user.user_id}:{request.client.host if request.client else 'unknown'}"
    if is_plagiarism_scan_limited(limiter_key):
        retry_after = get_plagiarism_scan_retry_after(limiter_key)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"message": "Too many plagiarism scans. Please wait.", "retry_after_seconds": retry_after},
        )
    record_plagiarism_scan_attempt(limiter_key)

    settings_payload = PlagiarismSettings(
        max_chunks=payload.maxChunks if payload.maxChunks is not None else (payload.maxQueries or 6),
        top_k_results_per_chunk=payload.topK if payload.topK is not None else (payload.topKResultsPerQuery or 3),
        num_results=payload.num,
        gl=payload.gl,
        hl=payload.hl or payload.language,
        near_match=payload.nearMatch,
        near_match_threshold=payload.nearMatchThreshold,
        ignore_domains=payload.ignoreDomains,
    )
    report = plagiarism_service.run(payload.inputText, settings_payload)

    scan_id = None
    resolved_user_id = current_user.user_id
    if resolved_user_id is not None:
        try:
            row = ScanResult(
                user_id=resolved_user_id,
                filename="plagiarism_scan",
                media_type="text",
                confidence_score=float(report["overallScore"]),
                is_synthetic=bool(report["overallScore"] >= 40),
                artifacts=[
                    f"Source: {src.get('url')} (score={src.get('strongestEvidenceScore')})"
                    for src in report.get("topSources", [])[:6]
                ],
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            scan_id = row.id
            _safe_write_audit_log(
                db,
                user_id=resolved_user_id,
                action="scan_plagiarism",
                type="success",
                msg=f"Plagiarism scan completed ({round(float(report.get('overallScore', 0)), 1)}% similarity)",
            )
        except SQLAlchemyError as err:
            db.rollback()
            report.setdefault("notes", []).append(f"Scan result was not saved to DB: {err.__class__.__name__}")
    else:
        report.setdefault("notes", []).append("Scan result was not saved to DB: no user exists yet.")

    return {"status": "success", "scan_id": scan_id, **report}


@router.get("/audit-logs")
def get_audit_logs(db: Session = Depends(get_db), authorization: Optional[str] = Header(default=None)):
    current_user = _require_authenticated_user(db, authorization)

    audit_rows = (
        db.query(AuditLog)
        .filter(AuditLog.user_id == current_user.user_id)
        .order_by(AuditLog.timestamp.desc())
        .limit(50)
        .all()
    )
    scan_rows = (
        db.query(ScanResult)
        .filter(ScanResult.user_id == current_user.user_id)
        .order_by(ScanResult.created_at.desc())
        .limit(20)
        .all()
    )

    events = [
        {
            "timestamp": row.timestamp.isoformat() if row.timestamp else "",
            "time": row.timestamp.strftime("%Y-%m-%d %H:%M:%S") if row.timestamp else "",
            "msg": row.msg or row.action,
            "type": row.type if row.type in {"info", "success", "error"} else "info",
            "category": "download" if "report" in (row.msg or "").lower() else "auth" if row.action in {"login", "logout"} else "analysis",
        }
        for row in audit_rows
    ]

    if not audit_rows:
        events.extend(
            {
                "timestamp": row.created_at.isoformat() if row.created_at else "",
                "time": row.created_at.strftime("%Y-%m-%d %H:%M:%S") if row.created_at else "",
                "msg": f"Analysis completed for {row.filename}",
                "type": "success",
                "category": "analysis",
            }
            for row in scan_rows
        )

    events.sort(key=lambda item: item["timestamp"], reverse=True)
    return events[:50]


@router.get("/analytics")
def get_analytics(db: Session = Depends(get_db), authorization: Optional[str] = Header(default=None)):
    current_user = _require_authenticated_user(db, authorization)
    q = db.query(ScanResult)
    q = q.filter(ScanResult.user_id == current_user.user_id)

    total_scans = q.count()
    threats_detected = q.filter(ScanResult.is_synthetic.is_(True)).count()
    detection_rate = (threats_detected / total_scans * 100) if total_scans > 0 else 0.0
    avg_confidence = q.with_entities(func.avg(ScanResult.confidence_score)).scalar() or 0.0
    recent_scans = q.order_by(ScanResult.created_at.desc()).limit(4).all()

    weekly_data = []
    weekly_labels = []
    weekly_media_data = []
    weekly_text_data = []
    weekly_plagiarism_data = []
    weekly_text_analysis_data = []
    weekly_ai_data = []
    now = datetime.now()
    for i in range(6, -1, -1):
        dt = now - timedelta(days=i)
        day_filter = [func.DATE(ScanResult.created_at) == func.DATE(dt)]
        day_filter.append(ScanResult.user_id == current_user.user_id)
        day_total = db.query(ScanResult).filter(*day_filter).count()
        day_plagiarism = db.query(ScanResult).filter(*day_filter, ScanResult.filename == "plagiarism_scan").count()
        day_text_analysis = db.query(ScanResult).filter(*day_filter, ScanResult.filename == "text_analysis").count()
        day_ai = db.query(ScanResult).filter(
            *day_filter,
            and_(ScanResult.filename != "plagiarism_scan", ScanResult.filename != "text_analysis"),
        ).count()

        weekly_data.append(day_total)
        weekly_labels.append(dt.strftime("%a"))
        weekly_media_data.append(db.query(ScanResult).filter(*day_filter, ScanResult.media_type != "text").count())
        weekly_text_data.append(db.query(ScanResult).filter(*day_filter, ScanResult.media_type == "text").count())
        weekly_plagiarism_data.append(day_plagiarism)
        weekly_text_analysis_data.append(day_text_analysis)
        weekly_ai_data.append(day_ai)

    monthly_data = []
    monthly_labels = []
    monthly_plagiarism_data = []
    monthly_text_analysis_data = []
    monthly_ai_data = []
    current_month_index = now.year * 12 + (now.month - 1)
    for i in range(11, -1, -1):
        month_index = current_month_index - i
        year = month_index // 12
        month = (month_index % 12) + 1
        month_start = datetime(year, month, 1)
        if month == 12:
            next_month_start = datetime(year + 1, 1, 1)
        else:
            next_month_start = datetime(year, month + 1, 1)

        month_filter = [
            ScanResult.created_at >= month_start,
            ScanResult.created_at < next_month_start,
            ScanResult.user_id == current_user.user_id,
        ]
        month_total = db.query(ScanResult).filter(*month_filter).count()
        month_plagiarism = db.query(ScanResult).filter(*month_filter, ScanResult.filename == "plagiarism_scan").count()
        month_text_analysis = db.query(ScanResult).filter(*month_filter, ScanResult.filename == "text_analysis").count()
        month_ai = db.query(ScanResult).filter(
            *month_filter,
            and_(ScanResult.filename != "plagiarism_scan", ScanResult.filename != "text_analysis"),
        ).count()

        monthly_data.append(month_total)
        monthly_labels.append(month_start.strftime("%b"))
        monthly_plagiarism_data.append(month_plagiarism)
        monthly_text_analysis_data.append(month_text_analysis)
        monthly_ai_data.append(month_ai)

    return {
        "total_scans": total_scans,
        "threats_detected": threats_detected,
        "detection_rate": round(detection_rate, 1),
        "avg_confidence": round(float(avg_confidence), 1),
        "quick_history": [
            {"name": s.filename, "status": "Synthetic" if s.is_synthetic else "Authentic", "score": f"{int(s.confidence_score)}%"}
            for s in recent_scans
        ],
        "weekly_data": weekly_data,
        "weekly_labels": weekly_labels,
        "weekly_plagiarism_data": weekly_plagiarism_data,
        "weekly_text_data": weekly_text_analysis_data,
        "weekly_ai_data": weekly_ai_data,
        "monthly_data": monthly_data,
        "monthly_labels": monthly_labels,
        "monthly_plagiarism_data": monthly_plagiarism_data,
        "monthly_text_data": monthly_text_analysis_data,
        "monthly_ai_data": monthly_ai_data,
        "weekly_media_data": weekly_media_data,
        "weekly_text_media_data": weekly_text_data,
    }


@router.get("/daily-reports")
def daily_reports(db: Session = Depends(get_db), authorization: Optional[str] = Header(default=None)):
    current_user = _require_authenticated_user(db, authorization)
    today = datetime.now().date()
    base = [func.DATE(ScanResult.created_at) == today]
    base.append(ScanResult.user_id == current_user.user_id)
    synthetic_count = db.query(ScanResult).filter(*base, ScanResult.is_synthetic.is_(True)).count()
    authentic_count = db.query(ScanResult).filter(*base, ScanResult.is_synthetic.is_(False)).count()
    synthetic_avg = db.query(func.avg(ScanResult.confidence_score)).filter(*base, ScanResult.is_synthetic.is_(True)).scalar() or 0
    return {
        "synthetic_count": synthetic_count,
        "authentic_count": authentic_count,
        "total_scans": synthetic_count + authentic_count,
        "synthetic_avg_confidence": round(float(synthetic_avg), 1),
        "report_date": str(today),
    }


@router.get("/reports/download")
def download_report(
    report_type: str,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    current_user = _require_authenticated_user(db, authorization)
    today = datetime.now().date()
    base_filters = [func.DATE(ScanResult.created_at) == today, ScanResult.user_id == current_user.user_id]

    synthetic_count = db.query(ScanResult).filter(*base_filters, ScanResult.is_synthetic.is_(True)).count()
    authentic_count = db.query(ScanResult).filter(*base_filters, ScanResult.is_synthetic.is_(False)).count()
    total_scans = synthetic_count + authentic_count
    synthetic_avg = db.query(func.avg(ScanResult.confidence_score)).filter(
        *base_filters,
        ScanResult.is_synthetic.is_(True),
    ).scalar() or 0

    normalized_type = report_type.lower().strip()
    if normalized_type not in {"synthetic", "authentic"}:
        raise HTTPException(status_code=400, detail="Invalid report type")

    title = f"FactGuard {normalized_type.title()} Report"
    lines = [
        f"Date: {today.isoformat()}",
        f"Generated for: {current_user.username or current_user.email}",
        f"Total scans today: {total_scans}",
        f"Synthetic findings: {synthetic_count}",
        f"Authentic findings: {authentic_count}",
        f"Average synthetic confidence: {round(float(synthetic_avg), 1)}%",
    ]
    if normalized_type == "synthetic":
        lines.append("Scope: flagged synthetic or manipulated content.")
    else:
        lines.append("Scope: scans assessed as authentic content.")

    pdf_bytes = _build_simple_pdf(title, lines)
    _safe_write_audit_log(
        db,
        user_id=current_user.user_id,
        action="download_report",
        type="info",
        msg=f"{normalized_type.title()} PDF report generated",
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="factguard_{normalized_type}_report.pdf"'},
    )


@router.get("/admin/overview")
def admin_overview(db: Session = Depends(get_db), authorization: Optional[str] = Header(default=None)):
    _require_admin(authorization)

    total_users = db.query(User).count()
    total_records = db.query(ScanResult).count()
    pending_requests = db.query(ScanResult).filter(ScanResult.review_status == "pending").count()
    approved_requests = db.query(ScanResult).filter(ScanResult.review_status == "approved").count()
    rejected_requests = db.query(ScanResult).filter(ScanResult.review_status == "rejected").count()
    recent_users = db.query(User).order_by(User.user_id.desc()).limit(5).all()
    recent_records = (
        db.query(ScanResult, User.username, User.email)
        .join(User, User.user_id == ScanResult.user_id)
        .order_by(ScanResult.created_at.desc())
        .limit(6)
        .all()
    )
    recent_logs = (
        db.query(AuditLog, User.username, User.email)
        .outerjoin(User, User.user_id == AuditLog.user_id)
        .order_by(AuditLog.timestamp.desc())
        .limit(8)
        .all()
    )

    now = datetime.utcnow()
    usage_labels: list[str] = []
    usage_counts: list[int] = []
    status_breakdown = {
        "pending": pending_requests,
        "approved": approved_requests,
        "rejected": rejected_requests,
    }
    role_breakdown = {"admin": 0, "staff": 0, "user": 0}
    for user in db.query(User).all():
        role_breakdown[_normalize_user_role(getattr(user, "role", "user"))] += 1

    for offset in range(6, -1, -1):
        day_start = datetime(now.year, now.month, now.day) - timedelta(days=offset)
        day_end = day_start + timedelta(days=1)
        usage_labels.append(day_start.strftime("%b %d"))
        usage_counts.append(
            db.query(ScanResult)
            .filter(and_(ScanResult.created_at >= day_start, ScanResult.created_at < day_end))
            .count()
        )

    return {
        "total_users": total_users,
        "total_records": total_records,
        "pending_requests": pending_requests,
        "approved_requests": approved_requests,
        "rejected_requests": rejected_requests,
        "recent_users": [_serialize_admin_user(db, user) for user in recent_users],
        "recent_records": [
            _serialize_admin_record(scan, username, email)
            for scan, username, email in recent_records
        ],
        "recent_activity": [
            _serialize_admin_log(log, username, email)
            for log, username, email in recent_logs
        ],
        "analytics": {
            "usage_labels": usage_labels,
            "usage_counts": usage_counts,
            "status_breakdown": status_breakdown,
            "role_breakdown": role_breakdown,
        },
    }


@router.get("/admin/users")
def admin_list_users(db: Session = Depends(get_db), authorization: Optional[str] = Header(default=None)):
    _require_admin(authorization)
    users = db.query(User).order_by(User.user_id.asc()).all()
    return [_serialize_admin_user(db, user) for user in users]


@router.post("/admin/users")
def admin_create_user(
    payload: schemas.AdminUserCreateRequest,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    admin = _require_admin(authorization)
    user_repo = UserRepository(db)
    auth = AuthService(user_repo)
    if user_repo.get_by_email(payload.email.lower()):
        raise HTTPException(status_code=400, detail="Email already exists")
    try:
        auth.validate_password_policy(payload.password)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))

    user = user_repo.create(
        email=payload.email.lower(),
        username=payload.username.strip(),
        hashed_password=auth.get_password_hash(payload.password),
    )
    user.role = _normalize_user_role(payload.role)
    user.is_active = bool(payload.is_active)
    db.commit()
    db.refresh(user)
    _safe_write_audit_log(
        db,
        action="admin_create_user",
        type="success",
        msg=f"Administrator created user {user.email}",
        ip_address=admin["email"],
    )
    return _serialize_admin_user(db, user)


@router.patch("/admin/users/{user_id}")
def admin_update_user(
    user_id: int,
    payload: schemas.AdminUserUpdateRequest,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    admin = _require_admin(authorization)
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_repo = UserRepository(db)
    auth = AuthService(user_repo)

    if payload.email is not None:
        normalized_email = str(payload.email).lower()
        existing = user_repo.get_by_email(normalized_email)
        if existing and existing.user_id != user_id:
            raise HTTPException(status_code=400, detail="Email already exists")
        user.email = normalized_email
    if payload.username is not None:
        user.username = payload.username.strip()
    if payload.password is not None:
        try:
            auth.validate_password_policy(payload.password)
        except ValueError as err:
            raise HTTPException(status_code=400, detail=str(err))
        user.password = auth.get_password_hash(payload.password)
    if payload.role is not None:
        user.role = _normalize_user_role(payload.role)
    if payload.is_active is not None:
        user.is_active = bool(payload.is_active)

    db.commit()
    db.refresh(user)
    _safe_write_audit_log(
        db,
        action="admin_update_user",
        type="info",
        msg=f"Administrator updated user {user.email}",
        ip_address=admin["email"],
    )
    return _serialize_admin_user(db, user)


@router.delete("/admin/users/{user_id}")
def admin_delete_user(user_id: int, db: Session = Depends(get_db), authorization: Optional[str] = Header(default=None)):
    admin = _require_admin(authorization)
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.query(ScanResult).filter(ScanResult.user_id == user_id).delete()
    db.query(AuditLog).filter(AuditLog.user_id == user_id).delete()
    db.delete(user)
    db.commit()
    _safe_write_audit_log(
        db,
        action="admin_delete_user",
        type="error",
        msg=f"Administrator deleted user {user.email}",
        ip_address=admin["email"],
    )
    return {"status": "success"}


@router.get("/admin/scans")
def admin_list_scans(db: Session = Depends(get_db), authorization: Optional[str] = Header(default=None)):
    _require_admin(authorization)
    rows = (
        db.query(ScanResult, User.username, User.email)
        .join(User, User.user_id == ScanResult.user_id)
        .order_by(ScanResult.created_at.desc())
        .limit(200)
        .all()
    )
    return [_serialize_admin_record(scan, username, email) for scan, username, email in rows]


@router.post("/admin/records")
def admin_create_record(
    payload: schemas.AdminRecordCreateRequest,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    admin = _require_admin(authorization)
    user = db.query(User).filter(User.user_id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    record = ScanResult(
        user_id=payload.user_id,
        filename=payload.filename.strip(),
        media_type=payload.media_type,
        confidence_score=float(payload.confidence_score),
        is_synthetic=bool(payload.is_synthetic),
        review_status=_normalize_review_status(payload.review_status),
        artifacts=[item.strip() for item in payload.artifacts if str(item).strip()],
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    _safe_write_audit_log(
        db,
        action="admin_create_record",
        type="success",
        msg=f"Administrator created record {record.filename}",
        ip_address=admin["email"],
    )
    return _serialize_admin_record(record, user.username, user.email)


@router.patch("/admin/records/{record_id}")
def admin_update_record(
    record_id: int,
    payload: schemas.AdminRecordUpdateRequest,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    admin = _require_admin(authorization)
    record = db.query(ScanResult).filter(ScanResult.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    if payload.user_id is not None:
        user = db.query(User).filter(User.user_id == payload.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        record.user_id = payload.user_id
    if payload.filename is not None:
        record.filename = payload.filename.strip()
    if payload.media_type is not None:
        record.media_type = payload.media_type
    if payload.confidence_score is not None:
        record.confidence_score = float(payload.confidence_score)
    if payload.is_synthetic is not None:
        record.is_synthetic = bool(payload.is_synthetic)
    if payload.review_status is not None:
        record.review_status = _normalize_review_status(payload.review_status)
    if payload.artifacts is not None:
        record.artifacts = [item.strip() for item in payload.artifacts if str(item).strip()]

    db.commit()
    db.refresh(record)
    user = db.query(User).filter(User.user_id == record.user_id).first()
    _safe_write_audit_log(
        db,
        action="admin_update_record",
        type="info",
        msg=f"Administrator updated record {record.filename}",
        ip_address=admin["email"],
    )
    return _serialize_admin_record(record, user.username if user else None, user.email if user else None)


@router.delete("/admin/records/{record_id}")
def admin_delete_record(record_id: int, db: Session = Depends(get_db), authorization: Optional[str] = Header(default=None)):
    admin = _require_admin(authorization)
    record = db.query(ScanResult).filter(ScanResult.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    filename = record.filename
    db.delete(record)
    db.commit()
    _safe_write_audit_log(
        db,
        action="admin_delete_record",
        type="error",
        msg=f"Administrator deleted record {filename}",
        ip_address=admin["email"],
    )
    return {"status": "success"}


@router.get("/admin/records/export")
def admin_export_records(
    export_format: str,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    _require_admin(authorization)
    rows = (
        db.query(ScanResult, User.username, User.email)
        .join(User, User.user_id == ScanResult.user_id)
        .order_by(ScanResult.created_at.desc())
        .all()
    )
    records = [_serialize_admin_record(scan, username, email) for scan, username, email in rows]
    headers = ["Record ID", "User", "Email", "Filename", "Type", "Confidence", "Classification", "Review Status", "Created At"]
    data_rows = [
        [
            item["scan_id"],
            item["username"] or "",
            item["email"] or "",
            item["filename"],
            item["media_type"],
            item["confidence_score"],
            "Synthetic" if item["is_synthetic"] else "Authentic",
            item["review_status"],
            item["created_at"],
        ]
        for item in records
    ]
    normalized = export_format.lower().strip()
    if normalized == "csv":
        content = _build_csv_bytes(headers, data_rows)
        media_type = "text/csv; charset=utf-8"
        extension = "csv"
    elif normalized == "excel":
        content = _build_excel_bytes("FactGuard Records Export", headers, data_rows)
        media_type = "application/vnd.ms-excel"
        extension = "xls"
    elif normalized == "pdf":
        pdf_lines = [", ".join(str(value) for value in row[:5]) for row in data_rows[:28]]
        content = _build_simple_pdf("FactGuard Records Export", pdf_lines or ["No records available"])
        media_type = "application/pdf"
        extension = "pdf"
    else:
        raise HTTPException(status_code=400, detail="Invalid export format")

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="factguard_records.{extension}"'},
    )


@router.get("/admin/logs")
def admin_list_logs(db: Session = Depends(get_db), authorization: Optional[str] = Header(default=None)):
    _require_admin(authorization)
    rows = (
        db.query(AuditLog, User.username, User.email)
        .outerjoin(User, User.user_id == AuditLog.user_id)
        .order_by(AuditLog.timestamp.desc())
        .limit(250)
        .all()
    )
    return [_serialize_admin_log(log, username, email) for log, username, email in rows]


@router.get("/admin/reports")
def admin_reports(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    _require_admin(authorization)
    query = db.query(ScanResult, User.username, User.email).join(User, User.user_id == ScanResult.user_id)
    start_dt: Optional[datetime] = None
    end_dt: Optional[datetime] = None
    if date_from:
        start_dt = datetime.strptime(date_from, "%Y-%m-%d")
        query = query.filter(ScanResult.created_at >= start_dt)
    if date_to:
        end_dt = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
        query = query.filter(ScanResult.created_at < end_dt)

    rows = query.order_by(ScanResult.created_at.desc()).all()
    records = [_serialize_admin_record(scan, username, email) for scan, username, email in rows]
    total_records = len(records)
    pending = sum(1 for item in records if item["review_status"] == "pending")
    approved = sum(1 for item in records if item["review_status"] == "approved")
    rejected = sum(1 for item in records if item["review_status"] == "rejected")
    synthetic = sum(1 for item in records if item["is_synthetic"])
    authentic = total_records - synthetic
    avg_confidence = round(
        sum(float(item["confidence_score"]) for item in records) / total_records,
        1,
    ) if total_records else 0.0

    return {
        "date_from": date_from,
        "date_to": date_to,
        "total_records": total_records,
        "pending_requests": pending,
        "approved_requests": approved,
        "rejected_requests": rejected,
        "synthetic_records": synthetic,
        "authentic_records": authentic,
        "average_confidence": avg_confidence,
        "records": records[:50],
    }


@router.get("/admin/reports/download")
def admin_download_report(
    export_format: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    _require_admin(authorization)
    report = admin_reports(date_from=date_from, date_to=date_to, db=db, authorization=authorization)
    headers = ["Metric", "Value"]
    rows = [
        ["Date From", report["date_from"] or "N/A"],
        ["Date To", report["date_to"] or "N/A"],
        ["Total Records", report["total_records"]],
        ["Pending Requests", report["pending_requests"]],
        ["Approved Requests", report["approved_requests"]],
        ["Rejected Requests", report["rejected_requests"]],
        ["Synthetic Records", report["synthetic_records"]],
        ["Authentic Records", report["authentic_records"]],
        ["Average Confidence", report["average_confidence"]],
    ]
    normalized = export_format.lower().strip()
    if normalized == "csv":
        content = _build_csv_bytes(headers, rows)
        media_type = "text/csv; charset=utf-8"
        extension = "csv"
    elif normalized == "excel":
        content = _build_excel_bytes("FactGuard Report Summary", headers, rows)
        media_type = "application/vnd.ms-excel"
        extension = "xls"
    elif normalized == "pdf":
        pdf_lines = [f"{label}: {value}" for label, value in rows]
        content = _build_simple_pdf("FactGuard Report Summary", pdf_lines)
        media_type = "application/pdf"
        extension = "pdf"
    else:
        raise HTTPException(status_code=400, detail="Invalid export format")

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="factguard_report.{extension}"'},
    )


def _resolve_user_id(db: Session, requested_user_id: Optional[int]) -> Optional[int]:
    if requested_user_id is not None:
        existing = db.query(User).filter(User.user_id == requested_user_id).first()
        if existing:
            return requested_user_id
    first_user = db.query(User.user_id).order_by(User.user_id.asc()).first()
    return first_user[0] if first_user else None
