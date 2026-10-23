"""可重複遊玩的模式與社交：故障之塔、每日挑戰、世界 Boss、公會、非同步 PvP、排行榜。"""
import random
import re
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_optional_user, is_admin
from app.core.ratelimit import enforce
from app.db.database import get_db
from app.game import data as D
from app.game import economy as E
from app.game import services as S
from app.models.game import (
    DailyScore, Guild, GuildMember, PlayerProfile, RaidBoss, RaidDamage, TowerRun,
)
from app.models.user import User
from app.realtime import hub

router = APIRouter(tags=["modes"])


def _profile(db: Session, user: User, lock: bool = False) -> PlayerProfile:
    row = S.get_profile(db, user, lock=lock)
    if not row:
        raise HTTPException(status_code=409, detail="尚未建立角色，請先到 PLAY 選擇職業")
    return row


# ───────────── 故障之塔 ─────────────

def _run_view(run: TowerRun | None, best: int) -> dict:
    if not run:
        return {"active": False, "best": best}
    return {
        "active": run.status == "active",
        "id": str(run.id),
        "floor": run.floor,
        "buffs": run.buffs or {},
        "hpRatio": run.hp_ratio,
        "pendingBlessing": run.pending_blessing,
        "next": E.tower_floor(run.seed, run.floor),
        "best": best,
        "blessings": D.BLESSINGS,
        "modifiers": D.MODIFIERS,
    }


