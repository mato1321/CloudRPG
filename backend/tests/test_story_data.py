"""劇情資料（fronted/src/data/story/*.json）的完整性檢查：在 CI 裡擋下寫錯的章節"""
import json
import pathlib

from app.game import data as D

STORY_DIR = pathlib.Path(__file__).resolve().parents[2] / "fronted" / "src" / "data" / "story"


def load():
    scenes, endings = {}, []
    for f in sorted(STORY_DIR.glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        for sid, sc in d.get("scenes", {}).items():
            assert sid not in scenes, f"場景 id 重複：{sid}（{f.name}）"
            scenes[sid] = sc
        endings += d.get("endings", [])
    return scenes, endings


def targets(sc):
    out = [c["go"] for c in sc.get("choices", [])] + [sc.get("winGo"), sc.get("loseGo")]
    out += [r["go"] for r in sc.get("route", [])]
    return [t for t in out if t]


def test_links_battles_claims_endings():
    scenes, endings = load()
    assert "classroom" in scenes and "hub" in scenes
    ending_ids = {e["id"] for e in endings}
    for sid, sc in scenes.items():
        for t in targets(sc):
            assert t in scenes, f"{sid} → {t}：場景不存在"
        if sc.get("battle"):
            assert sc["battle"] in D.ENEMIES, f"{sid}：伺服器沒有敵人 {sc['battle']}"
            assert sc.get("winGo") and sc.get("loseGo"), f"{sid}：戰鬥場景要有 winGo / loseGo"
        if sc.get("claim"):
            assert sc["claim"] in D.STORY_REWARDS, f"{sid}：伺服器沒有劇情獎勵 {sc['claim']}"
        ending = (sc.get("effects") or {}).get("ending")
        if ending:
            assert ending in ending_ids, f"{sid}：結局 {ending} 沒有列在 endings"
        if not sc.get("battle") and not sc.get("route"):
            assert sc.get("choices"), f"{sid}：沒有任何指令（玩家會卡住）"


def test_every_scene_is_reachable_and_every_ending_exists():
    scenes, endings = load()
    seen, todo = set(), ["classroom"]
    while todo:
        sid = todo.pop()
        if sid in seen:
            continue
        seen.add(sid)
        todo += targets(scenes[sid])
    unreachable = set(scenes) - seen
    assert not unreachable, f"從序章走不到的場景：{sorted(unreachable)}"
    used = {(sc.get("effects") or {}).get("ending") for sc in scenes.values()}
    for e in endings:
        assert e["id"] in used, f"結局 {e['id']} 沒有任何場景會觸發"
