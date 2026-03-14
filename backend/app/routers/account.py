from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import schemas
from ..db import get_db
from ..repositories import UserRepository
from .common import require_authenticated_user
from .routers import AuthService

router = APIRouter()


@router.get("/session/validate")
def validate_session(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    user = require_authenticated_user(db, authorization)
    return {
        "valid": True,
        "user_id": user.user_id,
        "email": user.email,
        "username": user.username,
    }


@router.get("/me/settings")
def me_settings(db: Session = Depends(get_db), authorization: Optional[str] = Header(default=None)):
    user = require_authenticated_user(db, authorization)
    return {
        "user_id": user.user_id,
        "email": user.email,
        "username": user.username,
        "mfa_enabled": bool(getattr(user, "mfa_enabled", False)),
    }


@router.patch("/me/mfa")
def update_mfa_settings(
    payload: schemas.MfaSettingsUpdateRequest,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    user = require_authenticated_user(db, authorization)
    user.mfa_enabled = bool(payload.enabled)
    db.commit()
    return {"status": "success", "mfa_enabled": bool(payload.enabled)}


@router.patch("/me/profile")
def update_profile(
    payload: schemas.ProfileUpdateRequest,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    user = require_authenticated_user(db, authorization)
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
    user = require_authenticated_user(db, authorization)
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