@router.get("/api/tower")
def tower_state(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = _profile(db, user)
    run = db.query(TowerRun).filter(TowerRun.user_id == user.id, TowerRun.status == "active").first()
    return _run_view(run, row.tower_best or 0)


@router.post("/api/tower/start")
def tower_start(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = _profile(db, user)
    for old in db.query(TowerRun).filter(TowerRun.user_id == user.id, TowerRun.status == "active").all():
        old.status = "ended"
        old.ended_at = S.now_utc()
    run = TowerRun(user_id=user.id, seed=random.randrange(1, 2**31), floor=1, buffs={}, hp_ratio=1.0)
    db.add(run)
    db.commit()
    db.refresh(run)
    return _run_view(run, row.tower_best or 0)


class BlessingReq(BaseModel):
    blessing: str


@router.post("/api/tower/blessing")
def tower_blessing(req: BlessingReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = _profile(db, user, lock=True)
    run = db.query(TowerRun).filter(TowerRun.user_id == user.id, TowerRun.status == "active").first()
    if not run or not run.pending_blessing:
        raise HTTPException(status_code=409, detail="現在不能選祝福")
    if req.blessing not in D.BLESSINGS:
        raise HTTPException(status_code=400, detail="未知的祝福")
    buffs = dict(run.buffs or {})
    if req.blessing == "heal":
        run.hp_ratio = min(1.0, run.hp_ratio + 0.4)
    elif req.blessing == "power":
        buffs["power"] = buffs.get("power", 0) + 1
    elif req.blessing == "energy":
        buffs["energy"] = True
    elif req.blessing == "herb":
        data = S.data_of(row)
        E.add_items(data, {"herb": 2})
        S.save(db, row, data)
    run.buffs = buffs
    run.pending_blessing = False
    db.commit()
    db.refresh(run)
    return _run_view(run, row.tower_best or 0)


@router.post("/api/tower/abandon")
def tower_abandon(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = _profile(db, user)
    run = db.query(TowerRun).filter(TowerRun.user_id == user.id, TowerRun.status == "active").first()
    if run:
        run.status = "ended"
        run.ended_at = S.now_utc()
        db.commit()
    return _run_view(None, row.tower_best or 0)


# ───────────── 每日挑戰 ─────────────

@router.get("/api/daily")
def daily_info(user: Optional[User] = Depends(get_optional_user), db: Session = Depends(get_db)):
    day = S.today()
    cfg = E.daily_config(day)
    mine = None
    if user:
        ds = db.query(DailyScore).filter(DailyScore.day == day, DailyScore.user_id == user.id).first()
        if ds:
            mine = {"score": ds.score, "cleared": ds.cleared, "rewarded": ds.rewarded}
    return {
        "day": day,
        "enemy": cfg["enemy"],
        "modifiers": {k: D.MODIFIERS[k] for k in cfg["enemy"]["modifiers"]},
        "mine": mine,
        "top": _daily_top(db, day, 20),
    }


def _daily_top(db: Session, day: str, n: int):
    rows = (
        db.query(DailyScore, User.username)
        .join(User, User.id == DailyScore.user_id)
        .filter(DailyScore.day == day)
        .order_by(DailyScore.score.desc())
        .limit(n)
        .all()
    )
    return [{"username": u, "score": d.score, "cleared": d.cleared, "durationMs": d.duration_ms} for d, u in rows]


# ───────────── 世界 Boss / 公會 Boss ─────────────

@router.get("/api/worldboss")
def worldboss_state(user: Optional[User] = Depends(get_optional_user), db: Session = Depends(get_db)):
    boss = S.current_world_boss(db)
    state = S.raid_state(db, boss, user.id if user else None)
    state["online"] = hub.online()
    state["unclaimed"] = len(S.unclaimed_raid_rewards(db, user.id, "world")) if user else 0
    return state


def _claim_raid(db: Session, user: User, prefix: str):
    row = _profile(db, user, lock=True)
    data = S.data_of(row)
    total_gold = 0
    gear = []
    claimed = 0
    for dmg, boss in S.unclaimed_raid_rewards(db, user.id, prefix):
        gold = 800 + min(2000, int(dmg.damage) // 50)
        data["gold"] += gold
        total_gold += gold
        item = E.roll_gear(random.Random(boss.id * 7919 + hash(str(user.id)) % 10007), data["level"] + boss.level, 0.6, "rare")
        total_gold += E.add_gear(data, item)
        gear.append(item)
        dmg.rewarded = True
        claimed += 1
    if not claimed:
        db.rollback()
        raise HTTPException(status_code=409, detail="目前沒有可以領取的獎勵")
    S.save(db, row, data)
    return {"ok": True, "claimed": claimed, "gold": total_gold, "gear": gear, "profile": E.public(data, is_admin(user))}


@router.post("/api/worldboss/claim")
def worldboss_claim(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _claim_raid(db, user, "world")


# ───────────── 公會 ─────────────

class GuildCreateReq(BaseModel):
    tag: str = Field(min_length=2, max_length=5)
    name: str = Field(min_length=2, max_length=24)
    description: str = Field(default="", max_length=140)


def _guild_card(db: Session, g: Guild) -> dict:
    members = db.query(func.count(GuildMember.user_id)).filter(GuildMember.guild_id == g.id).scalar() or 0
    boss = db.query(RaidBoss).filter(RaidBoss.scope == f"guild:{g.id}", RaidBoss.period == S.week_key()).first()
    weekly = 0
    if boss:
        weekly = db.query(func.coalesce(func.sum(RaidDamage.damage), 0)).filter(RaidDamage.boss_id == boss.id).scalar() or 0
    leader = db.query(User.username).filter(User.id == g.leader_id).scalar()
    return {
        "id": str(g.id), "tag": g.tag, "name": g.name, "description": g.description or "",
        "members": members, "maxMembers": D.GUILD_MAX_MEMBERS, "leader": leader,
        "weeklyDamage": int(weekly), "bossDefeated": bool(boss and boss.defeated_at),
    }


@router.get("/api/guilds")
def guild_list(q: str = "", db: Session = Depends(get_db)):
    query = db.query(Guild)
    if q:
        like = f"%{q}%"
        query = query.filter((Guild.name.ilike(like)) | (Guild.tag.ilike(like)))
    cards = [_guild_card(db, g) for g in query.order_by(Guild.created_at).limit(50).all()]
    cards.sort(key=lambda c: (-c["weeklyDamage"], -c["members"]))
    return {"guilds": cards, "week": S.week_key()}


@router.get("/api/guilds/mine")
def guild_mine(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    gm = S.guild_of(db, user.id)
    if not gm:
        return {"guild": None}
    g, me = gm
    boss = S.current_guild_boss(db, g)
    rows = (
        db.query(GuildMember, User.username, PlayerProfile)
        .join(User, User.id == GuildMember.user_id)
        .outerjoin(PlayerProfile, PlayerProfile.user_id == GuildMember.user_id)
        .filter(GuildMember.guild_id == g.id)
        .all()
    )
    dmg = {str(r.user_id): int(r.damage) for r in db.query(RaidDamage).filter(RaidDamage.boss_id == boss.id).all()}
    members = []
    for m, uname, prof in rows:
        pdata = (prof.data if prof else {}) or {}
        members.append({
            "username": uname, "role": m.role, "level": pdata.get("level", 1),
            "klass": pdata.get("klass"), "weeklyDamage": dmg.get(str(m.user_id), 0),
        })
    members.sort(key=lambda x: -x["weeklyDamage"])
    return {
        "guild": _guild_card(db, g),
        "role": me.role,
        "members": members,
        "boss": S.raid_state(db, boss, user.id),
        "unclaimed": len(S.unclaimed_raid_rewards(db, user.id, f"guild:{g.id}")),
    }


@router.post("/api/guilds")
def guild_create(req: GuildCreateReq, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    enforce(f"guild:{user.id}", 5, 60)
    if S.guild_of(db, user.id):
        raise HTTPException(status_code=409, detail="你已經在公會裡了，請先退出")
    tag = req.tag.strip().upper()
    if not re.fullmatch(r"[A-Z0-9]{2,5}", tag):
        raise HTTPException(status_code=400, detail="公會標籤只能用 2～5 個英文字母或數字")
    if db.query(Guild).filter((Guild.tag == tag) | (Guild.name == req.name.strip())).first():
        raise HTTPException(status_code=409, detail="公會名稱或標籤已被使用")
    row = _profile(db, user, lock=True)
    data = S.data_of(row)
    if not is_admin(user):
        if data["gold"] < D.GUILD_CREATE_PRICE:
            raise HTTPException(status_code=400, detail=f"建立公會需要 {D.GUILD_CREATE_PRICE}G")
        data["gold"] -= D.GUILD_CREATE_PRICE
    g = Guild(tag=tag, name=req.name.strip(), description=req.description.strip(), leader_id=user.id)
    db.add(g)
    db.flush()
    db.add(GuildMember(user_id=user.id, guild_id=g.id, role="leader"))
    S.save(db, row, data)
    return guild_mine(user, db)


@router.post("/api/guilds/{guild_id}/join")
def guild_join(guild_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    enforce(f"guild:{user.id}", 5, 60)
    _profile(db, user)
    if S.guild_of(db, user.id):
        raise HTTPException(status_code=409, detail="你已經在公會裡了，請先退出")
    try:
        g = db.query(Guild).filter(Guild.id == uuid.UUID(guild_id)).first()
    except ValueError:
        g = None
    if not g:
        raise HTTPException(status_code=404, detail="找不到公會")
    count = db.query(func.count(GuildMember.user_id)).filter(GuildMember.guild_id == g.id).scalar() or 0
    if count >= D.GUILD_MAX_MEMBERS:
        raise HTTPException(status_code=409, detail="公會人數已滿")
    db.add(GuildMember(user_id=user.id, guild_id=g.id, role="member"))
    db.commit()
    hub.publish_from_thread(f"guild:{g.id}", {"type": "system", "text": f"{user.username} 加入了公會！"})
    return guild_mine(user, db)


@router.post("/api/guilds/leave")
def guild_leave(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    gm = S.guild_of(db, user.id)
    if not gm:
        raise HTTPException(status_code=409, detail="你不在任何公會")
    g, me = gm
    db.delete(me)
    db.flush()
    rest = db.query(GuildMember).filter(GuildMember.guild_id == g.id).order_by(GuildMember.joined_at).all()
    if not rest:
        db.delete(g)  # 沒人了就解散
    elif me.role == "leader":
        rest[0].role = "leader"
        g.leader_id = rest[0].user_id
    db.commit()
    return {"guild": None}


@router.post("/api/guilds/boss/claim")
def guild_boss_claim(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _claim_raid(db, user, "guild:")


# ───────────── 非同步 PvP ─────────────

@router.get("/api/pvp/opponents")
def pvp_opponents(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = _profile(db, user)
    my = row.rating or D.PVP_START_RATING
    rows = (
        db.query(PlayerProfile, User.username)
        .join(User, User.id == PlayerProfile.user_id)
        .filter(PlayerProfile.user_id != user.id)
        .order_by(func.abs(PlayerProfile.rating - my))
        .limit(12)
        .all()
    )
    rng = random.Random()
    picks = rng.sample(rows, k=min(3, len(rows)))
    opps = []
    for prof, uname in picks:
        p = prof.data or {}
        if p.get("klass") not in D.CLASSES:
            continue
        d = E.derived(p)
        opps.append({"ref": str(prof.user_id), "name": uname, "klass": p["klass"], "level": p.get("level", 1),
                     "rating": prof.rating, "atk": d["atk"], "hpMax": d["hpMax"], "weaponTier": d["weaponTier"], "bot": False})
    for b in D.PVP_BOTS:
        if len(opps) >= 4:
            break
        p = E.new_profile(b["klass"])
        p["level"] = b["level"]
        d = E.derived(p)
        opps.append({"ref": b["id"], "name": b["name"], "klass": b["klass"], "level": b["level"],
                     "rating": 800 + b["level"] * 20, "atk": d["atk"], "hpMax": d["hpMax"], "weaponTier": 1, "bot": True})
    return {"rating": my, "wins": row.pvp_wins or 0, "losses": row.pvp_losses or 0, "opponents": opps}


# ───────────── 排行榜 ─────────────

BOARDS = {"level", "tower", "pvp", "daily", "worldboss", "guild"}


@router.get("/api/leaderboard/{board}")
def leaderboard(board: str, db: Session = Depends(get_db)):
    if board not in BOARDS:
        raise HTTPException(status_code=404, detail="未知的排行榜")
    if board == "daily":
        return {"board": board, "day": S.today(), "rows": _daily_top(db, S.today(), 50)}
    if board == "worldboss":
        boss = S.current_world_boss(db)
        st = S.raid_state(db, boss, None, top=50)
        return {"board": board, "boss": st["name"], "rows": [{"username": r["username"], "value": r["damage"]} for r in st["top"]]}
    if board == "guild":
        cards = [_guild_card(db, g) for g in db.query(Guild).all()]
        cards.sort(key=lambda c: -c["weeklyDamage"])
        return {"board": board, "week": S.week_key(), "rows": [{"username": f"<{c['tag']}> {c['name']}", "value": c["weeklyDamage"], "members": c["members"]} for c in cards[:50]]}
    col = {"level": PlayerProfile.level, "tower": PlayerProfile.tower_best, "pvp": PlayerProfile.rating}[board]
    rows = (
        db.query(PlayerProfile, User.username)
        .join(User, User.id == PlayerProfile.user_id)
        .order_by(col.desc())
        .limit(50)
        .all()
    )
    out = []
    for prof, uname in rows:
        p = prof.data or {}
        value = {"level": prof.level, "tower": prof.tower_best, "pvp": prof.rating}[board]
        out.append({"username": uname, "value": value, "klass": p.get("klass"), "level": prof.level})
    return {"board": board, "rows": out}
