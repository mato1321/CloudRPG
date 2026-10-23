"""線上即時對戰：建立房間、用房號加入、快速配對、按鍵與畫面轉送、結果紀錄、斷線通知"""
import json

from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models.game import PvpMatch


def token(headers):
    return headers["Authorization"].split()[1]


def test_duel_room_flow(new_user):
    _, h1 = new_user("warrior")
    _, h2 = new_user("mage")
    with TestClient(app) as c:
        with c.websocket_connect(f"/api/ws/duel?token={token(h1)}") as host, c.websocket_connect(f"/api/ws/duel?token={token(h2)}") as guest:
            host.send_text(json.dumps({"t": "create", "fighter": "ryu", "stage": 2}))
            code = host.receive_json()["code"]
            assert len(code) == 4

            guest.send_text(json.dumps({"t": "join", "code": "ZZZZ", "fighter": "ken"}))
            assert guest.receive_json()["t"] == "error"
            guest.send_text(json.dumps({"t": "join", "code": code.lower(), "fighter": "ken"}))
            hs, gs = host.receive_json(), guest.receive_json()
            assert hs["t"] == gs["t"] == "start" and hs["role"] == "host" and gs["role"] == "guest"
            assert gs["host"]["fighter"] == "ryu" and gs["guest"]["fighter"] == "ken" and gs["stage"] == 2

            # 對手的按鍵 → 房主；房主的畫面狀態 → 對手（原文轉送）
            guest.send_text(json.dumps({"t": "in", "c": "KeyF", "d": 1}))
            assert host.receive_json() == {"t": "in", "c": "KeyF", "d": 1}
            host.send_text(json.dumps({"t": "st", "s": {"timer": 98}}, separators=(",", ":")))
            assert guest.receive_json()["s"]["timer"] == 98
            # 只有房主能送畫面狀態
            guest.send_text(json.dumps({"t": "st", "s": {"timer": 1}}, separators=(",", ":")))

            host.send_text(json.dumps({"t": "end", "winner": "guest"}))
            assert guest.receive_json() == {"t": "end", "winner": "guest"}
            host.send_text(json.dumps({"t": "end", "winner": "host"}))  # 同一場不能回報兩次
            host.send_text(json.dumps({"t": "rematch"}))
            assert guest.receive_json() == {"t": "rematch"}

            host.close()
            assert guest.receive_json()["t"] == "left"

    db = SessionLocal()
    rows = db.query(PvpMatch).filter(PvpMatch.defender_ref.like("duel:%")).all()
    db.close()
    assert len(rows) == 1 and rows[0].win is False and rows[0].delta == 0


def test_duel_quick_match_and_login_required(new_user):
    _, h1 = new_user()
    _, h2 = new_user()
    with TestClient(app) as c:
        with c.websocket_connect("/api/ws/duel") as anon:
            assert anon.receive_json()["t"] == "error"
        with c.websocket_connect(f"/api/ws/duel?token={token(h1)}") as a, c.websocket_connect(f"/api/ws/duel?token={token(h2)}") as b:
            a.send_text(json.dumps({"t": "queue", "fighter": "chun"}))
            assert a.receive_json()["t"] == "waiting"
            b.send_text(json.dumps({"t": "queue", "fighter": "bad id!"}))
            sa, sb = a.receive_json(), b.receive_json()
            assert sa["role"] == "host" and sb["role"] == "guest"
            assert sb["guest"]["fighter"] == "warrior_rpg"  # 不合法的角色 id 換成預設
