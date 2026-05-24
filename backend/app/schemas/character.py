from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from uuid import UUID

class CharacterCreate(BaseModel):
    class_id: str = Field(..., description="warrior, mage, or priest")

class CharacterResponse(BaseModel):
    id: UUID
    user_id: UUID
    class_id: str
    level: int
    exp: int
    gold: int
    inventory_state: Dict[str, Any]
    story_flags: Dict[str, Any]
    
    class Config:
        from_attributes = True

class CharacterUpdate(BaseModel):
    gold: Optional[int] = None
    inventory_state: Optional[Dict[str, Any]] = None
    story_flags: Optional[Dict[str, Any]] = None