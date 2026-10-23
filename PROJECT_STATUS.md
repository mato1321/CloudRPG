# CloudRPG 專案現況、修復紀錄與優化建議

> 更新日期：2026-10-23　·　檢查對象：AWS Learner Lab EC2 `CloudRPG`（`i-020728b7077e9d8cf`）＋ GitHub `mato1321/CloudRPG`

---

## 0. 總結

- **網站本身有在跑**：Nginx、FastAPI 後端、Vite 前端三個服務都是 active，`/health` 正常。
- **「錯誤、沒辦法動」的主因**：故事模式進入 2D 格鬥後，鍵盤被下方的指令輸入框吃掉，角色完全不會動。另外還有「登入過期時後端回 500」、「/play 水合錯誤」、「GitHub 版本 API 位址寫死成舊 IP」等問題。
- **以上都已修好，部署到 EC2 並在實機驗證過**（第 3 節）。
- **第二輪（2026-10-23）**：格鬥畫面全面升級（各職業 / Boss 專屬外型、招式特效、Boss 專屬機制、武器外觀隨黑市購買進化、戰鬥中快速黑市），前端改成正式 build 部署，載入請求數 70+ → 5（第 9 節）。
- **第三輪（2026-10-23，commit `278fb33`）**：改成多人線上遊戲——伺服器端經濟與戰鬥驗證（防作弊）、限流、隨機掉寶、故障之塔、每日挑戰、世界 Boss、真的公會（公會 Boss + 公會聊天）、非同步 PvP、WebSocket 聊天室、排行榜、訪客模式 + 綁定帳號、新手教學。已部署到 EC2 並在正式站驗證（第 10 節）。
- **第四輪（2026-10-23）資安與維運**：換掉外洩的 RDS 密碼與 `SECRET_KEY`、`.env` 移出 git、RDS 只允許 EC2 連線、關閉多餘 port、關掉 `admin` 特權；EC2 改成 git checkout + 每 5 分鐘自動部署（CI 通過才部署、失敗自動回滾）；CloudWatch Agent + 8 個告警；Locust 壓力測試（舒適容量約 400–500 人同時在線）。詳見第 11 節。
- ~~⚠️ 發現嚴重資安問題需要你本人處理~~ → 已在第四輪處理（第 4 節）。

---

## 1. 目前部署架構（實際檢查結果）

```
                                 ┌── /api/ws（WebSocket）─┐
瀏覽器 ──HTTP :80──▶ Nginx ──────┼── /api/*、/health ─────┴──▶ FastAPI (uvicorn) :8000 ──▶ RDS PostgreSQL
                                 └── 其他所有路徑 ───────────▶ 前端正式版 :4173（vite preview 跑 build 好的 SSR）

EC2 關機時：喚醒網址（Lambda Function URL）──▶ StartInstances ──▶ 「伺服器啟動中」頁面輪詢 /health ──▶ 轉址回遊戲
```

| 項目 | 實際狀態 |
|---|---|
| EC2 | t3.micro（~1 GB RAM + 2 GB swap）· us-east-1d · Ubuntu 26.04 · Python 3.14 · Node 22 |
| 公開 IP | `54.161.3.74`，**是 Elastic IP**（`eipalloc-01b49f7451674e958`），重開 lab 也不會變。（舊版文件說「每次重開會換」是錯的；`44.205.216.47` 是更早的 IP，已失效） |
| 後端服務 | systemd `cloudrpg-backend` → `uvicorn app.main:app --port 8000` |
| 前端服務 | systemd `cloudrpg-frontend` → `npm run start`（**正式 build**，2026-10-23 起；原本是 `npm run dev` 開發模式）port 4173 |
| Nginx | `/api/ws` → :8000（WebSocket upgrade，`proxy_read_timeout 3600s`，第三輪新增）、`/api/` 與 `/health` → :8000、其他 → :4173 |
| 資料庫 | RDS **PostgreSQL** `cloudrpg-db`（publicly accessible，但安全群組只允許 EC2）。**自動備份已開啟：保留 7 天**，備份時段 18:00–18:30 UTC（台灣 02:00） |
| 喚醒頁 | Lambda `cloudrpg-wake`（角色 `LabRole`）：https://u22bkmoz6n7547l75ovss2hrqi0peogd.lambda-url.us-east-1.on.aws/ ，原始碼 `deploy/wake_lambda/lambda_function.py`；`?to=/raid` 可指定頁面（已防開放轉址） |
| 部署方式 | **EC2 上的 `~/CloudRPG` 是 GitHub repo 的 git checkout**；systemd timer `cloudrpg-deploy.timer` 每 5 分鐘執行 `deploy/auto_deploy.sh`：`main` 有新 commit 且 CI 通過 → 更新並只重啟有變動的部分，健康檢查失敗自動回滾（第 11 節） |
| 磁碟 | 6.7 GB；第四輪清理 apt 快取後約 **88%（剩約 870 MB）**，並設定 apt 自動清理。最大的是 `fronted/node_modules`（590 MB）與 `/opt/aws`（250 MB，CloudWatch Agent）；長期建議把 EBS 加大到 12 GB 以上 |
| 安全群組 | EC2：`sg-083d09c1c87ef2f90` 只開 22（EC2 Instance Connect）、80、443。RDS：`sg-05ce5f3a6457a4098`（`cloudrpg-rds-sg`）5432 **只允許來源 = EC2 的安全群組**。4173、5173、8000 已關閉（第四輪） |
| EC2 金鑰 / 角色 | 沒有 key pair，要連線請用 Console 的 **EC2 Instance Connect**；IAM：`LabInstanceProfile`（第四輪掛上，給 CloudWatch Agent 用） |
| 監控 | CloudWatch Agent（記憶體 / swap / 磁碟）+ 8 個告警 → SNS 主題 `cloudrpg-alerts`（第 11 節） |
| 不能用的服務 | CloudFront（Learner Lab 拒絕 `cloudfront:List`），所以沒有 CDN / HTTPS 代理 |

> `FINAL_PROJECT_REPORT.md` 寫的是「RDS MySQL」和「progress 表」，實際是 **PostgreSQL**，劇情進度存在 `users.game_progress` 欄位（第三輪起金幣 / 等級 / 道具 / 裝備改存 `player_profiles` 表，由伺服器計算），報告需要更正。

---

## 2. 怎麼找到問題的

1. 用 Learner Lab 憑證查 EC2／安全群組／RDS 狀態。
2. 從外部測各個 port 與 API（前端、`/health`、`/api/progress/load`）。
3. 用 EC2 Instance Connect 登入，看 systemd、Nginx 設定、`journalctl` 與 Nginx access/error log。
4. 把 EC2 上的程式碼和本機逐檔比對雜湊值，找出兩邊不一致的檔案。
5. 在瀏覽器逐頁實際操作，並用 canvas 像素量測角色座標，確認「按鍵後角色到底有沒有移動」。

---

## 3. 修復紀錄（已部署到 EC2）

### 3.1 🔴 故事模式戰鬥中角色「沒辦法動」（主因）

