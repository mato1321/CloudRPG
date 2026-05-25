# CloudRPG 故障排除指南

## 📋 快速參考

| 狀態 | 含義 | 常見原因 |
|------|------|---------|
| **502 Bad Gateway** | Nginx 無法連接到後端/前端服務 | 服務未運行、埠號錯誤、防火牆問題 |
| **500 Internal Server Error** | 後端應用程序崩潰或出錯 | 代碼錯誤、數據庫連接問題、未捕獲的異常 |
| **503 Service Unavailable** | 服務暫時不可用 | 服務重啟中、資源耗盡 |

---

## 🔴 **502 Bad Gateway 解決方案**

### **症狀**
- 訪問 `http://44.205.216.47` 顯示 502 錯誤
- Nginx 日誌顯示 `connect() failed (111: Connection refused)`

### **🔍 診斷步驟**

```bash
# 1️⃣ 檢查服務是否運行
sudo systemctl status cloudrpg-frontend.service
sudo systemctl status cloudrpg-backend.service

# 2️⃣ 檢查埠是否開放
sudo lsof -i :4173  # 前端
sudo lsof -i :8000  # 後端
sudo lsof -i :80    # Nginx

# 3️⃣ 測試本地連接
curl http://localhost:4173
curl http://localhost:8000/health
curl http://localhost:80

# 4️⃣ 檢查 Nginx 配置
sudo nginx -t

# 5️⃣ 查看 Nginx 錯誤日誌
sudo tail -20 /var/log/nginx/error.log
```

### **✅ 解決方案**

#### **情況 1：服務未運行**
```bash
# 查看服務狀態
sudo systemctl status cloudrpg-frontend.service
sudo systemctl status cloudrpg-backend.service

# 如果是 inactive，啟動它們
sudo systemctl start cloudrpg-frontend.service
sudo systemctl start cloudrpg-backend.service

# 等待 10 秒後再測試
sleep 10
curl http://localhost:4173
curl http://localhost:8000/health
```

#### **情況 2：埠被占用**
```bash
# 查找占用埠的進程
sudo lsof -i :4173
sudo lsof -i :8000
sudo lsof -i :80

# 殺死進程（PID 是第二列數字）
sudo kill -9 <PID>

# 重啟服務
sudo systemctl restart cloudrpg-frontend.service
sudo systemctl restart cloudrpg-backend.service
```

#### **情況 3：Nginx 配置錯誤**
```bash
# 驗證 Nginx 配置
sudo nginx -t

# 如果有錯誤，查看配置文件
sudo nano /etc/nginx/sites-available/default

# 確保包含以下內容：
# location / {
#     proxy_pass http://localhost:4173;
# }
# location /api/ {
#     proxy_pass http://localhost:8000;
# }

# 重啟 Nginx
sudo systemctl restart nginx
```

#### **情況 4：防火牆/安全組問題**
```bash
# 檢查 AWS 安全組是否開放埠
# - 埠 80（HTTP）
# - 埠 443（HTTPS，如果使用）
# - 埠 3000（如果前端使用）
# - 埠 4173（前端內部）
# - 埠 8000（後端內部）

# 在 EC2 本地測試
curl http://localhost:4173
curl http://localhost:8000/health

# 從外部測試
curl http://44.205.216.47
```

---

## 🔴 **500 Internal Server Error 解決方案**

### **症狀**
- 訪問應用顯示 500 錯誤
- 後端服務運行但返回 500
- 日誌顯示異常或堆棧跟蹤

### **🔍 診斷步驟**

```bash
# 1️⃣ 查看後端日誌
sudo tail -50 /var/log/cloudrpg-backend.log

# 2️⃣ 實時監控後端日誌
sudo journalctl -u cloudrpg-backend.service -f

# 3️⃣ 檢查前端日誌
sudo tail -50 /var/log/cloudrpg-frontend.log

# 4️⃣ 檢查 EC2 資源
free -h          # 記憶體
df -h            # 磁盤
top -b -n 1      # CPU 和進程

# 5️⃣ 測試 API 端點
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'
```

### **✅ 解決方案**

