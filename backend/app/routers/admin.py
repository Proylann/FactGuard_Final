from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from sqlalchemy import and_
from sqlalchemy.orm import Session

from .. import schemas
from ..db import get_db
from ..models import AuditLog, ScanResult, User
from ..repositories import UserRepository
from .common import (
    build_csv_bytes,
    build_excel_bytes,
    build_simple_pdf,
    normalize_review_status,
    normalize_user_role,
    require_admin,
    safe_write_audit_log,
    serialize_admin_log,
    serialize_admin_record,
    serialize_admin_user,
)
from .routers import AuthService

router = APIRouter()


@router.get("/admin/overview")
def admin_overview(db: Session = Depends(get_db), authorization: Optional[str] = Header(default=None)):
    require_admin(db, authorization)

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
        role_breakdown[normalize_user_role(getattr(user, "role", "user"))] += 1

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
        "recent_users": [serialize_admin_user(db, user) for user in recent_users],
        "recent_records": [serialize_admin_record(scan, username, email) for scan, username, email in recent_records],
        "recent_activity": [serialize_admin_log(log, username, email) for log, username, email in recent_logs],
        "analytics": {
            "usage_labels": usage_labels,
            "usage_counts": usage_counts,
            "status_breakdown": status_breakdown,
            "role_breakdown": role_breakdown,
        },
    }


@router.get("/admin/users")
def admin_list_users(db: Session = Depends(get_db), authorization: Optional[str] = Header(default=None)):
    require_admin(db, authorization)
    users = db.query(User).order_by(User.user_id.asc()).all()
    return [serialize_admin_user(db, user) for user in users]


