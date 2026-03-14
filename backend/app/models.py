from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.sql import func
from .db import Base


class User(Base):
    __tablename__ = "users"
    user_id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password = Column(String, nullable=False)
    role = Column(String(20), nullable=False, default="user")
    is_active = Column(Boolean, nullable=False, default=True)
    mfa_enabled = Column(Boolean, nullable=False, default=False)
    last_login = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ScanResult(Base):
    """Stores the output of AI model scans shown in Detection Tools."""
    __tablename__ = "scan_results"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    filename = Column(String, nullable=False)
    media_type = Column(String)  # 'image', 'video', or 'text'
    confidence_score = Column(Float, nullable=False)
    is_synthetic = Column(Boolean, default=False)
    review_status = Column(String(20), nullable=False, default="pending")
    # Flexible field to store anomalies like ["Inconsistent Lighting", "Audio Desync"]
    artifacts = Column(JSON) 
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    """Powers the 'Audit Logs' view and 'Live System Console'."""
    __tablename__ = "audit_logs"

    log_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    action = Column(String, nullable=False)  # e.g., "Login", "Initiated Scan"
    ip_address = Column(String)
    msg = Column(String)
    type = Column(String)  # 'info', 'success', or 'error'
    timestamp = Column(DateTime(timezone=True), server_default=func.now())


class DailyReport(Base):
    """Stores the metadata for the 'Daily Reports' view."""
    __tablename__ = "daily_reports"

    report_id = Column(Integer, primary_key=True, index=True)
    report_date = Column(DateTime, server_default=func.now())
    total_scans = Column(Integer, default=0)
    synthetic_count = Column(Integer, default=0)
    authentic_count = Column(Integer, default=0)
    report_path = Column(String)  # Path to the generated PDF forensic report


class SessionRecord(Base):
    __tablename__ = "session_records"

    token = Column(String(255), primary_key=True)
    subject_type = Column(String(20), nullable=False)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    email = Column(String(100), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TempSecret(Base):
    __tablename__ = "temp_secrets"

    secret_key = Column(String(255), primary_key=True)
    secret_type = Column(String(50), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    email = Column(String(100), nullable=True)
    payload = Column(JSON, nullable=False, default=dict)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
