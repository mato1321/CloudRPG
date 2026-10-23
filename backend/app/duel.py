"""即時連線房間：線上對戰（2 人）與組隊共鬥 Boss（2–4 人）共用。

架構：房主（slot 0）的瀏覽器跑完整的格鬥模擬，其他人只送按鍵、畫房主傳來的畫面狀態。
伺服器不模擬戰鬥，只負責：
  - 建立房間（4 碼房號）/ 用房號加入 / 快速配對（只有對戰）
  - 大廳：每個人選角色（房主另外選場地），房主按開始
  - 轉送其他人的按鍵（in，附上 slot）給房主、房主的畫面狀態（st）給其他人
  - 有人離開時通知其他人；對戰結束時記錄在 pvp_matches（友誼賽：不影響積分與金幣）
組隊共鬥的獎勵不在這裡發：每個人各自用 /api/battle/start（mode=worldboss）拿戰鬥憑證，
結束時各自結算，伺服器照樣用經過時間限制每個人的傷害上限。
單一後端程序時存在記憶體；之後多台後端要改成 Redis（跟聊天 Hub 一樣）。
"""
import asyncio
import random
import string
from dataclasses import dataclass, field

from fastapi import WebSocket

FIGHTER_ID_CHARS = set(string.ascii_lowercase + string.digits + "_")
CAPACITY = {"duel": 2, "coop": 4}


@dataclass(eq=False)
class Player:
    ws: WebSocket
    user_id: object
    name: str
    fighter: str = "warrior_rpg"
    room: "Room | None" = None


@dataclass(eq=False)
class Room:
    code: str
    kind: str
    players: list
    stage: int = 0
    started: bool = False
    reported: bool = False
    matches: int = 0

    @property
    def host(self) -> Player:
        return self.players[0]

    @property
    def full(self) -> bool:
        return len(self.players) >= CAPACITY[self.kind]

    def slot(self, p: Player) -> int:
        return self.players.index(p)

    def others(self, p: Player):
        return [q for q in self.players if q is not p]


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

    @staticmethod
    def clean_stage(stage) -> int:
        try:
            return max(0, min(10, int(stage or 0)))
        except (TypeError, ValueError):
            return 0

    async def create(self, p: Player, kind: str, stage) -> Room:
        async with self.lock:
            await self._leave(p)
            room = Room(code=self._code(), kind=kind if kind in CAPACITY else "duel", players=[p], stage=self.clean_stage(stage))
            self.rooms[room.code] = room
            p.room = room
            return room

    async def join(self, p: Player, code: str) -> Room | None:
        async with self.lock:
            room = self.rooms.get(str(code or "").upper().strip())
            if not room or room.full or room.started or any(q.user_id == p.user_id for q in room.players):
                return None
            await self._leave(p)
            room.players.append(p)
            p.room = room
            return room

    async def quick(self, p: Player, stage) -> Room | None:
        """快速配對（對戰）：有人在排隊就一起進大廳，沒有就排進隊伍（回傳 None）"""
        async with self.lock:
            await self._leave(p)
            while self.queue:
                other = self.queue.pop(0)
                if other.user_id == p.user_id or other.room:
                    continue
                room = Room(code=self._code(), kind="duel", players=[other, p], stage=self.clean_stage(stage))
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
        if room.host is p:  # 房主離開：房間解散
            self.rooms.pop(room.code, None)
            for q in room.others(p):
                q.room = None
                await safe_send(q, {"t": "left", "msg": f"房主 {p.name} 離開了，房間已解散"})
            return
        slot = room.slot(p)
        room.players.remove(p)
        await safe_send(room.host, {"t": "dropped", "slot": slot, "name": p.name})
        if room.kind == "duel" or len(room.players) < 2:
            room.started = False
        for q in room.players:
            await safe_send(q, {"t": "left", "msg": f"{p.name} 離開了"} if room.kind == "duel" else {"t": "info", "msg": f"{p.name} 離開了隊伍"})
        await broadcast_lobby(room)


def room_payload(room: Room, p: Player, t: str) -> dict:
    return {
        "t": t, "code": room.code, "kind": room.kind, "stage": room.stage, "you": room.slot(p),
        "players": [{"name": q.name, "fighter": q.fighter} for q in room.players],
        "capacity": CAPACITY[room.kind],
    }


async def broadcast_lobby(room: Room):
    if room.started:
        return
    for q in room.players:
        await safe_send(q, room_payload(room, q, "lobby"))


async def broadcast_start(room: Room):
    room.started = True
    room.reported = False
    for q in room.players:
        await safe_send(q, room_payload(room, q, "start"))


async def safe_send(p: Player | None, msg: dict):
    if not p:
        return
    try:
        await p.ws.send_json(msg)
    except Exception:
        pass


duels = DuelManager()
