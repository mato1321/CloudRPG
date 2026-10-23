// @ts-nocheck
/* 劇情資料 → 場景物件。加新章節：在 src/data/story/ 新增一個 JSON 檔（依檔名排序合併），不用改程式。
 *
 * 場景欄位
 *   location   場景名稱             intro     進場文字 [{ t, text }]（t：world/dim/system/player/npc/battle/glitch）
 *   dynamic    依條件顯示的文字 [{ if?, t, text }]，text 可用 {stones} {memories} {endings} {endingsTotal}
 *   choices    指令 [{ cmd, label, go, if?, needMsg? }]：if 不成立時不列出，硬打指令會顯示 needMsg
 *   effects    進場效果 { flags: {...}, items: {加數量}, setItems: {設定數量}, quest, ending: "結局 id" }
 *   battle     敵人 key（同時要在 backend/app/game/data.py 的 ENEMIES 有資料）＋ winGo / loseGo
 *   route      進場就依條件轉到別的場景 [{ if?, go }]（第一個成立的）
 *   claim      劇情獎勵 id（伺服器 STORY_REWARDS，每個帳號只能領一次）
 *   guest      訪客（未登入）也能進入        glitch   故障畫面效果
 * 條件：{ flag } { noFlag } { item } { noItem } { all: [...] } { any: [...] }
 */
const FILES = import.meta.glob("../data/story/*.json", { eager: true });
const DATA = Object.keys(FILES)
  .sort()
  .map((k) => FILES[k].default || FILES[k]);

export const ENDINGS = DATA.flatMap((d) => d.endings || []);
const STONES = ["stone_red", "stone_blue", "stone_gold"];
const MEMORIES = ["memory_1", "memory_2"];

export function evalCond(c, s) {
  if (!c) return true;
  const inv = s?.inv || {};
  const flags = s?.flags || {};
  if (c.all) return c.all.every((x) => evalCond(x, s));
  if (c.any) return c.any.some((x) => evalCond(x, s));
  if (c.flag) return !!flags[c.flag];
  if (c.noFlag) return !flags[c.noFlag];
  if (c.item) return (inv[c.item] || 0) > 0;
  if (c.noItem) return !((inv[c.noItem] || 0) > 0);
  return true;
}

function fill(text, s) {
  const inv = s?.inv || {};
  const vars = {
    stones: STONES.filter((k) => inv[k]).length,
    memories: MEMORIES.filter((k) => inv[k]).length,
    endings: (s?.flags?.endings || []).length,
    endingsTotal: ENDINGS.length,
  };
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function applyEffects(e, s) {
  const patch: any = {};
  if (e.items || e.setItems) {
    const inv = { ...(s.inv || {}) };
    for (const [k, v] of Object.entries(e.items || {})) inv[k] = (inv[k] || 0) + v;
    Object.assign(inv, e.setItems || {});
    patch.inv = inv;
  }
  if (e.flags || e.ending) {
    const flags = { ...(s.flags || {}), ...(e.flags || {}) };
    if (e.ending) flags.endings = [...new Set([...(s.flags?.endings || []), e.ending])];
    patch.flags = flags;
  }
  if (e.quest) patch.quest = e.quest;
  return patch;
}

function compileScene(id, sc) {
  const out: any = { ...sc };
  if (sc.effects) out.onEnter = (s) => applyEffects(sc.effects, s);
  if (sc.dynamic) {
    out.dynamic = (s) => sc.dynamic.filter((d) => evalCond(d.if, s)).map((d) => ({ t: d.t, text: fill(d.text, s) }));
  }
  if (sc.choices) {
    out.choices = sc.choices.map((c) => ({ ...c, need: c.if ? (s) => evalCond(c.if, s) : undefined }));
  }
  if (sc.route) out.route = (s) => (sc.route.find((r) => evalCond(r.if, s)) || {}).go;
  return out;
}

/** 所有章節合併後的場景表（id → 場景） */
export function compileStory() {
  const scenes = {};
  for (const d of DATA) {
    for (const [id, sc] of Object.entries(d.scenes || {})) {
      if (id.startsWith("_")) continue;
      scenes[id] = compileScene(id, sc);
    }
  }
  return scenes;
}

/** 依 route 轉場（最多 5 層，避免設定錯誤造成無限迴圈） */
export function resolveScene(scenes, id, s) {
  let cur = id;
  for (let i = 0; i < 5 && scenes[cur]?.route; i++) cur = scenes[cur].route(s) || cur;
  return cur;
}

/** 檢查劇情資料：所有 go / winGo / loseGo / route 都要指向存在的場景 */
export function validateStory(scenes = compileStory()) {
  const errors = [];
  for (const [id, sc] of Object.entries(scenes)) {
    const targets = [...(sc.choices || []).map((c) => c.go), sc.winGo, sc.loseGo];
    const raw = DATA.find((d) => d.scenes?.[id])?.scenes[id];
    for (const r of raw?.route || []) targets.push(r.go);
    for (const t of targets) if (t && !scenes[t]) errors.push(`${id} → ${t}（不存在）`);
  }
  return errors;
}
