"""遊戲伺服器端資料表：經濟（玩家檔案）、戰鬥憑證、爬塔、每日挑戰、團隊 Boss、公會、聊天、PvP。

全部都是新資料表，啟動時 Base.metadata.create_all() 會自動建立，不需要動到舊的 users 表。
"""
import uuid

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
    func,
)

from app.db.database import Base, JSONX


class PlayerProfile(Base):
    """伺服器說了算的經濟資料：職業、等級、經驗、金幣、物品、技能、裝備。客戶端不能直接寫。"""

    __tablename__ = "player_profiles"

    user_id = Column(Uuid, ForeignKey("users.id"), primary_key=True)
    data = Column(JSONX, nullable=False, default=dict)
    # 排行榜用的反正規化欄位（加索引）
    level = Column(Integer, default=1, index=True)
    tower_best = Column(Integer, default=0, index=True)
    rating = Column(Integer, default=1000, index=True)
    pvp_wins = Column(Integer, default=0)
    pvp_losses = Column(Integer, default=0)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class BattleSession(Base):
    """每場戰鬥開始時由伺服器發放的一次性憑證；結算時檢查歸屬、時間與合理性。"""

    __tablename__ = "battle_sessions"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey("users.id"), index=True, nullable=False)
    mode = Column(String(16), nullable=False)  # story | tower | daily | worldboss | guildboss | pvp
    enemy_key = Column(String(32), nullable=False)
    ref = Column(String(64), nullable=True)  # 爬塔 run id / Boss id / PvP 對手
    seed = Column(BigInteger, nullable=False)
    params = Column(JSONX, nullable=False, default=dict)
    status = Column(String(12), default="pending", index=True)  # pending | won | lost | rejected
    result = Column(JSONX, nullable=True)
    started_at = Column(DateTime, server_default=func.now(), index=True)
    finished_at = Column(DateTime, nullable=True)


class TowerRun(Base):
    """故障之塔：一次攀登的進度（樓層、祝福、剩餘血量）。"""

    __tablename__ = "tower_runs"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey("users.id"), index=True, nullable=False)
    seed = Column(BigInteger, nullable=False)
    floor = Column(Integer, default=1)
    buffs = Column(JSONX, nullable=False, default=dict)
    hp_ratio = Column(Float, default=1.0)
    pending_blessing = Column(Boolean, default=False)
    status = Column(String(10), default="active", index=True)  # active | ended
    started_at = Column(DateTime, server_default=func.now())
    ended_at = Column(DateTime, nullable=True)


class DailyScore(Base):
    __tablename__ = "daily_scores"
    __table_args__ = (UniqueConstraint("day", "user_id", name="uq_daily_day_user"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    day = Column(String(10), index=True, nullable=False)  # YYYY-MM-DD（台灣時間）
    user_id = Column(Uuid, ForeignKey("users.id"), nullable=False)
    score = Column(Integer, default=0, index=True)
    duration_ms = Column(Integer, default=0)
    cleared = Column(Boolean, default=False)
    rewarded = Column(Boolean, default=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class RaidBoss(Base):
    """共享血條的 Boss：scope = "world"（世界 Boss）或 "guild:<id>"（公會 Boss，每週一隻）。"""

    __tablename__ = "raid_bosses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scope = Column(String(48), index=True, nullable=False)
    period = Column(String(16), nullable=True)  # 公會 Boss 的週次，例如 2026-W43
    boss_key = Column(String(32), nullable=False)
    name = Column(String(64), nullable=False)
    level = Column(Integer, default=1)
    hp_max = Column(BigInteger, nullable=False)
    hp = Column(BigInteger, nullable=False)
    started_at = Column(DateTime, server_default=func.now())
    defeated_at = Column(DateTime, nullable=True)


class RaidDamage(Base):
    __tablename__ = "raid_damage"
    __table_args__ = (UniqueConstraint("boss_id", "user_id", name="uq_raid_boss_user"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    boss_id = Column(Integer, ForeignKey("raid_bosses.id"), index=True, nullable=False)
    user_id = Column(Uuid, ForeignKey("users.id"), index=True, nullable=False)
    damage = Column(BigInteger, default=0)
    hits = Column(Integer, default=0)
    rewarded = Column(Boolean, default=False)


class Guild(Base):
    __tablename__ = "guilds"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    tag = Column(String(5), unique=True, nullable=False)
    name = Column(String(24), unique=True, nullable=False)
    description = Column(String(140), default="")
    leader_id = Column(Uuid, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class GuildMember(Base):
    """一個玩家只能在一個公會（user_id 當主鍵）。"""

    __tablename__ = "guild_members"

    user_id = Column(Uuid, ForeignKey("users.id"), primary_key=True)
    guild_id = Column(Uuid, ForeignKey("guilds.id"), index=True, nullable=False)
    role = Column(String(10), default="member")  # leader | member
    joined_at = Column(DateTime, server_default=func.now())


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    channel = Column(String(48), index=True, nullable=False)  # world | guild:<id>
    user_id = Column(Uuid, ForeignKey("users.id"), nullable=False)
    username = Column(String(50), nullable=False)
    text = Column(String(200), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), index=True)


class PvpMatch(Base):
    __tablename__ = "pvp_matches"

    id = Column(Integer, primary_key=True, autoincrement=True)
    attacker_id = Column(Uuid, ForeignKey("users.id"), index=True, nullable=False)
    defender_ref = Column(String(64), nullable=False)  # 對手 user id 或 bot:<n>
    win = Column(Boolean, nullable=False)
    delta = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
