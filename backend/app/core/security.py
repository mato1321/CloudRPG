from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from app.core.config import settings

# 使用 Argon2 而不是 bcrypt
argon2_hasher = PasswordHasher()

def hash_password(password: str) -> str:
    """使用 Argon2 哈希密碼"""
    if len(password) > 72:
        password = password[:72]
    return argon2_hasher.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """驗證密碼"""
    try:
        if len(plain_password) > 72:
            plain_password = plain_password[:72]
        argon2_hasher.verify(hashed_password, plain_password)
        return True
    except (VerifyMismatchError, Exception):
        return False

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """建立 JWT token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=7)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.SECRET_KEY, 
        algorithm=settings.ALGORITHM
    )
    return encoded_jwt

def decode_token(token: str) -> dict | None:
    """解碼和驗證 JWT token"""
    try:
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError:
        return None

def verify_token(token: str) -> dict | None:
    """驗證 JWT token（別名）"""
    return decode_token(token)