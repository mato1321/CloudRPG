"""遊戲數值表（伺服器端權威版本）。

數值與前端一致（fronted/src/routes/play.tsx 的 CLASSES / ENEMIES、fronted/src/lib/shop.ts），
但「發多少獎勵、商品多少錢」以這裡為準，客戶端改 localStorage 也沒用。
"""

INFINITE_GOLD = 999_999_999

# ── 職業 ──
CLASSES = {
    "warrior": {"name": "戰士", "hp": 220, "mp": 60, "atk": 25, "wBasic": "銀風鐵劍", "wAdv": "日蝕殞落之劍",
                "skill2": "狂戰衝擊", "skill3": "鋼鐵粉碎", "ult": "滅世斷界斬"},
    "mage": {"name": "法師", "hp": 120, "mp": 220, "atk": 15, "wBasic": "刻印法杖", "wAdv": "全世操縱之杖",
             "skill2": "虛空火球", "skill3": "極光崩解", "ult": "禁忌・星界崩壞"},
    "priest": {"name": "牧師", "hp": 160, "mp": 180, "atk": 12, "wBasic": "純潔寶珠", "wAdv": "虛空之眼",
               "skill2": "靈魂祈禱 (含回血)", "skill3": "神聖脈動 (含回血)", "ult": "終焉聖域 (大回血)"},
}
LEVEL_GROWTH = {"hp": 30, "mp": 15, "atk": 4}
EXP_BASE = 200
EXP_GROWTH = 1.4
MAX_LEVEL = 99

# ── 故事敵人：hp 是 2D 格鬥裡的血量（對應前端 STORY_ENEMY_PROFILES）──
ENEMIES = {
    "minions": {"name": "魔王軍雜魚老大", "hp": 200, "xp": 100, "gold": 150},
    "goblin": {"name": "哥布林狂戰王", "hp": 240, "xp": 140, "gold": 220},
    "duke": {"name": "羅劫公爵", "hp": 320, "xp": 260, "gold": 450, "drop": "stone_red", "boss": True},
    "abyss": {"name": "冥盡洞主", "hp": 400, "xp": 340, "gold": 600, "drop": "stone_blue", "boss": True},
    "skyisle": {"name": "天光島嶼之主", "hp": 480, "xp": 420, "gold": 800, "drop": "stone_gold", "boss": True},
    "demonlord": {"name": "魔王 (21世紀程式語言版)", "hp": 550, "xp": 600, "gold": 1200, "boss": True},
    "admin": {"name": "Administrator", "hp": 680, "xp": 9999, "gold": 9999, "boss": True},
}

# 劇情中撿到的東西：每個 id 每個帳號只能領一次
STORY_REWARDS = {
    "wasteland_loot": {"inv": {"herb": 3, "mana": 1, "junk": 3}},
    "village_sword": {"inv": {"sword": 1}},
}

# ── 黑市（與 fronted/src/lib/shop.ts 相同規則）──
CLASS_TRANSFER_PRICE = 6000
MAX_PLUS = 3
WEAPON_ATK = {"weapon_basic": (15, 6), "weapon_adv": (35, 14)}
SHOP = {
    "herb": {"name": "草藥", "price": 100},
    "mana": {"name": "魔力藥水", "price": 100},
    "skillbook_1": {"name": "進階技能書・卷一", "price": 600, "learn": "learnedSkill2"},
    "skillbook_2": {"name": "進階技能書・卷二", "price": 1200, "learn": "learnedSkill3"},
    "skillbook": {"name": "終極奧義技能書", "price": 2000, "learn": "learnedUlt"},
    "totem": {"name": "不死圖騰", "price": 3000},
    "weapon_basic": {"name": "初級職業武器", "price": 500},
    "weapon_adv": {"name": "高級職業武器", "price": 3000},
    "terminus": {"name": "???終端機", "price": 100000},
}

# ── 隨機掉寶：稀有度、部位、詞綴 ──
RARITIES = [
    # key, 名稱, 權重, 屬性倍率, 詞綴數
    ("common", "普通", 55, 1.0, 1),
    ("rare", "稀有", 28, 1.4, 2),
    ("epic", "史詩", 12, 1.9, 2),
    ("legend", "傳說", 4.5, 2.6, 3),
    ("myth", "神話", 0.5, 3.5, 3),
]
RARITY_ORDER = [r[0] for r in RARITIES]
GEAR_SLOTS = {
    "armor": {"name": "護甲", "names": ["布織外衣", "皮革護甲", "鎖子甲", "賽博裝甲", "量子護盾衣", "防火牆戰袍"]},
    "charm": {"name": "飾品", "names": ["幸運幣", "祈願符", "記憶晶片", "時之沙漏", "聖光吊墜", "Root 權限鑰匙"]},
}
# 詞綴：stat, 名稱, 每級基礎值
AFFIXES = [
    ("atk", "攻擊力", 2.2),
    ("hp", "生命上限", 9.0),
    ("mp", "魔力上限", 6.0),
    ("energy", "氣條獲得 %", 1.6),
    ("speed", "移動速度 %", 1.0),
]
GEAR_CAP = 40  # 背包上限

