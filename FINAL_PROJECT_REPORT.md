# Cloud RPG 期末專案報告

## 1. 系統架構圖

```
┌─────────────────────────────────────────────────────────────┐
│                     使用者終端 (Client)                      │
│                  Browser / Web Application                   │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    AWS 雲端架構                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────┐                                   │
│  │   Nginx Reverse      │                                   │
│  │   Proxy / Load       │                                   │
│  │   Balancer           │                                   │
│  │ (Port 80 / 443)      │                                   │
│  └──────────┬───────────┘                                   │
│             │                                               │
│      ┌──────┴──────┐                                        │
│      ▼             ▼                                        │
│  ┌─────────┐  ┌─────────┐                                  │
│  │ EC2     │  │ EC2     │ ◄─── Frontend (Vite Dev Server) │
│  │Instance │  │Instance │      Port 4173                   │
│  │(Backend)│  │(Backend)│                                  │
│  │Port8000 │  │Port8000 │                                  │
│  └────┬────┘  └────┬────┘                                  │
│       │            │                                       │
│       └────────┬───┘                                       │
│                ▼                                            │
│      ┌──────────────────┐                                  │
│      │   RDS (MySQL)    │                                  │
│      │                  │                                  │
│      │ • Users Table    │                                  │
│      │ • Characters Tbl │                                  │
│      │ • Progress Tbl   │                                  │
│      └──────────────────┘                                  │
│                                                             │
│      ┌──────────────────────────────────────────┐          │
│      │        (Future Services)                 │          │
│      │ □ S3 (遊戲資源存儲)                      │          │
│      │ □ DynamoDB (實時遊戲狀態)                │          │
│      │ □ Lambda (無伺服器函數)                  │          │
│      │ □ Elastic Beanstalk (自動擴展)          │          │
│      └──────────────────────────────────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘

【已使用服務】
✅ 1. EC2 - 運行 Node.js 後端和前端開發服務器
✅ 2. RDS - MySQL 資料庫存儲用戶、角色、進度數據

【未使用但建議的服務】
□ 3. S3 - 存儲遊戲資源（角色頭像、背景圖、物品圖標）
□ 4. DynamoDB - 存儲實時遊戲狀態（位置、HP、MP）
□ 5. Elastic Beanstalk - 自動擴展後端應用
□ 6. Lambda - 處理異步任務（郵件通知、數據分析）
```

---

## 2. 系統情境說明

### 📋 **系統名稱**：Cloud RPG 角色扮演遊戲平台

### **系統背景**
Cloud RPG 是一個基於雲端的多人角色扮演遊戲平台。玩家可以創建角色、進行冒險、交易物品、加入公會等。

### **主要使用情境**

#### **情境 1：新玩家註冊與角色創建**

**流程：**
```
玩家訪問網站 
  ▼
填寫用戶名和密碼 (/register)
  ▼
後端驗證並存儲到 RDS MySQL
  ▼
玩家登入系統 (/login)
  ▼
前端發送 Authorization Token 到後端
  ▼
後端驗證 JWT Token 並返回用戶數據
  ▼
玩家進入遊戲大廳 (/play)
  ▼
玩家查看角色列表並創建新角色
  ▼
角色數據存儲到 RDS (Characters 表)
```

**涉及服務：**
- **EC2**: 運行認證邏輯和 API 端點
- **RDS**: 存儲用戶和角色信息

---

#### **情境 2：玩家冒險進度追蹤**

**流程：**
```
玩家進入 Play 頁面
  ▼
前端加載角色數據（從後端 /api/character 獲取）
  ▼
玩家進行冒險（收集經驗、獲得獎勵）
  ▼
遊戲狀態更新（EXP、金幣、等級）
  ▼
前端定時發送進度到後端 /api/progress/save
  ▼
後端驗證並更新 RDS Progress 表
  ▼
玩家進度永久保存
```

**涉及服務：**
- **EC2**: 計算經驗值、驗證進度邏輯
- **RDS**: 持久化玩家進度數據

---

#### **情境 3：玩家市場交易**

**流程：**
```
玩家進入 Market 頁面
  ▼
前端從後端加載物品列表
  ▼
玩家購買或出售物品
  ▼
後端檢查玩家金幣是否足夠
  ▼
RDS 更新庫存和玩家金幣
  ▼
交易完成，列表實時更新
```

**未來優化（使用 S3 + DynamoDB）：**
- **S3**: 存儲物品圖標和預覽圖
- **DynamoDB**: 存儲實時物品價格波動