| | |
|---|---|
| 現象 | 在 `/play` 輸入 `fight` 進入 2D 格鬥後，按 WASD 角色不動，字母反而被打進下方指令框 |
| 根因 | 指令輸入框有 `autoFocus`，送出 `fight` 後焦點仍停在輸入框；`StoryBattleArena` 的 keydown 只要事件目標是 `<input>` 就直接 `return` |
| 修法 | ① 戰鬥開始時自動把焦點從輸入框移開，鍵盤交給戰場<br>② 輸入框有焦點時，戰場上顯示黃色提示「鍵盤目前在指令輸入框 — 點擊戰場或按 Esc 回到角色操控」<br>③ 在輸入框按 **Esc** 或點戰場即可回到操控<br>④ 戰鬥中輸入框不再 autoFocus，戰鬥結束後自動把焦點還給輸入框 |
| 驗證 | 修復前：輸入框有焦點時按住 A，角色位移 0 px。修復後：打完 `fight` 直接按住 D 角色右移；點輸入框出現提示；按 Esc 後按住 A 角色左移 |
| 檔案 | `fronted/src/components/crpg/StoryBattleArena.tsx`、`fronted/src/routes/play.tsx` |

### 3.2 🔴 登入過期後端回 500，雲端存檔默默失敗

| | |
|---|---|
| 現象 | JWT 有效 7 天；過期後 `/api/progress/load`、`/save` 回 **500**，前端仍顯示已登入，雲端存檔一直失敗但玩家不知道 |
| 根因 | `decode_token()` 遇到無效／過期 token 會回傳 `None`（不會丟例外），`progress.py` 接著呼叫 `payload.get()` → `AttributeError` → 500 |
| 修法 | 後端三個 progress 端點加上 `None` 檢查，改回 **401**；前端收到 401 時清除登入狀態並導回 `/login`（本機進度保留）；錯誤回應不是 JSON 時不再誤報「網路錯誤」 |
| 驗證 | `curl` 帶無效 token → 401（原本 500）；瀏覽器帶過期 token 進 `/play` → 自動回登入頁，本機存檔仍在 |
| 檔案 | `backend/app/api/progress.py`、`fronted/src/routes/play.tsx` |

### 3.3 🟠 `/play` 水合錯誤（Hydration failed）

| | |
|---|---|
| 現象 | 有存檔的玩家重新整理 `/play`，console 出現 React「Hydration failed…」，整頁被丟掉重畫（和以前修過的 418 錯誤同一類） |
| 根因 | `PlayPage` 在 render 時讀 localStorage：伺服器讀不到 → 畫「選職業」；瀏覽器讀得到 → 畫遊戲畫面，兩邊 HTML 不一致 |
| 修法 | `/play` 路由設定 `ssr: false`（這頁完全依賴 localStorage，本來就不適合伺服器端渲染） |
| 驗證 | 帶存檔重新整理 `/play`，不再產生新的 hydration 錯誤 |

### 3.4 🟠 雲端舊進度覆蓋本機新進度

- 原本：進 `/play` 時只要雲端有存檔就無條件覆蓋本機（例如離線玩了一段，再上線就被舊進度蓋掉）。
- 修法：比較「進頁面當下的本機存檔時間」和雲端 `last_save_at`，本機較新就保留本機。

### 3.5 🟠 登入／註冊在頁面還沒載入完時按下「沒反應」，而且密碼跑進網址

- 證據：Nginx log 裡有 `GET /login?username=&password=`。
- 根因：開發模式第一次載入要抓 70 多個模組，React 還沒接管頁面時按送出，表單走瀏覽器原生 GET，帳密被放進網址（也被寫進 Nginx log），頁面重新整理，看起來像沒反應。
- 修法：React 載入完成前按鈕停用並顯示 `[ loading… ]`；表單改 `method="post"`；`[register]`、`[cancel]`、`[back]` 改用 router `<Link>`，不再整頁重新載入；註冊成功改用 `navigate`。
- 檔案：`fronted/src/routes/login.tsx`、`fronted/src/routes/register.tsx`

### 3.6 🟠 GitHub 版本和 EC2 不一致（從 GitHub 重新部署會壞）

- GitHub `main` 上的 `login.tsx`、`register.tsx` 把 API 寫死成 `http://44.205.216.47:8000`（舊 lab IP，已失效），從 GitHub 部署會「連接失敗」無法登入。本機已改成依目前網址自動判斷，但**還沒 commit**。
- EC2 上有 4 個修正從沒回到 repo，**已同步回本機**：

| 檔案 | EC2 上的修正 |
|---|---|
| `backend/requirements.txt` | 新增 `argon2-cffi`（`security.py` 需要，缺了後端起不來）；版本改 `>=`（Python 3.14 需要）；移除沒用到的 `prisma` |
| `fronted/vite.config.ts` | port 4173 + `allowedHosts: true` |
| `fronted/src/routes/index.tsx` | 大廳的「STREET FIGHTER ARENA」按鈕 |
| `fronted/src/routeTree.gen.ts` | `/arena` 路由註冊 |

- `arena.tsx`、`StoryBattleArena.tsx`、`StoryWorldStage.tsx` 目前都是**未追蹤檔案**，一定要 commit，否則 GitHub 上根本沒有格鬥功能。

### 3.7 🟡 EC2 磁碟快滿

- 清除 apt 快取、npm 快取，journal 限制 100 MB：92% → 83%（剩 1.2 GB）。

### 部署與回滾

- 已上傳到 EC2 並重啟 `cloudrpg-backend`、`cloudrpg-frontend`，三個服務皆 active。
- 修改前的檔案備份在 EC2：`~/backups/pre-fix-20261022-155657.tgz`
- 回滾指令：

```bash
cd ~/CloudRPG && tar xzf ~/backups/pre-fix-20261022-155657.tgz && sudo systemctl restart cloudrpg-backend cloudrpg-frontend
```

---

## 4. 資安問題（第 1–3、5 點已在第四輪處理，見第 11 節）

1. **資料庫密碼與 JWT 金鑰外洩**：`backend/.env`、`fronted/.env` 從 2026-05-24 起被 commit 在**公開**的 GitHub repo，裡面有 RDS 連線字串（含密碼）和 `SECRET_KEY`。
   - 到 RDS Console 修改 master password → 更新 EC2 上的 `backend/.env` → `sudo systemctl restart cloudrpg-backend`
   - 產生新的 `SECRET_KEY`（`python3 -c "import secrets;print(secrets.token_urlsafe(48))"`），換掉後所有人會被登出，屬正常
   - `.gitignore` 加上 `.env`，執行 `git rm --cached backend/.env fronted/.env`，repo 只留 `.env.example`
   - 舊密碼還在 git 歷史裡，所以**換密碼**才是真正的解法
2. **RDS 對全世界開放**：RDS 設為 publicly accessible，安全群組 5432 對 `0.0.0.0/0` 開放，加上外洩的密碼，任何人都能連進你的資料庫。
   - 幫 RDS 建立專用安全群組，5432 只允許來源 = EC2 的安全群組，或關閉 publicly accessible
   - EC2 和 RDS 目前**共用同一個安全群組**，所以要先建好 RDS 專用的再改，不要直接刪規則
