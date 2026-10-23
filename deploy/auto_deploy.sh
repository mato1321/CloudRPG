#!/bin/bash
# 在 EC2 上由 systemd timer（cloudrpg-deploy.timer）每 5 分鐘執行一次：
#   GitHub main 有新 commit、而且 GitHub Actions CI 通過 → 更新程式碼，只重啟有變動的部分
#   部署後健康檢查失敗 → 自動回滾到上一個 commit
# 手動執行：bash ~/CloudRPG/deploy/auto_deploy.sh    看紀錄：journalctl -u cloudrpg-deploy -n 50
# 不需要 AWS 憑證；GitHub API 用公開 repo 的匿名額度（只有在有新 commit 時才會呼叫）
set -uo pipefail

REPO_DIR="${REPO_DIR:-$HOME/CloudRPG}"
BRANCH=main
GITHUB_REPO=mato1321/CloudRPG

exec 9>/tmp/cloudrpg-deploy.lock
flock -n 9 || { echo "另一個部署正在進行，略過"; exit 0; }
cd "$REPO_DIR" || exit 1

git fetch -q origin "$BRANCH" || { echo "git fetch 失敗"; exit 1; }
OLD=$(git rev-parse HEAD)
NEW=$(git rev-parse "origin/$BRANCH")
[ "$OLD" = "$NEW" ] && exit 0
# 這個 commit 之前部署失敗並已回滾：等下一個 commit 再試
[ "$(git rev-parse -q --verify refs/deploy/failed)" = "$NEW" ] && exit 0

# ── 只部署 CI 通過的 commit ──
ci=$(curl -fsS -m 20 "https://api.github.com/repos/$GITHUB_REPO/actions/runs?head_sha=$NEW&event=push" | python3 -c '
import json, sys
runs = [r for r in json.load(sys.stdin).get("workflow_runs", []) if r["name"] == "CI"]
if not runs: print("pending")
elif runs[0]["status"] != "completed": print("pending")
else: print(runs[0]["conclusion"])
') || ci=pending
case "$ci" in
  success) ;;
  pending) echo "${NEW:0:7} 的 CI 還沒跑完，下次再檢查"; exit 0 ;;
  *) echo "${NEW:0:7} 的 CI 結果是 $ci，不部署"; exit 0 ;;
esac

CHANGED=$(git diff --name-only "$OLD" "$NEW")
echo "部署 ${OLD:0:7} → ${NEW:0:7}（$(echo "$CHANGED" | wc -l) 個檔案）"

healthy_backend() {
  for _ in $(seq 1 15); do
    sleep 2
    curl -fsS -m 5 -o /dev/null http://127.0.0.1:8000/health \
      && curl -fsS -m 10 -o /dev/null http://127.0.0.1:8000/api/worldboss && return 0
  done
  return 1
}

healthy_frontend() {
  for _ in $(seq 1 20); do
    sleep 3
    curl -fsS -m 10 -o /dev/null http://127.0.0.1:4173/ && return 0
  done
  return 1
}

apply() {  # $1 = 要部署的 commit，$2 = 跟哪個 commit 比較變動
  local target=$1 base=$2 files
  files=$(git diff --name-only "$base" "$target")
  git reset -q --hard "$target" || return 1   # 只動 git 追蹤的檔案；.env、venv、node_modules、dist 不受影響
  if echo "$files" | grep -q '^backend/requirements.txt$'; then
    backend/venv/bin/pip install -q -r backend/requirements.txt || return 1
  fi
  if echo "$files" | grep -q '^backend/'; then
    sudo systemctl restart cloudrpg-backend
    healthy_backend || { echo "後端健康檢查失敗"; return 1; }
  fi
  if echo "$files" | grep -q '^fronted/'; then
    bash deploy/update_frontend.sh >/dev/null || { echo "前端 build 失敗"; return 1; }
    healthy_frontend || { echo "前端健康檢查失敗"; return 1; }
  fi
  return 0
}

if apply "$NEW" "$OLD"; then
  echo "部署完成：${NEW:0:7} $(git log -1 --format=%s "$NEW")"
else
  echo "部署失敗，回滾到 ${OLD:0:7}"
  if apply "$OLD" "$NEW"; then
    echo "已回滾到 ${OLD:0:7}"
  else
    echo "回滾也失敗了，請手動檢查（journalctl -u cloudrpg-backend / cloudrpg-frontend）"
  fi
  # 記住失敗的 commit，避免每 5 分鐘重試同一個壞版本
  git update-ref refs/deploy/failed "$NEW"
  exit 1
fi
