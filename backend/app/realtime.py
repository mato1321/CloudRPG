"""WebSocket 即時推播（世界聊天、公會聊天、團隊 Boss 血量）。

單一後端程序時用記憶體廣播；擴充成多台後端時，把 publish 改成 Redis Pub/Sub 即可。
"""
import asyncio
import logging

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class Hub:
    def __init__(self):
        self.conns: dict[WebSocket, set[str]] = {}
        self.loop: asyncio.AbstractEventLoop | None = None

    async def connect(self, ws: WebSocket, channels: set[str]):
        self.loop = asyncio.get_running_loop()
        self.conns[ws] = set(channels)

    def disconnect(self, ws: WebSocket):
        self.conns.pop(ws, None)

    def online(self) -> int:
        return len(self.conns)

    async def publish(self, channel: str, payload: dict):
        dead = []
        for ws, chans in list(self.conns.items()):
            if channel in chans:
                try:
                    await ws.send_json(payload)
                except Exception:
                    dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    def publish_from_thread(self, channel: str, payload: dict):
        """給同步（threadpool）端點用：把廣播丟回事件迴圈"""
        if not self.loop or not self.conns:
            return
        try:
            asyncio.run_coroutine_threadsafe(self.publish(channel, payload), self.loop)
        except Exception as e:  # 推播失敗不影響主要流程
            logger.warning("publish failed: %s", e)


hub = Hub()