3. **多餘的對外 port**：4173、5173、8000 不需要對外（全部經 Nginx :80），建議從安全群組移除。移除後請一律用 `http://<IP>/` 進入。
4. **Vite 開發伺服器直接對外**：log 已經看到掃描器在試 `/etc/passwd`、`/.env`（被 Vite 擋下），但開發伺服器不是設計來對外的，見 6.1。
5. **管理員帳號（黑市免費）只用使用者名稱判斷**：第三輪改成由後端設定 `ADMIN_USERNAMES` 決定（逗號分隔），但**預設值是 `admin`**，正式站的 `backend/.env` 目前沒有設定這個值。如果 `admin` 帳號不是你的，或不想保留這個特權，在 EC2 的 `backend/.env` 加上 `ADMIN_USERNAMES=`（留空 = 沒有管理員）後 `sudo systemctl restart cloudrpg-backend`。長期建議改成資料庫欄位 `is_admin`。

---

## 5. 專案進度盤點

| 模組 | 狀態 | 說明 |
|---|---|---|
| 註冊／登入（JWT + Argon2） | ✅ 完成 | `/api/auth/register`、`/login`、`/me`；第三輪加上每 IP 限流、帳號 3–20 字（英數中文底線） |
| 雲端存讀檔 | ✅ 完成 | `/api/progress/save`、`load`、`clear`；劇情狀態存在 `users.game_progress`。第三輪起存檔**忽略經濟欄位**，讀檔時用伺服器 profile 覆蓋 |
| 伺服器端經濟 | ✅ 第三輪完成 | 金幣、經驗、等級、道具、裝備存在 `player_profiles`，購買 / 劇情獎勵 / 戰鬥結算都由伺服器計算；舊存檔第一次呼叫 API 時自動遷移 |
| 故事模式 `/play` | ✅ 可從頭玩到結局 | 19 個場景、7 種敵人、3 職業、AI 隊友、文字指令 + 2D 街機格鬥；第三輪加入訪客模式、5 步教學、劇情跳過 / 加速 |
| 訪客模式 + 綁定帳號 | ✅ 第三輪完成 | 免註冊玩第一章（打倒雜魚老大），之後綁定帳號，伺服器只承認第一章可驗證的獎勵 |
| 自由對戰 `/arena` | ✅ 完成 | 8 角色、4 場地、4 段 AI 難度、雙人同鍵盤 PvP／對電腦；與故事模式共用新的渲染引擎 |
| 格鬥畫面 / 特效 | ✅ 第二輪完成 | 各職業 / Boss 專屬外型、招式特效、Boss 專屬機制、奧義 Cut-in、7+1 個關卡背景（第 9 節）；第三輪加詞綴特效、高 DPI 與自動降畫質 |
| 黑市 `/market` | ✅ 伺服器計算 | 技能書、武器（可升階 +1～+3）、不死圖騰、轉職聖典；故事模式內也能開「快速黑市」；訪客不能購買 |
| 隨機裝備 | ✅ 第三輪完成 | 護甲 / 飾品，5 種稀有度、1–3 條隨機詞綴；背包上限 40，可分解換金幣 |
| 故障之塔 `/tower` | ✅ 第三輪完成 | 每層隨機敵人與詞綴，每 5 層 Boss，層間選祝福 |
| 每日挑戰 `/daily` | ✅ 第三輪完成 | 全服同一關卡（台灣日期當種子），每日排行，首次通關送 300G + 裝備 |
| 世界 Boss `/raid` | ✅ 第三輪完成 | 全服共用血條、每場 45 秒、即時戰報（WebSocket），倒下後所有參與者可領獎 |
| 公會 `/guild` | ✅ 第三輪重寫 | 建立（1000G）、加入、退出、上限 30 人、每週公會 Boss、公會聊天 |
| 非同步 PvP `/pvp` | ✅ 第三輪完成 | 挑戰真實玩家角色的 AI 分身（不足時補 Bot），Elo 積分 |
| 排行榜 `/ranking` | ✅ 第三輪完成 | 等級、塔、PvP、每日、世界 Boss、公會（本週） |
| 大廳、世界聊天 | ✅ 第三輪改成真資料 | 在線人數、世界 Boss、每日關卡、排行都來自伺服器；聊天室走 WebSocket |
| 圖鑑 `/codex` | 🟡 靜態內容 | 指令與世界觀說明 |
| 後端 characters API | ⚪ 有寫，前端沒用 | |
| 舊 battles API | ⚪ 已移除 | 邏輯錯誤的舊版移到 `backups/2026-10-23_before-upgrade/`，改用新的 `/api/battle/start`、`/finish` |
| `StoryWorldStage.tsx` | ⚪ 未使用 → 已移到 `backups/` | 878 行，沒有任何地方 import |
| 自動化測試 | 🟡 只有後端 | `backend/tests/` 15 個 pytest（SQLite）；前端沒有自動化測試 |
| 部署 | 🟡 正式 build，但流程仍手動 | 前端正式 build（`deploy/update_frontend.sh`）、Elastic IP、喚醒 Lambda；仍是手動 tar 上傳、資安未處理 |

**整體評估**：第三輪之後，多人與社群功能都是真的（伺服器資料 + WebSocket），遊戲數值也改由伺服器驗證。剩下的主要缺口是「部署與資安」（第 4 節）和「CI / 監控 / 壓力測試」（第 8 節）。

---

## 6. 技術優化建議（依優先度）

### 6.1 前端改用正式 build（效益最大）— ✅ 已於 2026-10-23 完成，見第 9 節

- 原本：每次開頁面要下載 70 多個未打包的模組（首次載入實測約 3.8 秒），Vite 開發伺服器還吃掉約 400 MB 記憶體（t3.micro 總共才 ~1 GB）。
- 做法：`vite.config.ts` 改成 `defineConfig({ cloudflare: false, ... })` 關掉 Cloudflare 打包目標，改輸出 Node 伺服器（可搭配 Nitro 的 node-server preset），systemd 改跑 build 出來的伺服器。**請先在本機驗證 build 與啟動流程。**
- t3.micro 上 build 容易 OOM，建議在自己電腦 build，只上傳產物。
- 另一條路：照原本 `wrangler.toml` 的方向把前端放 Cloudflare，EC2 只跑 API（但 API 需要 HTTPS，見 6.3）。

### 6.2 部署流程

- EC2 改用 `git clone` / `git pull` 取代 tar 上傳（tar 會帶進 Mac 的 `._*` 檔，版本也容易對不上，這次就發生了）。
- 寫一支 `deploy.sh`：`git pull` → `pip install -r requirements.txt` → `npm ci` → build → `systemctl restart`。
- ~~申請 Elastic IP，讓 IP 不再每次變~~ — ✅ `54.161.3.74` 已經是 Elastic IP。

### 6.3 安全

- 先完成第 4 節。
- 有網域的話用 `certbot --nginx` 上 HTTPS。
- CORS 目前是 `allow_origins=["*"]` 加 `allow_credentials=True`，改成只允許自己的網域。
- ~~登入 API 加 rate limit，防暴力破解~~ — ✅ 第三輪完成：登入每 IP 每分鐘 10 次、註冊每 IP 每 10 分鐘 5 次，另有全域每 IP 每 10 秒 80 個請求（`RATE_LIMIT_PER_10S`）。

