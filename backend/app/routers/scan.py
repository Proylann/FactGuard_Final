from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Body, Depends, File, Header, HTTPException, Request, Response, UploadFile, status
from sqlalchemy import and_, func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .. import schemas
from ..db import get_db
from ..models import AuditLog, ScanResult
from ..services.plagiarism_scanner import PlagiarismSettings
from ..utils.rate_limiter import (
    get_plagiarism_scan_retry_after,
    is_plagiarism_scan_limited,
    record_plagiarism_scan_attempt,
)
from .common import (
    build_simple_pdf,
    deepfake_service,
    plagiarism_service,
    require_authenticated_user,
    safe_write_audit_log,
    text_detector,
)

router = APIRouter()


@router.post("/detect-ai-text")
def detect_ai_text(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
):
    current_user = require_authenticated_user(db, authorization)
    text_content = str(payload.get("text") or "").strip()
    if not text_content:
        raise HTTPException(status_code=400, detail="No text provided")

    result = text_detector.analyze(text_content)
    if result is None:
        raise HTTPException(status_code=400, detail="Unable to analyze empty text")

    db_id = None
    try:
        row = ScanResult(
            user_id=current_user.user_id,
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
        safe_write_audit_log(
            db,
            user_id=current_user.user_id,
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
    current_user = require_authenticated_user(db, authorization)
    data = await file.read()
    result = deepfake_service.analyze(data)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    db_id = None
    try:
        row = ScanResult(
            user_id=current_user.user_id,
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
        safe_write_audit_log(
            db,
            user_id=current_user.user_id,
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
    current_user = require_authenticated_user(db, authorization)
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
    try:
        row = ScanResult(
            user_id=current_user.user_id,
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
        safe_write_audit_log(
            db,
            user_id=current_user.user_id,
            action="scan_plagiarism",
            type="success",
            msg=f"Plagiarism scan completed ({round(float(report.get('overallScore', 0)), 1)}% similarity)",
        )
    except SQLAlchemyError as err:
        db.rollback()
        report.setdefault("notes", []).append(f"Scan result was not saved to DB: {err.__class__.__name__}")

    return {"status": "success", "scan_id": scan_id, **report}


@router.get("/audit-logs")
def get_audit_logs(db: Session = Depends(get_db), authorization: Optional[str] = Header(default=None)):
    current_user = require_authenticated_user(db, authorization)

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
    current_user = require_authenticated_user(db, authorization)
    q = db.query(ScanResult).filter(ScanResult.user_id == current_user.user_id)

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
        day_filter = [func.DATE(ScanResult.created_at) == func.DATE(dt), ScanResult.user_id == current_user.user_id]
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
        next_month_start = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)

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
    current_user = require_authenticated_user(db, authorization)
    today = datetime.now().date()
    base = [func.DATE(ScanResult.created_at) == today, ScanResult.user_id == current_user.user_id]
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
    current_user = require_authenticated_user(db, authorization)
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
    lines.append(
        "Scope: flagged synthetic or manipulated content."
        if normalized_type == "synthetic"
        else "Scope: scans assessed as authentic content."
    )

    pdf_bytes = build_simple_pdf(title, lines)
    safe_write_audit_log(
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
