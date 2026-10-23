"""需要資料庫的共用邏輯：讀寫玩家檔案、團隊 Boss、公會。"""
import copy
import datetime as dt

from sqlalchemy import func, update
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.game import data as D
from app.game import economy as E
from app.models.game import Guild, GuildMember, PlayerProfile, RaidBoss, RaidDamage
from app.models.user import User

TW = dt.timezone(dt.timedelta(hours=8))


def now_utc() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)


def today() -> str:
    return dt.datetime.now(TW).strftime("%Y-%m-%d")


def week_key() -> str:
    y, w, _ = dt.datetime.now(TW).isocalendar()
    return f"{y}-W{w:02d}"


# ───────────── 玩家檔案 ─────────────

def get_profile(db: Session, user: User, lock: bool = False, migrate: bool = True) -> PlayerProfile | None:
    q = db.query(PlayerProfile).filter(PlayerProfile.user_id == user.id)
    if lock and db.bind.dialect.name == "postgresql":
        q = q.with_for_update()
    row = q.first()
    if row is None and migrate:
        # 舊玩家第一次進來：從舊存檔搬資料
        data = E.migrate_from_progress(user.game_progress or {})
        if data:
            row = PlayerProfile(user_id=user.id, data=data, level=data["level"])
            db.add(row)
            db.commit()
            db.refresh(row)
    return row


def create_profile(db: Session, user: User, data: dict) -> PlayerProfile:
    row = PlayerProfile(user_id=user.id, data=data, level=data["level"], rating=D.PVP_START_RATING)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def data_of(row: PlayerProfile) -> dict:
    return copy.deepcopy(row.data or {})


def save(db: Session, row: PlayerProfile, data: dict):
    row.data = data
    flag_modified(row, "data")
    row.level = data.get("level", 1)
    db.commit()


# ───────────── 團隊 Boss ─────────────

def _spawn_world_boss(db: Session, level: int) -> RaidBoss:
    cfg = D.WORLD_BOSSES[(level - 1) % len(D.WORLD_BOSSES)]
    hp = int(cfg["hp"] * (1.25 ** (level - 1)))
    boss = RaidBoss(scope="world", boss_key=cfg["key"], name=f"{cfg['name']} Lv.{level}", level=level, hp_max=hp, hp=hp)
    db.add(boss)
    db.commit()
    db.refresh(boss)
    return boss


def current_world_boss(db: Session) -> RaidBoss:
    boss = (
        db.query(RaidBoss)
        .filter(RaidBoss.scope == "world", RaidBoss.defeated_at.is_(None))
        .order_by(RaidBoss.id.desc())
        .first()
    )
    if boss:
        return boss
    last = db.query(func.max(RaidBoss.level)).filter(RaidBoss.scope == "world").scalar() or 0
    return _spawn_world_boss(db, last + 1)


def guild_of(db: Session, user_id) -> tuple[Guild, GuildMember] | None:
    m = db.query(GuildMember).filter(GuildMember.user_id == user_id).first()
    if not m:
        return None
    g = db.query(Guild).filter(Guild.id == m.guild_id).first()
    return (g, m) if g else None


def current_guild_boss(db: Session, guild: Guild) -> RaidBoss:
    scope = f"guild:{guild.id}"
    wk = week_key()
    boss = db.query(RaidBoss).filter(RaidBoss.scope == scope, RaidBoss.period == wk).first()
    if boss:
        return boss
    members = db.query(func.count(GuildMember.user_id)).filter(GuildMember.guild_id == guild.id).scalar() or 1
    hp = D.GUILD_BOSS["base_hp"] + D.GUILD_BOSS["per_member"] * members
    boss = RaidBoss(scope=scope, period=wk, boss_key=D.GUILD_BOSS["key"], name=D.GUILD_BOSS["name"], level=1, hp_max=hp, hp=hp)
    db.add(boss)
    db.commit()
    db.refresh(boss)
    return boss


def apply_raid_damage(db: Session, boss: RaidBoss, user_id, dmg: int) -> tuple[RaidBoss, bool]:
    """原子地扣共享血量（多人同時打也不會算錯），回傳 (Boss, 這一擊是否打倒)"""
    dmg = max(0, int(dmg))
    killed = False
    if dmg and boss.defeated_at is None:
        res = db.execute(
            update(RaidBoss)
            .where(RaidBoss.id == boss.id, RaidBoss.hp > 0)
            .values(hp=func.max(RaidBoss.hp - dmg, 0) if db.bind.dialect.name == "sqlite" else func.greatest(RaidBoss.hp - dmg, 0))
            .returning(RaidBoss.hp)
        ).first()
        if res is not None and res[0] == 0:
            killed = True
            db.execute(update(RaidBoss).where(RaidBoss.id == boss.id, RaidBoss.defeated_at.is_(None)).values(defeated_at=now_utc()))
        row = db.query(RaidDamage).filter(RaidDamage.boss_id == boss.id, RaidDamage.user_id == user_id).first()
        if not row:
            row = RaidDamage(boss_id=boss.id, user_id=user_id, damage=0, hits=0)
            db.add(row)
        row.damage = (row.damage or 0) + dmg
        row.hits = (row.hits or 0) + 1
        db.commit()
        db.refresh(boss)
    return boss, killed


def raid_state(db: Session, boss: RaidBoss, user_id=None, top: int = 10) -> dict:
    rows = (
        db.query(RaidDamage, User.username)
        .join(User, User.id == RaidDamage.user_id)
        .filter(RaidDamage.boss_id == boss.id)
        .order_by(RaidDamage.damage.desc())
        .limit(top)
        .all()
    )
    mine = None
    if user_id is not None:
        r = db.query(RaidDamage).filter(RaidDamage.boss_id == boss.id, RaidDamage.user_id == user_id).first()
        if r:
            mine = {"damage": r.damage, "hits": r.hits, "rewarded": r.rewarded}
    participants = db.query(func.count(RaidDamage.id)).filter(RaidDamage.boss_id == boss.id).scalar() or 0
    return {
        "id": boss.id,
        "scope": boss.scope,
        "key": boss.boss_key,
        "name": boss.name,
        "level": boss.level,
        "hp": boss.hp,
        "hpMax": boss.hp_max,
        "defeated": boss.defeated_at is not None,
        "participants": participants,
        "timeLimit": D.RAID_TIME_LIMIT,
        "top": [{"username": u, "damage": d.damage, "hits": d.hits} for d, u in rows],
        "mine": mine,
    }


def unclaimed_raid_rewards(db: Session, user_id, scope_prefix: str):
    return (
        db.query(RaidDamage, RaidBoss)
        .join(RaidBoss, RaidBoss.id == RaidDamage.boss_id)
        .filter(
            RaidDamage.user_id == user_id,
            RaidDamage.rewarded.is_(False),
            RaidBoss.defeated_at.isnot(None),
            RaidBoss.scope.like(f"{scope_prefix}%"),
        )
        .all()
    )