### 6.4 後端與資料

- ~~**伺服器端驗證**：`/api/progress/save` 完全相信前端送來的狀態~~ — ✅ 第三輪完成：購買、劇情獎勵、戰鬥結算都移到後端，存檔忽略經濟欄位，戰鬥用伺服器量到的時間檢查（見 10.3）。
- 進度可以改存到已經建好的 `characters` 表（JSONB），不要全部塞在 `users`。
- 用 Alembic 做 migration，取代 `create_all`。
- `requirements.txt` 用 `pip freeze` 鎖版本，避免下次 Python 升級又壞。
- `datetime.utcnow()` 已棄用，改 `datetime.now(timezone.utc)`；`print` 改 `logging`；`/health` 加資料庫連線檢查。

### 6.5 前端程式碼

- `play.tsx` 約 1,300 行、`StoryBattleArena.tsx` 約 2,200 行、`arena.tsx` 約 1,600 行；後兩者有大量重複的格鬥引擎，可以抽成共用模組。
- ~~`API_URL` 的判斷邏輯重複在 4 個檔案，抽成 `lib/api.ts`，順便統一處理 401~~ — ✅ 第三輪新增 `lib/api.ts`（自動帶 token、401 清登入、`keepalive`、WebSocket 自動重連）。
- 自動同步：每次 state 或 log 變化都會重設 30 秒計時器，連續操作時可能一直不同步；`beforeunload` 裡的非同步 fetch 常被瀏覽器中斷。建議在場景切換、戰鬥結束時存檔，並使用 `fetch(..., { keepalive: true })`。
- 遊戲 log 無限增長並整包上傳，建議只保留最近 200 行。
- 逐步移除 `// @ts-nocheck`。

### 6.6 雲端架構（課程加分項）

- CloudWatch Agent 收集 log 和 CPU／記憶體指標，設定 Alarm。
- ~~開啟 RDS 自動備份與快照~~ — ✅ 自動備份保留 7 天；第三輪部署前另做了手動快照 `cloudrpg-db-pre-round3-20261023`。
- 靜態資源放 S3 + CloudFront（Learner Lab 不允許 CloudFront，目前做不到）。
- 報告中列的 DynamoDB／Lambda 可擇一實作，例如用 Lambda 每天結算排行榜。

---

## 7. 讓遊戲更好玩的建議

> 第三輪已完成：真的世界聊天、排行榜、新手教學、每日挑戰、真的公會、非同步 PvP、隨機裝備掉落（標 ✅）。

### 短期（1–3 天，效果最明顯）

- ✅ **真的世界聊天**：FastAPI WebSocket 取代假的 bot 訊息，最能體現「Cloud」RPG。
- ✅ **排行榜**：等級、通關時間、競技場勝場，存 RDS 並顯示在大廳，讓「線上人數」這類假資料變成真的。
- ✅ **新手操作教學**：第一場戰鬥前顯示 WASD／F／G／R 的操作提示，避免玩家不知道怎麼動。
- **打擊感**：命中停頓（hit-stop）、畫面震動、連段計數、受擊閃白。
- **成就系統**：首次通關、無傷擊敗公爵、集滿三顆傳說之石，存在 `story_flags`。
- 🟡 **每日任務／登入獎勵**：提高回訪率。（已做「每日挑戰」，登入獎勵還沒做）

### 中期（1–2 週）

- ✅ **真的公會**：建立、加入、公會聊天、公會排行。
- ✅ **非同步 PvP（幽靈對戰）**：用其他玩家的角色資料加 AI 當對手，不需要即時連線也有多人感。
- **線上即時 PvP**：WebSocket 房間，讓競技場可以兩台電腦對打（現在只能同一個鍵盤）。
- ✅ **隨機裝備掉落**：沿用現有的稀有度顏色系統，加入隨機詞綴。
- **多結局**：依選擇和隊友存活狀況走向不同結局；Administrator 戰加入第二階段。
- **手機支援**：虛擬搖桿和按鈕。
- **每張地圖不同 BGM**。

### 長期

- 賽季與排位制度。
- 黑市改成玩家拍賣場（正好需要後端驗證）。
- 劇情章節改由 JSON 資料驅動，方便擴充新章節。

---

## 8. 下一步行動清單

- [x] commit 本次修改與 `arena.tsx`、`StoryBattleArena.tsx` 並 push（2026-10-23；舊版放在 `backups/`）
- [x] 換 RDS 密碼、換 `SECRET_KEY`、把 `.env` 移出 git（第四輪）
- [x] RDS 5432 只允許 EC2；安全群組移除 4173、5173、8000（第四輪）
- [ ] 更正 `FINAL_PROJECT_REPORT.md`、`TROUBLESHOOTING.md` 裡的舊 IP（`44.205.216.47`）與 MySQL → PostgreSQL
- [x] EC2 改用 git 部署 + 定時自動部署（第四輪）
- [x] 前端改正式 build（2026-10-23）
- [x] 格鬥畫面升級、Boss 專屬機制、武器外觀與黑市整合（2026-10-23）
- [x] commit 第二輪新增的 `battleFx.ts`、`ShopModal.tsx`、`lib/shop.ts`、`deploy/` 資料夾，新增中英文 `README.md`
- [x] 遊戲功能：排行榜 + WebSocket 聊天，以及塔、每日、世界 Boss、公會、PvP、訪客模式（第三輪，2026-10-23，`278fb33`）
- [x] Nginx 加 `/api/ws` WebSocket 設定（2026-10-23）
- [x] 正式站 `ADMIN_USERNAMES=`（沒有管理員；前端也改成看伺服器判斷）
- [x] 實機測試塔 / PvP / 公會（使用者用自己的帳號測過，2026-10-23）
- [x] 商城頂部不顯示金幣（`TopBar` 沒有畫出 `headerExtra`，第四輪修正）
- [ ] 實測喚醒頁「EC2 關機 → 自動開機」完整流程
- [x] EC2 磁碟清理（apt 快取、舊 snap）+ apt 自動清理設定
- [ ] EBS 根磁碟加大到 12 GB 以上（目前 6.7 GB，核心更新與 node_modules 很容易又吃滿）
- [x] GitHub Actions CI（`.github/workflows/ci.yml`：pytest on Python 3.11 / 3.14 + 前端 `npm ci` + `npm run build` + TEMP-DEBUG 檢查；push 到 main 與 PR 時執行）
- [x] 自動部署：EC2 定時 git pull（CI 通過才部署、失敗回滾）
- [x] Locust 壓力測試腳本 + 正式站實測（`loadtest/README.md`）
- [ ] 突破單程序瓶頸：限流與 WebSocket Hub 改用 Redis 後再開 `uvicorn --workers 2`；熱門唯讀 API 加短暫快取
- [x] Sentry 程式整合：`requirements.txt` 加 `sentry-sdk[fastapi]`；後端例外 + 瀏覽器 / SSR 錯誤（經 `/api/telemetry/error` 轉送）共用一組 DSN（`backend/app/core/monitoring.py`、`tests/test_monitoring.py` 5 個測試；沒裝 sentry-sdk 時後端照常啟動）
- [ ] ~~Sentry 上線~~（決定不使用；程式沒有 DSN 時不會動作）
- [x] CloudWatch Agent + 8 個告警（第四輪）
- [ ] 告警通知：在 SNS 主題 `cloudrpg-alerts` 訂閱 email（需要到信箱點確認）
- [ ] 手機虛擬搖桿

