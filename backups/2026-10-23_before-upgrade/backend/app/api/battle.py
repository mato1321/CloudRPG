from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.character import Character
from app.core.security import decode_token
import random

router = APIRouter(prefix="/api/battles", tags=["battles"])

class AttackRequest(BaseModel):
    enemy_id: str  # 'goblin', 'duke' 等
    attack_index: int = 0  # 攻擊招式索引

class BattleResult(BaseModel):
    player_damage: int
    enemy_damage: int
    player_hp: int
    player_exp: int
    player_gold: int
    victory: bool

# 遊戲數據（靜態配置）
ENEMIES = {
    "goblin": {"hp": 40, "atk_min": 3, "atk_max": 8, "xp": 25, "gold": 50},
    "duke": {"hp": 80, "atk_min": 8, "atk_max": 15, "xp": 100, "gold": 150},
}

CLASS_ATTACKS = {
    "warrior": [
        {"name": "普通斬擊", "mul": 1.0},
        {"name": "重劈", "mul": 1.4},
    ],
    "mage": [
        {"name": "冷凍箭", "mul": 0.9},
        {"name": "火球", "mul": 1.3},
    ],
    "priest": [
        {"name": "聖光射線", "mul": 0.8},
        {"name": "神聖之擊", "mul": 1.2},
    ],
}

@router.post("/attack", response_model=BattleResult)
async def perform_attack(
    req: AttackRequest,
    character_id: str,
    token: str,
    db: Session = Depends(get_db)
):
    """
    ⭐ 關鍵：伺服器端計算戰鬥結果
    防止前端作弊
    """
    
    # 1. 驗證用戶認證
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # 2. 獲取角色資料
    character = db.query(Character).filter(
        Character.id == character_id,
        Character.user_id == payload.get("sub")
    ).first()
    
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    # 3. 驗證敵人存在
    if req.enemy_id not in ENEMIES:
        raise HTTPException(status_code=400, detail="Invalid enemy")
    
    enemy = ENEMIES[req.enemy_id]
    
    # 4. 計算傷害（伺服器端隨機數）
    attacks = CLASS_ATTACKS.get(character.class_id, [])
    if req.attack_index >= len(attacks):
        raise HTTPException(status_code=400, detail="Invalid attack index")
    
    attack = attacks[req.attack_index]
    player_damage = int(character.inventory_state["atk"] * attack["mul"])
    player_damage += random.randint(-2, 3)  # 隨機波動
    player_damage = max(1, player_damage)
    
    enemy_damage = random.randint(enemy["atk_min"], enemy["atk_max"])
    
    # 5. 更新角色狀態
    inventory = character.inventory_state
    inventory["hp"] -= enemy_damage
    
    victory = inventory["hp"] >= enemy["hp"]
    
    if victory:
        character.exp += enemy["xp"]
        character.gold += enemy["gold"]
    
    character.inventory_state = inventory
    db.commit()
    db.refresh(character)
    
    return BattleResult(
        player_damage=player_damage,
        enemy_damage=enemy_damage,
        player_hp=max(0, inventory["hp"]),
        player_exp=character.exp,
        player_gold=character.gold,
        victory=victory
    )