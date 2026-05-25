# Cloud RPG 資料庫完整文檔

## 📊 資料庫概述

**資料庫系統**：AWS RDS (PostgreSQL)  
**ORM 框架**：SQLAlchemy  
**驅動程式**：psycopg2  
**表數量**：2 個主要表  
**約束類型**：UNIQUE, FOREIGN KEY, NOT NULL  

---

## 📋 表結構詳細信息

### **表 1：users（用戶表）**

#### 基本信息
```
表名：users
用途：存儲用戶帳號信息和遊戲進度
記錄數：用戶總數
```

#### 欄位定義

| 欄位名 | 類型 | 約束 | 說明 |
|--------|------|------|------|
| **id** | UUID | PRIMARY KEY, DEFAULT uuid.uuid4() | 用戶唯一識別碼（自動生成） |
| **username** | String | UNIQUE, NOT NULL, INDEX | 用戶名（唯一，有索引） |
| **password_hash** | String | NOT NULL | 密碼雜湊值（bcrypt 或 argon2） |
| **avatar_url** | String(500) | NULLABLE | 用戶頭像 URL |
| **game_progress** | JSON | NULLABLE, DEFAULT {} | 遊戲進度（JSON 格式） |
| **game_log** | JSON | NULLABLE, DEFAULT [] | 遊戲日誌（JSON 陣列） |
| **last_save_at** | DateTime | DEFAULT func.now() | 最後保存時間 |
| **created_at** | DateTime | DEFAULT func.now() | 帳號建立時間 |

#### 範例數據
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "player_123",
  "password_hash": "$2b$12$R9h...",
  "avatar_url": "https://s3.amazonaws.com/avatars/player_123.png",
  "game_progress": {
    "level": 10,
    "total_exp": 5000,
    "current_map": "forest_01",
    "playtime_hours": 25
  },
  "game_log": [
    { "ts": "2026-05-25 10:30:00", "event": "level_up", "details": "Reached level 10" },
    { "ts": "2026-05-25 09:45:00", "event": "item_acquired", "details": "Sword of Flame" }
  ],
  "last_save_at": "2026-05-25 11:00:00",
  "created_at": "2026-05-20 14:22:15"
}
```

#### 索引策略
```sql
-- 自動創建的索引
CREATE UNIQUE INDEX idx_users_username ON users(username);

-- 用途：
-- 1. 登入時快速查找用戶
-- 2. 防止重複註冊
```

---

### **表 2：characters（角色表）**

#### 基本信息
```
表名：characters
用途：存儲每個用戶的遊戲角色
記錄數：(用戶總數 × 平均角色數)
關聯：多對一 - 多個角色屬於一個用戶
```

#### 欄位定義

| 欄位名 | 類型 | 約束 | 說明 |
|--------|------|------|------|
| **id** | UUID | PRIMARY KEY, DEFAULT uuid.uuid4() | 角色唯一識別碼 |
| **user_id** | UUID | FOREIGN KEY → users.id, NOT NULL | 所屬用戶 ID |
| **class_id** | String | NOT NULL | 職業類別（'warrior', 'mage', 'priest'） |
| **level** | Integer | DEFAULT 1 | 角色等級（1-99） |
| **exp** | Integer | DEFAULT 0 | 當前經驗值 |
| **gold** | Integer | DEFAULT 100 | 金幣數量 |
| **inventory_state** | JSONB | DEFAULT {...} | 角色詳細狀態（JSONB） |
| **story_flags** | JSONB | DEFAULT {} | 劇情進度標記 |
| **created_at** | DateTime | DEFAULT func.now() | 角色建立時間 |
| **updated_at** | DateTime | DEFAULT func.now(), onupdate | 最後更新時間 |

#### 詳細欄位說明

##### **class_id 職業系統**
```
'warrior'  → 戰士
  ├─ 高 ATK（攻擊力）
  ├─ 高 HP（生命值）
  └─ 低 MP（魔法值）

'mage'     → 法師
  ├─ 低 ATK
  ├─ 低 HP
  └─ 高 MP

'priest'   → 祭司
  ├─ 中等 ATK
  ├─ 中等 HP
  └─ 中等 MP（特殊技能）