---

## 9. 第二輪：格鬥畫面升級 + 正式版部署（2026-10-23）

### 9.1 做了什麼

| 需求 | 原本 | 現在 |
|---|---|---|
| **角色外觀差異化** | 所有角色都是「武道服火柴人」換顏色，頂多加一頂帽子 | 新的骨架姿勢系統（idle 呼吸、走路、跳躍、蹲下、受擊、倒地、每招都有預備→出招→收招動作）+ 每個角色專屬體型與服裝（見 9.2） |
| **招式特效** | 只有圓形投射物和方塊粒子 | 半月形劍氣弧光、魔法陣（地面 / 垂直）、聖光柱 + 金色羽毛、命中星芒與衝擊波、衝刺殘影、地裂、奧義 Cut-in 特寫橫幅、命中閃屏 |
| **投射物造型** | 全部是發光圓球 | 劍氣波、雷電球、聖光十字彈、波動拳、火球、氣功環、旋轉毒匕首、血月斬、冰晶、落雷槍、程式碼封包、BUG 炸彈，各自有拖尾粒子 |
| **冥盡洞主機制** | 一根三角形冰刺 | 地面裂紋預警 → 冰晶叢爆發（半血後一次三處）；新增 **黑水陷阱**：觸手 + 氣泡，站在上面會減速並持續扣血 |
| **天光島嶼之主機制** | 一個黃色矩形 | 天空凝聚雷雲 + 地面「!」預警圈 → 鋸齒狀落雷劈下、閃屏與火花；半血後一次三道錯開落雷 |
| **Administrator 機制** | 55% 血量變速、紅色矩形光束 | **半血觸發「SYSTEM OVERCLOCK」**：定格 + 橫幅 + 背景變紅色亂碼雨 + 畫面故障切片；輪流施放 **全畫面雷射**（高位要蹲、低位要跳）、**數據方塊轟炸**（看地面陰影閃避）、雙格式化光束；移動時留下程式碼殘影 |
| **哥布林** | 只是縮小的火柴人 | 矮小駝背、大耳朵大鼻子、纏腰布 + 毒匕首，AI 會頻繁跳躍 |
| **武器外觀隨購買進化** | 只換光暈顏色 | 每個職業 4 段外觀（初始 / 初級 / 高級 / ???終端機），強化 +1～+3 光效與粒子越來越強，戰鬥中購買立即生效（見 9.3） |
| **黑市整合** | 只有 `/market` 頁面；同一把武器可以無限重複購買；`EQUIPPED` 名稱一直重複堆疊 | 武器改為「首次購買 = 裝備、之後升階 +1～+3（有上限）」；有高級武器就不再賣初級；???終端機只能買一次；EQUIPPED 只顯示實際裝備 `日蝕殞落之劍 +2`；故事模式內新增 **快速黑市**（戰鬥中按「🛒 快速開啟黑市」、側欄按鈕或輸入 `shop`），開啟時戰鬥暫停 |
| **HUD** | 平面長方形血條 | 角色頭像、斜角血條（受傷殘影、低血量閃爍）、分段必殺氣條、彈跳式連擊數、黑邊浮動傷害數字、ROUND / FIGHT / K.O. 動態橫幅、Boss 稱號與 PHASE 2 標示、裝備武器名稱 |
| **關卡背景** | 單色漸層 + 綠色格線 | 燃燒村莊、火把哥布林洞窟、血月凶宅、冥盡冰窟、天空浮島、魔王城、系統核心（超頻時變紅）、東吳頂樓夜景；靜態部分預先畫在離屏 canvas 只畫一次 |
| **AWS 正式版部署** | `npm run dev`（開發伺服器） | `npm run build` + `npm run start`（vite preview 跑 SSR build），見 9.4 |

### 9.2 角色外型一覽

| 角色 | 外型重點 | 武器 |
|---|---|---|
| 戰士 | 騎士頭盔（面罩縫透出眼光）+ 翎羽、胸甲與職業色外袍、肩甲、飄動披風 | 巨劍（揮砍時半月劍氣） |
| 法師 | 巫師帽（帽尖會晃）、長袍下襬、背後浮游魔導書（會開闔） | 法杖 + 法珠（施法時出現魔法陣） |
| 牧師 | 白色兜帽與聖袍、披帶、背後神聖光環 | 十字權杖 + 聖珠（回血技能有聖光柱與金色羽毛） |
| RYU / KEN / 春麗（/arena） | 道服 + 頭帶 / 金色刺蝟頭 / 雙包頭旗袍 | 拳腳（旋風腿會翻轉） |
| 魔王軍雜魚老大 | 壯碩體型、牛角頭盔、獠牙、皮甲綁帶 | 尖刺狼牙棒 |
| 哥布林狂戰王 | 縮小 0.78 倍、駝背、長耳大鼻、黃眼 | 毒匕首 |
| 羅劫公爵 | 高大 1.12 倍、惡魔雙翼會拍動、大披風、高領大衣、捲角、紅眼 | 血色細劍 |
| 冥盡洞主 | 兜帽遮臉只露發光雙眼、冰之王冠、破碎下襬長袍、浮游 | 冰晶三叉戟 |
| 天光島嶼之主 | 金色鎧甲、天使羽翼、光環、羽翼頭盔 | 雷光長槍 |
| 魔王（程式語言版） | 1.14 倍、巨大捲角 + 王冠、發光程式碼紋路鎧甲 | 鐮刀 |
| Administrator | 連帽 + 螢幕臉（紅色掃描線）、頭頂環繞程式碼、矩陣殘影；超頻後全身轉紅 | 出招時浮現全息程式碼刃 |

### 9.3 武器外觀分級

| 職業 | 初始 | 初級武器 | 高級武器 | ???終端機 |
|---|---|---|---|---|
| 戰士 | 很廢的武器（灰色） | 銀風鐵劍：銀白劍身 + 疾風粒子 | 日蝕殞落之劍：黑金劍身 + 熔岩紋 + 烈焰餘燼 | 綠色程式碼劍身 |
| 法師 | 學徒木杖 | 刻印法杖：藍色法珠 + 環繞符文 | 全世操縱之杖：黃金杖身 + 水晶 + 雷電火花 | 程式碼法珠 |
| 牧師 | 木製念珠 | 純潔寶珠：白色聖光 + 星芒 | 虛空之眼：紫色瞳孔寶珠 + 虛空粒子 | 程式碼寶珠 |

升階 +1～+3：武器光暈與粒子噴發頻率增加；每階 ATK +6（初級）/ +14（高級），價格 = 原價 × (0.5 + 0.25 × 等級)。

