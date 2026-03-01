import time
from typing import Dict

# In-memory stores (replace with Redis in production).
login_attempts: Dict[str, list[float]] = {}
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15

plagiarism_scan_attempts: Dict[str, list[float]] = {}
PLAGIARISM_SCAN_MAX_REQUESTS = 2
PLAGIARISM_SCAN_WINDOW_SECONDS = 60


def _prune_attempts(bucket: Dict[str, list[float]], key: str, window_seconds: int) -> None:
    cutoff = time.time() - window_seconds
    bucket[key] = [t for t in bucket.get(key, []) if t > cutoff]


def is_user_locked_out(email: str) -> bool:
    _prune_attempts(login_attempts, email, LOCKOUT_DURATION_MINUTES * 60)
    return len(login_attempts.get(email, [])) >= MAX_LOGIN_ATTEMPTS


def record_failed_login(email: str):
    _prune_attempts(login_attempts, email, LOCKOUT_DURATION_MINUTES * 60)
    login_attempts.setdefault(email, []).append(time.time())


def reset_failed_login(email: str):
    login_attempts.pop(email, None)


def get_remaining_lockout_time(email: str) -> int:
    _prune_attempts(login_attempts, email, LOCKOUT_DURATION_MINUTES * 60)
    attempts = login_attempts.get(email, [])
    if len(attempts) < MAX_LOGIN_ATTEMPTS:
        return 0
    oldest = min(attempts)
    remaining = int((oldest + LOCKOUT_DURATION_MINUTES * 60) - time.time())
    return max(1, remaining)


def get_remaining_attempts(email: str) -> int:
    _prune_attempts(login_attempts, email, LOCKOUT_DURATION_MINUTES * 60)
    return max(0, MAX_LOGIN_ATTEMPTS - len(login_attempts.get(email, [])))


def is_plagiarism_scan_limited(key: str) -> bool:
    _prune_attempts(plagiarism_scan_attempts, key, PLAGIARISM_SCAN_WINDOW_SECONDS)
    return len(plagiarism_scan_attempts.get(key, [])) >= PLAGIARISM_SCAN_MAX_REQUESTS


def record_plagiarism_scan_attempt(key: str) -> None:
    _prune_attempts(plagiarism_scan_attempts, key, PLAGIARISM_SCAN_WINDOW_SECONDS)
    plagiarism_scan_attempts.setdefault(key, []).append(time.time())


def get_plagiarism_scan_retry_after(key: str) -> int:
    _prune_attempts(plagiarism_scan_attempts, key, PLAGIARISM_SCAN_WINDOW_SECONDS)
    attempts = plagiarism_scan_attempts.get(key, [])
    if len(attempts) < PLAGIARISM_SCAN_MAX_REQUESTS:
        return 0
    oldest = min(attempts)
    remaining = int((oldest + PLAGIARISM_SCAN_WINDOW_SECONDS) - time.time())
    return max(1, remaining)