#### **情況 1：後端代碼崩潰**
```bash
# 查看詳細錯誤日誌
sudo journalctl -u cloudrpg-backend.service -n 100

# 常見錯誤：
# - ModuleNotFoundError: 缺少 Python 依賴
# - KeyError: 配置文件缺少鍵
# - ConnectionError: 無法連接到數據庫
# - ValueError: 參數類型錯誤

# 解決方法：
cd ~/CloudRPG/backend
source venv/bin/activate

# 重新安裝依賴
pip install -r requirements.txt

# 重啟服務
sudo systemctl restart cloudrpg-backend.service
```

#### **情況 2：數據庫連接失敗**
```bash
# 檢查數據庫狀態
ps aux | grep -E "mysql|postgres|mongo" | grep -v grep

# 如果數據庫未運行，啟動它
sudo systemctl start mysql    # 或 postgresql/mongodb

# 驗證連接字符串
cat ~/CloudRPG/backend/.env | grep DATABASE_URL

# 測試連接
python -c "from app.config import settings; print(settings.DATABASE_URL)"

# 重啟後端
sudo systemctl restart cloudrpg-backend.service
```

#### **情況 3：前端 API 請求錯誤**
```bash
# 檢查前端環境變量
cat ~/CloudRPG/fronted/.env | grep VITE_API_URL

# 確保指向正確的後端地址
# 應該是：http://localhost:8000 或 http://44.205.216.47

# 重新構建前端
cd ~/CloudRPG/fronted
npm run build

# 重啟前端服務
sudo systemctl restart cloudrpg-frontend.service
```

#### **情況 4：資源耗盡（記憶體/磁盤）**
```bash
# 檢查記憶體
free -h
# 如果接近滿，重啟服務
sudo systemctl restart cloudrpg-backend.service
sudo systemctl restart cloudrpg-frontend.service

# 檢查磁盤
df -h /
# 如果滿了，清理日誌
sudo journalctl --vacuum=500M

# 清理舊日誌
sudo truncate -s 0 /var/log/cloudrpg-backend.log
sudo truncate -s 0 /var/log/cloudrpg-frontend.log
```

---

## 🚀 **臨時手動啟動後端和前端**

### **場景 1：完全手動前台運行（看實時日誌）**

#### **後端**
```bash
# 進入後端目錄
cd ~/CloudRPG/backend

# 啟用虛擬環境
source venv/bin/activate

# 啟動後端（前台運行，Ctrl+C 停止）
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# 輸出示例：
# INFO:     Started server process [12345]
# INFO:     Waiting for application startup.
# INFO:     Application startup complete.
# INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

#### **前端（新開一個終端）**
```bash
# 進入前端目錄
cd ~/CloudRPG/fronted

# 啟動前端預覽（前台運行，Ctrl+C 停止）
npm run preview

# 輸出示例：
# ➜  Local:   http://localhost:4173/
# ➜  Network: http://172.31.13.218:4173/
```

### **場景 2：後台運行但可隨時查看日誌**

#### **後端**
```bash
# 停止 systemd 服務
sudo systemctl stop cloudrpg-backend.service

# 後台運行
cd ~/CloudRPG/backend
source venv/bin/activate
nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > ~/backend.log 2>&1 &

# 查看日誌
tail -f ~/backend.log

# 查找進程 PID
ps aux | grep uvicorn | grep -v grep

# 停止進程
kill <PID>
```

#### **前端**
```bash
# 停止 systemd 服務
sudo systemctl stop cloudrpg-frontend.service

# 後台運行
cd ~/CloudRPG/fronted
nohup npm run preview > ~/frontend.log 2>&1 &

# 查看日誌
tail -f ~/frontend.log

# 查找進程 PID
ps aux | grep "npm run preview" | grep -v grep

# 停止進程
kill <PID>
```

### **場景 3：快速重啟 systemd 服務**

```bash
# 重啟所有服務
sudo systemctl restart cloudrpg-backend.service cloudrpg-frontend.service

# 查看實時日誌
sudo journalctl -u cloudrpg-backend.service -f

# 等待服務啟動
sleep 5

# 測試
curl http://localhost:8000/health
curl http://localhost:4173
```

---

## 📊 **完整故障排除流程圖**

```
訪問 http://44.205.216.47
        ↓
   ├─ 502 Bad Gateway? ──→ 檢查 Nginx ──→ 檢查前端/後端服務 ──→ 重啟服務
   │
   ├─ 500 Internal Error? ──→ 查看後端日誌 ──→ 查看異常 ──→ 修復代碼/依賴
   │
   ├─ 503 Unavailable? ──→ 檢查資源 ──→ 清理日誌 ──→ 重啟
   │
   └─ 正常工作 ✓
