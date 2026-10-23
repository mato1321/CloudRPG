"""把 Locust 的 *_stats_history.csv 依「同時在線人數」分階彙總。用法：python loadtest/summarize.py loadtest/results/<名稱>_stats_history.csv"""
import csv, sys
from collections import defaultdict

rows = [r for r in csv.DictReader(open(sys.argv[1], encoding="utf-8")) if r["Name"] == "Aggregated"]
steps = defaultdict(list)
for r in rows:
    steps[int(r["User Count"])].append(r)
print(f"{'users':>6} {'req/s':>7} {'p50ms':>6} {'p95ms':>6} {'p99ms':>6} {'fail%':>6}")
for users in sorted(steps):
    rs = steps[users][len(steps[users]) // 3:]  # 跳過每階剛開始的爬升
    if not rs:
        continue
    def avg(k):
        vals = [float(r[k]) for r in rs if r[k] not in ("", "N/A")]
        return sum(vals) / len(vals) if vals else 0
    reqs = float(rs[-1]["Total Request Count"]) - float(rs[0]["Total Request Count"])
    fails = float(rs[-1]["Total Failure Count"]) - float(rs[0]["Total Failure Count"])
    print(f"{users:>6} {avg('Requests/s'):>7.1f} {avg('50%'):>6.0f} {avg('95%'):>6.0f} {avg('99%'):>6.0f} {100 * fails / reqs if reqs else 0:>6.2f}")
