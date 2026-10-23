# 壓力測試（Locust）

[`locustfile.py`](locustfile.py) 有兩種虛擬玩家：

| 類型 | 行為 | 帳號 |
|---|---|---|
| `Visitor`（權重 3） | 每 2–6 秒做一件事：開大廳 / raid 頁、輪詢世界 Boss、每日關卡、排行榜、世界聊天 | 不需要，對正式站安全 |
| `Player`（權重 1） | 每 3–8 秒：讀角色、塔、PvP 對手、公會、世界 Boss，偶爾發言 | `LOADTEST_USERS=帳號檔`（每行 `帳號:密碼`），或 `LOADTEST_REGISTER=1` 自動註冊（**只允許 localhost**） |

## 怎麼跑

```bash
pip install locust          # Windows 若被 Smart App Control 擋下 greenlet，改在 WSL / Linux / macOS 執行
locust -f loadtest/locustfile.py --host http://54.161.3.74            # 介面模式：http://localhost:8089

# 無介面 + 階梯負載（每階 40 秒），輸出 CSV，再依人數彙總
LOADTEST_STEPS=50,100,200,400,600 LOADTEST_STEP_SECONDS=40 \
  locust -f loadtest/locustfile.py --host http://54.161.3.74 --headless \
  --csv loadtest/results/run --csv-full-history --only-summary Visitor
python loadtest/summarize.py loadtest/results/run_stats_history.csv
```

> 後端有每 IP 限流（預設每 10 秒 80 個請求）。從同一台電腦壓測前，要在 EC2 的 `backend/.env` 暫時加上 `RATE_LIMIT_PER_10S=1000000` 並重啟後端，**測完一定要刪掉再重啟**。注意 systemd 的 EnvironmentFile 不支援行尾註解，寫成 `RATE_LIMIT_PER_10S=1000000  # 註解` 會讓後端啟動失敗。

## 2026-10-23 正式站結果（t3.micro，單一 uvicorn 程序）

壓測端在台灣（WSL），到 us-east-1 的網路來回約 **220 ms**，所以下面的延遲都包含這段時間。只跑 `Visitor`。原始資料在 [`results/`](results/)。

| 同時在線 | 吞吐量 | p50 | p95 | p99 | 失敗率 | EC2 CPU（2 vCPU 合計） |
|---:|---:|---:|---:|---:|---:|---:|
| 50 | 13 req/s | 230 ms | 260 ms | 270 ms | 0% | ~5% |
| 100 | 24 req/s | 232 ms | 274 ms | 297 ms | 0% | ~7% |
| 200 | 49 req/s | 232 ms | 282 ms | 334 ms | 0% | ~12% |
| 400 | 96 req/s | 232 ms | 300 ms | 577 ms | 0% | ~25% |
| 600 | 129–140 req/s | 270–450 ms | 0.7–2.3 s | 1.4–4.4 s | 0% | ~40–50% |
| 800 | 87 req/s | 2.5 s | 18 s | 27 s | 0% | ~50%（滿載） |
| 1000 | 135 req/s | 1.2 s | 15 s | 29 s | 0% | ~50%（滿載） |

**結論**

- **舒適容量約 400–500 人同時在線**（p95 < 0.6 秒）；600 人開始排隊，800 人以上延遲到十幾秒，但沒有請求失敗。
- **瓶頸是後端只有一個 uvicorn 程序**：Python 一個程序只用得到一個核心，CPU 卡在 50%（2 個 vCPU 中的 1 個）。記憶體和 RDS 都還有餘裕。
- 最大吞吐量約 **130–140 req/s**。
- t3.micro 是可突發型主機：CPU 長時間超過 10% 會消耗 CPU credit，用完就會被降速（CloudWatch 告警 `cloudrpg-ec2-cpu-credit-low` 會通知）。

**怎麼再往上提升**

1. 用 `uvicorn --workers 2` 吃滿 2 個 vCPU，但要先把限流和 WebSocket Hub 換成 Redis。這兩個目前存在單一程序的記憶體裡，多程序之間不會共用。
2. 換更大的主機（t3.small / t3.medium），或多台後端放在 ALB 後面。這需要 Learner Lab 允許，而且同樣要先有 Redis。
3. 把 `/api/worldboss`、`/api/leaderboard/*`、`/api/daily` 這類大家都在讀的資料做幾秒鐘的快取，可以大幅減少資料庫查詢。
