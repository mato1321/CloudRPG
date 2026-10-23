"""戰鬥憑證：開打前向伺服器領 battle_id，結束時回報結果，由伺服器驗證並發放獎勵。

防作弊重點：
  - 獎勵數值完全由伺服器決定（客戶端只回報輸贏與統計）
  - battle_id 一次性、綁定玩家、30 分鐘內有效
  - 用「伺服器量到的經過時間」檢查：比理論最快擊殺時間還快 → 拒絕
  - 團隊 Boss 回報的傷害會被「理論最高 DPS × 時間」封頂
"""
import datetime as dt
import random
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, is_admin
from app.core.ratelimit import enforce
from app.db.database import get_db
from app.game import data as D
from app.game import economy as E
from app.game import services as S
from app.models.game import BattleSession, DailyScore, PlayerProfile, PvpMatch, TowerRun
from app.models.user import User
from app.realtime import hub

router = APIRouter(prefix="/api/battle", tags=["battle"])

SESSION_TTL = dt.timedelta(minutes=30)


class StartReq(BaseModel):
    mode: str
    key: Optional[str] = None
    ref: Optional[str] = None


class FinishReq(BaseModel):
    battle_id: str
    win: bool
    duration_ms: int = Field(ge=0, le=3_600_000)
    damage: int = Field(default=0, ge=0)
    hp_left: int = Field(default=0, ge=0)
    max_combo: int = Field(default=0, ge=0)
    items_used: dict = Field(default_factory=dict)


def _profile(db: Session, user: User):
    row = S.get_profile(db, user, lock=True)
    if not row:
        raise HTTPException(status_code=409, detail="尚未建立角色，請先到 PLAY 選擇職業")
    return row