---

#### **情境 4：公會系統**

**流程：**
```
玩家進入 Guild 頁面
  ▼
查看已加入的公會信息
  ▼
查看公會成員排行
  ▼
參與公會戰爭或任務
  ▼
獲得公會貢獻度
  ▼
公會數據存儲到 RDS
```

---

### **系統架構流程圖**

```
前端應用 (React + Vite)
    ├─ /login
    │   └─ 發送 POST /api/auth/login → RDS 驗證 ✅
    │
    ├─ /play
    │   ├─ GET /api/character → 獲取角色列表
    │   └─ POST /api/progress/save → 保存進度
    │
    ├─ /market
    │   ├─ GET /api/items → 獲取物品列表
    │   └─ POST /api/trade → 執行交易
    │
    ├─ /guild
    │   ├─ GET /api/guild → 獲取公會信息
    │   └─ POST /api/guild/join → 加入公會
    │
    └─ /codex
        └─ GET /api/codex → 獲取遊戲百科資料

後端 API (FastAPI + Python)
    ├─ /api/auth/
    │   ├─ login → 驗證用戶、頒發 JWT Token ✅
    │   ├─ register → 創建新用戶 ✅
    │   └─ /me → 獲取當前用戶信息 ✅
    │
    ├─ /api/character/
    │   ├─ GET → 獲取角色列表
    │   ├─ POST → 創建新角色
    │   └─ GET /{id} → 獲取角色詳情
    │
    └─ /api/progress/
        ├─ GET → 獲取進度
        └─ POST → 保存進度

資料庫 (RDS MySQL) ✅ 已實現
    ├─ users
    │   ├─ id (PRIMARY KEY)
    │   ├─ username (UNIQUE)
    │   ├─ password_hash
    │   └─ created_at
    │
    ├─ characters
    │   ├─ id
    │   ├─ user_id (FOREIGN KEY)
    │   ├─ name
    │   ├─ level
    │   ├─ exp
    │   └─ created_at
    │
    └─ progress
        ├─ id
        ├─ character_id (FOREIGN KEY)
        ├─ level
        ├─ exp
        ├─ gold
        └─ updated_at
```

---

## 3. 開發時所碰到最難突破的項目

### 🔴 **難題 1：認證狀態同步導致的 UI 閃現 (CRITICAL)**

**問題描述：**
- 用戶登入後點擊菜單，會短暫出現 "ACCESS DENIED" 面板，隨後才跳轉
- 原因：React state 更新有延遲，導致路由變化時認證狀態還沒同步

**症狀：**
```
用戶點擊 [PLAY] 菜單
  ▼
頁面導航到 /play
  ▼
Shell 組件檢查 authed state (還是 false！)
  ▼
顯示 ACCESS DENIED 面板 🔴
  ▼
100ms 後 state 更新
  ▼
消失並正確顯示頁面 ✅
```

**解決方案：**
```typescript
// ❌ 舊方案：依賴 state，有延遲
useEffect(() => {
  if (!authed && !PUBLIC_PATHS.has(location.pathname)) {
    navigate({ to: "/login" });
  }
}, [authed, location.pathname]);

// ✅ 新方案：直接讀 localStorage，無延遲
useEffect(() => {
  if (!mounted) return;
  
  // 直接讀取，不依賴 state
  const auth = readAuth(); // 直接從 localStorage 讀
  const isAuthenticated = !!auth;
  const isPublicPath = PUBLIC_PATHS.has(location.pathname);

  if (!isAuthenticated && !isPublicPath) {
    navigate({ to: "/login" });
  }
}, [location.pathname, mounted, navigate]);
```

**關鍵改進：**
1. ✅ 不再依賴 React state 同步
2. ✅ 直接讀 localStorage（同步操作）
3. ✅ 去掉了 ACCESS DENIED 面板的條件渲染
4. ✅ 完全消除 UI 閃現

---

### 🔴 **難題 2：菜單導航導致頁面完整重新加載**

**問題描述：**
- 使用 HTML `<a>` 標籤導航會刷新整個頁面
- 導致 React 組件狀態丟失、無 SPA 體驗
- 用戶看到短暫的白屏/加載

**原始代碼：**
```typescript
// ❌ 使用 <a> 標籤 - 會重新加載頁面
<a href="/play" className="px-2 py-1">
  [PLAY]
</a>
```

