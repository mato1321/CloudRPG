# ☁️ Cloud RPG

[![CI](https://github.com/mato1321/CloudRPG/actions/workflows/ci.yml/badge.svg)](https://github.com/mato1321/CloudRPG/actions/workflows/ci.yml)

> 賽博龐克終端機風格的雲端多人角色扮演遊戲：文字冒險 × 2D 街機格鬥，部署在 AWS（EC2 + RDS）。
> A cyberpunk, terminal-styled multiplayer cloud RPG — text adventure meets 2D arcade fighting, deployed on AWS (EC2 + RDS).

🎮 **立即遊玩 / Play now**：http://54.161.3.74/ （免註冊，訪客模式 / no sign-up needed）

[中文](#中文) · [English](#english)

---

## 中文

### 遊戲簡介

上課發呆許了個願，結果整個教室被傳送到異世界——還被宮廷魔法師判定為「廢物三人組」。
選擇職業（戰士 / 法師 / 牧師），和兩位 AI 隊友一起打倒三巨頭、收集傳說之石，最後面對藏在系統深處的 **Administrator**。
通關之後，和全伺服器的玩家一起爬故障之塔、挑戰世界 Boss、組公會、打 PvP。

### 主要功能

| 功能 | 說明 |
|---|---|
| 📜 故事模式 `/play` | 19 個場景、7 位敵人，文字指令推進劇情，遇敵時切換成 2D 街機格鬥；第一場戰鬥有 5 步操作教學 |
| 👤 訪客模式 | 免註冊直接玩第一章，打倒第一個 Boss 後可以綁定帳號保存進度 |
| 🗼 故障之塔 `/tower` | 每層隨機敵人與詞綴（狂暴、分身、雷暴、迷霧…），血量跨層延續，每層選一個祝福，每 5 層 Boss |
| 📅 每日挑戰 `/daily` | 全服同一個關卡，台灣時間 0 點更新，比分數排名；每天首次通關送金幣和裝備 |
| 🐉 世界 Boss `/raid` | 全伺服器共用一條血條，每場 45 秒，即時戰報；倒下後所有參與者都能領獎 |
| 🛡 公會 `/guild` | 建立 / 加入公會、每週公會 Boss、公會聊天、公會週排行 |
| ⚔ 非同步 PvP `/pvp` | 挑戰其他玩家角色的 AI 分身，Elo 積分排名 |
| 🏆 排行榜 `/ranking` | 等級、故障之塔、PvP、今日挑戰、世界 Boss、公會 |
| 💬 聊天室 | 世界頻道 + 公會頻道，WebSocket 即時推播 |
| 🎒 隨機裝備 | 護甲 / 飾品，5 種稀有度（普通 → 神話）與隨機詞綴，可分解 |
| 🥊 自由對戰 `/arena` | 8 名角色、4 個場地、4 段 AI 難度；單人對電腦或雙人同鍵盤對戰 |
| 🎨 格鬥畫面 | 每個職業 / Boss 專屬外型與武器、招式特效、奧義 Cut-in、動態關卡背景；高 DPI 與自動降畫質 |
| 👹 Boss 專屬機制 | 冥盡洞主：冰刺 + 黑水陷阱；天光島嶼之主：預警落雷；Administrator：半血「系統超頻」、全畫面雷射、數據方塊轟炸 |
| 🛒 黑市 `/market` | 技能書、不死圖騰、轉職聖典；武器可升階 +1～+3，格鬥中武器外觀會跟著進化；故事模式內可開「快速黑市」 |
| 🔒 防作弊 | 金幣、經驗、道具、裝備由伺服器計算；戰鬥結算用伺服器計時驗證；API 限流 |

### 操作方式（格鬥）

| 按鍵 | 動作 |
|---|---|
| `W` `A` `S` `D` | 跳躍 / 左右移動 / 蹲下（往後走 = 格擋） |
| `F` / `J` | 輕攻擊 |
| `G` / `K` | 重攻擊（蹲下時為掃堂腿） |
| `R` / `L` | 技能 1（遠程） |
| `T` / `U`、`Y` / `O` | 技能 2、技能 3（需在黑市買技能書） |
| `Q` / `I` | 終極奧義（氣條 100%） |
| `E` | 呼叫 AI 隊友支援 |
| `H` / `B` | 使用草藥 / 魔力藥水 |
| `Esc` | 從指令輸入框回到角色操控 |

> 自由對戰的 2P 使用方向鍵 + `J K L U O I`（或數字鍵盤 1～6）。

### 故事模式指令

| 指令 | 作用 |
|---|---|
| `help` | 列出所有指令 |
| `look` · `stats` · `skills` · `party` · `inv` | 查看場景 / 角色數值 / 技能 / 隊伍 / 道具 |
| `shop` | 開啟快速黑市（戰鬥中會暫停） |
| `gear` | 開啟裝備背包 |
| `skip` | 跳過目前的劇情文字 |
| `save` · `load` · `clear` · `restart` | 存檔 / 讀檔 / 清除畫面 / 重新開始 |
| `attack [N]` · `skill [N]` · `ult` · `item` · `flee` | 文字戰鬥指令（N = 招式編號） |

### 技術架構

```
                                 ┌── /api/ws（WebSocket）─┐
瀏覽器 ──HTTP :80──▶ Nginx ──────┼── /api/*、/health ─────┴──▶ FastAPI (uvicorn) :8000 ──▶ AWS RDS PostgreSQL
                                 └── 其他路徑 ───────────────▶ 前端（TanStack Start SSR 正式版）:4173
```

| 層 | 技術 |
|---|---|
| 前端 | React 19、TanStack Start / Router、Vite 7、Tailwind CSS 4、Canvas 2D（格鬥引擎）、WebSocket（自動重連） |
| 後端 | Python、FastAPI（REST + WebSocket）、SQLAlchemy、python-jose（JWT）、argon2-cffi、pytest |
| 資料庫 | AWS RDS PostgreSQL（自動備份 7 天） |
| 部署 | AWS EC2（Ubuntu）+ Elastic IP、Nginx 反向代理、systemd；AWS Lambda 喚醒頁（EC2 關機時自動開機） |

### API 一覽

| 分類 | 端點 |
|---|---|
| 帳號 | `POST /api/auth/register`、`POST /api/auth/login`、`GET /api/auth/me` |
| 存檔 | `POST /api/progress/save`、`GET /api/progress/load`、`DELETE /api/progress/clear` |
| 角色 / 經濟 | `GET /api/profile`、`POST /api/profile/create`、`POST /api/profile/import-guest`、`POST /api/shop/buy`、`POST /api/shop/transfer`、`POST /api/story/claim`、`POST /api/gear/equip`、`POST /api/gear/salvage` |
| 戰鬥 | `POST /api/battle/start`、`POST /api/battle/finish` |
| 遊戲模式 | `GET /api/tower`、`POST /api/tower/{start,blessing,abandon}`、`GET /api/daily`、`GET /api/worldboss`、`POST /api/worldboss/claim` |
| 公會 | `GET /api/guilds`、`GET /api/guilds/mine`、`POST /api/guilds`、`POST /api/guilds/{id}/join`、`POST /api/guilds/leave`、`POST /api/guilds/boss/claim` |
| PvP / 排行 | `GET /api/pvp/opponents`、`GET /api/leaderboard/{level,tower,pvp,daily,worldboss,guild}` |
| 社群 | `GET/POST /api/chat/{world,guild}`、WebSocket `/api/ws?token=`、`POST /api/telemetry/error` |

### 專案結構

```
CloudRPG/
├── backend/
│   ├── app/
│   │   ├── api/             路由：auth、progress、profile、combat、modes、social、character
│   │   ├── game/            遊戲規則：data（數值表）、economy（純函式）、services（DB 輔助）
│   │   ├── models/          資料表（users、characters、game：profiles / 塔 / Boss / 公會 / 聊天 / PvP）
│   │   ├── core/            設定、JWT、驗證依賴、限流
│   │   └── realtime.py      WebSocket Hub
│   └── tests/               pytest（SQLite）
├── fronted/                 前端（資料夾名稱沿用原本的拼法）
│   └── src/
│       ├── routes/          頁面：index、play、tower、daily、raid、pvp、guild、ranking、arena、market、codex、login、register
│       ├── components/crpg/ 遊戲元件：StoryBattleArena、battleFx、ModeBattle、ChatPanel、GearPanel、ShopModal、Shell…
│       └── lib/             api（REST + WebSocket）、shop、gear、classes、useProfile、telemetry
├── deploy/                  EC2 部署設定（systemd service、前端更新腳本）、wake_lambda（喚醒頁）
├── backups/                 舊版程式碼備份（不會被編譯）
├── PROJECT_STATUS.md        專案現況、修復紀錄、部署紀錄、待辦
├── FINAL_PROJECT_REPORT.md  期末報告
├── DATABASE_DOCUMENTATION.md
└── TROUBLESHOOTING.md
```

### 本機開發

**後端**

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows：venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # 填入 DATABASE_URL 與 SECRET_KEY
uvicorn app.main:app --reload --port 8000
```

不想連 RDS 時可以改用 SQLite：

```bash
DATABASE_URL=sqlite:///./dev.db SECRET_KEY=local-dev-only ADMIN_USERNAMES= uvicorn app.main:app --port 8000
```

新資料表會在啟動時自動建立。選填設定：`ADMIN_USERNAMES`（逗號分隔的管理員帳號，黑市免費；預設 `admin`，留空 = 沒有管理員）、`RATE_LIMIT_PER_10S`（每 IP 每 10 秒請求上限，預設 80）、`SENTRY_DSN`。

**測試**

```bash
cd backend
pip install pytest httpx
python -m pytest -q tests       # 使用暫存 SQLite，不會碰到 RDS
```

push 到 `main` 或開 PR 時，GitHub Actions（[`.github/workflows/ci.yml`](.github/workflows/ci.yml)）會自動在 Python 3.11 / 3.14 跑 pytest，並用 Node 22 執行 `npm ci` + `npm run build`。

**前端**

```bash
cd fronted
npm install
npm run dev                     # http://localhost:4173
```

前端會自動判斷 API 與 WebSocket 位址：從 port 80 進入時走同一個網域（Nginx 轉發），其他 port 時連到同主機的 `:8000`；也可以用 `VITE_API_URL` 指定。

### 部署到 AWS EC2

1. 把程式放到 EC2 的 `~/CloudRPG`，後端用 `venv` 安裝套件，`backend/.env` 指向 RDS，然後 `sudo systemctl restart cloudrpg-backend`。
2. 前端正式版：

   ```bash
   bash ~/CloudRPG/deploy/update_frontend.sh   # 停服務 → npm install → build → 用 vite preview 啟動
   ```

3. Nginx：`/api/ws` 轉到 `127.0.0.1:8000` 並開啟 WebSocket upgrade（`Upgrade` / `Connection` 標頭、`proxy_read_timeout 3600s`）；`/api/` 與 `/health` 轉到 `127.0.0.1:8000`；其餘轉到 `127.0.0.1:4173`。
4. EC2 使用 Elastic IP（`54.161.3.74`），重開 lab 後 IP 不變。EC2 關機時可以開喚醒網址（`deploy/wake_lambda/`），它會自動開機並在伺服器就緒後轉回遊戲。

更多細節、部署紀錄與故障排除請看 [PROJECT_STATUS.md](PROJECT_STATUS.md) 與 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)。

---

## English

### About the game

You make a wish while daydreaming in class — and the whole classroom gets teleported to another world, where the court mage labels your group "the useless trio".
Pick a class (Warrior / Mage / Priest), team up with two AI companions, defeat the Three Overlords, collect the Legendary Stones, and finally face the **Administrator** hiding deep inside the system.
After the story, climb the Glitch Tower, raid world bosses with the whole server, join a guild and fight in PvP.

### Features

| Feature | Description |
|---|---|
| 📜 Story mode `/play` | 19 scenes and 7 enemies; type commands to advance the story, encounters switch to 2D arcade fights; a 5-step tutorial in the first fight |
| 👤 Guest mode | Play chapter 1 without signing up, then bind an account to keep your progress |
| 🗼 Glitch Tower `/tower` | Random enemies and modifiers on every floor (berserk, clones, thunderstorm, fog…), HP carries over, pick a blessing after each floor, a boss every 5 floors |
| 📅 Daily challenge `/daily` | The whole server plays the same stage, reset at midnight Taiwan time, ranked by score; first clear of the day gives gold and gear |
| 🐉 World boss `/raid` | One shared HP bar for the entire server, 45-second fights, live battle feed; every participant gets rewards when it falls |
| 🛡 Guilds `/guild` | Create / join guilds, weekly guild boss, guild chat, weekly guild ranking |
| ⚔ Async PvP `/pvp` | Fight AI-controlled copies of other players' characters, Elo rating |
| 🏆 Leaderboards `/ranking` | Level, Glitch Tower, PvP, today's challenge, world boss, guilds |
| 💬 Chat | World and guild channels pushed live over WebSocket |
| 🎒 Random loot | Armor and charms with 5 rarities (common → mythic) and random affixes; salvage for gold |
| 🥊 Free battle `/arena` | 8 fighters, 4 stages, 4 AI difficulty levels; vs CPU or 2-player on one keyboard |
| 🎨 Combat visuals | Unique look and weapon for every class / boss, move effects, super-move cut-ins, animated stages; high-DPI rendering with automatic quality fallback |
| 👹 Boss mechanics | Abyss Lord: ice spikes + black-water trap; Sky Isle Lord: telegraphed lightning strikes; Administrator: "System Overclock" at half HP, full-screen lasers, falling data blocks |
| 🛒 Black market `/market` | Skill books, revive totems, class transfer; weapons upgrade +1 to +3 and visibly evolve in battle; a quick shop is available inside story mode |
| 🔒 Anti-cheat | Gold, XP, items and gear are computed by the server; battle results are checked against server-side timing; API rate limiting |

### Controls (fighting)

| Key | Action |
|---|---|
| `W` `A` `S` `D` | Jump / move / crouch (walk backward to block) |
| `F` / `J` | Light attack |
| `G` / `K` | Heavy attack (sweep while crouching) |
| `R` / `L` | Skill 1 (projectile) |
| `T` / `U`, `Y` / `O` | Skills 2 and 3 (unlocked with skill books) |
| `Q` / `I` | Ultimate (requires a full super meter) |
| `E` | Call an AI teammate assist |
| `H` / `B` | Use herb / mana potion |
| `Esc` | Leave the command box and return to fighter control |

> In free battle, player 2 uses the arrow keys + `J K L U O I` (or numpad 1–6).

### Story-mode commands

| Command | What it does |
|---|---|
| `help` | List all commands |
| `look` · `stats` · `skills` · `party` · `inv` | Show the scene / stats / skills / party / items |
| `shop` | Open the quick shop (pauses an ongoing fight) |
| `gear` | Open the gear bag |
| `skip` | Skip the current story text |
| `save` · `load` · `clear` · `restart` | Save / load / clear the screen / start over |
| `attack [N]` · `skill [N]` · `ult` · `item` · `flee` | Text battle commands (N = move number) |

### Architecture

```
                                  ┌── /api/ws (WebSocket) ─┐
Browser ──HTTP :80──▶ Nginx ──────┼── /api/*, /health ─────┴──▶ FastAPI (uvicorn) :8000 ──▶ AWS RDS PostgreSQL
                                  └── everything else ─────────▶ Frontend (TanStack Start SSR production build) :4173
```

| Layer | Stack |
|---|---|
| Frontend | React 19, TanStack Start / Router, Vite 7, Tailwind CSS 4, Canvas 2D (fighting engine), WebSocket (auto-reconnect) |
| Backend | Python, FastAPI (REST + WebSocket), SQLAlchemy, python-jose (JWT), argon2-cffi, pytest |
| Database | AWS RDS PostgreSQL (7-day automated backups) |
| Hosting | AWS EC2 (Ubuntu) + Elastic IP, Nginx reverse proxy, systemd; AWS Lambda wake-up page (starts the instance when it is stopped) |

### API overview

| Area | Endpoints |
|---|---|
| Accounts | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| Saves | `POST /api/progress/save`, `GET /api/progress/load`, `DELETE /api/progress/clear` |
| Profile / economy | `GET /api/profile`, `POST /api/profile/create`, `POST /api/profile/import-guest`, `POST /api/shop/buy`, `POST /api/shop/transfer`, `POST /api/story/claim`, `POST /api/gear/equip`, `POST /api/gear/salvage` |
| Battles | `POST /api/battle/start`, `POST /api/battle/finish` |
| Game modes | `GET /api/tower`, `POST /api/tower/{start,blessing,abandon}`, `GET /api/daily`, `GET /api/worldboss`, `POST /api/worldboss/claim` |
| Guilds | `GET /api/guilds`, `GET /api/guilds/mine`, `POST /api/guilds`, `POST /api/guilds/{id}/join`, `POST /api/guilds/leave`, `POST /api/guilds/boss/claim` |
| PvP / rankings | `GET /api/pvp/opponents`, `GET /api/leaderboard/{level,tower,pvp,daily,worldboss,guild}` |
| Social | `GET/POST /api/chat/{world,guild}`, WebSocket `/api/ws?token=`, `POST /api/telemetry/error` |

### Project layout

```
CloudRPG/
├── backend/
│   ├── app/
│   │   ├── api/             Routes: auth, progress, profile, combat, modes, social, character
│   │   ├── game/            Game rules: data (tables), economy (pure functions), services (DB helpers)
│   │   ├── models/          Tables (users, characters, game: profiles / tower / bosses / guilds / chat / PvP)
│   │   ├── core/            Settings, JWT, auth dependencies, rate limiting
│   │   └── realtime.py      WebSocket hub
│   └── tests/               pytest (SQLite)
├── fronted/                 Frontend (folder name kept as originally spelled)
│   └── src/
│       ├── routes/          Pages: index, play, tower, daily, raid, pvp, guild, ranking, arena, market, codex, login, register
│       ├── components/crpg/ Game components: StoryBattleArena, battleFx, ModeBattle, ChatPanel, GearPanel, ShopModal, Shell…
│       └── lib/             api (REST + WebSocket), shop, gear, classes, useProfile, telemetry
├── deploy/                  EC2 deployment files (systemd service, frontend update script), wake_lambda (wake-up page)
├── backups/                 Old source versions (not built)
├── PROJECT_STATUS.md        Status, fix log, deployment log, to-dos (Chinese)
├── FINAL_PROJECT_REPORT.md  Final course report (Chinese)
├── DATABASE_DOCUMENTATION.md
└── TROUBLESHOOTING.md
```

### Local development

**Backend**

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # fill in DATABASE_URL and SECRET_KEY
uvicorn app.main:app --reload --port 8000
```

To run without RDS, use SQLite:

```bash
DATABASE_URL=sqlite:///./dev.db SECRET_KEY=local-dev-only ADMIN_USERNAMES= uvicorn app.main:app --port 8000
```

New tables are created automatically on startup. Optional settings: `ADMIN_USERNAMES` (comma-separated admin accounts that shop for free; defaults to `admin`, empty = no admins), `RATE_LIMIT_PER_10S` (requests per IP per 10 seconds, default 80), `SENTRY_DSN`.

**Tests**

```bash
cd backend
pip install pytest httpx
python -m pytest -q tests       # uses a temporary SQLite database, never touches RDS
```

On every push to `main` and on pull requests, GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs pytest on Python 3.11 / 3.14 and `npm ci` + `npm run build` on Node 22.

**Frontend**

```bash
cd fronted
npm install
npm run dev                     # http://localhost:4173
```

The frontend picks the API and WebSocket address automatically: same origin when served on port 80 (through Nginx), otherwise `:8000` on the same host. Set `VITE_API_URL` to override.

### Deploying to AWS EC2

1. Put the project in `~/CloudRPG` on the instance, install the backend into a `venv`, point `backend/.env` at RDS, then `sudo systemctl restart cloudrpg-backend`.
2. Build and run the production frontend:

   ```bash
   bash ~/CloudRPG/deploy/update_frontend.sh   # stop service → npm install → build → start with vite preview
   ```

3. Nginx: `/api/ws` goes to `127.0.0.1:8000` with WebSocket upgrade enabled (`Upgrade` / `Connection` headers, `proxy_read_timeout 3600s`); `/api/` and `/health` go to `127.0.0.1:8000`; everything else goes to `127.0.0.1:4173`.
4. The instance uses an Elastic IP (`54.161.3.74`), so the address survives lab restarts. When the instance is stopped, open the wake-up URL (`deploy/wake_lambda/`): it starts the instance and redirects back to the game once the server is ready.

See [PROJECT_STATUS.md](PROJECT_STATUS.md) and [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for details, the deployment log and troubleshooting.
