"""伺服器端經濟、防作弊與各遊戲模式的整合測試（SQLite）"""
import datetime as dt
import uuid

from app.db.database import SessionLocal
from app.game import economy as E
from app.models.game import BattleSession, PlayerProfile


def age_battle(battle_id: str, seconds: int):
    """把戰鬥開始時間往前推，模擬真的打了這麼久"""
    db = SessionLocal()
    s = db.query(BattleSession).filter(BattleSession.id == uuid.UUID(battle_id)).first()
    s.started_at = s.started_at - dt.timedelta(seconds=seconds)
    db.commit()
    db.close()


def set_gold(username_headers, client, gold):
    db = SessionLocal()
    me = client.get("/api/profile", headers=username_headers).json()
    from app.models.user import User

    u = db.query(User).filter(User.username == me["username"]).first()
    row = db.query(PlayerProfile).filter(PlayerProfile.user_id == u.id).first()
    data = dict(row.data)
    data["gold"] = gold
    row.data = data
    db.commit()
    db.close()


# ───────────── 經濟規則（純函式） ─────────────

def test_level_curve_matches_client():
    assert E.exp_needed(1) == 200
    assert E.exp_needed(2) == 280
    assert E.exp_needed(3) == 392
    p = E.new_profile("warrior")
    assert E.grant_xp(p, 500) == 2 and p["level"] == 3 and p["exp"] == 20


def test_weapon_upgrade_cap_and_basic_blocked_after_adv():
    p = E.new_profile("mage")
    p["gold"] = 100_000
    for _ in range(4):
        E.buy(p, "weapon_basic")
    assert p["inv"]["weapon_basic"] == 4
    try:
        E.buy(p, "weapon_basic")
        assert False, "should hit +3 cap"
    except E.GameError:
        pass
    E.buy(p, "weapon_adv")
    try:
        E.buy(p, "weapon_basic")
        assert False
    except E.GameError as e:
        assert "高級武器" in str(e)
    d = E.derived(p)
    assert d["weaponTier"] == 2 and d["weaponPlus"] == 0
    assert d["atk"] == 15 + (15 + 6 * 3) + 35


def test_gear_roll_and_equip():
    import random

    p = E.new_profile("priest")
    item = E.roll_gear(random.Random(1), 10, luck=1.0, min_rarity="epic")
    assert item["rarity"] in ("epic", "legend", "myth")
    E.add_gear(p, item)
    E.equip(p, item["id"])
    assert E.derived(p)["rarityGlow"] == item["rarity"]
    gold = E.salvage(p, item["id"])
    assert gold > 0 and not p["gear"] and not p["equippedGear"]


# ───────────── API ─────────────

def test_shop_and_progress_cannot_be_cheated(client, new_user):
    _, h = new_user("warrior")
    prof = client.get("/api/profile", headers=h).json()["profile"]
    assert prof["gold"] == 50
    r = client.post("/api/shop/buy", json={"item_id": "weapon_adv"}, headers=h)
    assert r.status_code == 400 and "金幣不足" in r.json()["detail"]

    # 客戶端想在存檔裡把金幣改成 99999、塞進終端機 → 伺服器忽略
    client.post("/api/progress/save", json={"state": {"sceneId": "hub", "gold": 99999, "inv": {"terminus": 1}, "hp": 100}, "log": []}, headers=h)
    st = client.get("/api/progress/load", headers=h).json()["state"]
    assert st["gold"] == 50 and st["sceneId"] == "hub" and "terminus" not in st["inv"]

    r = client.post("/api/shop/buy", json={"item_id": "herb"}, headers=h)
    assert r.status_code == 400  # 50G 買不起 100G 草藥


