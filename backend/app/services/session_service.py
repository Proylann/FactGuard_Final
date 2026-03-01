import secrets
import time
from typing import Optional


class SessionService:
    def __init__(self, ttl_seconds: int = 60 * 60 * 8):
        self.ttl_seconds = ttl_seconds
        self._sessions: dict[str, dict[str, float | int]] = {}

    def _prune(self) -> None:
        now = time.time()
        expired_tokens = [token for token, value in self._sessions.items() if float(value.get("expires_at", 0)) <= now]
        for token in expired_tokens:
            self._sessions.pop(token, None)

    def create(self, user_id: int) -> dict[str, float | int | str]:
        self._prune()
        token = secrets.token_urlsafe(32)
        expires_at = time.time() + self.ttl_seconds
        self._sessions[token] = {"user_id": int(user_id), "expires_at": expires_at}
        return {"access_token": token, "token_type": "bearer", "expires_at": int(expires_at)}

    def validate(self, token: str) -> Optional[int]:
        self._prune()
        session = self._sessions.get(token)
        if not session:
            return None
        if float(session.get("expires_at", 0)) <= time.time():
            self._sessions.pop(token, None)
            return None
        return int(session["user_id"])

    def delete(self, token: str) -> None:
        self._sessions.pop(token, None)
