"""即時 PvP（線上對戰）：配對 + 訊息轉送。

架構：房主（host）的瀏覽器跑完整的格鬥模擬，對手（guest）只送按鍵、畫房主傳來的畫面狀態。
伺服器不模擬戰鬥，只負責：
  - 建立房間（4 碼房號）/ 用房號加入 / 快速配對
  - 轉送 guest 的按鍵（in）給 host、host 的畫面狀態（st）給 guest
  - 一方斷線時通知另一方；對戰結束時記錄在 pvp_matches（友誼賽：不影響積分與金幣）
單一後端程序時存在記憶體；之後多台後端要改成 Redis（跟聊天 Hub 一樣）。
"""
import asyncio
import random
import string
from dataclasses import dataclass, field

from fastapi import WebSocket

FIGHTER_ID_CHARS = set(string.ascii_lowercase + string.digits + "_")


@dataclass
class Player:
    ws: WebSocket
    user_id: object
    name: str
    fighter: str = "warrior_rpg"
    room: "Room | None" = None


@dataclass
class Room:
    code: str
    host: Player
    guest: Player | None = None
    stage: int = 0
    started: bool = False
    reported: bool = False
    matches: int = 0


@dataclass
class DuelManager:
    rooms: dict = field(default_factory=dict)
    queue: list = field(default_factory=list)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    def _code(self) -> str:
        while True:
            code = "".join(random.choices("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", k=4))
            if code not in self.rooms:
                return code

    @staticmethod
    def clean_fighter(fid) -> str:
        fid = str(fid or "")[:24]
        return fid if fid and set(fid) <= FIGHTER_ID_CHARS else "warrior_rpg"

    async def create(self, p: Player, stage: int) -> Room:
        async with self.lock:
            await self._leave(p)
            room = Room(code=self._code(), host=p, stage=max(0, min(10, int(stage or 0))))
            self.rooms[room.code] = room
            p.room = room
            return room

    async def join(self, p: Player, code: str) -> Room | None:
        async with self.lock:
            room = self.rooms.get(str(code or "").upper().strip())
            if not room or room.guest or room.host is p or room.host.user_id == p.user_id:
                return None
            await self._leave(p)
            room.guest = p
            p.room = room
            return room

    async def quick(self, p: Player, stage: int) -> Room | None:
        """快速配對：有人在排隊就直接開打，沒有就排進隊伍（回傳 None）"""
        async with self.lock:
            await self._leave(p)
            while self.queue:
                other = self.queue.pop(0)
                if other.user_id == p.user_id or other.room:
                    continue
                room = Room(code=self._code(), host=other, guest=p, stage=max(0, min(10, int(stage or 0))))
                self.rooms[room.code] = room
                other.room = p.room = room
                return room
            self.queue.append(p)
            return None

    async def leave(self, p: Player):
        async with self.lock:
            await self._leave(p)

    async def _leave(self, p: Player):
        if p in self.queue:
            self.queue.remove(p)
        room = p.room
        if not room:
            return
        p.room = None
        other = room.guest if room.host is p else room.host
        self.rooms.pop(room.code, None)
        if other:
            other.room = None
            await safe_send(other, {"t": "left", "msg": f"{p.name} 離開了對戰"})


def start_payload(room: Room, role: str) -> dict:
    return {
        "t": "start", "role": role, "code": room.code, "stage": room.stage,
        "host": {"name": room.host.name, "fighter": room.host.fighter},
        "guest": {"name": room.guest.name, "fighter": room.guest.fighter},
    }


async def safe_send(p: Player | None, msg: dict):
    if not p:
        return
    try:
        await p.ws.send_json(msg)
    except Exception:
        pass


duels = DuelManager()