```

##### **inventory_state JSONB 結構**
```json
{
  "hp": 100,           // 當前生命值
  "hpMax": 100,        // 最大生命值
  "mp": 50,            // 當前魔法值
  "mpMax": 50,         // 最大魔法值
  "atk": 15,           // 攻擊力
  "def": 5,            // 防禦力（可選）
  "inv": {             // 背包物品
    "potion_hp": 5,
    "potion_mp": 3,
    "sword_of_flame": 1
  },
  "equipped": {        // 裝備中的物品
    "weapon": "sword_of_flame",
    "armor": "leather_chest",
    "accessory": "ring_of_wisdom"
  }
}
```

##### **story_flags JSONB 結構**
```json
{
  "quest_forest_01_completed": true,
  "boss_forest_dragon_defeated": true,
  "city_unlocked": true,
  "npc_tavern_keeper_met": true,
  "lore_chapter_1_read": true
}
```

#### 範例數據
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "class_id": "warrior",
  "level": 10,
  "exp": 5250,
  "gold": 2500,
  "inventory_state": {
    "hp": 85,
    "hpMax": 120,
    "mp": 20,
    "mpMax": 30,
    "atk": 25,
    "def": 8,
    "inv": {
      "potion_hp": 5,
      "potion_mp": 2,
      "sword_of_flame": 1,
      "shield": 1
    },
    "equipped": {
      "weapon": "sword_of_flame",
      "armor": "iron_armor",
      "shield": "wooden_shield"
    }
  },
  "story_flags": {
    "quest_forest_01_completed": true,
    "boss_forest_dragon_defeated": true,
    "city_unlocked": true
  },
  "created_at": "2026-05-22 10:15:30",
  "updated_at": "2026-05-25 10:45:20"
}
```

---

## 🔗 表關聯關係

```
users (1) ──────────── (N) characters
   ↓                         ↓
   │                    一個用戶可以有
   │                    多個角色
   │
   └─ FOREIGN KEY: user_id → users.id
   
CASCADE DELETE：
  當用戶被刪除時，該用戶的所有角色也會被刪除
```

### SQL 關聯定義
```sql
ALTER TABLE characters 
ADD CONSTRAINT fk_characters_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
```

---

## 💾 資料庫設計模式

### **JSON vs 傳統欄位**

#### ✅ 使用 JSON/JSONB 的欄位
- `game_progress` → 遊戲進度（結構經常變化）
- `game_log` → 事件日誌（動態增長）
- `inventory_state` → 背包和裝備（複雜嵌套）
- `story_flags` → 劇情進度（任意組合）

**優點：**
- 靈活性高，無需修改表結構
- 適合遊戲邏輯複雜的數據
- 可以直接存儲 Python dict

**缺點：**
- 查詢性能略低
- 難以進行複雜的 SQL 查詢
- 需要驗證 JSON 結構

#### ❌ 不使用 JSON 的欄位
- `id`, `username`, `password_hash` → 需要精確查詢和索引
- `level`, `exp`, `gold` → 需要排序和統計
- `created_at`, `updated_at` → 需要時間範圍查詢

---

## 🔐 安全考慮

### 密碼存儲
```python
# ✅ 安全做法
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 存儲時：雜湊密碼
hashed_password = pwd_context.hash("user_password")
db.user.password_hash = hashed_password

# 驗證時：比較雜湊
is_correct = pwd_context.verify("user_input", db.user.password_hash)
```

### UUID vs 自增 ID
```
❌ 自增 ID
   └─ 易於被預測（猜測其他用戶 ID）
   └─ 存在資訊洩露風險

✅ UUID (UUID4)
   └─ 隨機 128 位
   └─ 無法預測
   └─ 全球唯一
```

### 索引策略
```sql
-- ✅ 已有的索引
CREATE UNIQUE INDEX idx_users_username ON users(username);

-- 📌 建議添加的索引
CREATE INDEX idx_characters_user_id ON characters(user_id);
CREATE INDEX idx_characters_class_id ON characters(class_id);
CREATE INDEX idx_characters_level ON characters(level);
```

---

## 📈 資料庫查詢示例

### 查詢 1：用戶登入
```python
# FastAPI 後端
@router.post("/auth/login")
async def login(credentials: LoginSchema, db: Session = Depends(get_db)):
    # 查詢用戶
    user = db.query(User).filter(
        User.username == credentials.username
    ).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # 驗證密碼
    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid password")
    
    return {"user": user, "access_token": create_jwt_token(user.id)}
```

### 查詢 2：獲取用戶的所有角色
```python
@router.get("/api/character")
async def get_characters(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    characters = db.query(Character).filter(
        Character.user_id == current_user.id
    ).all()
    
    return {
        "characters": [
            {
                "id": c.id,
                "class": c.class_id,
                "level": c.level,
                "exp": c.exp
            }
            for c in characters
        ]
    }
```

