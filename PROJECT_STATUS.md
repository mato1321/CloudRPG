# CloudRPG 專案現況、修復紀錄與優化建議

> 更新日期：2026-10-23　·　檢查對象：AWS Learner Lab EC2 `CloudRPG`（`i-020728b7077e9d8cf`）＋ GitHub `mato1321/CloudRPG`

---

## 0. 總結

- **網站本身有在跑**：Nginx、FastAPI 後端、Vite 前端三個服務都是 active，`/health` 正常。
- **「錯誤、沒辦法動」的主因**：故事模式進入 2D 格鬥後，鍵盤被下方的指令輸入框吃掉，角色完全不會動。另外還有「登入過期時後端回 500」、「/play 水合錯誤」、「GitHub 版本 API 位址寫死成舊 IP」等問題。
- **以上都已修好，部署到 EC2 並在實機驗證過**（第 3 節）。
- **第二輪（2026-10-23）**：格鬥畫面全面升級（各職業 / Boss 專屬外型、招式特效、Boss 專屬機制、武器外觀隨黑市購買進化、戰鬥中快速黑市），前端改成正式 build 部署，載入請求數 70+ → 5（第 9 節）。
- **⚠️ 發現嚴重資安問題需要你本人處理**：資料庫密碼和 JWT 金鑰被 commit 在**公開**的 GitHub repo，而且 RDS 對全世界開放 5432 port（第 4 節）。

---

## 1. 目前部署架構（實際檢查結果）

```
瀏覽器 ──HTTP :80──▶ Nginx ──┬── /api/*、/health ──▶ FastAPI (uvicorn) :8000 ──▶ RDS PostgreSQL
                             └── 其他所有路徑 ─────▶ 前端正式版 :4173（vite preview 跑 build 好的 SSR）
```

| 項目 | 實際狀態 |
|---|---|
| EC2 | t3.micro（~1 GB RAM + 2 GB swap）· us-east-1d · Ubuntu 26.04 · Python 3.14 · Node 22 |
| 公開 IP | `54.161.3.74`（**Learner Lab 每次重開都會換**；文件裡的 `44.205.216.47` 已失效） |
| 後端服務 | systemd `cloudrpg-backend` → `uvicorn app.main:app --port 8000` |
| 前端服務 | systemd `cloudrpg-frontend` → `npm run start`（**正式 build**，2026-10-23 起；原本是 `npm run dev` 開發模式）port 4173 |
| 資料庫 | RDS **PostgreSQL** `cloudrpg-db`（publicly accessible） |
| 部署方式 | 在 Mac 打包 tar 上傳 + `deploy_remote.sh`，EC2 上的專案**不是 git repo** |
| 磁碟 | 6.7 GB；檢查時 92% → 清理後 83% |
| 安全群組 | `sg-083d09c1c87ef2f90`（EC2 與 RDS 共用）：22、80、443、4173、5173、8000、5432 全對 `0.0.0.0/0` 開放 |
| EC2 金鑰 | 沒有 key pair、沒有 IAM role；要連線請用 Console 的 **EC2 Instance Connect** |

> `FINAL_PROJECT_REPORT.md` 寫的是「RDS MySQL」和「progress 表」，實際是 **PostgreSQL**，進度存在 `users.game_progress` 欄位，報告需要更正。

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

## 4. ⚠️ 需要你本人處理的資安問題（我沒有動）

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
5. **任何人註冊 `admin` 就有無限金幣**：前後端都只用使用者名稱判斷，建議改成資料庫欄位 `is_admin`。

---

## 5. 專案進度盤點

| 模組 | 狀態 | 說明 |
|---|---|---|
| 註冊／登入（JWT + Argon2） | ✅ 完成 | `/api/auth/register`、`/login`、`/me` |
| 雲端存讀檔 | ✅ 完成 | `/api/progress/save`、`load`、`clear`；整份狀態存在 `users.game_progress`（JSON），每 30 秒同步 |
| 故事模式 `/play` | ✅ 可從頭玩到結局 | 19 個場景、7 種敵人（雜魚 → 哥布林 → 公爵 → 冥盡 → 天光島 → 魔王 → Administrator）、3 職業、AI 隊友、文字指令 + 2D 街機格鬥 |
| 自由對戰 `/arena` | ✅ 完成 | 8 角色、4 場地、4 段 AI 難度、雙人同鍵盤 PvP／對電腦；與故事模式共用新的渲染引擎 |
| 格鬥畫面 / 特效 | ✅ 第二輪完成 | 各職業 / Boss 專屬外型、招式特效、Boss 專屬機制、奧義 Cut-in、7+1 個關卡背景（第 9 節） |
| 黑市 `/market` | ✅ 完成（前端計算） | 技能書、武器（可升階 +1～+3）、不死圖騰、轉職聖典；故事模式內也能開「快速黑市」 |
| 公會 `/guild` | 🟡 假資料 | 4 個寫死的公會，「申請」只跳提示 |
| 圖鑑 `/codex` | 🟡 靜態內容 | 指令與世界觀說明 |
| 大廳、世界聊天 | 🟡 假資料 | 線上人數、新聞、聊天訊息都是隨機產生 |
| 後端 characters API | ⚪ 有寫，前端沒用 | |
| 後端 battles API | ⚪ 有寫，沒用且邏輯錯誤 | 勝利判定寫成「玩家 HP ≥ 敵人 HP」、敵人不會扣血 |
| `StoryWorldStage.tsx` | ⚪ 未使用 → 已移到 `backups/` | 878 行，沒有任何地方 import |
| 部署 | 🟡 正式 build，但流程仍手動 | 前端已改正式 build（`deploy/update_frontend.sh`）；仍是手動上傳、IP 每次變、資安未處理 |

