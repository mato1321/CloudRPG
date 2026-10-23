"""伺服器端經濟規則：都是純函式，對「玩家檔案 dict」做運算，方便測試。

玩家檔案（PlayerProfile.data）格式：
  klass, level, exp, gold, inv{}, learnedSkill2/3, learnedUlt,
  gear[], equippedGear{slot: item_id}, claims[], bossesDefeated[]
攻擊力 / 生命上限 / 魔力上限一律由等級 + 武器 + 裝備即時算出（derived），不存，避免被竄改。
"""
import hashlib
import math
import random
import uuid

from app.game import data as D

# 客戶端存檔裡屬於「經濟」的欄位：存檔時伺服器忽略，讀檔時由伺服器覆蓋
ECONOMY_KEYS = {
    "klass", "klassName", "level", "exp", "expMax", "gold", "atk", "hpMax", "mpMax", "inv",
    "learnedSkill2", "learnedSkill3", "learnedUlt", "equipped", "gear", "equippedGear",
    "gearStats", "weaponTier", "weaponPlus", "rarityGlow", "bossesDefeated",
}


class GameError(Exception):
    """可以直接回給玩家看的錯誤（HTTP 400）"""


# ───────────── 基本 ─────────────

def exp_needed(level: int) -> int:
    e = D.EXP_BASE
    for _ in range(max(0, level - 1)):
        e = math.floor(e * D.EXP_GROWTH)
    return e


def new_profile(klass: str) -> dict:
    if klass not in D.CLASSES:
        raise GameError("未知的職業")
    return {
        "klass": klass,
        "level": 1,
        "exp": 0,
        "gold": 50,
        "inv": {"herb": 2, "mana": 1},
        "learnedSkill2": False,
        "learnedSkill3": False,
        "learnedUlt": False,
        "gear": [],
        "equippedGear": {},
        "claims": [],
        "bossesDefeated": [],
    }


def migrate_from_progress(state: dict) -> dict | None:
    """舊存檔（金幣等都存在 users.game_progress）→ 建立伺服器檔案。沒有職業就回傳 None。"""
    klass = (state or {}).get("klass")
    if klass not in D.CLASSES:
        return None
    p = new_profile(klass)
    p["level"] = max(1, min(D.MAX_LEVEL, int(state.get("level") or 1)))
    p["exp"] = max(0, int(state.get("exp") or 0))
    gold = int(state.get("gold") or 0)
    p["gold"] = max(0, min(gold, 1_000_000))  # 舊版 admin 無限金幣不搬過來
    inv = {k: int(v) for k, v in (state.get("inv") or {}).items() if isinstance(v, (int, float)) and v > 0}
    inv["weapon_basic"] = min(inv.get("weapon_basic", 0), 1 + D.MAX_PLUS)
    inv["weapon_adv"] = min(inv.get("weapon_adv", 0), 1 + D.MAX_PLUS)
    inv["terminus"] = min(inv.get("terminus", 0), 1)
    p["inv"] = {k: v for k, v in inv.items() if v > 0}
    for k in ("learnedSkill2", "learnedSkill3", "learnedUlt"):
        p[k] = bool(state.get(k))
    for drop, boss in (("stone_red", "duke"), ("stone_blue", "abyss"), ("stone_gold", "skyisle")):
        if p["inv"].get(drop):
            p["bossesDefeated"].append(boss)
    if (state.get("flags") or {}).get("demonDead"):
        p["bossesDefeated"].append("demonlord")
    return p


# ───────────── 武器 / 裝備 / 數值 ─────────────

def weapon_loadout(inv: dict) -> tuple[int, int]:
    inv = inv or {}
    if inv.get("terminus", 0) > 0:
        return 3, D.MAX_PLUS
    if inv.get("weapon_adv", 0) > 0:
        return 2, min(D.MAX_PLUS, inv["weapon_adv"] - 1)
    if inv.get("weapon_basic", 0) > 0:
        return 1, min(D.MAX_PLUS, inv["weapon_basic"] - 1)
    return 0, 0