### 9.4 正式版部署（已套用在 EC2）

- `fronted/vite.config.ts`：`cloudflare: false`（不再打包成 Cloudflare Worker），`npm run build` 產出 `dist/client` + `dist/server`
- `fronted/package.json`：新增 `"start": "vite preview --host 0.0.0.0 --port 4173"`（TanStack Start 內建 preview SSR 伺服器）
- systemd 設定改為 `npm run start`，檔案放在 repo 的 `deploy/cloudrpg-frontend.service`
- 之後更新前端：上傳程式後在 EC2 執行 `bash ~/CloudRPG/deploy/update_frontend.sh`（會先停服務再 build，避免 t3.micro OOM；build 約 20 秒）
- 也清掉了 EC2 上 166 個 Mac 打包殘留的 `._*` 檔案（會干擾 build）
- 修改前的檔案備份：EC2 `~/backups/pre-combat-upgrade-20261022-164928.tgz`

| 指標 | 開發伺服器（之前） | 正式版（現在） |
|---|---|---|
| `/arena` 載入請求數 | 70+ 個未打包模組 | **5 個** |
| 傳輸量 / 載入完成 | 首次約 3.8 秒 | **159 KB / 約 0.7 秒** |
| 前端程序記憶體 | 約 330–400 MB | **約 200 MB** |
| 對外暴露 Vite 開發伺服器 | 是（掃描器在試 `/etc/passwd`） | 否 |

### 9.5 新增 / 修改的檔案

| 檔案 | 內容 |
|---|---|
| `fronted/src/components/crpg/battleFx.ts`（新） | 共用渲染與特效引擎：角色骨架 / 外型、武器、粒子、招式特效、投射物、Boss 機關、關卡背景、HUD 元件 |
| `fronted/src/lib/shop.ts`（新） | 黑市商品與購買規則（武器升階上限、已裝備判斷、轉職武器加成），`/market` 與快速黑市共用 |
| `fronted/src/components/crpg/ShopModal.tsx`（新） | 故事模式內的快速黑市視窗 |
| `fronted/src/components/crpg/StoryBattleArena.tsx` | 改用新引擎；Boss 機制（黑水、多重落雷、超頻、雷射、數據方塊）；暫停；武器 / ATK 即時生效 |
| `fronted/src/routes/arena.tsx` | 改用新引擎與新 HUD |
| `fronted/src/routes/play.tsx` | 接上快速黑市（按鈕、`shop` 指令、戰鬥暫停）；自動存檔也會在道具變動時觸發 |
| `fronted/src/routes/market.tsx` | 改用 `lib/shop.ts` 的共用規則與「已裝備 / 升階」顯示 |
| `fronted/vite.config.ts`、`fronted/package.json` | 正式版 build / start 設定 |
| `deploy/cloudrpg-frontend.service`、`deploy/update_frontend.sh`（新） | EC2 正式版部署設定與更新腳本 |

### 9.6 驗證方式

- 本機 `npm run build` 與 EC2 build 都成功；EC2 上 `/`、`/arena`、`/play`、`/market`、`/login`、`/health` 全部 200
- 在瀏覽器實際測試：/arena 戰士 vs RYU、法師 vs 公爵；故事模式哥布林、雜魚老大、冥盡洞主（冰刺、黑水減速）、天光島嶼之主（三重落雷、牧師回血聖光柱）、魔王、Administrator（半血超頻、全畫面雷射、數據方塊、奧義 Cut-in）
- 快速黑市：開啟後戰鬥幀數停止（暫停）；購買升階後金幣扣款、裝備名稱更新為 `+2`、戰鬥中攻擊倍率即時更新
- 已知限制：沒有自動化測試；畫面效果以 Canvas 2D 繪製，舊電腦或手機上若掉幀，可把 `battleFx.ts` 的粒子上限（420）調低（第三輪已加自動降畫質）

---

## 10. 第三輪：多人線上化（2026-10-23，commit `278fb33`）

目標：把專案從「單機遊戲 + 雲端存檔」改成「可以給很多人一起玩、不能作弊的線上遊戲」。

### 10.1 新玩法

| 模式 | 頁面 | 規則 |
|---|---|---|
| 訪客模式 | `/play` | 免註冊直接玩第一章（打倒雜魚老大），之後跳出「綁定帳號」；綁定時伺服器只承認第一章可驗證的獎勵 |
| 新手教學 | `/play` | 第一場戰鬥 5 步操作教學；劇情文字可跳過 / 加速（`skip` 指令） |
| 隨機裝備 | 遊戲內 `gear` 指令 / 黑市「裝備背包」分頁 | 護甲、飾品兩個欄位；普通 / 稀有 / 史詩 / 傳說 / 神話 5 種稀有度，1–3 條詞綴（攻擊、生命、魔力、氣條、移速）；背包上限 40，可分解換金幣；裝備神話級會讓武器發出紅色光暈 |
| 故障之塔 | `/tower` | 每層隨機敵人，第 3 層起有詞綴（狂暴、玻璃大砲、全場黑水、雷暴、分身、再生、迷霧、巨大化），越高越多；血量跨層延續；每通過一層選一個祝福（回血 / 攻擊 / 草藥 / 氣條）；每 5 層 Boss 保底稀有以上裝備 |
| 每日挑戰 | `/daily` | 全服同一個關卡（以台灣日期為種子），台灣時間 0 點更新；分數 = 通關 + 剩餘血量 + 速度 + 最高連擊；每天首次通關送 300G + 一件裝備 |
| 世界 Boss | `/raid` | 全伺服器共用一條血條，每場 45 秒，傷害直接扣在共享血量上（資料庫原子扣血）；即時戰報與在線人數走 WebSocket；倒下後所有參與者可領獎，下一隻更強 |
| 公會 | `/guild` | 建立（1000G，標籤 2–5 字）、加入、退出，上限 30 人；每週一隻公會 Boss（血量依人數調整）；公會聊天頻道；公會週排行 |
| 非同步 PvP | `/pvp` | 對手是積分相近的真實玩家角色（由 AI 操控），人數不夠時補 Bot；Elo 積分（起始 1000，K=32） |
| 排行榜 | `/ranking` | 等級、故障之塔、PvP 積分、今日挑戰、世界 Boss、公會（本週） |
| 聊天室 | 大廳 / raid / 遊戲內 | 世界頻道 + 公會頻道，WebSocket 即時推播，斷線自動重連；每則 140 字、限速 |

### 10.2 新 API 一覽

