"""CloudRPG 壓力測試（Locust）

兩種虛擬玩家：
  Visitor  逛大廳 / 世界 Boss / 每日 / 排行 / 聊天的訪客（不用帳號，對正式站安全）
  Player   登入後的玩家（讀角色、塔、PvP 對手、公會、偶爾發言）。需要帳號：
           LOADTEST_USERS=帳號檔（每行 帳號:密碼），或 LOADTEST_REGISTER=1 自動註冊
           （自動註冊只允許 localhost，避免在正式站建立大量假帳號）

用法：
  pip install locust
  # 介面模式：開 http://localhost:8089
  locust -f loadtest/locustfile.py --host http://54.161.3.74
  # 無介面 + 階梯負載（每階 45 秒），輸出 CSV
  LOADTEST_STEPS=25,50,100,200,300 locust -f loadtest/locustfile.py --host http://54.161.3.74 \
      --headless --csv loadtest/results/run Visitor

注意：後端有每 IP 限流（預設每 10 秒 80 個請求），從同一台電腦壓測時要先把
EC2 backend/.env 的 RATE_LIMIT_PER_10S 暫時調高，測完再改回來。
"""
import itertools
import os
import random
from urllib.parse import urlparse

from locust import HttpUser, LoadTestShape, between, task

_counter = itertools.count(1)


class Visitor(HttpUser):
    """沒登入的訪客：瀏覽頁面、輪詢世界 Boss 與聊天"""

    weight = 3
    wait_time = between(2, 6)

    @task(2)
    def lobby_page(self):
        self.client.get("/", name="page /")

    @task(1)
    def raid_page(self):
        self.client.get("/raid", name="page /raid")

    @task(4)
    def worldboss(self):
        self.client.get("/api/worldboss")

    @task(1)
    def daily(self):
        self.client.get("/api/daily")

    @task(1)
    def leaderboard(self):
        board = random.choice(["level", "tower", "pvp", "daily", "worldboss", "guild"])
        self.client.get(f"/api/leaderboard/{board}", name="/api/leaderboard/[board]")

    @task(3)
    def chat(self):
        self.client.get("/api/chat/world")


def _accounts():
    path = os.environ.get("LOADTEST_USERS")
    if not path:
        return []
    with open(path, encoding="utf-8") as f:
        return [tuple(line.strip().split(":", 1)) for line in f if ":" in line]


_ACCOUNTS = _accounts()


class Player(HttpUser):
    """登入的玩家：讀取自己的資料與各模式狀態"""

    weight = 1
    wait_time = between(3, 8)

    def on_start(self):
        self.headers = None
        if _ACCOUNTS:
            name, password = _ACCOUNTS[next(_counter) % len(_ACCOUNTS)]
            r = self.client.post("/api/auth/login", json={"username": name, "password": password}, name="/api/auth/login")
        elif os.environ.get("LOADTEST_REGISTER") == "1":
            if urlparse(self.host).hostname not in ("localhost", "127.0.0.1"):
                raise RuntimeError("LOADTEST_REGISTER 只能對 localhost 使用")
            name = f"lt{os.getpid()}_{next(_counter)}"
            r = self.client.post("/api/auth/register", json={"username": name, "password": "loadtest123"}, name="/api/auth/register")
        else:
            self.stop()
            return
        if r.status_code != 200:
            self.stop()
            return
        self.headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
        p = self.client.get("/api/profile", headers=self.headers).json()
        if not p.get("profile"):
            self.client.post("/api/profile/create", json={"klass": random.choice(["warrior", "mage", "priest"])},
                             headers=self.headers, name="/api/profile/create")

    @task(4)
    def profile(self):
        self.client.get("/api/profile", headers=self.headers)

    @task(2)
    def tower(self):
        self.client.get("/api/tower", headers=self.headers)

    @task(1)
    def pvp(self):
        self.client.get("/api/pvp/opponents", headers=self.headers)

    @task(1)
    def guild(self):
        self.client.get("/api/guilds/mine", headers=self.headers)

    @task(3)
    def worldboss(self):
        self.client.get("/api/worldboss", headers=self.headers)

    @task(1)
    def say(self):
        self.client.post("/api/chat/world", json={"text": "loadtest ping"}, headers=self.headers, name="/api/chat/world [POST]")


if os.environ.get("LOADTEST_STEPS"):

    class StepLoad(LoadTestShape):
        """階梯負載：LOADTEST_STEPS=25,50,100 → 每階維持 LOADTEST_STEP_SECONDS 秒（預設 45）"""

        steps = [int(x) for x in os.environ["LOADTEST_STEPS"].split(",")]
        seconds = int(os.environ.get("LOADTEST_STEP_SECONDS", "45"))

        def tick(self):
            i = int(self.get_run_time() // self.seconds)
            if i >= len(self.steps):
                return None
            users = self.steps[i]
            return users, max(5, users // 5)
