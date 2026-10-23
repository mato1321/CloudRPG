"""簡單的滑動視窗限流（單一後端程序用記憶體；多台後端時改成 Redis 即可，介面不變）"""
import threading
import time
from collections import deque

from fastapi import HTTPException, Request


class SlidingWindowLimiter:
    def __init__(self):
        self._hits: dict[str, deque] = {}
        self._lock = threading.Lock()
        self._ops = 0

    def hit(self, key: str, limit: int, window: float) -> bool:
        """記一次請求；超過上限回傳 False"""
        now = time.monotonic()
        with self._lock:
            q = self._hits.setdefault(key, deque())
            while q and now - q[0] > window:
                q.popleft()
            if len(q) >= limit:
                return False
            q.append(now)
            self._ops += 1
            if self._ops % 2000 == 0:
                self._prune(now)
            return True

    def _prune(self, now: float):
        for k in [k for k, q in self._hits.items() if not q or now - q[-1] > 120]:
            del self._hits[k]

    def reset(self):
        with self._lock:
            self._hits.clear()


limiter = SlidingWindowLimiter()


def client_ip(request: Request) -> str:
    """Nginx 轉發時用 X-Real-IP；直接連 :8000 時不信任這個標頭（避免偽造）"""
    host = request.client.host if request.client else "unknown"
    if host in ("127.0.0.1", "::1"):
        return request.headers.get("x-real-ip") or host
    return host


def enforce(key: str, limit: int, window: float, message: str = "操作太頻繁，請稍後再試"):
    if not limiter.hit(key, limit, window):
        raise HTTPException(status_code=429, detail=message)