| 分類 | 端點 |
|---|---|
| 角色資料 | `GET /api/profile`、`POST /api/profile/create`、`POST /api/profile/import-guest` |
| 經濟 | `POST /api/shop/buy`、`POST /api/shop/transfer`（轉職）、`POST /api/story/claim`、`POST /api/gear/equip`、`POST /api/gear/salvage` |
| 戰鬥 | `POST /api/battle/start`（發戰鬥憑證）、`POST /api/battle/finish`（mode：story / tower / daily / worldboss / guildboss / pvp） |
| 故障之塔 | `GET /api/tower`、`POST /api/tower/start`、`POST /api/tower/blessing`、`POST /api/tower/abandon` |
| 每日 / 世界 Boss | `GET /api/daily`、`GET /api/worldboss`、`POST /api/worldboss/claim` |
| 公會 | `GET /api/guilds`、`GET /api/guilds/mine`、`POST /api/guilds`、`POST /api/guilds/{id}/join`、`POST /api/guilds/leave`、`POST /api/guilds/boss/claim` |
| PvP / 排行 | `GET /api/pvp/opponents`、`GET /api/leaderboard/{level,tower,pvp,daily,worldboss,guild}` |
| 社群 | `GET/POST /api/chat/{world,guild}`、WebSocket `/api/ws?token=`、`POST /api/telemetry/error`（前端錯誤回報） |

### 10.3 防作弊與穩定性

- **經濟只在伺服器**：金幣、經驗、等級、道具、裝備存在 `player_profiles`；`/api/progress/save` 會忽略這些欄位，讀檔時用伺服器資料覆蓋。改 localStorage 不再有用。
- **戰鬥憑證**：開戰時伺服器發一張一次性憑證並記下時間；結算時用伺服器量到的經過時間檢查「最快可能獲勝時間」（`min_win_ms`）與「最大可能傷害」（`damage_cap`），同一張憑證不能結算兩次。
- **限流**：記憶體滑動視窗（Nginx 後用 `X-Real-IP`）：全域每 IP 每 10 秒 80 個請求；登入、註冊、開戰、結算、購買、公會、聊天、WebSocket 連線各有獨立上限。
- **可替換架構**：限流與 WebSocket Hub 都包成單一類別，將來多台後端時換成 Redis 即可。
- **前端**：高 DPI canvas + 掉幀時自動降畫質；全域錯誤回報到 `/api/telemetry/error`。
- **錯誤監控（之後補上）**：設定 `SENTRY_DSN` 後，後端例外與前端回報的錯誤（瀏覽器、路由錯誤畫面、SSR）都會送到 Sentry，見 README「錯誤監控」。
- **測試**：`backend/tests/` 15 個 pytest（SQLite），涵蓋經濟規則、存檔防作弊、戰鬥時間驗證、憑證重複結算、世界 Boss 共享血量、塔、每日、公會 + 聊天 + 限流、PvP Elo、訪客匯入、WebSocket 推播。

### 10.4 新增 / 修改的檔案

| 檔案 | 內容 |
|---|---|
| `backend/app/game/data.py`、`economy.py`、`services.py`（新） | 數值表、純函式遊戲規則（升級、購買、掉寶、塔 / 每日生成、防作弊上限、Elo、舊存檔遷移）、DB 輔助 |
| `backend/app/models/game.py`（新） | 新資料表 `player_profiles`、`battle_sessions`、`tower_runs`、`daily_scores`、`raid_bosses`、`raid_damage`、`guilds`、`guild_members`、`chat_messages`、`pvp_matches`（啟動時 `create_all` 自動建立，不動舊表） |
| `backend/app/api/profile.py`、`combat.py`、`modes.py`、`social.py`（新） | 10.2 的 API |
| `backend/app/core/deps.py`、`ratelimit.py`、`app/realtime.py`（新） | Bearer 驗證、限流、WebSocket Hub |
| `backend/app/core/config.py` | 新設定 `ADMIN_USERNAMES`、`SENTRY_DSN`、`RATE_LIMIT_PER_10S` |
| `backend/tests/`（新） | pytest |
| `fronted/src/lib/api.ts`、`classes.ts`、`gear.ts`、`useProfile.ts`、`telemetry.ts`（新） | API 工具 + WebSocket、職業資料、稀有度顯示、讀 profile、錯誤回報 |
| `fronted/src/components/crpg/ModeBattle.tsx`、`ChatPanel.tsx`、`GearPanel.tsx`、`BindAccountModal.tsx`、`GameUI.tsx`（新） | 伺服器驗證戰鬥流程、聊天室、裝備背包、綁定帳號、共用 UI |
| `fronted/src/routes/tower.tsx`、`daily.tsx`、`raid.tsx`、`pvp.tsx`、`ranking.tsx`（新）、`guild.tsx`（重寫） | 新模式頁面 |
| `fronted/src/routes/play.tsx`、`index.tsx`、`market.tsx`、`StoryBattleArena.tsx`、`battleFx.ts`、`ShopModal.tsx`、`Shell.tsx` | 接上伺服器經濟、大廳即時資料、詞綴特效、導覽列新增 TOWER / DAILY / RAID / PVP / RANK |
| `deploy/wake_lambda/lambda_function.py`（新） | 喚醒頁 Lambda |

### 10.5 部署紀錄（已套用在 EC2）

1. 備份：EC2 `~/backups/pre-round3-20261023-071904.tgz`（`backend/app`、`fronted/src`、`fronted/dist`、`deploy`、Nginx 設定）＋ RDS 手動快照 `cloudrpg-db-pre-round3-20261023`
2. 上傳 `backend/app`、`fronted/src`、`deploy/`；刪除 EC2 上已不再使用的舊 `backend/app/api/battle.py`
3. Nginx 加 `location /api/ws`（WebSocket upgrade）→ `nginx -t` → reload
4. `sudo systemctl restart cloudrpg-backend`：新表在 PostgreSQL 上自動建立
5. `bash ~/CloudRPG/deploy/update_frontend.sh`（build 約 28 秒）

回滾：

```bash
cd ~/CloudRPG && tar xzf ~/backups/pre-round3-20261023-071904.tgz backend/app fronted/src fronted/dist deploy \
  && sudo systemctl restart cloudrpg-backend cloudrpg-frontend
# Nginx 設定在同一個備份裡：sudo tar xzf ~/backups/pre-round3-20261023-071904.tgz -C / etc/nginx/sites-available/default && sudo systemctl reload nginx
```

> 注意：tar 解壓只會覆蓋舊檔，不會刪掉第三輪新增的檔案；舊版 `main.py` 不會 import 新檔案，所以不影響執行。資料庫新表留著不會影響舊版；要完全還原資料請用 RDS 快照。

### 10.6 驗證

- 本機：pytest 15/15 通過；`npm run build` 成功
- 正式站 API（PostgreSQL）：`/health`、`/api/worldboss`、`/api/daily`、6 個排行榜、`/api/guilds`、`/api/chat/world` 全部 200
- WebSocket：從外部經 Nginx 連 `/api/ws` → `101 Switching Protocols`，收到 `{"type":"hello","online":1}`；開第二條連線後，raid 頁的「X 人在線」自動從 1 變成 2
- 瀏覽器：大廳（即時在線人數、世界 Boss、每日關卡）、`/raid`、`/daily`、`/ranking`、`/play`（訪客選職業）都正常，console 沒有錯誤；`/tower`、`/pvp`、`/guild` 未登入時導到登入頁
- **還沒驗證**：登入後實際玩塔 / PvP / 公會（正式站不替使用者建立測試帳號）；喚醒頁「關機 → 自動開機」

---

## 11. 第四輪：資安、自動部署、監控、壓力測試（2026-10-23）

### 11.1 資安

