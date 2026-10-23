"""世界聊天 / 公會聊天（REST 讀寫 + WebSocket 即時推播）與前端錯誤回報。"""
import logging
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import _user_from_header, get_current_user, get_optional_user
from app.core.ratelimit import client_ip, enforce, limiter
from app.db.database import SessionLocal, get_db
from app.game import services as S
from app.models.game import ChatMessage
from app.models.user import User
from app.realtime import hub

router = APIRouter(tags=["social"])
logger = logging.getLogger("cloudrpg.client")

KEEP_PER_CHANNEL = 500


def _resolve(db: Session, channel: str, user: Optional[User]) -> str:
    if channel == "world":
        return "world"
    if channel == "guild":
        if not user:
            raise HTTPException(status_code=401, detail="請先登入")
        gm = S.guild_of(db, user.id)
        if not gm:
            raise HTTPException(status_code=403, detail="你還沒有加入公會")
        return f"guild:{gm[0].id}"
    raise HTTPException(status_code=404, detail="未知的頻道")


def _msg(m: ChatMessage) -> dict:
    return {"id": m.id, "user": m.username, "text": m.text, "at": m.created_at.isoformat() if m.created_at else None}


@router.get("/api/chat/{channel}")
def chat_history(channel: str, after: int = 0, limit: int = 50,
                 user: Optional[User] = Depends(get_optional_user), db: Session = Depends(get_db)):
    ch = _resolve(db, channel, user)
    q = db.query(ChatMessage).filter(ChatMessage.channel == ch)
    if after:
        q = q.filter(ChatMessage.id > after).order_by(ChatMessage.id.asc()).limit(min(limit, 100))
        rows = q.all()
    else:
        rows = list(reversed(q.order_by(ChatMessage.id.desc()).limit(min(limit, 100)).all()))
    return {"channel": channel, "messages": [_msg(m) for m in rows], "online": hub.online()}


class ChatReq(BaseModel):
    text: str = Field(min_length=1, max_length=140)


_CTRL = re.compile(r"[\x00-\x1f\x7f]")


@router.post("/api/chat/{channel}")
def chat_send(channel: str, req: ChatReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    enforce(f"chat-burst:{user.id}", 1, 1.5, "說話太快了，休息一下")
    enforce(f"chat:{user.id}", 20, 60, "說話太快了，休息一下")
    ch = _resolve(db, channel, user)
    text = _CTRL.sub("", req.text).strip()
    if not text:
        raise HTTPException(status_code=400, detail="訊息不能是空的")
    m = ChatMessage(channel=ch, user_id=user.id, username=user.username, text=text)
    db.add(m)
    db.commit()
    db.refresh(m)
    if m.id % 50 == 0:  # 偶爾清掉太舊的訊息
        db.query(ChatMessage).filter(ChatMessage.channel == ch, ChatMessage.id < m.id - KEEP_PER_CHANNEL).delete()
        db.commit()
    payload = {"type": "chat", "channel": "world" if ch == "world" else "guild", "message": _msg(m)}
    hub.publish_from_thread(ch, payload)
    return payload["message"]


@router.websocket("/api/ws")
async def ws_endpoint(ws: WebSocket, token: Optional[str] = None):
    """訂閱世界頻道（以及自己的公會頻道）：聊天、Boss 血量即時更新"""
    ip = ws.client.host if ws.client else "?"
    if not limiter.hit(f"ws:{ip}", 20, 60):
        await ws.close(code=1008)
        return
    await ws.accept()
    channels = {"world"}
    db = SessionLocal()
    try:
        user = _user_from_header(f"Bearer {token}", db) if token else None
        if user:
            gm = S.guild_of(db, user.id)
            if gm:
                channels.add(f"guild:{gm[0].id}")
    finally:
        db.close()
    await hub.connect(ws, channels)
    try:
        await ws.send_json({"type": "hello", "channels": ["world"] + (["guild"] if len(channels) > 1 else []), "online": hub.online()})
        while True:
            msg = await ws.receive_text()  # 客戶端只會送 ping
            if msg == "ping":
                await ws.send_json({"type": "pong", "online": hub.online()})
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        hub.disconnect(ws)


class ClientError(BaseModel):
    message: str = Field(max_length=500)
    stack: str = Field(default="", max_length=4000)
    url: str = Field(default="", max_length=300)


@router.post("/api/telemetry/error")
def client_error(req: ClientError, request: Request):
    """前端錯誤回報：寫進後端 log（journalctl 看得到；之後可接 CloudWatch Logs / Sentry）"""
    enforce(f"telemetry:{client_ip(request)}", 10, 60)
    logger.warning("client error at %s: %s\n%s", req.url, req.message, req.stack[:1500])
    return {"ok": True}
