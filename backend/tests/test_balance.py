"""平衡規則：重複擊敗打折、每日金幣軟上限、PvP 打 Bot 的金幣、塔金幣樓層上限、管理員平衡報表"""
from app.game import data as D
from app.game import economy as E
from test_game import age_battle


def win_story(client, h, key="minions", seconds=20):
    b = client.post("/api/battle/start", json={"mode": "story", "key": key}, headers=h).json()
    age_battle(b["battle_id"], seconds)
    r = client.post("/api/battle/finish", json={"battle_id": b["battle_id"], "win": True, "duration_ms": seconds * 1000, "hp_left": 100}, headers=h)
    assert r.status_code == 200, r.text
    return r.json()


def test_repeat_story_kills_pay_less(client, new_user):
    _, h = new_user("warrior")
    first = win_story(client, h)["rewards"]
    again = win_story(client, h)["rewards"]
    assert first["gold"] == D.ENEMIES["minions"]["gold"]
    assert again["gold"] == int(D.ENEMIES["minions"]["gold"] * D.REPEAT_REWARD["mob"])
    assert again["xp"] == int(D.ENEMIES["minions"]["xp"] * D.REPEAT_REWARD["mob"])


def test_daily_soft_cap():
    p = {"gold": 0}
    day = "2026-10-23"
    assert E.apply_income(p, D.DAILY_GOLD_SOFT_CAP - 100, day) == D.DAILY_GOLD_SOFT_CAP - 100
    # 跨過軟上限：上限內的 100 全額，超過的 900 只給 SOFT_CAP_RATE
    assert E.apply_income(p, 1000, day) == 100 + int(900 * D.SOFT_CAP_RATE)
    assert E.apply_income(p, 1000, day) == int(1000 * D.SOFT_CAP_RATE)
    # 到達硬上限之後就不再入帳
    E.apply_income(p, 10**7, day)
    assert p["earn"]["gold"] == D.DAILY_GOLD_HARD_CAP
    assert E.apply_income(p, 1000, day) == 0
    # 換日歸零
    assert E.apply_income(p, 500, "2026-10-24") == 500


def test_tower_gold_stops_growing():
    cap = D.TOWER_GOLD_FLOOR_CAP
    assert E.tower_rewards(cap + 20)["gold"] == E.tower_rewards(cap)["gold"]
    assert E.tower_rewards(cap + 20)["xp"] > E.tower_rewards(cap)["xp"]


def test_pvp_bot_pays_less(client, new_user):
    _, h = new_user("warrior")
    b = client.post("/api/battle/start", json={"mode": "pvp", "ref": "bot:1"}, headers=h).json()
    age_battle(b["battle_id"], 40)
    r = client.post("/api/battle/finish", json={"battle_id": b["battle_id"], "win": True, "duration_ms": 40000}, headers=h).json()
    assert r["rewards"]["gold"] == D.PVP_WIN_GOLD["bot"]


def test_admin_balance_report(client, new_user):
    _, h = new_user("warrior")
    win_story(client, h)
    assert client.get("/api/admin/balance", headers=h).status_code == 403

    r = client.post("/api/auth/register", json={"username": "admin", "password": "pass1234"})
    if r.status_code != 200:  # 其他測試可能已經註冊過
        r = client.post("/api/auth/login", json={"username": "admin", "password": "pass1234"})
    ha = {"Authorization": f"Bearer {r.json()['access_token']}"}
    rep = client.get("/api/admin/balance?days=7", headers=ha).json()
    story = next(x for x in rep["battles"] if x["mode"] == "story" and x["enemy"] == "minions")
    assert story["count"] >= 1 and 0 <= story["winRate"] <= 1
    assert rep["economy"]["players"] >= 1 and "median" in rep["economy"]["gold"]
    assert any(x["mode"] == "story" for x in rep["income"])