@router.post("/admin/users")
def admin_create_user(
    payload: schemas.AdminUserCreateRequest,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    admin = require_admin(db, authorization)
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
    user.role = normalize_user_role(payload.role)
    user.is_active = bool(payload.is_active)
    user.mfa_enabled = False
    db.commit()
    db.refresh(user)
    safe_write_audit_log(
        db,
        action="admin_create_user",
        type="success",
        msg=f"Administrator created user {user.email}",
        ip_address=admin["email"],
    )
    return serialize_admin_user(db, user)


@router.patch("/admin/users/{user_id}")
def admin_update_user(
    user_id: int,
    payload: schemas.AdminUserUpdateRequest,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    admin = require_admin(db, authorization)
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
        user.role = normalize_user_role(payload.role)
    if payload.is_active is not None:
        user.is_active = bool(payload.is_active)

    db.commit()
    db.refresh(user)
    safe_write_audit_log(
        db,
        action="admin_update_user",
        type="info",
        msg=f"Administrator updated user {user.email}",
        ip_address=admin["email"],
    )
    return serialize_admin_user(db, user)


@router.delete("/admin/users/{user_id}")
def admin_delete_user(user_id: int, db: Session = Depends(get_db), authorization: Optional[str] = Header(default=None)):
    admin = require_admin(db, authorization)
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.query(ScanResult).filter(ScanResult.user_id == user_id).delete()
    db.query(AuditLog).filter(AuditLog.user_id == user_id).delete()
    db.delete(user)
    db.commit()
    safe_write_audit_log(
        db,
        action="admin_delete_user",
        type="error",
        msg=f"Administrator deleted user {user.email}",
        ip_address=admin["email"],
    )
    return {"status": "success"}


@router.get("/admin/scans")
def admin_list_scans(db: Session = Depends(get_db), authorization: Optional[str] = Header(default=None)):
    require_admin(db, authorization)
    rows = (
        db.query(ScanResult, User.username, User.email)
        .join(User, User.user_id == ScanResult.user_id)
        .order_by(ScanResult.created_at.desc())
        .limit(200)
        .all()
    )
    return [serialize_admin_record(scan, username, email) for scan, username, email in rows]


@router.post("/admin/records")
def admin_create_record(
    payload: schemas.AdminRecordCreateRequest,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    admin = require_admin(db, authorization)
    user = db.query(User).filter(User.user_id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    record = ScanResult(
        user_id=payload.user_id,
        filename=payload.filename.strip(),
        media_type=payload.media_type,
        confidence_score=float(payload.confidence_score),
        is_synthetic=bool(payload.is_synthetic),
        review_status=normalize_review_status(payload.review_status),
        artifacts=[item.strip() for item in payload.artifacts if str(item).strip()],
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    safe_write_audit_log(
        db,
        action="admin_create_record",
        type="success",
        msg=f"Administrator created record {record.filename}",
        ip_address=admin["email"],
    )
    return serialize_admin_record(record, user.username, user.email)


@router.patch("/admin/records/{record_id}")
def admin_update_record(
    record_id: int,
    payload: schemas.AdminRecordUpdateRequest,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    admin = require_admin(db, authorization)
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
        record.review_status = normalize_review_status(payload.review_status)
    if payload.artifacts is not None:
        record.artifacts = [item.strip() for item in payload.artifacts if str(item).strip()]

    db.commit()
    db.refresh(record)
    user = db.query(User).filter(User.user_id == record.user_id).first()
    safe_write_audit_log(
        db,
        action="admin_update_record",
        type="info",
        msg=f"Administrator updated record {record.filename}",
        ip_address=admin["email"],
    )
    return serialize_admin_record(record, user.username if user else None, user.email if user else None)


@router.delete("/admin/records/{record_id}")
def admin_delete_record(record_id: int, db: Session = Depends(get_db), authorization: Optional[str] = Header(default=None)):
    admin = require_admin(db, authorization)
    record = db.query(ScanResult).filter(ScanResult.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    filename = record.filename
    db.delete(record)
    db.commit()
    safe_write_audit_log(
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
    require_admin(db, authorization)
    rows = (
        db.query(ScanResult, User.username, User.email)
        .join(User, User.user_id == ScanResult.user_id)
        .order_by(ScanResult.created_at.desc())
        .all()
    )
    records = [serialize_admin_record(scan, username, email) for scan, username, email in rows]
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
        content = build_csv_bytes(headers, data_rows)
        media_type = "text/csv; charset=utf-8"
        extension = "csv"
    elif normalized == "excel":
        content = build_excel_bytes("FactGuard Records Export", headers, data_rows)
        media_type = "application/vnd.ms-excel"
        extension = "xls"
    elif normalized == "pdf":
        pdf_lines = [", ".join(str(value) for value in row[:5]) for row in data_rows[:28]]
        content = build_simple_pdf("FactGuard Records Export", pdf_lines or ["No records available"])
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
    require_admin(db, authorization)
    rows = (
        db.query(AuditLog, User.username, User.email)
        .outerjoin(User, User.user_id == AuditLog.user_id)
        .order_by(AuditLog.timestamp.desc())
        .limit(250)
        .all()
    )
    return [serialize_admin_log(log, username, email) for log, username, email in rows]


@router.get("/admin/reports")
def admin_reports(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    require_admin(db, authorization)
    query = db.query(ScanResult, User.username, User.email).join(User, User.user_id == ScanResult.user_id)
    if date_from:
        query = query.filter(ScanResult.created_at >= datetime.strptime(date_from, "%Y-%m-%d"))
    if date_to:
        query = query.filter(ScanResult.created_at < datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1))

    rows = query.order_by(ScanResult.created_at.desc()).all()
    records = [serialize_admin_record(scan, username, email) for scan, username, email in rows]
    total_records = len(records)
    pending = sum(1 for item in records if item["review_status"] == "pending")
    approved = sum(1 for item in records if item["review_status"] == "approved")
    rejected = sum(1 for item in records if item["review_status"] == "rejected")
    synthetic = sum(1 for item in records if item["is_synthetic"])
    authentic = total_records - synthetic
    avg_confidence = round(sum(float(item["confidence_score"]) for item in records) / total_records, 1) if total_records else 0.0

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
    require_admin(db, authorization)
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
        content = build_csv_bytes(headers, rows)
        media_type = "text/csv; charset=utf-8"
        extension = "csv"
    elif normalized == "excel":
        content = build_excel_bytes("FactGuard Report Summary", headers, rows)
        media_type = "application/vnd.ms-excel"
        extension = "xls"
    elif normalized == "pdf":
        pdf_lines = [f"{label}: {value}" for label, value in rows]
        content = build_simple_pdf("FactGuard Report Summary", pdf_lines)
        media_type = "application/pdf"
        extension = "pdf"
    else:
        raise HTTPException(status_code=400, detail="Invalid export format")

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="factguard_report.{extension}"'},
    )