def weapon_atk_bonus(inv: dict) -> int:
    inv = inv or {}
    total = 0
    for key, (base, per) in D.WEAPON_ATK.items():
        n = min(inv.get(key, 0), 1 + D.MAX_PLUS)
        if n:
            total += base + per * (n - 1)
    if inv.get("terminus", 0) > 0:
        total += 9999
    return total


def equipped_items(p: dict) -> list:
    ids = set((p.get("equippedGear") or {}).values())
    return [g for g in p.get("gear", []) if g["id"] in ids]


def gear_stats(p: dict) -> dict:
    out = {"atk": 0, "hp": 0, "mp": 0, "energy": 0, "speed": 0}
    for g in equipped_items(p):
        for k, v in g.get("stats", {}).items():
            out[k] = out.get(k, 0) + v
    out["energy"] = min(out["energy"], 80)
    out["speed"] = min(out["speed"], 35)
    return out


def derived(p: dict) -> dict:
    c = D.CLASSES[p["klass"]]
    lvl = p["level"]
    gs = gear_stats(p)
    terminus = 9999 if p.get("inv", {}).get("terminus", 0) > 0 else 0
    tier, plus = weapon_loadout(p.get("inv"))
    glow = None
    for g in equipped_items(p):
        if glow is None or D.RARITY_ORDER.index(g["rarity"]) > D.RARITY_ORDER.index(glow):
            glow = g["rarity"]
    return {
        "atk": c["atk"] + (lvl - 1) * D.LEVEL_GROWTH["atk"] + weapon_atk_bonus(p.get("inv")) + gs["atk"],
        "hpMax": c["hp"] + (lvl - 1) * D.LEVEL_GROWTH["hp"] + terminus + gs["hp"],
        "mpMax": c["mp"] + (lvl - 1) * D.LEVEL_GROWTH["mp"] + terminus + gs["mp"],
        "expMax": exp_needed(lvl),
        "weaponTier": tier,
        "weaponPlus": plus,
        "gearStats": gs,
        "rarityGlow": glow,
    }


def atk_mul(p: dict, buff_pct: float = 0) -> float:
    """與前端 calcAtkMul 相同公式（格鬥傷害倍率）"""
    d = derived(p)
    m = max(0.88, min(2.6, 0.85 + d["atk"] * 0.008 + p["level"] * 0.03))
    return round(m * (1 + buff_pct / 100), 2)


def equipped_names(p: dict) -> list:
    c = D.CLASSES[p["klass"]]
    tier, plus = weapon_loadout({**p.get("inv", {}), "terminus": 0})
    out = []
    tag = f" +{plus}" if plus else ""
    if tier == 2:
        out.append(f"{c['wAdv']}{tag}")
    elif tier == 1:
        out.append(f"{c['wBasic']}{tag}")
    if p.get("inv", {}).get("terminus", 0) > 0:
        out.append("???終端機")
    out += [g["name"] for g in equipped_items(p)]
    return out


def public(p: dict, is_admin: bool = False) -> dict:
    """回給客戶端的經濟資料（會直接合併進前端的 state）"""
    d = derived(p)
    return {
        "klass": p["klass"],
        "klassName": D.CLASSES[p["klass"]]["name"],
        "level": p["level"],
        "exp": p["exp"],
        "expMax": d["expMax"],
        "gold": D.INFINITE_GOLD if is_admin else p["gold"],
        "atk": d["atk"],
        "hpMax": d["hpMax"],
        "mpMax": d["mpMax"],
        "inv": dict(p.get("inv", {})),
        "learnedSkill2": p.get("learnedSkill2", False),
        "learnedSkill3": p.get("learnedSkill3", False),
        "learnedUlt": p.get("learnedUlt", False),
        "equipped": equipped_names(p),
        "gear": p.get("gear", []),
        "equippedGear": p.get("equippedGear", {}),
        "gearStats": d["gearStats"],
        "weaponTier": d["weaponTier"],
        "weaponPlus": d["weaponPlus"],
        "rarityGlow": d["rarityGlow"],
        "bossesDefeated": p.get("bossesDefeated", []),
    }