### 查詢 3：更新角色經驗值
```python
@router.post("/api/progress/save")
async def save_progress(
    payload: ProgressSchema,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    character = db.query(Character).filter(
        Character.id == payload.character_id,
        Character.user_id == current_user.id
    ).first()
    
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    # 更新狀態
    character.exp += payload.exp_gained
    character.gold += payload.gold_gained
    character.level = calculate_level(character.exp)
    character.updated_at = datetime.now()
    
    db.commit()
    return {"success": True, "new_level": character.level}
```

### 查詢 4：排行榜查詢
```python
@router.get("/api/leaderboard")
async def get_leaderboard(db: Session = Depends(get_db)):
    # 按等級排序，取前 100 名
    top_characters = db.query(Character).order_by(
        Character.level.desc(),
        Character.exp.desc()
    ).limit(100).all()
    
    return {
        "leaderboard": [
            {
                "rank": idx + 1,
                "username": c.user.username,  # 關聯查詢
                "level": c.level,
                "class": c.class_id
            }
            for idx, c in enumerate(top_characters)
        ]
    }
```

---

## 📊 資料庫統計和監控

### 表大小估算
```
假設 1000 個用戶，平均 3 個角色

users 表
├─ 記錄數：1000
├─ 平均行大小：~500 bytes（含 JSON）
└─ 總大小：~500 KB

characters 表
├─ 記錄數：3000
├─ 平均行大小：~1 KB（含 JSONB）
└─ 總大小：~3 MB

索引大小：~200 KB
總計：~3.7 MB
```

### 性能指標
```
✅ 登入查詢：< 10ms（有索引）
✅ 獲取角色列表：< 20ms
✅ 保存進度：< 50ms（寫入）
✅ 排行榜查詢：< 100ms（大數據量）
```

---

## 🚀 未來擴展建議

### 添加的新表

#### **表 3：guild（公會表）** 
```python
class Guild(Base):
    __tablename__ = "guilds"
    
    id = Column(UUID, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    leader_id = Column(UUID, ForeignKey("users.id"))
    description = Column(String(500))
    founded_at = Column(DateTime, default=func.now())
    members = Column(JSONB, default=[])  # [user_id, ...]
    treasury = Column(Integer, default=0)  # 公會金庫
```

#### **表 4：item（物品表）**
```python
class Item(Base):
    __tablename__ = "items"
    
    id = Column(String, primary_key=True)  # 'sword_of_flame'
    name = Column(String, nullable=False)
    type = Column(String)  # 'weapon', 'armor', 'potion'
    stats = Column(JSONB)  # {'atk': 15, 'def': 5}
    price = Column(Integer)
    icon_url = Column(String)
```

#### **表 5：quest（任務表）**
```python
class Quest(Base):
    __tablename__ = "quests"
    
    id = Column(String, primary_key=True)
    title = Column(String)
    description = Column(String)
    rewards = Column(JSONB)  # {'exp': 500, 'gold': 100}
    requirements = Column(JSONB)  # 條件
```

### 建議的優化
- 添加 **DynamoDB** 存儲實時遊戲狀態（HP、MP 更新頻繁）
- 使用 **Redis** 快取排行榜數據
- 分離 **game_log** 到專門的日誌表（減少主表大小）

---

## 🔧 資料庫初始化代碼

```python
# app/db/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# 數據庫連接
engine = create_engine(
    settings.DATABASE_URL,  # 例：postgresql://user:pass@host/dbname
    echo=settings.DEBUG,
    future=True
)

# Session 工廠
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True
)

# ORM 基類
Base = declarative_base()

# 創建所有表
def init_db():
    """初始化資料庫（創建所有表）"""
    Base.metadata.create_all(bind=engine)

# 獲取 DB 連接（依賴注入）
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

---

## 📝 總結

| 項目 | 值 |
|------|-----|
| 資料庫類型 | PostgreSQL (RDS) |
| ORM 框架 | SQLAlchemy |
| 表數量 | 2（users, characters） |
| 主鍵類型 | UUID |
| 外鍵約束 | CASCADE DELETE |
| JSON 欄位 | 4 個（game_progress, game_log, inventory_state, story_flags） |
| 索引數 | 1（username） |
| 關聯類型 | 一對多（users → characters） |

