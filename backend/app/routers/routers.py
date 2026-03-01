import re
from passlib.context import CryptContext
from ..repositories import UserRepository

pwd_context = CryptContext(schemes=["bcrypt_sha256"], deprecated="auto")


class AuthService:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    def get_password_hash(self, password: str) -> str:
        return pwd_context.hash(password)

    def validate_password_policy(self, password: str) -> None:
        if len(password) < 10:
            raise ValueError("Password must be at least 10 characters long")
        if not re.search(r"[A-Z]", password):
            raise ValueError("Password must include at least one uppercase letter")
        if not re.search(r"[a-z]", password):
            raise ValueError("Password must include at least one lowercase letter")
        if not re.search(r"\d", password):
            raise ValueError("Password must include at least one number")
        if not re.search(r"[^A-Za-z0-9]", password):
            raise ValueError("Password must include at least one special character")

    def register_user(self, email: str, password: str, username: str = None):
        existing = self.user_repo.get_by_email(email)
        if existing:
            raise ValueError("User already exists")

        self.validate_password_policy(password)
        hashed = self.get_password_hash(password)

        if not username:
            username = email.split('@')[0]

        return self.user_repo.create(
            username=username,
            email=email,
            hashed_password=hashed
        )

    def authenticate(self, email: str, password: str):
        user = self.user_repo.get_by_email(email)
        if not user:
            return None
        if not self.verify_password(password, user.password):
            return None
        return user