**問題現象：**
```
點擊 [PLAY]
  ▼
瀏覽器向服務器請求 /play 頁面
  ▼
服務器返回完整 HTML
  ▼
React 應用重新初始化 🔴
  ▼
頁面短暫白屏
  ▼
所有前端 state 丟失
```

**解決方案：**
```typescript
// ✅ 使用 TanStack Router Link 組件
import { Link } from "@tanstack/react-router";

<Link
  to="/play"
  className="px-2 py-1"
>
  [PLAY]
</Link>
```

**優勢：**
1. ✅ 保持 SPA 體驗（不重新加載頁面）
2. ✅ React state 不丟失
3. ✅ 過程無縫順暢
4. ✅ 瞬間切換頁面

---

### 🔴 **難題 3：前端開發伺服器記憶體溢出**

**問題描述：**
- EC2 實例只有 1GB 記憶體
- 運行 `npm run build` 時 Vite 會耗盡記憶體被 kill
- 導致構建失敗

**錯誤信息：**
```bash
✓ 218 modules transformed.
Killed  ← 進程被系統 kill
```

**根本原因：**
```
Vite SSR 構建需要 ~500MB 記憶體
└─ Node.js 預設堆大小 ~256MB
└─ 物理記憶體 1GB
└─ 運行其他服務（Nginx、MySQL）也需要記憶體
└─ 總計超過 1GB → OOM (Out of Memory)
```

**解決方案（三步）：**

**步驟 1：創建 Swap 虛擬記憶體**
```bash
# 創建 1GB swap 檔案
sudo dd if=/dev/zero of=/swapfile bs=1M count=1024

# 設置權限並啟用
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 驗證
free -h
# 現在有 ~2GB 可用記憶體
```

**步驟 2：增加 Node.js 堆大小**
```bash
# 設置環境變量
export NODE_OPTIONS="--max-old-space-size=1024"

# 重試構建
npm run build
```

**步驟 3：結果**
```
✓ 218 modules transformed.
✓ built in 6.51s  ← 客戶端成功
✓ 276 modules transformed.
✓ built in 7.33s  ← 服務器成功！
```

---

### 🔴 **難題 4：Systemd 服務執行路徑問題**

**問題描述：**
- Systemd 服務找不到 NVM 安裝的 Node.js
- 錯誤：`Unable to locate executable '/home/ubuntu/.nvm/versions/node/v22.16.0/bin/npx'`

**根本原因：**
```
Systemd 運行環境 ≠ 用戶 Shell 環境
├─ Shell 有 NVM PATH 配置
└─ Systemd 沒有加載 ~/.bashrc
```

**解決方案：**
```ini
[Service]
# ✅ 使用系統 npm（而不是 NVM 路徑）
ExecStart=/usr/bin/npm run dev -- --host 0.0.0.0 --port 4173
```

---

### 🟡 **難題 5：輸入框在登入/註冊頁消失**

**問題描述：**
- 用戶在登入/註冊頁面輸入帳號
- 第一次輸入會導致輸入框消失
- 第二次輸入時恢復正常

**原因分析：**
- Shell.tsx 的過度重新渲染
- 路由導航時 Form 組件 unmount/remount

**解決方案：**
- 簡化 Shell 組件邏輯
- 移除不必要的條件渲染
- Vite 熱更新自動修復

---

## 4. 總結本專案收穫

### 📚 **技術收穫**

#### **前端技術棧**
✅ **React + TypeScript**
- 組件設計和狀態管理
- 認證狀態同步最佳實踐
- 條件渲染和效能優化

✅ **TanStack Router**
- SPA 路由原理
- 路由守衛實現
- 動態路由配置

✅ **Vite 開發工具**
- 熱模塊更新 (HMR)
- 優化的構建流程
- 開發伺服器配置

✅ **CSS 和設計系統**
- 終端 CRT 風格設計
- 暗色主題色彩搭配
- 響應式 Grid 佈局

---

#### **後端技術棧**
✅ **FastAPI 框架**
- RESTful API 設計
- 依賴注入和模組化
- 非同步處理

✅ **認證和授權**
- JWT Token 實現
- 密碼安全存儲 (Hashing)
- 會話管理

✅ **資料庫設計**
- SQL 表結構設計
- 關聯查詢優化
- ORM 使用 (SQLAlchemy)

---

#### **雲端基礎設施**
✅ **AWS EC2**
- Linux 伺服器管理
- 進程監控 (Systemd)
- 服務啟動和重新啟動