def test_story_battle_validation_and_rewards(client, new_user):
    _, h = new_user("warrior")
    b = client.post("/api/battle/start", json={"mode": "story", "key": "minions"}, headers=h).json()
    # 秒殺 → 拒絕
    r = client.post("/api/battle/finish", json={"battle_id": b["battle_id"], "win": True, "duration_ms": 900}, headers=h)
    assert r.status_code == 400 and "不合理" in r.json()["detail"]

    b = client.post("/api/battle/start", json={"mode": "story", "key": "minions"}, headers=h).json()
    age_battle(b["battle_id"], 20)
    r = client.post("/api/battle/finish", json={"battle_id": b["battle_id"], "win": True, "duration_ms": 20000, "hp_left": 150, "items_used": {"herb": 1}}, headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["rewards"]["gold"] == 150 and body["rewards"]["xp"] == 100
    assert body["profile"]["gold"] == 200 and body["profile"]["inv"]["herb"] == 1
    assert "minions" in body["profile"]["bossesDefeated"]
    # 同一張憑證不能結算兩次
    r = client.post("/api/battle/finish", json={"battle_id": b["battle_id"], "win": True, "duration_ms": 20000}, headers=h)
    assert r.status_code == 409


def test_story_gating(client, new_user):
    _, h = new_user()
    r = client.post("/api/battle/start", json={"mode": "story", "key": "admin"}, headers=h)
    assert r.status_code == 403
    r = client.post("/api/battle/start", json={"mode": "story", "key": "demonlord"}, headers=h)
    assert r.status_code == 403


def test_world_boss_shared_hp_and_damage_cap(client, new_user):
    _, h1 = new_user("warrior")
    _, h2 = new_user("mage")
    boss0 = client.get("/api/worldboss").json()
    b = client.post("/api/battle/start", json={"mode": "worldboss"}, headers=h1).json()
    age_battle(b["battle_id"], 45)
    r = client.post("/api/battle/finish", json={"battle_id": b["battle_id"], "win": True, "duration_ms": 45000, "damage": 5000}, headers=h1).json()
    assert r["extra"]["raid"]["dealt"] == 5000
    # 回報一千萬傷害 → 被理論 DPS 封頂
    b = client.post("/api/battle/start", json={"mode": "worldboss"}, headers=h2).json()
    age_battle(b["battle_id"], 45)
    r = client.post("/api/battle/finish", json={"battle_id": b["battle_id"], "win": True, "duration_ms": 45000, "damage": 10_000_000}, headers=h2).json()
    assert r["extra"]["raid"]["capped"] is True and r["extra"]["raid"]["dealt"] < 30000
    boss = client.get("/api/worldboss").json()
    assert boss["hp"] == boss0["hp"] - 5000 - r["extra"]["raid"]["dealt"]
    assert boss["participants"] == 2 and boss["top"][0]["damage"] >= 5000


def test_world_boss_kill_and_claim(client, new_user):
    _, h = new_user("warrior")
    from app.models.game import RaidBoss

    boss = client.get("/api/worldboss").json()
    db = SessionLocal()
    db.query(RaidBoss).filter(RaidBoss.id == boss["id"]).update({"hp": 100})
    db.commit()
    db.close()
    b = client.post("/api/battle/start", json={"mode": "worldboss"}, headers=h).json()
    age_battle(b["battle_id"], 30)
    r = client.post("/api/battle/finish", json={"battle_id": b["battle_id"], "win": True, "duration_ms": 30000, "damage": 3000}, headers=h).json()
    assert r["extra"]["raid"]["killed"] is True
    nxt = client.get("/api/worldboss", headers=h).json()
    assert nxt["id"] != boss["id"] and nxt["level"] == boss["level"] + 1 and nxt["unclaimed"] == 1
    c = client.post("/api/worldboss/claim", headers=h).json()
    assert c["claimed"] == 1 and c["gold"] >= 800 and len(c["gear"]) == 1
    assert client.post("/api/worldboss/claim", headers=h).status_code == 409


def test_tower_run(client, new_user):
    _, h = new_user("mage")
    t = client.post("/api/tower/start", headers=h).json()
    assert t["active"] and t["floor"] == 1
    b = client.post("/api/battle/start", json={"mode": "tower"}, headers=h).json()
    age_battle(b["battle_id"], 40)
    r = client.post("/api/battle/finish", json={"battle_id": b["battle_id"], "win": True, "duration_ms": 40000, "hp_left": 60}, headers=h).json()
    assert r["extra"]["tower"]["floor"] == 2 and r["extra"]["tower"]["pendingBlessing"]
    # 還沒選祝福不能開下一層
    assert client.post("/api/battle/start", json={"mode": "tower"}, headers=h).status_code == 409
    t = client.post("/api/tower/blessing", json={"blessing": "power"}, headers=h).json()
    assert t["buffs"]["power"] == 1 and not t["pendingBlessing"]
    b = client.post("/api/battle/start", json={"mode": "tower"}, headers=h).json()
    assert b["player"]["buffPct"] == 12
    age_battle(b["battle_id"], 10)
    r = client.post("/api/battle/finish", json={"battle_id": b["battle_id"], "win": False, "duration_ms": 10000}, headers=h).json()
    assert r["extra"]["tower"]["status"] == "ended" and r["extra"]["tower"]["best"] == 1
    lb = client.get("/api/leaderboard/tower").json()
    assert any(row["value"] == 1 for row in lb["rows"])


def test_daily_challenge(client, new_user):
    name, h = new_user("priest")
    info = client.get("/api/daily").json()
    assert len(info["enemy"]["modifiers"]) >= 2
    b = client.post("/api/battle/start", json={"mode": "daily"}, headers=h).json()
    assert b["seed"] == client.post("/api/battle/start", json={"mode": "daily"}, headers=h).json()["seed"]  # 同一天同種子
    age_battle(b["battle_id"], 90)
    r = client.post("/api/battle/finish", json={"battle_id": b["battle_id"], "win": True, "duration_ms": 90000, "hp_left": 80, "max_combo": 12}, headers=h).json()
    assert r["extra"]["daily"]["newBest"] and r["rewards"]["gold"] == 300
    top = client.get("/api/daily").json()["top"]
    assert top[0]["username"] == name


def test_guild_and_chat(client, new_user):
    n1, h1 = new_user()
    n2, h2 = new_user()
    set_gold(h1, client, 5000)
    r = client.post("/api/guilds", json={"tag": "abc", "name": "測試公會", "description": "hi"}, headers=h1)
    assert r.status_code == 200, r.text
    gid = r.json()["guild"]["id"]
    assert client.get("/api/profile", headers=h1).json()["profile"]["gold"] == 4000
    assert client.post(f"/api/guilds/{gid}/join", headers=h2).json()["guild"]["members"] == 2
    assert client.post("/api/chat/guild", json={"text": "大家好"}, headers=h2).status_code == 200
    msgs = client.get("/api/chat/guild", headers=h1).json()["messages"]
    assert msgs[-1]["text"] == "大家好" and msgs[-1]["user"] == n2
    # 太快連發會被限流
    assert client.post("/api/chat/world", json={"text": "1"}, headers=h1).status_code == 200
    assert client.post("/api/chat/world", json={"text": "2"}, headers=h1).status_code == 429
    # 公會 Boss
    b = client.post("/api/battle/start", json={"mode": "guildboss"}, headers=h2).json()
    age_battle(b["battle_id"], 45)
    r = client.post("/api/battle/finish", json={"battle_id": b["battle_id"], "win": True, "duration_ms": 45000, "damage": 4000}, headers=h2).json()
    assert r["extra"]["raid"]["dealt"] == 4000
    mine = client.get("/api/guilds/mine", headers=h1).json()
    assert mine["members"][0]["username"] == n2 and mine["guild"]["weeklyDamage"] == 4000
    # 會長退出 → 會長轉移
    client.post("/api/guilds/leave", headers=h1)
    assert client.get("/api/guilds/mine", headers=h2).json()["role"] == "leader"


def test_pvp(client, new_user):
    _, h1 = new_user("warrior")
    _, h2 = new_user("mage")
    opps = client.get("/api/pvp/opponents", headers=h1).json()
    assert opps["rating"] == 1000 and len(opps["opponents"]) >= 1
    target = next(o for o in opps["opponents"] if not o["bot"])
    b = client.post("/api/battle/start", json={"mode": "pvp", "ref": target["ref"]}, headers=h1).json()
    assert b["enemy"]["pvp"]["klass"] in ("warrior", "mage", "priest")
    age_battle(b["battle_id"], 40)
    r = client.post("/api/battle/finish", json={"battle_id": b["battle_id"], "win": True, "duration_ms": 40000}, headers=h1).json()
    assert r["extra"]["pvp"]["delta"] > 0 and r["extra"]["pvp"]["rating"] > 1000


def test_guest_import_only_trusts_first_chapter(client, new_user):
    _, h = new_user(with_profile=False)
    r = client.post("/api/profile/import-guest", json={"klass": "mage", "claims": ["wasteland_loot", "fake"], "beatMinions": True}, headers=h).json()
    p = r["profile"]
    assert r["imported"] and p["klass"] == "mage" and p["gold"] == 200 and p["inv"]["herb"] == 5
    again = client.post("/api/profile/import-guest", json={"klass": "warrior", "beatMinions": True}, headers=h).json()
    assert not again["imported"] and again["profile"]["klass"] == "mage"


def test_expired_token_is_401(client):
    r = client.get("/api/progress/load", headers={"Authorization": "Bearer not-a-token"})
    assert r.status_code == 401


def test_websocket_pushes_chat(client, new_user):
    name, h = new_user()
    token = h["Authorization"].split()[1]
    with client.websocket_connect(f"/api/ws?token={token}") as ws:
        hello = ws.receive_json()
        assert hello["type"] == "hello" and "world" in hello["channels"]
        client.post("/api/chat/world", json={"text": "即時訊息"}, headers=h)
        msg = ws.receive_json()
        assert msg["type"] == "chat" and msg["message"]["text"] == "即時訊息" and msg["message"]["user"] == name
