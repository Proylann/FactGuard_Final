from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=10, max_length=128)
    username: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class UserOut(BaseModel):
    user_id: int
    email: EmailStr
    username: Optional[str] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SignupVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)


class PasswordResetConfirmRequest(BaseModel):
    token: str = Field(..., min_length=8, max_length=512)
    new_password: str = Field(..., min_length=10, max_length=128)


class ProfileUpdateRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)


class MfaSettingsUpdateRequest(BaseModel):
    enabled: bool


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=10, max_length=128)


class PlagiarismScanRequest(BaseModel):
    inputText: str = Field(..., min_length=1)
    user_id: Optional[int] = None
    maxChunks: int = Field(default=6, ge=1, le=30)
    topK: int = Field(default=3, ge=1, le=10)
    num: int = Field(default=5, ge=1, le=10)
    gl: Optional[str] = None
    hl: Optional[str] = None
    nearMatch: bool = True
    nearMatchThreshold: float = Field(default=0.85, ge=0.5, le=1.0)
    ignoreDomains: list[str] = Field(default_factory=list)
    # legacy compatibility fields
    maxQueries: Optional[int] = Field(default=None, ge=1, le=20)
    topKResultsPerQuery: Optional[int] = Field(default=None, ge=1, le=10)
    language: Optional[str] = None
    chunkMode: Literal["sentences", "lines", "ngrams"] = "sentences"
    chunkLengthWords: int = Field(default=10, ge=6, le=20)
    searchEngine: Literal["google", "bing", "brave"] = "brave"
