from sqlalchemy.orm import Session
from .models import User


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_email(self, email: str):
        return self.db.query(User).filter(User.email == email).first()

    def get_by_username(self, username: str):
        return self.db.query(User).filter(User.username == username).first()

    def get_by_id(self, user_id: int):
        return self.db.query(User).filter(User.user_id == user_id).first()

    def create(self, email: str, hashed_password: str, username: str = None):
        db_user = User(email=email, password=hashed_password, username=username)
        self.db.add(db_user)
        self.db.commit()
        self.db.refresh(db_user)
        return db_user

    def update_password(self, user_id: int, hashed_password: str) -> bool:
        user = self.get_by_id(user_id)
        if not user:
            return False
        user.password = hashed_password
        self.db.commit()
        return True
