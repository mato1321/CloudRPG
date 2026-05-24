from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.security import hash_password, verify_password, create_access_token
from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest, db: Session = Depends(get_db)):
    """註冊新帳號"""
    
    # 檢查用戶是否已存在
    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # 創建新用戶
    user = User(
        username=req.username,
        password_hash=hash_password(req.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # 生成 Token
    access_token = create_access_token({"sub": str(user.id), "username": user.username})
    
    return TokenResponse(
        access_token=access_token,
        user={"id": str(user.id), "username": user.username}
    )

@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    """登入"""
    
    # 查找用戶
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # 生成 Token
    access_token = create_access_token({"sub": str(user.id), "username": user.username})
    
    return TokenResponse(
        access_token=access_token,
        user={"id": str(user.id), "username": user.username}
    )

@router.get("/me")
async def get_current_user(
    token: str = None,
    db: Session = Depends(get_db)
):
    """獲取當前用戶信息"""
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    from app.core.security import decode_token
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"id": str(user.id), "username": user.username}