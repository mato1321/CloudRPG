from sqlalchemy import create_engine, JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# PostgreSQL 用 JSONB，測試用的 SQLite 自動退回一般 JSON
JSONX = JSON().with_variant(JSONB(), "postgresql")

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

# 創建引擎（連線池：pre_ping 避免 RDS 閒置斷線後第一個請求失敗）
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG and not _is_sqlite,  # 開發時輸出 SQL
    future=True,
    **(
        {"connect_args": {"check_same_thread": False}}
        if _is_sqlite
        else {"pool_pre_ping": True, "pool_size": 10, "max_overflow": 20, "pool_recycle": 1800}
    ),
)

# 創建 Session 工廠
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True
)

# ORM 基類 ✅ 這一行最重要！
Base = declarative_base()

def get_db():
    """依賴注入：獲取 DB 連接"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
