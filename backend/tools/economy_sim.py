"""經濟模擬：估算各種「刷錢策略」每小時 / 每天能賺多少金幣，比較平衡調整前後的差異。

用法（在 backend/ 底下）：python tools/economy_sim.py
數值直接讀 app/game/data.py 與 economy.py，改了平衡參數後重跑就能看到影響。

戰鬥時間模型：實際戰鬥時間 = 伺服器允許的最快勝利時間 × 2.5（一般玩家不會打出理論最大傷害），
再加 12 秒的開場 / 結算畫面。這是保守估計：真實玩家數據出來後，用 /api/admin/balance 的
avgSeconds 取代這個假設會更準。
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("SECRET_KEY", "sim")

from app.game import data as D  # noqa: E402
from app.game import economy as E  # noqa: E402

OVERHEAD_S = 12
SKILL_FACTOR = 2.5


def player(level: int, weapon: str | None = None, plus: int = 0) -> dict:
    p = E.new_profile("warrior")
    p["level"] = level
    if weapon:
        p["inv"][weapon] = 1 + plus
    p["learnedSkill2"] = p["learnedSkill3"] = p["learnedUlt"] = level >= 10
    return p


def fight_seconds(p, enemy_hp):
    return E.min_win_ms(p, enemy_hp) / 1000 * SKILL_FACTOR + OVERHEAD_S


def story_farm(p, key, new_rules):
    hp = D.ENEMIES[key]["hp"]
    gold = D.ENEMIES[key]["gold"] * (E.repeat_scale(key) if new_rules else 1)
    return gold * 3600 / fight_seconds(p, hp)


def tower_run(p, floors, new_rules):
    """從 1 樓爬到 floors 樓、一次攀登的總金幣與時間"""
    gold = secs = 0
    for f in range(1, floors + 1):
        enemy = E.tower_floor(1, f)
        g = E.tower_rewards(f)["gold"] if new_rules else 40 * f + 60
        gold += g
        secs += fight_seconds(p, enemy["hp"]) + 8  # 選祝福
    return gold * 3600 / secs


def pvp_bot_farm(p, new_rules):
    secs = 40 + OVERHEAD_S
    wins_per_hour = 3600 / secs
    if not new_rules:
        return 80 * wins_per_hour
    return D.PVP_WIN_GOLD["bot"] * min(wins_per_hour, D.PVP_DAILY_GOLD_WINS)


def raid_farm(p):
    dmg = E.damage_cap(p, D.RAID_TIME_LIMIT * 1000) * 0.5
    gold = min(600, 50 + dmg // 100)
    return gold * 3600 / (D.RAID_TIME_LIMIT + OVERHEAD_S)


def daily_total(per_hour, hours, new_rules):
    """玩 hours 小時，一天實際入帳的金幣（新規則會套每日軟上限）"""
    raw = per_hour * hours
    if not new_rules:
        return raw
    p = {"gold": 0}
    return E.apply_income(p, int(raw), "sim-day")


def shop_total(klass="warrior"):
    """把黑市所有一次性商品買齊（含武器強化到 +3、轉職一次、???終端機）需要的金幣"""
    total = 0
    for k in ("skillbook_1", "skillbook_2", "skillbook", "totem"):
        total += D.SHOP[k]["price"]
    for k in ("weapon_basic", "weapon_adv"):
        price = D.SHOP[k]["price"]
        total += price + sum(E.upgrade_cost(price, n) for n in range(1, D.MAX_PLUS + 1))
    return total + D.CLASS_TRANSFER_PRICE, D.SHOP["terminus"]["price"]


def main():
    early = player(5, "weapon_basic", 1)
    late = player(30, "weapon_adv", 3)
    strategies = [
        ("哥布林（前期，Lv5）", early, lambda nr: story_farm(early, "goblin", nr)),
        ("羅劫公爵（中期，Lv5）", early, lambda nr: story_farm(early, "duke", nr)),
        ("Administrator 重刷（後期，Lv30）", late, lambda nr: story_farm(late, "admin", nr)),
        ("故障之塔爬到 60 樓（Lv30）", late, lambda nr: tower_run(late, 60, nr)),
        ("PvP 一直打 Bot（Lv30）", late, lambda nr: pvp_bot_farm(late, nr)),
        ("世界 Boss（Lv30，不含討伐獎勵）", late, lambda nr: raid_farm(late)),
    ]
    once, terminus = shop_total()
    print(f"黑市一次性商品全部買齊：{once:,}G（另加 ???終端機 {terminus:,}G）")
    print(f"每日戰鬥金幣軟上限：{D.DAILY_GOLD_SOFT_CAP:,}G，超過後 ×{D.SOFT_CAP_RATE}\n")
    print(f"{'策略':<30}{'舊規則 G/小時':>14}{'新規則 G/小時':>14}{'舊：一天玩4小時':>16}{'新：一天玩4小時':>16}")
    for name, _, fn in strategies:
        old, new = fn(False), fn(True)
        print(f"{name:<30}{old:>14,.0f}{new:>14,.0f}{daily_total(old, 4, False):>16,.0f}{daily_total(new, 4, True):>16,.0f}")


if __name__ == "__main__":
    main()