# ── 故障之塔 ──
TOWER_POOL = ["minions", "goblin", "duke", "abyss", "skyisle", "demonlord", "admin"]
MODIFIERS = {
    "berserk": {"name": "狂暴", "desc": "敵人攻擊與速度 +30%"},
    "glass": {"name": "玻璃大砲", "desc": "雙方受到的傷害 ×2"},
    "blackwater": {"name": "全場黑水", "desc": "場上會不斷出現黑水陷阱"},
    "thunder": {"name": "雷暴", "desc": "天空隨機落雷"},
    "clone": {"name": "分身", "desc": "敵人的分身會從畫面另一端突進"},
    "regen": {"name": "再生", "desc": "敵人每秒回復生命"},
    "fog": {"name": "迷霧", "desc": "視野變暗"},
    "giant": {"name": "巨大化", "desc": "敵人血量 +60%、體型變大"},
}
BLESSINGS = {
    "heal": {"name": "生命泉水", "desc": "回復 40% HP"},
    "power": {"name": "力量刻印", "desc": "本次攀登 ATK +12%（可疊加）"},
    "herb": {"name": "補給包", "desc": "獲得草藥 ×2"},
    "energy": {"name": "超頻核心", "desc": "之後每層開場氣條 +40%"},
}

# ── 每日挑戰 ──
DAILY_POOL = ["goblin", "duke", "abyss", "skyisle", "demonlord", "admin"]

# ── 團隊 Boss ──
WORLD_BOSSES = [
    {"key": "admin", "name": "Ω Administrator 主機本體", "hp": 250_000},
    {"key": "duke", "name": "血月公爵・真祖化", "hp": 200_000},
    {"key": "abyss", "name": "冥盡深淵意識體", "hp": 220_000},
    {"key": "demonlord", "name": "Legacy Code 集合體", "hp": 230_000},
    {"key": "skyisle", "name": "天光熾天使", "hp": 240_000},
]
GUILD_BOSS = {"key": "skyisle", "name": "公會試煉：天光守護者", "base_hp": 30_000, "per_member": 12_000}
RAID_TIME_LIMIT = 45  # 秒

# ── 平衡：避免無限刷金幣造成通膨（數值依據見 backend/tools/economy_sim.py 與 /api/admin/balance）──
REPEAT_REWARD = {"boss": 0.25, "mob": 0.5, "admin": 0.05}  # 故事敵人「重複擊敗」的獎勵比例（可指定敵人）；第一次擊敗全額
DAILY_GOLD_SOFT_CAP = 15_000  # 每天（台灣日期）從戰鬥賺的金幣超過這個數字後……
SOFT_CAP_RATE = 0.1  # ……之後的戰鬥金幣只給 10%
DAILY_GOLD_HARD_CAP = 30_000  # 一天最多從戰鬥拿到這麼多金幣（黑市一次性商品全部約 2.7 萬）
TOWER_GOLD_FLOOR_CAP = 40  # 故障之塔的金幣只算到第 40 層（經驗照樣成長）
PVP_WIN_GOLD = {"player": 80, "bot": 20}  # 打贏真人 / Bot 的金幣
PVP_DAILY_GOLD_WINS = 10  # 每天前 10 場 PvP 勝利才給金幣（經驗照給）

# ── 公會 ──
GUILD_CREATE_PRICE = 1000
GUILD_MAX_MEMBERS = 30

# ── PvP ──
PVP_START_RATING = 1000
PVP_K = 32
PVP_BOTS = [
    {"id": "bot:1", "name": "AI_練習生", "klass": "warrior", "level": 3},
    {"id": "bot:2", "name": "NullPointer_Bot", "klass": "mage", "level": 8},
    {"id": "bot:3", "name": "Firewall_Saint", "klass": "priest", "level": 14},
    {"id": "bot:4", "name": "Kernel_Breaker", "klass": "warrior", "level": 22},
    {"id": "bot:5", "name": "Root_Sorcerer", "klass": "mage", "level": 30},
]
