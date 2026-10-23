#!/bin/bash
# 一次性設定（在 EC2 上執行）：把 ~/CloudRPG 變成 GitHub repo 的 git checkout，並啟用自動部署
#   bash setup_git_deploy.sh <目前 EC2 上程式對應的 commit>
# 只會初始化 git 與安裝 systemd timer，不會改動任何檔案；第一次部署由 auto_deploy.sh 執行
set -euo pipefail
DEPLOYED_COMMIT=${1:?用法：bash setup_git_deploy.sh <目前 EC2 上程式對應的 commit>}
cd ~/CloudRPG

if [ ! -d .git ]; then
  git init -q -b main
  git remote add origin https://github.com/mato1321/CloudRPG.git
fi
git fetch -q origin main
git reset -q "$DEPLOYED_COMMIT"   # 只設定 HEAD 與 index，工作目錄的檔案不變
echo "與 $DEPLOYED_COMMIT 不同的追蹤檔案："
git status --short --untracked-files=no | head -30

# 從 GitHub 最新版安裝 systemd 設定（工作目錄可能還是舊版，沒有這兩個檔案）
for unit in cloudrpg-deploy.service cloudrpg-deploy.timer; do
  git show "origin/main:deploy/$unit" | sudo tee "/etc/systemd/system/$unit" >/dev/null
done
sudo systemctl daemon-reload
sudo systemctl enable --now cloudrpg-deploy.timer
systemctl list-timers cloudrpg-deploy.timer --no-pager
