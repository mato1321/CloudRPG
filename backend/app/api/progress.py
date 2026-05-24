# @ts-nocheck
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.core.security import decode_token
from datetime import datetime
from typing import Optional

router = APIRouter(prefix="/api/progress", tags=["progress"])

@router.post("/save")
async def save_progress(
    data: dict,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    保存遊戲進度到雲端
    
    期望格式：
    {
        "state": { "level": 1, "gold": 50, "inv": {...}, ... },
        "log": [ { "t": "system", "text": "..." }, ... ]
    }
    """
    # 驗證 token
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    try:
        token = authorization.replace("Bearer ", "")
        payload = decode_token(token)
    except Exception as e:
        print(f"❌ Token 解碼失敗: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    # 查詢用戶
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        print(f"❌ 用戶不存在: {user_id}")
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        # 保存進度
        user.game_progress = data.get("state", {})
        user.game_log = data.get("log", [])
        user.last_save_at = datetime.utcnow()
        
        db.commit()
        db.refresh(user)
        
        print(f"✅ 用戶 {user.username} 進度已保存")
        print(f"   - State 字段數: {len(data.get('state', {}))}")
        print(f"   - Log 條數: {len(data.get('log', []))}")
        
        return {
            "status": "saved",
            "username": user.username,
            "saved_at": user.last_save_at.isoformat(),
            "state_keys": list(data.get("state", {}).keys()),
            "log_count": len(data.get("log", []))
        }
    except Exception as e:
        print(f"❌ 保存進度失敗: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save progress: {str(e)}")


@router.get("/load")
async def load_progress(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    從雲端讀取遊戲進度
    
    返回格式：
    {
        "state": { "level": 1, "gold": 50, ... },
        "log": [ ... ],
        "last_save_at": "2026-05-24T..."
    }
    """
    # 驗證 token
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    try:
        token = authorization.replace("Bearer ", "")
        payload = decode_token(token)
    except Exception as e:
        print(f"❌ Token 解碼失敗: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    # 查詢用戶
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        print(f"❌ 用戶不存在: {user_id}")
        raise HTTPException(status_code=404, detail="User not found")
    
    # 返回進度
    response = {
        "status": "loaded",
        "username": user.username,
        "state": user.game_progress or {},
        "log": user.game_log or [],
        "last_save_at": user.last_save_at.isoformat() if user.last_save_at else None
    }
    
    print(f"✅ 用戶 {user.username} 進度已讀取")
    print(f"   - 最後保存: {user.last_save_at}")
    
    return response


@router.delete("/clear")
async def clear_progress(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """清除遊戲進度（用於重新開始）"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    try:
        token = authorization.replace("Bearer ", "")
        payload = decode_token(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # 清除進度
    user.game_progress = {}
    user.game_log = []
    db.commit()
    
    print(f"✅ 用戶 {user.username} 進度已清除")
    
    return {
        "status": "cleared",
        "username": user.username
<<<<<<< HEAD
    }
=======
    }
>>>>>>> ec680b1cfac7494f4f06ef46d2f4840be4bab183
