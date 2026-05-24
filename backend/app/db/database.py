from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# 創建引擎
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,  # 開發時輸出 SQL
    future=True
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