# ───────────── 經驗 / 獎勵 ─────────────

def grant_xp(p: dict, xp: int) -> int:
    """加經驗並升級，回傳升了幾級"""
    p["exp"] += max(0, int(xp))
    ups = 0
    while p["level"] < D.MAX_LEVEL and p["exp"] >= exp_needed(p["level"]):
        p["exp"] -= exp_needed(p["level"])
        p["level"] += 1
        ups += 1
    return ups


def add_items(p: dict, items: dict):
    inv = p.setdefault("inv", {})
    for k, v in (items or {}).items():
        inv[k] = inv.get(k, 0) + int(v)


def consume(p: dict, used: dict):
    """戰鬥中用掉的消耗品（不會扣成負數）"""
    inv = p.setdefault("inv", {})
    for k in ("herb", "mana", "totem"):
        n = max(0, int((used or {}).get(k, 0)))
        if n:
            inv[k] = max(0, inv.get(k, 0) - n)


def claim_story(p: dict, reward_id: str) -> dict:
    if reward_id not in D.STORY_REWARDS:
        raise GameError("未知的獎勵")
    if reward_id in p.setdefault("claims", []):
        return {}
    p["claims"].append(reward_id)
    reward = D.STORY_REWARDS[reward_id]
    add_items(p, reward.get("inv"))
    return reward


# ───────────── 隨機掉寶 ─────────────

def roll_rarity(rng: random.Random, luck: float = 0.0, min_rarity: str | None = None) -> str:
    weights = []
    for i, (key, _n, w, _m, _a) in enumerate(D.RARITIES):
        weights.append(w * (1 + luck * i))  # luck 越高，高稀有度權重越大
    key = rng.choices(D.RARITY_ORDER, weights=weights)[0]
    if min_rarity and D.RARITY_ORDER.index(key) < D.RARITY_ORDER.index(min_rarity):
        key = min_rarity
    return key


def roll_gear(rng: random.Random, level: int, luck: float = 0.0, min_rarity: str | None = None) -> dict:
    rarity = roll_rarity(rng, luck, min_rarity)
    rinfo = next(r for r in D.RARITIES if r[0] == rarity)
    _key, rname, _w, mult, n_aff = rinfo
    slot = rng.choice(list(D.GEAR_SLOTS))
    base_name = rng.choice(D.GEAR_SLOTS[slot]["names"])
    affixes = rng.sample(D.AFFIXES, k=min(n_aff, len(D.AFFIXES)))
    stats = {}
    for stat, _label, per in affixes:
        val = per * mult * (1 + level * 0.09) * (0.75 + rng.random() * 0.5)
        if stat in ("energy", "speed"):
            val = per * mult * (0.8 + rng.random() * 0.6) * 2.2
        stats[stat] = max(1, round(val))
    return {
        "id": uuid.uuid4().hex[:12],
        "slot": slot,
        "name": f"[{rname}] {base_name}",
        "rarity": rarity,
        "level": level,
        "stats": stats,
    }


def gear_value(item: dict) -> int:
    return int(40 * (D.RARITY_ORDER.index(item["rarity"]) + 1) ** 2 * (1 + item.get("level", 1) * 0.1))


def add_gear(p: dict, item: dict) -> int:
    """放進背包；背包滿了就自動分解成金幣，回傳分解得到的金幣"""
    gear = p.setdefault("gear", [])
    if len(gear) >= D.GEAR_CAP:
        gold = gear_value(item)
        p["gold"] += gold
        return gold
    gear.append(item)
    return 0


