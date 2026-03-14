import csv
import io
from datetime import datetime
from html import escape
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..config import settings
from ..models import AuditLog, ScanResult, User
from ..services.ai_text_engine import AITextDetector
from ..services.deepfake_detector import DeepfakeDetector
from ..services.email_service import SMTPEmailService
from ..services.plagiarism_scanner import WebPlagiarismScanner
from ..services.session_service import SessionService
from ..services.temp_secret_service import TempSecretService

router = APIRouter()

text_detector = AITextDetector()
deepfake_service = DeepfakeDetector()
plagiarism_service = WebPlagiarismScanner(settings)
email_service = SMTPEmailService(settings)
session_service = SessionService(ttl_seconds=settings.SESSION_TTL_SECONDS)
temp_secret_service = TempSecretService()


def extract_bearer_token(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Unauthorized")
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = parts[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return token


def create_admin_session(db: Session) -> dict[str, float | str]:
    return session_service.create(
        db,
        subject_type="admin",
        email=settings.ADMIN_EMAIL.lower(),
    )


def validate_admin_session(db: Session, token: str) -> bool:
    session = session_service.validate(db, token, subject_type="admin")
    return bool(session and (session.email or "").lower() == settings.ADMIN_EMAIL.lower())


def require_admin(db: Session, authorization: Optional[str]) -> dict[str, str]:
    token = extract_bearer_token(authorization)
    if not validate_admin_session(db, token):
        raise HTTPException(status_code=401, detail="Admin session expired or invalid")
    return {
        "token": token,
        "email": settings.ADMIN_EMAIL,
        "username": settings.ADMIN_USERNAME,
    }


def require_authenticated_user(db: Session, authorization: Optional[str]) -> User:
    token = extract_bearer_token(authorization)
    session = session_service.validate(db, token, subject_type="user")
    if not session or session.user_id is None:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    user = db.query(User).filter(User.user_id == int(session.user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if not bool(getattr(user, "is_active", True)):
        raise HTTPException(status_code=403, detail="Account is inactive")
    return user


def safe_write_audit_log(
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


def normalize_user_role(role: Optional[str]) -> str:
    return role if role in {"admin", "staff", "user"} else "user"


def normalize_review_status(status_value: Optional[str]) -> str:
    return status_value if status_value in {"pending", "approved", "rejected"} else "pending"


def format_timestamp(value: Optional[datetime]) -> str:
    return value.isoformat() if value else ""


def get_last_login_for_user(db: Session, user_id: int) -> Optional[datetime]:
    from sqlalchemy import func

    return (
        db.query(func.max(AuditLog.timestamp))
        .filter(AuditLog.user_id == user_id, AuditLog.action == "login")
        .scalar()
    )


def serialize_admin_user(db: Session, user: User) -> dict:
    total_scans = db.query(ScanResult).filter(ScanResult.user_id == user.user_id).count()
    flagged_scans = db.query(ScanResult).filter(
        ScanResult.user_id == user.user_id,
        ScanResult.is_synthetic.is_(True),
    ).count()
    last_login = user.last_login or get_last_login_for_user(db, user.user_id)
    return {
        "user_id": user.user_id,
        "username": user.username,
        "email": user.email,
        "role": normalize_user_role(getattr(user, "role", "user")),
        "is_active": bool(getattr(user, "is_active", True)),
        "status": "active" if bool(getattr(user, "is_active", True)) else "inactive",
        "last_login": format_timestamp(last_login),
        "total_scans": total_scans,
        "flagged_scans": flagged_scans,
        "created_at": format_timestamp(getattr(user, "created_at", None)),
    }


def serialize_admin_record(scan: ScanResult, username: Optional[str], email: Optional[str]) -> dict:
    return {
        "scan_id": scan.id,
        "user_id": scan.user_id,
        "username": username,
        "email": email,
        "filename": scan.filename,
        "media_type": scan.media_type,
        "confidence_score": round(float(scan.confidence_score), 1),
        "is_synthetic": bool(scan.is_synthetic),
        "review_status": normalize_review_status(getattr(scan, "review_status", "pending")),
        "artifacts": scan.artifacts or [],
        "created_at": format_timestamp(scan.created_at),
    }


def serialize_admin_log(log: AuditLog, username: Optional[str], email: Optional[str]) -> dict:
    return {
        "log_id": log.log_id,
        "timestamp": format_timestamp(log.timestamp),
        "action": log.action,
        "message": log.msg or log.action,
        "type": log.type if log.type in {"info", "success", "error"} else "info",
        "ip_address": log.ip_address,
        "user_id": log.user_id,
        "username": username,
        "email": email,
    }


def build_csv_bytes(headers: list[str], rows: list[list[object]]) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(headers)
    writer.writerows(rows)
    return buffer.getvalue().encode("utf-8")


def build_excel_bytes(title: str, headers: list[str], rows: list[list[object]]) -> bytes:
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


def pdf_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def build_simple_pdf(title: str, lines: list[str]) -> bytes:
    safe_title = pdf_escape(title)
    safe_lines = [pdf_escape(line[:110]) for line in lines]
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
