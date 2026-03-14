from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session

from ..models import TempSecret


class TempSecretService:
    def purge_expired(self, db: Session) -> None:
        now = datetime.now(timezone.utc)
        db.query(TempSecret).filter(TempSecret.expires_at <= now).delete(synchronize_session=False)
        db.commit()

    def set(
        self,
        db: Session,
        *,
        secret_type: str,
        secret_key: str,
        ttl_seconds: int,
        payload: dict[str, Any],
        user_id: Optional[int] = None,
        email: Optional[str] = None,
    ) -> TempSecret:
        self.purge_expired(db)
        record = db.query(TempSecret).filter(TempSecret.secret_key == secret_key).first()
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
        if not record:
            record = TempSecret(
                secret_key=secret_key,
                secret_type=secret_type,
                user_id=user_id,
                email=email,
                payload=payload,
                expires_at=expires_at,
            )
            db.add(record)
        else:
            record.secret_type = secret_type
            record.user_id = user_id
            record.email = email
            record.payload = payload
            record.expires_at = expires_at
        db.commit()
        db.refresh(record)
        return record

    def get(self, db: Session, *, secret_key: str, secret_type: Optional[str] = None) -> Optional[TempSecret]:
        self.purge_expired(db)
        query = db.query(TempSecret).filter(TempSecret.secret_key == secret_key)
        if secret_type is not None:
            query = query.filter(TempSecret.secret_type == secret_type)
        return query.first()

    def delete(self, db: Session, *, secret_key: str, secret_type: Optional[str] = None) -> None:
        query = db.query(TempSecret).filter(TempSecret.secret_key == secret_key)
        if secret_type is not None:
            query = query.filter(TempSecret.secret_type == secret_type)
        query.delete(synchronize_session=False)
        db.commit()