def equip(p: dict, item_id: str | None, slot: str | None = None):
    eq = p.setdefault("equippedGear", {})
    if item_id is None:
        if slot in eq:
            del eq[slot]
        return
    item = next((g for g in p.get("gear", []) if g["id"] == item_id), None)
    if not item:
        raise GameError("找不到這件裝備")
    eq[item["slot"]] = item_id


def salvage(p: dict, item_id: str) -> int:
    gear = p.get("gear", [])
    item = next((g for g in gear if g["id"] == item_id), None)
    if not item:
        raise GameError("找不到這件裝備")
    p["gear"] = [g for g in gear if g["id"] != item_id]
    eq = p.get("equippedGear", {})
    for slot, gid in list(eq.items()):
        if gid == item_id:
            del eq[slot]
    gold = gear_value(item)
    p["gold"] += gold
    return gold


# ───────────── 黑市（與前端 lib/shop.ts 同規則）─────────────

def upgrade_cost(price: int, next_plus: int) -> int:
    return round(price * (0.5 + 0.25 * next_plus))


def item_price(p: dict, item_id: str) -> int:
    """實際價格；不能買時丟 GameError"""
    if item_id not in D.SHOP:
        raise GameError("未知的商品")
    it = D.SHOP[item_id]
    inv = p.get("inv", {})
    owned = inv.get(item_id, 0)
    if "learn" in it and p.get(it["learn"]):
        raise GameError("你已經習得這個技能了。")
    if item_id in D.WEAPON_ATK:
        if item_id == "weapon_basic" and inv.get("weapon_adv", 0) > 0:
            raise GameError("已裝備高級武器，初級武器不再需要。")
        if owned >= 1 + D.MAX_PLUS:
            raise GameError(f"已強化至 +{D.MAX_PLUS} 上限。")
        if owned > 0:
            return upgrade_cost(it["price"], owned)
    if item_id == "terminus" and owned > 0:
        raise GameError("已經裝備了。")
    return it["price"]


def buy(p: dict, item_id: str, is_admin: bool = False) -> str:
    price = item_price(p, item_id)
    if not is_admin and p["gold"] < price:
        raise GameError(f"金幣不足（需要 {price:,}G）")
    it = D.SHOP[item_id]
    c = D.CLASSES[p["klass"]]
    inv = p.setdefault("inv", {})
    if "learn" in it:
        p[it["learn"]] = True
        inv[item_id] = 1
        msg = {"learnedSkill2": f"✨ 已習得第 2 技能 [T/U]：{c['skill2']}！",
               "learnedSkill3": f"✨ 已習得第 3 技能 [Y/O]：{c['skill3']}！",
               "learnedUlt": f"★ 已習得終極奧義 [Q/I]：{c['ult']}！"}[it["learn"]]
    elif item_id in D.WEAPON_ATK:
        owned = inv.get(item_id, 0)
        base, per = D.WEAPON_ATK[item_id]
        gain = base if owned == 0 else per
        inv[item_id] = owned + 1
        wname = c["wBasic"] if item_id == "weapon_basic" else c["wAdv"]
        msg = (f"⚔ 已裝備「{wname}」ATK +{gain}！格鬥中的武器外觀已進化。" if owned == 0
               else f"⚔「{wname}」升階強化至 +{owned}，ATK +{gain}，武器光效增強！")
    elif item_id == "terminus":
        inv["terminus"] = 1
        msg = "[ERROR] 未知權限已解鎖……武器化為流動的程式碼。"
    else:
        inv[item_id] = inv.get(item_id, 0) + 1
        msg = f"已購買 {it['name']}"
    if not is_admin:
        p["gold"] -= price
    return msg


