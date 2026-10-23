"""即時連線房間：對戰（建立 / 加入 / 大廳換角色 / 開始 / 轉送 / 結果 / 再戰）、快速配對、組隊共鬥（3 人）"""
import json

from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models.game import PvpMatch


def token(headers):
    return headers["Authorization"].split()[1]


def send(ws, **msg):
    ws.send_text(json.dumps(msg, separators=(",", ":")))


def recv(ws, t):
    """讀到指定類型的訊息為止（跳過大廳更新等其他訊息）"""
    while True:
        m = ws.receive_json()
        if m["t"] == t:
            return m


def test_duel_lobby_pick_start_relay_end(new_user):
    _, h1 = new_user("warrior")
    _, h2 = new_user("mage")
    with TestClient(app) as c:
        with c.websocket_connect(f"/api/ws/duel?token={token(h1)}") as host, c.websocket_connect(f"/api/ws/duel?token={token(h2)}") as guest:
            send(host, t="create", kind="duel", fighter="ryu", stage=2)
            code = recv(host, "lobby")["code"]
            send(guest, t="join", code="ZZZZ", fighter="ken")
            assert recv(guest, "error")
            send(guest, t="join", code=code.lower(), fighter="ken")
            lobby = recv(guest, "lobby")
            assert lobby["you"] == 1 and [p["fighter"] for p in lobby["players"]] == ["ryu", "ken"]

            # 大廳裡換角色；只有房主能換場地
            send(guest, t="pick", fighter="chun", stage=5)
            lobby = recv(host, "lobby")
            lobby = recv(host, "lobby") if lobby["players"][1]["fighter"] != "chun" else lobby
            assert lobby["players"][1]["fighter"] == "chun" and lobby["stage"] == 2

            send(guest, t="go")  # 對手不能開始
            send(host, t="go")
            hs, gs = recv(host, "start"), recv(guest, "start")
            assert hs["you"] == 0 and gs["you"] == 1 and gs["players"][1]["fighter"] == "chun"

            send(guest, t="in", c="KeyF", d=1)
            assert recv(host, "in") == {"t": "in", "s": 1, "c": "KeyF", "d": 1}
            send(host, t="st", s={"timer": 98})
            assert recv(guest, "st")["s"]["timer"] == 98
            send(guest, t="pick", fighter="ryu")  # 開打後不能換角色（沒有回應）

            send(host, t="end", winner="guest")
            assert recv(guest, "end")["result"] == {"winner": "guest"}
            assert recv(guest, "lobby")["players"][1]["fighter"] == "chun"  # 結束後回到大廳
            send(host, t="go")
            assert recv(guest, "start")

            host.close()
            assert recv(guest, "left")

    db = SessionLocal()
    rows = db.query(PvpMatch).filter(PvpMatch.defender_ref.like("duel:%")).all()
    db.close()
    assert len(rows) == 1 and rows[0].win is False and rows[0].delta == 0


def test_quick_match_and_login_required(new_user):
    _, h1 = new_user()
    _, h2 = new_user()
    with TestClient(app) as c:
        with c.websocket_connect("/api/ws/duel") as anon:
            assert anon.receive_json()["t"] == "error"
        with c.websocket_connect(f"/api/ws/duel?token={token(h1)}") as a, c.websocket_connect(f"/api/ws/duel?token={token(h2)}") as b:
            send(a, t="queue", fighter="chun")
            assert recv(a, "waiting")
            send(b, t="queue", fighter="bad id!")
            la, lb = recv(a, "lobby"), recv(b, "lobby")
            assert la["you"] == 0 and lb["you"] == 1
            assert lb["players"][1]["fighter"] == "warrior_rpg"  # 不合法的角色 id 換成預設


def test_coop_room_three_players(new_user):
    hs = [new_user()[1] for _ in range(3)]
    with TestClient(app) as c:
        with c.websocket_connect(f"/api/ws/duel?token={token(hs[0])}") as a, \
             c.websocket_connect(f"/api/ws/duel?token={token(hs[1])}") as b, \
             c.websocket_connect(f"/api/ws/duel?token={token(hs[2])}") as d:
            send(a, t="create", kind="coop", fighter="warrior_rpg")
            code = recv(a, "lobby")["code"]
            send(b, t="join", code=code, fighter="mage_rpg")
            send(d, t="join", code=code, fighter="priest_rpg")
            lobby = recv(d, "lobby")
            assert lobby["kind"] == "coop" and lobby["capacity"] == 4 and lobby["you"] == 2 and len(lobby["players"]) == 3
            send(a, t="go")
            for ws in (a, b, d):
                assert len(recv(ws, "start")["players"]) == 3
            send(d, t="in", c="KeyR", d=1)
            assert recv(a, "in")["s"] == 2
            send(a, t="st", s={"bossHp": 100})
            assert recv(b, "st")["s"]["bossHp"] == 100 and recv(d, "st")["s"]["bossHp"] == 100
            send(a, t="end", result={"win": True, "damage": [10, 20, 30]})
            assert recv(b, "end")["result"]["damage"] == [10, 20, 30]
            b.close()
            assert recv(a, "dropped")["slot"] == 1


def test_held_keys_resync_is_relayed(new_user):
    _, h1 = new_user()
    _, h2 = new_user()
    with TestClient(app) as c:
        with c.websocket_connect(f"/api/ws/duel?token={token(h1)}") as a, c.websocket_connect(f"/api/ws/duel?token={token(h2)}") as b:
            send(a, t="create", kind="coop", fighter="warrior_rpg")
            code = recv(a, "lobby")["code"]
            send(b, t="join", code=code, fighter="mage_rpg")
            recv(a, "lobby")
            send(a, t="go")
            recv(a, "start")
            send(b, t="in", c="HELD", d=1, h="KeyD,KeyW")
            assert recv(a, "in") == {"t": "in", "s": 1, "c": "HELD", "d": 1, "h": "KeyD,KeyW"}