def _pvp_opponent(db: Session, ref: str, me: User) -> dict:
    """PvP 對手：真人玩家的 AI 分身，或內建練習 Bot"""
    if ref.startswith("bot:"):
        bot = next((b for b in D.PVP_BOTS if b["id"] == ref), None)
        if not bot:
            raise HTTPException(status_code=404, detail="找不到對手")
        p = E.new_profile(bot["klass"])
        p["level"] = bot["level"]
        p["inv"]["weapon_basic" if bot["level"] < 15 else "weapon_adv"] = 1 + min(3, bot["level"] // 10)
        return {"ref": ref, "name": bot["name"], "profile": p, "rating": 800 + bot["level"] * 20}
    try:
        uid = uuid.UUID(ref)
    except ValueError:
        raise HTTPException(status_code=404, detail="找不到對手")
    if uid == me.id:
        raise HTTPException(status_code=400, detail="不能挑戰自己")
    row = db.query(PlayerProfile).filter(PlayerProfile.user_id == uid).first()
    user = db.query(User).filter(User.id == uid).first()
    if not row or not user:
        raise HTTPException(status_code=404, detail="找不到對手")
    return {"ref": ref, "name": user.username, "profile": row.data, "rating": row.rating}


@router.post("/start")
def start(req: StartReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    enforce(f"battle:{user.id}", 30, 60, "開戰太頻繁，請稍後再試")
    row = _profile(db, user)
    p = row.data
    seed = random.randrange(1, 2**31)
    mode = req.mode
    params: dict = {"buffPct": 0, "energyStart": 0, "hpRatio": 1.0}
    extra: dict = {}

    if mode == "story":
        key = req.key or ""
        if key not in D.ENEMIES:
            raise HTTPException(status_code=400, detail="未知的敵人")
        inv = p.get("inv", {})
        if key == "demonlord" and not all(inv.get(s) for s in ("stone_red", "stone_blue", "stone_gold")):
            raise HTTPException(status_code=403, detail="需要集齊三顆傳說之石")
        if key in ("admin", "knight", "courtmage") and "demonlord" not in p.get("bossesDefeated", []):
            raise HTTPException(status_code=403, detail="擊敗魔王後解鎖")
        if key == "courtmage" and not inv.get("memory_1"):
            raise HTTPException(status_code=403, detail="先打倒騎士團長，取得記憶碎片・壹")
        base = D.ENEMIES[key]
        enemy = {"key": key, "name": base["name"], "hp": base["hp"], "atkScale": 1.0, "speedScale": 1.0, "modifiers": []}
        ref = None
    elif mode == "tower":
        run = db.query(TowerRun).filter(TowerRun.user_id == user.id, TowerRun.status == "active").first()
        if not run:
            raise HTTPException(status_code=409, detail="沒有進行中的攀登，請先開始挑戰")
        if run.pending_blessing:
            raise HTTPException(status_code=409, detail="請先選擇一個祝福")
        enemy = E.tower_floor(run.seed, run.floor)
        params.update(
            buffPct=12 * (run.buffs or {}).get("power", 0),
            energyStart=40 if (run.buffs or {}).get("energy") else 0,
            hpRatio=run.hp_ratio,
            floor=run.floor,
        )
        ref = str(run.id)
        extra["floor"] = run.floor
    elif mode == "daily":
        cfg = E.daily_config(S.today())
        enemy = cfg["enemy"]
        ref = cfg["day"]
        seed = cfg["seed"]  # 每日挑戰：所有人同一個種子
    elif mode in ("worldboss", "guildboss"):
        if mode == "worldboss":
            boss = S.current_world_boss(db)
        else:
            g = S.guild_of(db, user.id)
            if not g:
                raise HTTPException(status_code=403, detail="先加入公會才能挑戰公會 Boss")
            boss = S.current_guild_boss(db, g[0])
            if boss.defeated_at:
                raise HTTPException(status_code=409, detail="本週公會 Boss 已經被打倒了，下週一刷新")
        enemy = {
            "key": boss.boss_key, "name": boss.name, "hp": 999_999, "atkScale": 1.15, "speedScale": 1.0,
            "modifiers": [], "raid": {"bossId": boss.id, "hp": boss.hp, "hpMax": boss.hp_max},
            "timeLimit": D.RAID_TIME_LIMIT,
        }
        ref = str(boss.id)
    elif mode == "pvp":
        if not req.ref:
            raise HTTPException(status_code=400, detail="缺少對手")
        opp = _pvp_opponent(db, req.ref, user)
        op = opp["profile"]
        od = E.derived(op)
        enemy = {
            "key": op["klass"], "name": opp["name"], "hp": od["hpMax"], "atkScale": E.atk_mul(op), "speedScale": 1.0,
            "modifiers": [],
            "pvp": {"klass": op["klass"], "level": op["level"], "weaponTier": od["weaponTier"], "weaponPlus": od["weaponPlus"],
                    "rating": opp["rating"], "name": opp["name"]},
        }
        ref = opp["ref"]
        params["oppRating"] = opp["rating"]
    else:
        raise HTTPException(status_code=400, detail="未知的模式")

    params["enemy"] = enemy
    sess = BattleSession(user_id=user.id, mode=mode, enemy_key=enemy["key"], ref=ref, seed=seed, params=params)
    db.add(sess)
    db.commit()
    db.refresh(sess)
    return {
        "battle_id": str(sess.id),
        "seed": seed,
        "mode": mode,
        "enemy": enemy,
        "player": {
            "atkMul": E.atk_mul(p, params["buffPct"]),
            "buffPct": params["buffPct"],
            "energyStart": params["energyStart"],
            "hpRatio": params["hpRatio"],
        },
        "profile": E.public(p, is_admin(user)),
        "extra": extra,
    }


def _reject(db: Session, sess: BattleSession, reason: str):
    sess.status = "rejected"
    sess.finished_at = S.now_utc()
    sess.result = {"reason": reason}
    db.commit()
    raise HTTPException(status_code=400, detail=reason)


@router.post("/finish")
def finish(req: FinishReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    enforce(f"battle-finish:{user.id}", 30, 60, "結算太頻繁，請稍後再試")
    try:
        bid = uuid.UUID(req.battle_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="找不到這場戰鬥")
    sess = db.query(BattleSession).filter(BattleSession.id == bid).first()
    if not sess or sess.user_id != user.id:
        raise HTTPException(status_code=404, detail="找不到這場戰鬥")
    if sess.status != "pending":
        raise HTTPException(status_code=409, detail="這場戰鬥已經結算過了")
    now = S.now_utc()
    if now - sess.started_at > SESSION_TTL:
        _reject(db, sess, "戰鬥憑證已過期")

    row = _profile(db, user)
    p = S.data_of(row)
    params = sess.params or {}
    enemy = params.get("enemy", {})
    elapsed_ms = int((now - sess.started_at).total_seconds() * 1000)
    duration = min(req.duration_ms, elapsed_ms + 2000)
    buff = params.get("buffPct", 0)
    mode = sess.mode
    win = bool(req.win)
    raid = mode in ("worldboss", "guildboss")

    if win and not raid:
        need = E.min_win_ms(p, enemy.get("hp", 200), buff, "glass" in enemy.get("modifiers", []))
        if elapsed_ms < need:
            _reject(db, sess, f"戰鬥時間不合理（{elapsed_ms}ms < {need}ms），本場不計")

    E.consume(p, req.items_used)
    d = E.derived(p)
    hp_ratio = max(0.0, min(1.0, req.hp_left / max(1, d["hpMax"])))
    rewards = {"xp": 0, "gold": 0, "items": {}, "gear": [], "salvageGold": 0}
    extra: dict = {}

    def give_gear(level, luck=0.0, min_rarity=None):
        item = E.roll_gear(random.Random(sess.seed ^ len(rewards["gear"])), level, luck, min_rarity)
        rewards["salvageGold"] += E.add_gear(p, item)
        rewards["gear"].append(item)

    if mode == "story" and win:
        base = D.ENEMIES[sess.enemy_key]
        first = sess.enemy_key not in p.get("bossesDefeated", [])
        scale = 1.0 if first else E.repeat_scale(sess.enemy_key)  # 重複刷同一個敵人：獎勵打折
        rewards["xp"], rewards["gold"] = int(base["xp"] * scale), int(base["gold"] * scale)
        drop = base.get("drop")
        if drop and not p.get("inv", {}).get(drop):
            rewards["items"][drop] = 1
        if first:
            p.setdefault("bossesDefeated", []).append(sess.enemy_key)
            if base.get("boss"):
                give_gear(p["level"], 0.5, "rare")
        elif random.Random(sess.seed).random() < 0.2:
            give_gear(p["level"], 0.1)

    elif mode == "tower":
        run = db.query(TowerRun).filter(TowerRun.id == uuid.UUID(sess.ref)).first()
        if not run or run.status != "active":
            _reject(db, sess, "這次攀登已經結束")
        floor = run.floor
        if win:
            rw = E.tower_rewards(floor)
            rewards["xp"], rewards["gold"] = rw["xp"], rw["gold"]
            if floor % 5 == 0:
                give_gear(p["level"] + floor // 2, 0.15 * (floor // 5), "rare")
            elif random.Random(sess.seed).random() < 0.25:
                give_gear(p["level"] + floor // 3, 0.05 * floor)
            run.floor = floor + 1
            run.hp_ratio = max(0.15, hp_ratio)
            run.pending_blessing = True
            row.tower_best = max(row.tower_best or 0, floor)
        else:
            run.status = "ended"
            run.ended_at = now
            row.tower_best = max(row.tower_best or 0, floor - 1)
        extra["tower"] = {"floor": run.floor, "status": run.status, "best": row.tower_best, "pendingBlessing": run.pending_blessing}

    elif mode == "daily":
        score = E.daily_score(win, hp_ratio, duration, req.max_combo)
        ds = db.query(DailyScore).filter(DailyScore.day == sess.ref, DailyScore.user_id == user.id).first()
        if not ds:
            ds = DailyScore(day=sess.ref, user_id=user.id, score=0, duration_ms=0, cleared=False, rewarded=False)
            db.add(ds)
        best = score > (ds.score or 0)
        if best:
            ds.score, ds.duration_ms = score, duration
        if win:
            ds.cleared = True
            if not ds.rewarded:
                ds.rewarded = True
                rewards["gold"] = 300
                rewards["xp"] = 150
                give_gear(p["level"], 0.4)
        extra["daily"] = {"score": score, "best": ds.score, "newBest": best}

    elif raid:
        from app.models.game import RaidBoss

        boss = db.query(RaidBoss).filter(RaidBoss.id == int(sess.ref)).first()
        cap = E.damage_cap(p, min(duration, elapsed_ms, (D.RAID_TIME_LIMIT + 3) * 1000), buff)
        dmg = min(req.damage, cap)
        boss, killed = S.apply_raid_damage(db, boss, user.id, dmg)
        rewards["xp"] = min(400, 50 + dmg // 200)
        rewards["gold"] = min(600, 50 + dmg // 100)
        state = S.raid_state(db, boss, user.id)
        extra["raid"] = {**state, "dealt": dmg, "capped": req.damage > cap, "killed": killed}
        channel = "world" if boss.scope == "world" else boss.scope
        hub.publish_from_thread(channel, {"type": "raid", "boss": {k: state[k] for k in ("id", "scope", "name", "hp", "hpMax", "defeated", "participants")}, "by": user.username, "dealt": dmg, "killed": killed})

    elif mode == "pvp":
        my_rating = row.rating or D.PVP_START_RATING
        opp_rating = params.get("oppRating", D.PVP_START_RATING)
        delta = E.elo(my_rating, opp_rating, win)
        row.rating = max(100, my_rating + delta)
        if win:
            row.pvp_wins = (row.pvp_wins or 0) + 1
            earn = E.daily_earn(p, S.today())
            earn["pvpWins"] += 1
            is_bot = (sess.ref or "").startswith("bot:")
            gold = D.PVP_WIN_GOLD["bot" if is_bot else "player"] if earn["pvpWins"] <= D.PVP_DAILY_GOLD_WINS else 0
            rewards["gold"], rewards["xp"] = gold, 60
        else:
            row.pvp_losses = (row.pvp_losses or 0) + 1
        if sess.ref and not sess.ref.startswith("bot:"):
            opp = db.query(PlayerProfile).filter(PlayerProfile.user_id == uuid.UUID(sess.ref)).first()
            if opp:
                opp.rating = max(100, (opp.rating or D.PVP_START_RATING) - delta // 2)
        db.add(PvpMatch(attacker_id=user.id, defender_ref=sess.ref or "", win=win, delta=delta))
        extra["pvp"] = {"rating": row.rating, "delta": delta, "wins": row.pvp_wins, "losses": row.pvp_losses}

    E.add_items(p, rewards["items"])
    rewards["gold"] = E.apply_income(p, rewards["gold"], S.today())  # 每日金幣軟上限
    p["gold"] += rewards["gold"]
    level_ups = E.grant_xp(p, rewards["xp"])
    sess.status = "won" if win else "lost"
    sess.finished_at = now
    sess.result = {"duration": duration, "elapsed": elapsed_ms, "damage": req.damage, "combo": req.max_combo, "hpRatio": round(hp_ratio, 3), "rewards": {k: rewards[k] for k in ("xp", "gold")}}
    S.save(db, row, p)
    return {
        "ok": True,
        "win": win,
        "rewards": rewards,
        "levelUps": level_ups,
        "profile": E.public(p, is_admin(user)),
        "extra": extra,
    }
