from sqlalchemy import Column, String, DateTime, func, JSON
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.db.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    avatar_url = Column(String(500), nullable=True)
    
    # 新增：遊戲進度相關欄位
    game_progress = Column(JSON, nullable=True, default={})
    game_log = Column(JSON, nullable=True, default=[])
    last_save_at = Column(DateTime, server_default=func.now())
    
    created_at = Column(DateTime, server_default=func.now())
    
    def __repr__(self):
        return f"<User {self.username}>"