| 項目 | 做法 | 驗證 |
|---|---|---|
| RDS 密碼外洩 | 產生新的 32 字元密碼，用 `modify-db-instance` 更換，同時更新 EC2 的 `backend/.env`（新密碼沒有出現在任何輸出或 repo 裡） | 舊密碼連線被拒（`password authentication failed`），新密碼正常 |
| `SECRET_KEY` 外洩 | 換成新的 64 字元隨機金鑰 | 所有舊的登入 token 失效，玩家需要重新登入一次（屬正常） |
| `.env` 在公開 repo | `git rm --cached backend/.env fronted/.env`，`.gitignore` 忽略 `.env` / `.env.*`，保留 `.env.example`（`fronted/.env.example` 新增） | 舊密碼仍在 git 歷史裡，但已經失效 |
| RDS 對全世界開放 | 新增安全群組 `cloudrpg-rds-sg`（`sg-05ce5f3a6457a4098`）：5432 只允許來源 = EC2 的安全群組，RDS 改掛這個群組 | 從外部連 5432 逾時；EC2 後端正常 |
| 多餘的對外 port | EC2 安全群組移除 4173、5173、8000、5432；只剩 22、80、443 | 外部連 8000 / 4173 / 5173 逾時、80 正常。也堵住了「直接連 :8000 偽造 `X-Real-IP` 繞過限流」的漏洞 |
| `admin` 黑市免費 | EC2 `backend/.env` 設 `ADMIN_USERNAMES=`（沒有管理員）；前端原本也只看帳號名稱是不是 `admin`，改成以伺服器回傳的 `isAdmin` / 金幣為準 | — |
| `DEBUG=True` | 正式站關掉（原本會把每一條 SQL 與參數寫進 log，也吃磁碟） | log 裡不再有 SQL |

備份：EC2 `~/backups/pre-security-20261023-083924.tgz`（含舊 `.env`，權限 600）、`~/backups/backend.env.20261023-084709`（新 `.env`）。

### 11.2 自動部署（EC2 定時 git pull）

- EC2 上的 `~/CloudRPG` 改成 GitHub repo 的 git checkout（`deploy/setup_git_deploy.sh`，只需執行一次）。
- `cloudrpg-deploy.timer` 每 5 分鐘執行 `deploy/auto_deploy.sh`：
  1. `git fetch`，`main` 沒有新 commit 就結束
  2. 用 GitHub API 確認這個 commit 的 **CI 通過**才部署（CI 還在跑就下次再看，失敗就不部署）
  3. `git reset --hard` 到新 commit（只動追蹤的檔案；`.env`、`venv`、`node_modules`、`dist` 不受影響）
  4. 只重啟有變動的部分：`backend/requirements.txt` 變了才 `pip install`、`backend/` 變了才重啟後端、`fronted/` 變了才重新 build 前端
  5. 健康檢查（`/health`、`/api/worldboss`、前端首頁）失敗 → 自動回滾到上一個 commit，並記住失敗的 commit 不再重試
  6. 拒絕部署任何還在追蹤 `.env` 的舊 commit，避免 repo 裡的舊密碼覆蓋或刪掉 EC2 上的 `.env`
- 看紀錄：`journalctl -u cloudrpg-deploy -n 50`；手動觸發：`sudo systemctl start cloudrpg-deploy`
- 實測：push `1f4b258` 後約 5 分鐘，timer 自動完成部署（`部署 a45f5c7 → 1f4b258`）
- 不需要 AWS 憑證，也不用把 Learner Lab 憑證放進 GitHub Secrets

### 11.3 CloudWatch 監控

- EC2 掛上 `LabInstanceProfile`，安裝 CloudWatch Agent（`deploy/setup_cloudwatch.sh` + `deploy/cloudwatch-agent.json`），每 60 秒上傳記憶體、swap、根目錄磁碟使用率。
- SNS 主題 `cloudrpg-alerts` + 8 個告警：

| 告警 | 條件 |
|---|---|
| `cloudrpg-ec2-cpu-high` | EC2 CPU 平均 > 80% 持續 10 分鐘 |
| `cloudrpg-ec2-cpu-credit-low` | t3.micro CPU credit < 20（之後會被降速） |
| `cloudrpg-ec2-status-check-failed` | 系統狀態檢查失敗 → **自動復原主機** + 通知 |
| `cloudrpg-ec2-instance-check-failed` | 執行個體狀態檢查失敗（作業系統沒回應） |
| `cloudrpg-ec2-memory-high` | 記憶體 > 90% 持續 10 分鐘 |
| `cloudrpg-ec2-disk-high` | 根目錄磁碟 > 90% |
| `cloudrpg-rds-cpu-high` | RDS CPU 平均 > 80% 持續 10 分鐘 |
| `cloudrpg-rds-storage-low` | RDS 剩餘空間 < 2 GB |

- 建好後 `cloudrpg-ec2-disk-high` 立刻觸發（93%）：apt 每日更新又下載了約 300 MB 套件，而系統設定 `AutocleanInterval "0"` 從不清理。已清掉並新增 `/etc/apt/apt.conf.d/99cloudrpg-clean`（安裝後不保留 .deb、每天自動清理）。
- **通知還沒有收件人**：要在 SNS 主題訂閱 email，並到信箱點確認連結。

### 11.4 壓力測試

`loadtest/locustfile.py`（Locust），結果與分析見 [`loadtest/README.md`](loadtest/README.md)。重點：

- **舒適容量約 400–500 人同時在線**（p95 < 0.6 秒，含 220 ms 跨洋延遲）；最大吞吐量約 130–140 req/s；到 1000 人也沒有請求失敗，但延遲到十幾秒。
- **瓶頸是單一 uvicorn 程序**（CPU 卡在 2 個 vCPU 中的 1 個），不是記憶體或資料庫。
- 下一步：限流與 WebSocket Hub 改用 Redis 後開 `--workers 2`；熱門唯讀 API 加幾秒鐘的快取。

### 11.5 其他修正

- **商城不顯示金幣**：`TopBar` 收到 `headerExtra` 卻從來沒畫出來，所以商城和故事模式頂部的職業 / 金幣都消失了。已修正（`be821df`）。
- `deploy/update_frontend.sh` 只等 5 秒就檢查前端，vite preview 啟動較慢時會誤判失敗。改成最多等 60 秒（`1f4b258`）。

---

## 附錄：Learner Lab 重開後的檢查步驟

1. Start Lab → 等 EC2 變成 running。IP 是 Elastic IP，固定是 `54.161.3.74`。
2. 開 `http://54.161.3.74/`；`http://54.161.3.74/health` 應該回 `{"status":"ok"}`。EC2 關機時可以改開喚醒網址（第 1 節），它會自動開機並在啟動後轉回遊戲。
3. 三個服務都設了開機自動啟動，不需要手動開；如果看到 502，照 `TROUBLESHOOTING.md` 處理。
4. 前端的 API 與 WebSocket 位址會自動跟著網址走（從 port 80 進入時），不需要改程式。
5. 要登入主機：EC2 Console → Connect → **EC2 Instance Connect**（這台沒有 .pem 金鑰）。
