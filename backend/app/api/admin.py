"""管理員工具：用真實戰鬥紀錄檢查遊戲平衡（只有 ADMIN_USERNAMES 裡的帳號可以用）。

GET /api/admin/balance?days=7
  battles  每個模式 / 敵人：場數、勝率、平均戰鬥秒數、平均剩餘血量、平均金幣獎勵
  income   每個模式在這段期間發出的金幣與經驗
  economy  玩家金幣分布（中位數 / P90 / 最大值 / 總量）與等級分布
調整數值的建議見 docs：勝率 > 90% 且很快打完 → 太簡單；勝率 < 30% → 太難；
某個模式的金幣收入遠高於其他模式 → 會被拿來刷錢。
"""
import datetime as dt
from collections import defaultdict
from statistics import median

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, is_admin
from app.db.database import get_db
from app.models.game import BattleSession, PlayerProfile
from app.models.user import User

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _pct(values, q):
    if not values:
        return 0
    values = sorted(values)
    return values[min(len(values) - 1, int(q * len(values)))]


@router.get("/balance")
def balance(days: int = Query(7, ge=1, le=90), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="只有管理員可以查看")
    since = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None) - dt.timedelta(days=days)
    rows = (
        db.query(BattleSession.mode, BattleSession.enemy_key, BattleSession.status, BattleSession.result)
        .filter(BattleSession.started_at >= since, BattleSession.status.in_(["won", "lost"]))
        .all()
    )
    groups = defaultdict(list)
    income = defaultdict(lambda: {"gold": 0, "xp": 0, "battles": 0})
    for mode, enemy, status, result in rows:
        result = result or {}
        groups[(mode, enemy)].append((status == "won", result))
        rw = result.get("rewards") or {}
        income[mode]["gold"] += int(rw.get("gold") or 0)
        income[mode]["xp"] += int(rw.get("xp") or 0)
        income[mode]["battles"] += 1

    battles = []
    for (mode, enemy), items in sorted(groups.items()):
        n = len(items)
        durs = [r.get("duration", 0) / 1000 for _, r in items if r.get("duration")]
        hps = [r["hpRatio"] for won, r in items if won and "hpRatio" in r]
        golds = [int((r.get("rewards") or {}).get("gold") or 0) for won, r in items if won]
        battles.append({
            "mode": mode, "enemy": enemy, "count": n,
            "winRate": round(sum(1 for won, _ in items if won) / n, 3),
            "avgSeconds": round(sum(durs) / len(durs), 1) if durs else None,
            "avgHpLeft": round(sum(hps) / len(hps), 3) if hps else None,
            "avgGold": round(sum(golds) / len(golds)) if golds else 0,
        })

    admins = {u.id for u in db.query(User).all() if is_admin(u)}
    profiles = [p for p in db.query(PlayerProfile).all() if p.user_id not in admins]
    golds = [int((p.data or {}).get("gold", 0)) for p in profiles]
    levels = [int((p.data or {}).get("level", 1)) for p in profiles]
    return {
        "days": days,
        "battles": battles,
        "income": [{"mode": m, **v} for m, v in sorted(income.items(), key=lambda kv: -kv[1]["gold"])],
        "economy": {
            "players": len(profiles),
            "gold": {"median": median(golds) if golds else 0, "p90": _pct(golds, 0.9), "max": max(golds, default=0), "total": sum(golds)},
            "level": {"median": median(levels) if levels else 0, "p90": _pct(levels, 0.9), "max": max(levels, default=0)},
        },
    }