```

---

## 🛠️ **一鍵診斷腳本**

```bash
#!/bin/bash
# 保存為 ~/diagnose.sh

echo "=== CloudRPG 故障診斷 ==="
echo ""

echo "1️⃣ 檢查服務狀態..."
sudo systemctl status cloudrpg-backend.service --no-pager | grep Active
sudo systemctl status cloudrpg-frontend.service --no-pager | grep Active
echo ""

echo "2️⃣ 檢查埠..."
sudo lsof -i :8000 | tail -1
sudo lsof -i :4173 | tail -1
sudo lsof -i :80 | tail -1
echo ""

echo "3️⃣ 測試連接..."
echo "後端："
curl -s http://localhost:8000/health | head -c 50
echo ""
echo "前端："
curl -s http://localhost:4173 | head -c 50
echo ""

echo "4️⃣ 資源使用..."
echo "記憶體："
free -h | grep Mem
echo "磁盤："
df -h / | tail -1
echo "CPU："
top -b -n 1 | grep "Cpu(s)" 
echo ""

echo "5️⃣ 最近的錯誤..."
echo "Nginx 錯誤："
sudo tail -3 /var/log/nginx/error.log 2>/dev/null
echo "後端錯誤："
sudo tail -3 /var/log/cloudrpg-backend.log 2>/dev/null
```

使用方法：
```bash
chmod +x ~/diagnose.sh
~/diagnose.sh
```

---

## 📞 **快速命令速查表**

| 目的 | 命令 |
|------|------|
| **查看後端狀態** | `sudo systemctl status cloudrpg-backend.service` |
| **查看前端狀態** | `sudo systemctl status cloudrpg-frontend.service` |
| **重啟所有服務** | `sudo systemctl restart cloudrpg-*.service` |
| **查看後端日誌** | `sudo journalctl -u cloudrpg-backend.service -f` |
| **查看前端日誌** | `sudo journalctl -u cloudrpg-frontend.service -f` |
| **測試後端連接** | `curl http://localhost:8000/health` |
| **測試前端連接** | `curl http://localhost:4173` |
| **檢查 Nginx 配置** | `sudo nginx -t` |
| **重啟 Nginx** | `sudo systemctl restart nginx` |
| **查看所有進程** | `ps aux \| grep -E "uvicorn\|npm\|nginx" \| grep -v grep` |
| **清理日誌** | `sudo journalctl --vacuum=500M` |
| **實時監控** | `watch -n 1 'ps aux \| grep -E "uvicorn\|npm"'` |

---

## ⚠️ **常見錯誤和解決**

### **ModuleNotFoundError: No module named 'app'**
```bash
cd ~/CloudRPG/backend
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart cloudrpg-backend.service
```

### **EADDRINUSE: address already in use**
```bash
# 找到占用埠的進程
sudo lsof -i :8000
# 殺死進程
sudo kill -9 <PID>
# 重啟服務
sudo systemctl restart cloudrpg-backend.service
```

### **CORS errors in frontend**
```bash
# 確保後端允許 CORS
# 檢查 ~/CloudRPG/backend/app/main.py

# 應該包含：
# from fastapi.middleware.cors import CORSMiddleware
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

sudo systemctl restart cloudrpg-backend.service
```

### **前端無法連接後端 API**
```bash
# 檢查前端環境變量
cat ~/CloudRPG/fronted/.env

# 應該包含正確的後端 URL
# VITE_API_URL=http://localhost:8000 (開發)
# 或
# VITE_API_URL=http://44.205.216.47 (生產)

# 重新構建
cd ~/CloudRPG/fronted
npm run build
sudo systemctl restart cloudrpg-frontend.service
```

---

## 💡 **預防措施**

```bash
# 1. 設置自動監控和重啟
sudo systemctl enable cloudrpg-backend.service
sudo systemctl enable cloudrpg-frontend.service

# 2. 定期檢查日誌
sudo journalctl -u cloudrpg-backend.service --since "1 hour ago"

# 3. 定期備份
tar -czf ~/backups/cloudrpg-$(date +%Y%m%d-%H%M%S).tar.gz ~/CloudRPG/

# 4. 監控磁盤使用
df -h /

# 5. 監控記憶體
free -h
```

---

**最後更新：2026-05-25**
