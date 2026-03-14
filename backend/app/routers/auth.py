import random
import secrets
import uuid
from datetime import datetime
from typing import Any, Optional
from urllib.parse import quote

from fastapi import APIRouter, Body, Depends, Header, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import schemas
from ..config import settings
from ..db import get_db
from ..models import User
from ..repositories import UserRepository
from ..utils.rate_limiter import (
    get_remaining_attempts,
    get_remaining_lockout_time,
    is_user_locked_out,
    record_failed_login,
    reset_failed_login,
)
from .common import (
    create_admin_session,
    email_service,
    extract_bearer_token,
    require_admin,
    safe_write_audit_log,
    session_service,
    temp_secret_service,
    validate_admin_session,
)
from .routers import AuthService

router = APIRouter()

CAPTCHA_TTL_SECONDS = 5 * 60
MFA_TTL_SECONDS = 5 * 60
SIGNUP_OTP_TTL_SECONDS = settings.SIGNUP_OTP_TTL_SECONDS
PASSWORD_RESET_TTL_SECONDS = settings.PASSWORD_RESET_TTL_SECONDS


def _json_payload_field(payload: Any, key: str) -> str:
    if not isinstance(payload, dict):
        return ""
    return str(payload.get(key) or "").strip()


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
    temp_secret_service.set(
        db,
        secret_type="signup_otp",
        secret_key=payload.email.lower(),
        ttl_seconds=SIGNUP_OTP_TTL_SECONDS,
        email=payload.email.lower(),
        payload={
            "email": payload.email,
            "username": username,
            "password_hash": hashed_password,
            "code": code,
        },
    )

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
    pending = temp_secret_service.get(db, secret_key=key, secret_type="signup_otp")
    if not pending:
        raise HTTPException(status_code=400, detail="Invalid or expired activation code")
    pending_payload = pending.payload or {}
    if str(pending_payload.get("code")) != payload.code:
        raise HTTPException(status_code=400, detail="Invalid or expired activation code")

    user_repo = UserRepository(db)
    if user_repo.get_by_email(payload.email):
        temp_secret_service.delete(db, secret_key=key, secret_type="signup_otp")
        raise HTTPException(status_code=400, detail="User already exists")
    candidate_username = str(pending_payload.get("username") or payload.email.split("@")[0])

    try:
        user = user_repo.create(
            email=str(pending_payload.get("email") or payload.email),
            username=candidate_username,
            hashed_password=str(pending_payload.get("password_hash") or ""),
        )
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Email already exists")

    temp_secret_service.delete(db, secret_key=key, secret_type="signup_otp")
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
    if not bool(getattr(user, "mfa_enabled", False)):
        session = session_service.create(db, subject_type="user", user_id=user.user_id, email=user.email)
        user.last_login = datetime.utcnow()
        db.commit()
        safe_write_audit_log(
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

    code = f"{random.randint(0, 999999):06d}"
    temp_secret_service.set(
        db,
        secret_type="mfa_code",
        secret_key=str(user.user_id),
        ttl_seconds=MFA_TTL_SECONDS,
        user_id=user.user_id,
        email=user.email.lower(),
        payload={"code": code},
    )

    dev_code: Optional[str] = None
    message = "MFA code sent to your email."
    if email_service.is_configured():
        try:
            email_service.send_mfa_code(user.email, code)
        except Exception:
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

    session = create_admin_session(db)
    safe_write_audit_log(
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
def validate_admin_session_endpoint(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    require_admin(db, authorization)
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

    record = temp_secret_service.get(db, secret_key=str(int(user_id)), secret_type="mfa_code")
    if not record or str((record.payload or {}).get("code")) != code:
        raise HTTPException(status_code=401, detail="Invalid or expired MFA code")

    user = db.query(User).filter(User.user_id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    temp_secret_service.delete(db, secret_key=str(int(user_id)), secret_type="mfa_code")
    user.last_login = datetime.utcnow()
    db.commit()
    session = session_service.create(db, subject_type="user", user_id=user.user_id, email=user.email)
    return {
        "user_id": user.user_id,
        "email": user.email,
        "username": user.username,
        **session,
    }


@router.post("/captcha/generate")
def captcha_generate(db: Session = Depends(get_db)):
    a = random.randint(10, 99)
    b = random.randint(1, 9)
    answer = a + b
    session_id = str(uuid.uuid4())
    temp_secret_service.set(
        db,
        secret_type="captcha",
        secret_key=session_id,
        ttl_seconds=CAPTCHA_TTL_SECONDS,
        payload={"answer": answer},
    )
    return {"session_id": session_id, "captcha": f"{a} + {b}"}


@router.post("/captcha/verify")
def captcha_verify(payload: dict = Body(...), db: Session = Depends(get_db)):
    session_id = _json_payload_field(payload, "session_id")
    answer = payload.get("answer") if isinstance(payload, dict) else None
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    record = temp_secret_service.get(db, secret_key=session_id, secret_type="captcha")
    if not record:
        raise HTTPException(status_code=400, detail="Captcha session expired")

    try:
        provided = int(answer)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid captcha answer")

    if int((record.payload or {}).get("answer", -1)) != provided:
        raise HTTPException(status_code=400, detail="Incorrect captcha answer")

    temp_secret_service.delete(db, secret_key=session_id, secret_type="captcha")
    return {"verified": True}


@router.post("/forgot-password")
def forgot_password(payload: dict = Body(...), db: Session = Depends(get_db)):
    email = _json_payload_field(payload, "email")
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
    temp_secret_service.set(
        db,
        secret_type="password_reset",
        secret_key=token,
        ttl_seconds=PASSWORD_RESET_TTL_SECONDS,
        user_id=user.user_id,
        email=user.email.lower(),
        payload={"user_id": int(user.user_id)},
    )
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
    token_data = temp_secret_service.get(db, secret_key=payload.token, secret_type="password_reset")
    if not token_data:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user_id = int((token_data.payload or {}).get("user_id"))
    user_repo = UserRepository(db)
    auth = AuthService(user_repo)
    try:
        auth.validate_password_policy(payload.new_password)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))

    updated = user_repo.update_password(user_id=user_id, hashed_password=auth.get_password_hash(payload.new_password))
    temp_secret_service.delete(db, secret_key=payload.token, secret_type="password_reset")
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "success", "message": "Password updated successfully"}


@router.post("/logout")
def logout(db: Session = Depends(get_db), authorization: Optional[str] = Header(default=None)):
    token = extract_bearer_token(authorization)
    if validate_admin_session(db, token):
        session_service.delete(db, token)
        safe_write_audit_log(
            db,
            action="admin_logout",
            type="info",
            msg="Administrator signed out",
        )
        return {"status": "success"}

    session = session_service.validate(db, token, subject_type="user")
    user_id = int(session.user_id) if session and session.user_id is not None else None
    session_service.delete(db, token)
    if user_id is not None:
        safe_write_audit_log(
            db,
            user_id=user_id,
            action="logout",
            type="info",
            msg="User signed out",
        )
    return {"status": "success"}
