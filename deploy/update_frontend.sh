#!/bin/bash
# 在 EC2 上執行：重新 build 前端並以正式版（vite preview）重新啟動
# 用法：bash ~/CloudRPG/deploy/update_frontend.sh
set -e

cd ~/CloudRPG/fronted

# t3.micro 記憶體只有 ~1GB：build 前先停掉前端服務，避免 OOM
sudo systemctl stop cloudrpg-frontend
npm install --no-audit --no-fund
NODE_OPTIONS=--max-old-space-size=1024 npm run build

# 第一次切換到正式版時安裝 systemd 設定（之後重跑不影響）
sudo cp ~/CloudRPG/deploy/cloudrpg-frontend.service /etc/systemd/system/cloudrpg-frontend.service
sudo systemctl daemon-reload
sudo systemctl start cloudrpg-frontend

# vite preview 啟動要幾秒：最多等 60 秒，期間連不上不算失敗
for _ in $(seq 1 30); do
  curl -fsS -o /dev/null http://127.0.0.1:4173/ && break
  sleep 2
done
systemctl is-active cloudrpg-frontend
curl -s -o /dev/null -w "frontend / -> HTTP %{http_code}\n" http://127.0.0.1:4173/
