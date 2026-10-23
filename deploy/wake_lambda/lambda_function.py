"""CloudRPG 喚醒頁（AWS Lambda Function URL）

玩家打開這個網址時：
  - EC2 已經在跑且遊戲健康 → 直接 302 轉址到遊戲
  - EC2 是關機狀態 → 呼叫 StartInstances 開機，顯示「伺服器啟動中」頁面，
    每 3 秒查一次狀態，遊戲 /health 正常後自動跳轉

環境變數：
  INSTANCE_ID  例：i-020728b7077e9d8cf
  GAME_URL     例：http://54.161.3.74（Elastic IP，固定不變）
"""
import json
import os
import urllib.request

import boto3

INSTANCE_ID = os.environ["INSTANCE_ID"]
GAME_URL = os.environ["GAME_URL"].rstrip("/")
ec2 = boto3.client("ec2")


def _state() -> str:
    res = ec2.describe_instances(InstanceIds=[INSTANCE_ID])
    return res["Reservations"][0]["Instances"][0]["State"]["Name"]


def _healthy() -> bool:
    try:
        with urllib.request.urlopen(f"{GAME_URL}/health", timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


def _ensure_started():
    """關機中就開機；正在關機 (stopping) 時等下一次輪詢再試。回傳 (state, 是否剛送出開機)"""
    state = _state()
    if state == "stopped":
        ec2.start_instances(InstanceIds=[INSTANCE_ID])
        return "pending", True
    return state, False


def _target(qs) -> str:
    # 只允許站內路徑，避免被拿來當任意轉址
    to = (qs or {}).get("to", "/")
    if not to.startswith("/") or to.startswith("//"):
        to = "/"
    return GAME_URL + to


def lambda_handler(event, context):
    qs = event.get("queryStringParameters") or {}
    state, just_started = _ensure_started()
    ready = state == "running" and _healthy()

    if qs.get("status"):
        return {
            "statusCode": 200,
            "headers": {"content-type": "application/json", "cache-control": "no-store"},
            "body": json.dumps({"state": state, "ready": ready, "started": just_started, "url": _target(qs)}),
        }

    if ready:
        return {"statusCode": 302, "headers": {"location": _target(qs), "cache-control": "no-store"}, "body": ""}

    to = (qs.get("to") or "/") if (qs.get("to") or "/").startswith("/") else "/"
    return {
        "statusCode": 200,
        "headers": {"content-type": "text/html; charset=utf-8", "cache-control": "no-store"},
        "body": PAGE.replace("__TO__", json.dumps(to)),
    }


PAGE = """<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cloud RPG — 伺服器啟動中</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#050c09;color:#00ff88;
       font-family:ui-monospace,Menlo,Consolas,monospace}
  .box{width:min(560px,92vw);border:1px solid #0f3a26;background:#071510;padding:28px 26px;box-shadow:0 0 40px -10px #00ff88}
  h1{margin:0 0 6px;font-size:22px;letter-spacing:.2em;text-shadow:0 0 10px #00ff88}
  .sub{color:#3a8c5e;font-size:12px;margin-bottom:22px}
  .row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px dashed #0f3a26;font-size:14px}
  .ok{color:#00ff88}.wait{color:#ffd60a}.bar{height:6px;background:#0f3a26;margin-top:20px;overflow:hidden}
  .bar i{display:block;height:100%;width:30%;background:#00e5ff;animation:s 1.4s infinite ease-in-out}
  @keyframes s{0%{margin-left:-30%}100%{margin-left:100%}}
  .hint{margin-top:16px;color:#7be0a8;font-size:12px;line-height:1.6}
  a{color:#00e5ff}
</style></head><body><div class="box">
<h1>☁ CLOUD RPG</h1><div class="sub">BOOTING SHARD … 伺服器喚醒中，大約需要 1～2 分鐘</div>
<div class="row"><span>① EC2 雲端主機</span><span id="s1" class="wait">檢查中…</span></div>
<div class="row"><span>② 遊戲服務 (Nginx / API / 前端)</span><span id="s2" class="wait">等待中…</span></div>
<div class="bar"><i></i></div>
<div class="hint" id="hint">主機啟動後會自動帶你進入遊戲，請不要關閉這個頁面。</div>
</div><script>
const TO = __TO__;
const label = {pending:"開機中…", running:"已開機 ✓", stopping:"正在關機，稍後重新開機…", stopped:"開機指令已送出…"};
let tries = 0;
async function poll(){
  tries++;
  try{
    const r = await fetch("?status=1&to=" + encodeURIComponent(TO), {cache:"no-store"});
    const d = await r.json();
    const s1 = document.getElementById("s1"), s2 = document.getElementById("s2");
    s1.textContent = label[d.state] || d.state; s1.className = d.state === "running" ? "ok" : "wait";
    s2.textContent = d.ready ? "就緒 ✓" : (d.state === "running" ? "啟動中…" : "等待中…"); s2.className = d.ready ? "ok" : "wait";
    if (d.ready){ document.getElementById("hint").textContent = "完成！正在進入遊戲…"; location.href = d.url; return; }
  }catch(e){}
  if (tries > 100){ document.getElementById("hint").innerHTML = "啟動時間比預期久，請稍後重新整理。"; return; }
  setTimeout(poll, 3000);
}
poll();
</script></body></html>"""