def transfer_class(p: dict, klass: str, is_admin: bool = False) -> str:
    if klass not in D.CLASSES:
        raise GameError("未知的職業")
    if klass == p["klass"]:
        raise GameError("你目前已經是該職業了。")
    if not is_admin and p["gold"] < D.CLASS_TRANSFER_PRICE:
        raise GameError(f"轉職需要 {D.CLASS_TRANSFER_PRICE:,}G")
    if not is_admin:
        p["gold"] -= D.CLASS_TRANSFER_PRICE
    p["klass"] = klass
    return f"⚡ 轉職成功！你已轉職為「{D.CLASSES[klass]['name']}」，技能書與武器強化全部繼承。"


# ───────────── 故障之塔 / 每日挑戰 ─────────────

def _scaled_enemy(key: str, hp_mul: float, atk_mul: float, mods: list) -> dict:
    base = D.ENEMIES[key]
    hp = base["hp"] * hp_mul * (1.6 if "giant" in mods else 1.0)
    atk = atk_mul * (1.3 if "berserk" in mods else 1.0)
    return {
        "key": key,
        "name": base["name"],
        "hp": int(round(hp)),
        "atkScale": round(atk, 2),
        "speedScale": 1.3 if "berserk" in mods else 1.0,
        "modifiers": mods,
    }


def tower_floor(seed: int, floor: int) -> dict:
    rng = random.Random(seed * 1009 + floor)
    if floor % 5 == 0:
        key = rng.choice(["duke", "abyss", "skyisle", "demonlord", "admin"])
    else:
        pool = D.TOWER_POOL[: min(len(D.TOWER_POOL), 2 + floor // 2)]
        key = rng.choice(pool)
    n_mods = 0 if floor <= 2 else 1 if floor <= 6 else 2 if floor <= 14 else 3
    mods = rng.sample(list(D.MODIFIERS), k=n_mods)
    enemy = _scaled_enemy(key, 1 + 0.15 * (floor - 1), 1 + 0.07 * (floor - 1), mods)
    enemy["boss"] = floor % 5 == 0
    return enemy


def tower_rewards(floor: int) -> dict:
    return {"xp": 25 * floor + 30, "gold": 40 * floor + 60}


def day_seed(day: str) -> int:
    return int(hashlib.sha256(f"cloudrpg-daily-{day}".encode()).hexdigest()[:12], 16)


def daily_config(day: str) -> dict:
    seed = day_seed(day)
    rng = random.Random(seed)
    key = rng.choice(D.DAILY_POOL)
    mods = rng.sample(list(D.MODIFIERS), k=2 + (seed % 2))
    enemy = _scaled_enemy(key, 1.5, 1.25, mods)
    return {"day": day, "seed": seed, "enemy": enemy}


def daily_score(win: bool, hp_ratio: float, duration_ms: int, max_combo: int) -> int:
    score = (3000 if win else 0) + round(max(0.0, min(1.0, hp_ratio)) * 4000)
    if win:
        score += max(0, 180_000 - duration_ms) // 50
    score += min(max(0, max_combo), 60) * 40
    return int(score)


# ───────────── 防作弊：戰鬥合理性 ─────────────

def max_dps(p: dict, buff_pct: float = 0) -> float:
    """玩家在 2D 格鬥中理論上能打出的最高每秒傷害（寬鬆估計，含奧義與隊友支援）"""
    return 240 * atk_mul(p, buff_pct) + 80


def min_win_ms(p: dict, enemy_hp: int, buff_pct: float = 0, glass: bool = False) -> int:
    dps = max_dps(p, buff_pct) * (2 if glass else 1)
    return int(max(3000, enemy_hp / dps * 1000))


def damage_cap(p: dict, duration_ms: int, buff_pct: float = 0) -> int:
    return int(max_dps(p, buff_pct) * max(0, duration_ms) / 1000)


def elo(r_a: int, r_b: int, win: bool, k: int = D.PVP_K) -> int:
    expect = 1 / (1 + 10 ** ((r_b - r_a) / 400))
    return round(k * ((1 if win else 0) - expect))
