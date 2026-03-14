import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from ..models import SessionRecord


class SessionService:
    def __init__(self, ttl_seconds: int = 60 * 60 * 8):
        self.ttl_seconds = ttl_seconds

    def _purge_expired(self, db: Session) -> None:
        now = datetime.now(timezone.utc)
        db.query(SessionRecord).filter(SessionRecord.expires_at <= now).delete(synchronize_session=False)
        db.commit()

    def create(
        self,
        db: Session,
        *,
        subject_type: str,
        user_id: Optional[int] = None,
        email: Optional[str] = None,
    ) -> dict[str, float | int | str]:
        self._purge_expired(db)
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=self.ttl_seconds)
        db.add(
            SessionRecord(
                token=token,
                subject_type=subject_type,
                user_id=int(user_id) if user_id is not None else None,
                email=email.lower() if email else None,
                expires_at=expires_at,
            )
        )
        db.commit()
        return {
            "access_token": token,
            "token_type": "bearer",
            "expires_at": int(expires_at.timestamp()),
        }

    def validate(
        self,
        db: Session,
        token: str,
        *,
        subject_type: Optional[str] = None,
    ) -> Optional[SessionRecord]:
        self._purge_expired(db)
        query = db.query(SessionRecord).filter(SessionRecord.token == token)
        if subject_type is not None:
            query = query.filter(SessionRecord.subject_type == subject_type)
        session = query.first()
        if not session:
            return None
        if session.expires_at <= datetime.now(timezone.utc):
            db.delete(session)
            db.commit()
            return None
        return session

    def delete(self, db: Session, token: str) -> None:
        db.query(SessionRecord).filter(SessionRecord.token == token).delete(synchronize_session=False)
        db.commit()
