from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.models.character import Character
from app.schemas.character import CharacterCreate, CharacterResponse, CharacterUpdate
from app.core.security import decode_token

router = APIRouter(prefix="/api/characters", tags=["characters"])

def get_current_user(token: str, db: Session) -> User:
    """獲取當前認證用戶"""
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

@router.post("/", response_model=CharacterResponse)
async def create_character(
    req: CharacterCreate,
    token: str,
    db: Session = Depends(get_db)
):
    """創建新角色"""
    
    user = get_current_user(token, db)
    
    # 設置初始狀態（根據職業）
    CLASS_STATS = {
        "warrior": {"hp": 220, "hpMax": 220, "mp": 60, "mpMax": 60, "atk": 25},
        "mage": {"hp": 160, "hpMax": 160, "mp": 120, "mpMax": 120, "atk": 18},
        "priest": {"hp": 180, "hpMax": 180, "mp": 100, "mpMax": 100, "atk": 15},
    }
    
    stats = CLASS_STATS.get(req.class_id, CLASS_STATS["warrior"])
    
    character = Character(
        user_id=user.id,
        class_id=req.class_id,
        level=1,
        exp=0,
        gold=100,
        inventory_state={
            **stats,
            "inv": {"herb": 5},
            "equipped": {}
        },
        story_flags={}
    )
    
    db.add(character)
    db.commit()
    db.refresh(character)
    
    return character

@router.get("/", response_model=list[CharacterResponse])
async def list_characters(
    token: str,
    db: Session = Depends(get_db)
):
    """列出用戶所有角色"""
    
    user = get_current_user(token, db)
    
    characters = db.query(Character).filter(
        Character.user_id == user.id
    ).all()
    
    return characters

@router.get("/{character_id}", response_model=CharacterResponse)
async def get_character(
    character_id: str,
    token: str,
    db: Session = Depends(get_db)
):
    """獲取單個角色"""
    
    user = get_current_user(token, db)
    
    character = db.query(Character).filter(
        Character.id == character_id,
        Character.user_id == user.id
    ).first()
    
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    return character

@router.put("/{character_id}", response_model=CharacterResponse)
async def update_character(
    character_id: str,
    req: CharacterUpdate,
    token: str,
    db: Session = Depends(get_db)
):
    """更新角色（伺服器端驗證）"""
    
    user = get_current_user(token, db)
    
    character = db.query(Character).filter(
        Character.id == character_id,
        Character.user_id == user.id
    ).first()
    
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    # 更新允許的字段
    if req.gold is not None:
        character.gold = req.gold
    if req.inventory_state is not None:
        character.inventory_state = req.inventory_state
    if req.story_flags is not None:
        character.story_flags = req.story_flags
    
    db.commit()
    db.refresh(character)
    
    return character