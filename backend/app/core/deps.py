"""共用的 FastAPI 依賴：從 Authorization: Bearer <token> 取得目前玩家"""
from typing import Optional

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_token
from app.db.database import get_db
from app.models.user import User


def _user_from_header(authorization: Optional[str], db: Session) -> Optional[User]:
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "").strip()
    payload = decode_token(token)
    if not payload or not payload.get("sub"):
        return None
    import uuid

    try:
        uid = uuid.UUID(str(payload["sub"]))
    except ValueError:
        return None
    return db.query(User).filter(User.id == uid).first()


def get_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> User:
    user = _user_from_header(authorization, db)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


def get_optional_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> Optional[User]:
    return _user_from_header(authorization, db)


def is_admin(user: User) -> bool:
    return bool(user and user.username and user.username.lower() in settings.admin_usernames)