**整體評估**：遊戲內容已經相當完整，可以從頭玩到結局，還有獨立的格鬥模式。主要缺口有三個：「多人／社群功能是假的」、「伺服器完全不驗證遊戲數值」、「部署與資安」。

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
- 申請 Elastic IP，讓 IP 不再每次變；至少在 README 註明「重開 lab 後到 Console 看新 IP」。

### 6.3 安全

- 先完成第 4 節。
- 有網域的話用 `certbot --nginx` 上 HTTPS。
- CORS 目前是 `allow_origins=["*"]` 加 `allow_credentials=True`，改成只允許自己的網域。
- 登入 API 加 rate limit，防暴力破解。

### 6.4 後端與資料

- **伺服器端驗證**：`/api/progress/save` 完全相信前端送來的狀態，改 localStorage 就能把金幣、等級改成任意值。至少加上數值上限與合理性檢查；進一步可以把購買和戰鬥結算移到後端（`battles.py` 已經有雛形，但要先修邏輯）。
- 進度可以改存到已經建好的 `characters` 表（JSONB），不要全部塞在 `users`。
- 用 Alembic 做 migration，取代 `create_all`。
- `requirements.txt` 用 `pip freeze` 鎖版本，避免下次 Python 升級又壞。
- `datetime.utcnow()` 已棄用，改 `datetime.now(timezone.utc)`；`print` 改 `logging`；`/health` 加資料庫連線檢查。

### 6.5 前端程式碼

- `play.tsx` 約 1,300 行、`StoryBattleArena.tsx` 約 2,200 行、`arena.tsx` 約 1,600 行；後兩者有大量重複的格鬥引擎，可以抽成共用模組。
- `API_URL` 的判斷邏輯重複在 4 個檔案，抽成 `lib/api.ts`，順便統一處理 401。
- 自動同步：每次 state 或 log 變化都會重設 30 秒計時器，連續操作時可能一直不同步；`beforeunload` 裡的非同步 fetch 常被瀏覽器中斷。建議在場景切換、戰鬥結束時存檔，並使用 `fetch(..., { keepalive: true })`。
- 遊戲 log 無限增長並整包上傳，建議只保留最近 200 行。
- 逐步移除 `// @ts-nocheck`。

### 6.6 雲端架構（課程加分項）

- CloudWatch Agent 收集 log 和 CPU／記憶體指標，設定 Alarm。
- 開啟 RDS 自動備份與快照。
- 靜態資源放 S3 + CloudFront。
- 報告中列的 DynamoDB／Lambda 可擇一實作，例如用 Lambda 每天結算排行榜。

---

## 7. 讓遊戲更好玩的建議

### 短期（1–3 天，效果最明顯）

- **真的世界聊天**：FastAPI WebSocket 取代假的 bot 訊息，最能體現「Cloud」RPG。
- **排行榜**：等級、通關時間、競技場勝場，存 RDS 並顯示在大廳，讓「線上人數」這類假資料變成真的。
- **新手操作教學**：第一場戰鬥前顯示 WASD／F／G／R 的操作提示，避免玩家不知道怎麼動。
- **打擊感**：命中停頓（hit-stop）、畫面震動、連段計數、受擊閃白。
- **成就系統**：首次通關、無傷擊敗公爵、集滿三顆傳說之石，存在 `story_flags`。
- **每日任務／登入獎勵**：提高回訪率。

### 中期（1–2 週）

- **真的公會**：建立、加入、公會聊天、公會排行。
- **非同步 PvP（幽靈對戰）**：用其他玩家的角色資料加 AI 當對手，不需要即時連線也有多人感。
- **線上即時 PvP**：WebSocket 房間，讓競技場可以兩台電腦對打（現在只能同一個鍵盤）。
- **隨機裝備掉落**：沿用現有的稀有度顏色系統，加入隨機詞綴。
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
- [ ] 換 RDS 密碼、換 `SECRET_KEY`、把 `.env` 移出 git
- [ ] RDS 5432 只允許 EC2；安全群組移除 4173、5173、8000
- [ ] 更正 `FINAL_PROJECT_REPORT.md`、`TROUBLESHOOTING.md` 裡的舊 IP（`44.205.216.47`）與 MySQL → PostgreSQL
- [ ] EC2 改用 git 部署
- [x] 前端改正式 build（2026-10-23）
- [x] 格鬥畫面升級、Boss 專屬機制、武器外觀與黑市整合（2026-10-23）
- [x] commit 第二輪新增的 `battleFx.ts`、`ShopModal.tsx`、`lib/shop.ts`、`deploy/` 資料夾，新增中英文 `README.md`
- [ ] 挑 1–2 個遊戲功能實作（建議：排行榜 + WebSocket 聊天）

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
- 已知限制：沒有自動化測試；畫面效果以 Canvas 2D 繪製，舊電腦或手機上若掉幀，可把 `battleFx.ts` 的粒子上限（420）調低

---

## 附錄：Learner Lab 重開後的檢查步驟

1. Start Lab → 等 EC2 變成 running → 在 EC2 Console 查看新的 Public IPv4。
2. 開 `http://<新IP>/`；`http://<新IP>/health` 應該回 `{"status":"ok"}`。
3. 三個服務都設了開機自動啟動，不需要手動開；如果看到 502，照 `TROUBLESHOOTING.md` 處理。
4. 前端的 API 位址會自動跟著網址走（從 port 80 進入時），IP 變了不用改程式。
5. 要登入主機：EC2 Console → Connect → **EC2 Instance Connect**（這台沒有 .pem 金鑰）。