✅ **AWS RDS**
- 関係型資料庫配置
- MySQL 連接池管理
- 資料持久化

✅ **負載均衡**
- Nginx 反向代理
- 多應用協調
- 連接轉發

---

### 🎯 **解決問題的能力**

✅ **調試技能**
- 使用瀏覽器 DevTools 分析前端問題
- 查看伺服器日誌診斷後端錯誤
- 使用 Git 追蹤代碼變化

✅ **效能優化**
- 識別記憶體瓶頸
- 使用 Swap 擴展虛擬記憶體
- 優化 Node.js 堆大小

✅ **系統集成**
- 前後端 API 協作
- 認證令牌流程
- 跨域請求處理 (CORS)

---

### 💡 **架構設計領悟**

✅ **認識到的重要性：**

1. **狀態同步的複雜性**
   - React state 更新有延遲
   - 需要考慮 localStorage 同步
   - 應避免在 state 依賴中做路由檢查

2. **SPA vs 傳統網站**
   - `<a>` 標籤會重新加載整個頁面
   - 路由庫 (Router Link) 保持應用狀態
   - 使用者體驗差異明顯

3. **雲端資源限制**
   - 小型 EC2 記憶體有限
   - 需要主動規劃資源使用
   - Swap 和 OOM 殺手是現實問題

4. **服務協調**
   - Nginx 作為入口點
   - 後端服務需要獨立端口
   - Systemd 不同於 Shell 環境

---

### 🚀 **未來擴展方向**

✅ **短期（1-2 週）**
- [ ] 完善角色 API（遊戲邏輯）
- [ ] 實現市場交易系統
- [ ] 添加公會功能
- [ ] 用戶進度保存

✅ **中期（1 個月）**
- [ ] 集成 **S3** 存儲遊戲資源
- [ ] 使用 **DynamoDB** 存儲實時狀態
- [ ] 實現 **WebSocket** 多人同步
- [ ] 添加 **Lambda** 異步任務處理

✅ **長期（3-6 個月）**
- [ ] 遷移到 **Elastic Beanstalk** 自動擴展
- [ ] 實現全球 CDN 加速
- [ ] 多區域冗餘部署
- [ ] 遊戲分析和數據挖掘

---

### 📊 **項目成果統計**

| 項目 | 完成度 | 服務數 |
|------|--------|--------|
| **前端應用** | 100% | React + Vite |
| **後端 API** | 80% | FastAPI |
| **資料庫** | 100% | RDS MySQL |
| **認證系統** | 100% | JWT Token |
| **雲端架構** | 40% | EC2 + RDS |

**總體完成度：84%** ✅

---

### 🎓 **所學課程應用**

✅ 課程 1：計算機網路
- HTTP/HTTPS 協議
- 跨域請求 (CORS)
- RESTful API 設計

✅ 課程 2：資料庫系統
- SQL 查詢設計
- 表關聯設計
- 資料完整性約束

✅ 課程 3：Web 開發
- 前端框架 (React)
- 後端框架 (FastAPI)
- 全棧開發實踐

✅ 課程 4：雲計算
- AWS 服務組合
- 基礎設施配置
- 性能監控和優化

---

### 🏆 **核心收穫一句話**

> **「從零到一構建一個完整的雲端應用，經歷了前端認證、後端 API、資料庫設計、伺服器管理等全棧開發過程，解決了記憶體限制、狀態同步、服務協調等現實問題，理解了雲端架構的設計理念和實施挑戰。」**

---

## 📋 **附錄：核心代碼亮點**

### 認證狀態同步解決方案
```typescript
// 直接讀 localStorage 的認證檢查
export function readAuth() {
  try {
    const data = localStorage.getItem("cloud-rpg-auth");
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// 在 useEffect 中直接使用，無需依賴 state
useEffect(() => {
  if (!mounted) return;
  
  const currentAuth = readAuth(); // 同步讀取
  const isAuthenticated = !!currentAuth;
  const isPublicPath = PUBLIC_PATHS.has(location.pathname);

  if (!isAuthenticated && !isPublicPath) {
    navigate({ to: "/login" });
  }
}, [location.pathname, mounted, navigate]);
```

### JWT 認證流程
```python
# FastAPI 後端
@router.post("/auth/login")
async def login(credentials: LoginSchema, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == credentials.username).first()
    
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token(data={"sub": user.id})
    return {"access_token": token, "user": user}
```

