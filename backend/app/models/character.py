from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, func, Uuid
import uuid
from app.db.database import Base, JSONX

class Character(Base):
    __tablename__ = "characters"
    
    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey("users.id"), nullable=False)
    class_id = Column(String, nullable=False)  # 'warrior', 'mage', 'priest'
    level = Column(Integer, default=1)
    exp = Column(Integer, default=0)
    gold = Column(Integer, default=100)
    
    # 核心遊戲狀態（PostgreSQL 上是 JSONB）
    inventory_state = Column(JSONX, default={
        "hp": 100,
        "hpMax": 100,
        "mp": 50,
        "mpMax": 50,
        "atk": 15,
        "inv": {},
        "equipped": {}
    })
    
    # 劇情進度
    story_flags = Column(JSONX, default={})
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<Character {self.class_id} Lv.{self.level}>"