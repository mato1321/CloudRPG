# ☁️ Cloud RPG

> 賽博龐克終端機風格的雲端角色扮演遊戲：文字冒險 × 2D 街機格鬥，部署在 AWS（EC2 + RDS）。
> A cyberpunk, terminal-styled cloud RPG — text adventure meets 2D arcade fighting, deployed on AWS (EC2 + RDS).

[中文](#中文) · [English](#english)

---

## 中文

### 遊戲簡介

上課發呆許了個願，結果整個教室被傳送到異世界——還被宮廷魔法師判定為「廢物三人組」。
選擇職業（戰士 / 法師 / 牧師），和兩位 AI 隊友一起打倒三巨頭、收集傳說之石，最後面對藏在系統深處的 **Administrator**。

### 主要功能

| 功能 | 說明 |
|---|---|
| 📜 故事模式 `/play` | 19 個場景、7 位敵人，文字指令推進劇情，遇敵時切換成 2D 街機格鬥 |
| 🥊 自由對戰 `/arena` | 8 名角色、4 個場地、4 段 AI 難度；單人對電腦或雙人同鍵盤對戰 |
| 🎨 格鬥畫面 | 每個職業 / Boss 專屬外型與武器、半月劍氣、魔法陣、聖光柱、殘影、奧義 Cut-in、動態關卡背景 |
| 👹 Boss 專屬機制 | 冥盡洞主：冰刺 + 黑水陷阱；天光島嶼之主：預警落雷；Administrator：半血「系統超頻」、全畫面雷射、數據方塊轟炸 |
| 🛒 黑市 `/market` | 技能書、不死圖騰、轉職聖典；武器可升階 +1～+3，格鬥中武器外觀會跟著進化；故事模式內可開「快速黑市」（輸入 `shop`） |
| ☁️ 雲端存檔 | 註冊 / 登入（JWT + Argon2），進度每 30 秒同步到 RDS PostgreSQL |

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

### 技術架構

```
瀏覽器 ──HTTP :80──▶ Nginx ──┬── /api/*、/health ──▶ FastAPI (uvicorn) :8000 ──▶ AWS RDS PostgreSQL
                             └── 其他路徑 ─────────▶ 前端（TanStack Start SSR 正式版）:4173
```

| 層 | 技術 |
|---|---|
| 前端 | React 19、TanStack Start / Router、Vite 7、Tailwind CSS 4、Canvas 2D（格鬥引擎） |
| 後端 | Python、FastAPI、SQLAlchemy、python-jose（JWT）、argon2-cffi |
| 資料庫 | AWS RDS PostgreSQL |
| 部署 | AWS EC2（Ubuntu）、Nginx 反向代理、systemd |

### 專案結構

```
CloudRPG/
├── backend/                 FastAPI 後端（auth、progress 存讀檔 API）
├── fronted/                 前端（資料夾名稱沿用原本的拼法）
│   └── src/
│       ├── routes/          頁面：index、play、arena、market、guild、codex、login、register
│       ├── components/crpg/ 遊戲元件：StoryBattleArena、battleFx（渲染 / 特效引擎）、ShopModal、Shell
│       └── lib/shop.ts      黑市商品與購買規則
├── deploy/                  EC2 部署設定（systemd service、前端更新腳本）
├── backups/                 舊版程式碼備份（不會被編譯）
├── PROJECT_STATUS.md        專案現況、修復紀錄、優化建議
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

**前端**

```bash
cd fronted
npm install
npm run dev                     # http://localhost:4173
```

前端會自動判斷 API 位址：從 port 80 進入時走同一個網域（Nginx 轉發），其他 port 時連到同主機的 `:8000`；也可以用 `VITE_API_URL` 指定。

### 部署到 AWS EC2

1. 把程式放到 EC2 的 `~/CloudRPG`，後端用 `venv` 安裝套件，`backend/.env` 指向 RDS。
2. 前端正式版：

   ```bash
   bash ~/CloudRPG/deploy/update_frontend.sh   # 停服務 → npm install → build → 用 vite preview 啟動
   ```

3. Nginx 把 `/api/` 與 `/health` 轉到 `127.0.0.1:8000`，其餘轉到 `127.0.0.1:4173`。
4. AWS Learner Lab 每次重開，EC2 的公開 IP 都會改變，請到 EC2 Console 查看新 IP。

更多細節與故障排除請看 [PROJECT_STATUS.md](PROJECT_STATUS.md) 與 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)。

---

## English

### About the game

You make a wish while daydreaming in class — and the whole classroom gets teleported to another world, where the court mage labels your group "the useless trio".
Pick a class (Warrior / Mage / Priest), team up with two AI companions, defeat the Three Overlords, collect the Legendary Stones, and finally face the **Administrator** hiding deep inside the system.

### Features

| Feature | Description |
|---|---|
| 📜 Story mode `/play` | 19 scenes and 7 enemies; type commands to advance the story, encounters switch to 2D arcade fights |
| 🥊 Free battle `/arena` | 8 fighters, 4 stages, 4 AI difficulty levels; vs CPU or 2-player on one keyboard |
| 🎨 Combat visuals | Unique look and weapon for every class / boss, crescent sword waves, magic circles, holy pillars, afterimages, super-move cut-ins, animated stages |
| 👹 Boss mechanics | Abyss Lord: ice spikes + black-water trap; Sky Isle Lord: telegraphed lightning strikes; Administrator: "System Overclock" at half HP, full-screen lasers, falling data blocks |
| 🛒 Black market `/market` | Skill books, revive totems, class transfer; weapons upgrade +1 to +3 and visibly evolve in battle; a quick shop is available inside story mode (type `shop`) |
| ☁️ Cloud saves | Sign up / log in (JWT + Argon2); progress syncs to RDS PostgreSQL every 30 seconds |

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

### Architecture

```
Browser ──HTTP :80──▶ Nginx ──┬── /api/*, /health ──▶ FastAPI (uvicorn) :8000 ──▶ AWS RDS PostgreSQL
                              └── everything else ─▶ Frontend (TanStack Start SSR production build) :4173
```

| Layer | Stack |
|---|---|
| Frontend | React 19, TanStack Start / Router, Vite 7, Tailwind CSS 4, Canvas 2D (fighting engine) |
| Backend | Python, FastAPI, SQLAlchemy, python-jose (JWT), argon2-cffi |
| Database | AWS RDS PostgreSQL |
| Hosting | AWS EC2 (Ubuntu), Nginx reverse proxy, systemd |

### Project layout

```
CloudRPG/
├── backend/                 FastAPI backend (auth and progress save/load APIs)
├── fronted/                 Frontend (folder name kept as originally spelled)
│   └── src/
│       ├── routes/          Pages: index, play, arena, market, guild, codex, login, register
│       ├── components/crpg/ Game components: StoryBattleArena, battleFx (render / effects engine), ShopModal, Shell
│       └── lib/shop.ts      Shop items and purchase rules
├── deploy/                  EC2 deployment files (systemd service, frontend update script)
├── backups/                 Old source versions (not built)
├── PROJECT_STATUS.md        Status, fix log and improvement ideas (Chinese)
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

**Frontend**

```bash
cd fronted
npm install
npm run dev                     # http://localhost:4173
```

The frontend picks the API address automatically: same origin when served on port 80 (through Nginx), otherwise `:8000` on the same host. Set `VITE_API_URL` to override.

### Deploying to AWS EC2

1. Put the project in `~/CloudRPG` on the instance, install the backend into a `venv`, and point `backend/.env` at RDS.
2. Build and run the production frontend:

   ```bash
   bash ~/CloudRPG/deploy/update_frontend.sh   # stop service → npm install → build → start with vite preview
   ```

3. Nginx forwards `/api/` and `/health` to `127.0.0.1:8000` and everything else to `127.0.0.1:4173`.
4. AWS Learner Lab assigns a new public IP every time the lab restarts — check the EC2 console for the current one.

See [PROJECT_STATUS.md](PROJECT_STATUS.md) and [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for details and troubleshooting.
