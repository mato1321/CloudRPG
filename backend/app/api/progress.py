"""雲端存讀檔（劇情進度）。

金幣、物品、等級等「經濟」欄位由伺服器的 player_profiles 管理：
  - 存檔時：客戶端送來的經濟欄位一律忽略（改 localStorage 作弊無效）
  - 讀檔時：用伺服器的經濟資料覆蓋回去
"""
import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, is_admin
from app.core.ratelimit import enforce
from app.db.database import get_db
from app.game import economy as E
from app.game import services as S
from app.models.user import User

router = APIRouter(prefix="/api/progress", tags=["progress"])

MAX_LOG_LINES = 300
MAX_SAVE_BYTES = 600_000  # 含頭像 data URL


def merged_state(db: Session, user: User) -> dict:
    state = dict(user.game_progress or {})
    row = S.get_profile(db, user)
    if row:
        state.update(E.public(row.data, is_admin(user)))
        state["hp"] = max(1, min(int(state.get("hp") or state["hpMax"]), state["hpMax"]))
        state["mp"] = max(0, min(int(state.get("mp") or state["mpMax"]), state["mpMax"]))
    return state


@router.post("/save")
def save_progress(data: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """保存劇情進度：{ "state": {...}, "log": [...] }"""
    enforce(f"save:{user.id}", 20, 60)
    if len(json.dumps(data, ensure_ascii=False)) > MAX_SAVE_BYTES:
        raise HTTPException(status_code=413, detail="存檔太大（頭像圖片請縮小）")
    state = {k: v for k, v in dict(data.get("state") or {}).items() if k not in E.ECONOMY_KEYS}
    log = list(data.get("log") or [])[-MAX_LOG_LINES:]
    user.game_progress = state
    user.game_log = log
    user.last_save_at = datetime.utcnow()
    db.commit()
    return {
        "status": "saved",
        "username": user.username,
        "saved_at": user.last_save_at.isoformat(),
        "state_keys": list(state.keys()),
        "log_count": len(log),
    }


@router.get("/load")
def load_progress(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """讀取雲端進度：劇情狀態 + 伺服器端經濟資料"""
    row = S.get_profile(db, user)
    story = user.game_progress or {}
    return {
        "status": "loaded",
        "username": user.username,
        "state": merged_state(db, user) if (story or row) else {},
        "hasProfile": row is not None,
        "log": user.game_log or [],
        "last_save_at": user.last_save_at.isoformat() if user.last_save_at else None,
    }


@router.delete("/clear")
def clear_progress(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """清除劇情進度（重新開始故事）；金幣、物品、等級保留在伺服器"""
    user.game_progress = {}
    user.game_log = []
    db.commit()
    return {"status": "cleared", "username": user.username}
