from datetime import datetime, timedelta
import random
import secrets
import time
import uuid
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Body, Depends, File, Header, HTTPException, Request, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy import and_, func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from .. import schemas
from ..config import settings
from ..db import get_db
from ..models import ScanResult, User
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
    return user


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

    reset_failed_login(email)
    if not _mfa_preferences.get(user.user_id, False):
        session = session_service.create(user.user_id)
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
def logout(authorization: Optional[str] = Header(default=None)):
    token = _extract_bearer_token(authorization)
    session_service.delete(token)
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
        except SQLAlchemyError as err:
            db.rollback()
            report.setdefault("notes", []).append(f"Scan result was not saved to DB: {err.__class__.__name__}")
    else:
        report.setdefault("notes", []).append("Scan result was not saved to DB: no user exists yet.")

    return {"status": "success", "scan_id": scan_id, **report}


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


def _resolve_user_id(db: Session, requested_user_id: Optional[int]) -> Optional[int]:
    if requested_user_id is not None:
        existing = db.query(User).filter(User.user_id == requested_user_id).first()
        if existing:
            return requested_user_id
    first_user = db.query(User.user_id).order_by(User.user_id.asc()).first()
    return first_user[0] if first_user else None
