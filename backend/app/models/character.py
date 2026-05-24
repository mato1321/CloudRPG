from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
from app.db.database import Base

class Character(Base):
    __tablename__ = "characters"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    class_id = Column(String, nullable=False)  # 'warrior', 'mage', 'priest'
    level = Column(Integer, default=1)
    exp = Column(Integer, default=0)
    gold = Column(Integer, default=100)
    
    # 核心遊戲狀態（JSONB）
    inventory_state = Column(JSONB, default={
        "hp": 100,
        "hpMax": 100,
        "mp": 50,
        "mpMax": 50,
        "atk": 15,
        "inv": {},
        "equipped": {}
    })
    
    # 劇情進度
    story_flags = Column(JSONB, default={})
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<Character {self.class_id} Lv.{self.level}>"