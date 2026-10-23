// @ts-nocheck
import { audio } from "../../lib/audio";
/* ───────────── CLOUD RPG · 共用格鬥渲染與特效引擎 ─────────────
 * 故事模式 (StoryBattleArena) 與自由對戰 (/arena) 共用：
 *   1. drawFighter   ：骨架姿勢 + 分層繪製，每個職業 / Boss 有專屬體型、服裝與武器
 *   2. 招式特效       ：半月劍氣、魔法陣、聖光柱、金色羽毛、命中火花、殘影、奧義 Cut-in
 *   3. 投射物造型     ：劍氣波、雷電球、聖光彈、血月斬、冰晶、落雷槍、程式碼封包…
 *   4. Boss 場地機關  ：深淵冰刺、黑水陷阱、天罰落雷、格式化光束、全畫面雷射、數據方塊
 *   5. 關卡背景與 HUD ：燃燒村莊、哥布林洞窟、凶宅血月、冥盡冰窟、天空島、魔王城、系統核心
 * 角色資料（x, y, state, attackType…）由兩個遊戲引擎維護，這裡只負責「看起來像真正的遊戲」。
 */

const TAU = Math.PI * 2;
const FLOOR = 380;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function hexRgb(hex: string) {
  if (!hex || hex[0] !== "#") return [255, 255, 255];
  let c = hex.slice(1);
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  const n = parseInt(c, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function shade(hex: string, amt: number) {
  let [r, g, b] = hexRgb(hex);
  if (amt >= 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
export function rgba(hex: string, a: number) {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
const GLYPHS = "01アイウエオカキクケコサシスセソ<>{}[]#$%&@ABCDEF";
const GARBLE = "▓░▒█¥$#@!?※〒≠∑∂Ω卍¿§¶ØÆ<>/\\|";

/* ───────────── 0. 畫質：高解析度螢幕 + 低階裝置自動降畫質 ───────────── */

let PARTICLE_CAP = 420;

/** 依螢幕 DPR 設定 canvas 實際像素（最多 2 倍），回傳 dpr；繪圖時仍使用 900×H 的邏輯座標 */
export function setupCanvas(canvas: HTMLCanvasElement, W: number, H: number) {
  const dpr = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
  if (canvas.width !== Math.round(W * dpr)) {
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }
  return dpr;
}

/** 低畫質模式：關掉 shadowBlur（最吃效能）、降低粒子上限 */
export function setLowQuality(ctx: CanvasRenderingContext2D, low: boolean) {
  if (low) {
    Object.defineProperty(ctx, "shadowBlur", { configurable: true, get: () => 0, set: () => {} });
    PARTICLE_CAP = 160;
  } else {
    delete (ctx as any).shadowBlur;
    PARTICLE_CAP = 420;
  }
}

/** 偵測掉幀：平均每幀超過 26ms 持續約 2 秒就切到低畫質 */
export function createPerfMonitor(onLow: () => void) {
  let avg = 16;
  let bad = 0;
  let fired = false;
  return (dt: number) => {
    if (fired) return;
    avg = avg * 0.95 + dt * 0.05;
    bad = avg > 26 ? bad + 1 : Math.max(0, bad - 2);
    if (bad > 120) {
      fired = true;
      onLow();
    }
  };
}

/* ───────────── 1. 角色外型設定 ───────────── */

export const VISUALS: Record<string, any> = {
  warrior: { scale: 1.0, build: "knight", weapon: "greatsword", proj: "swordWave", skin: "#f1c27d" },
  mage: { scale: 1.0, build: "robe", weapon: "staff", proj: "thunderOrb", skin: "#f3d2b3" },
  priest: { scale: 1.0, build: "vestment", weapon: "scepter", proj: "holyOrb", skin: "#f5d0b0" },
  ryu: { scale: 1.0, build: "gi", weapon: "fists", proj: "hadouken", skin: "#e0ac69", hair: "#1c1209" },
  ken: { scale: 1.0, build: "gi", weapon: "fists", proj: "fireball", skin: "#e8b67a", hair: "#facc15" },
  chun: { scale: 0.96, build: "qipao", weapon: "kicks", proj: "kikoken", skin: "#f1c9a5", hair: "#1c1209" },
  minions: { scale: 1.05, build: "brute", weapon: "club", proj: "fireball", skin: "#a8a27a" },
  goblin: { scale: 0.78, build: "goblin", weapon: "dagger", proj: "dagger", skin: "#4ade80" },
  duke: { scale: 1.12, build: "noble", weapon: "rapier", proj: "bloodCrescent", skin: "#e7e5e4" },
  abyss: { scale: 1.06, build: "hooded", weapon: "trident", proj: "iceShard", skin: "#0b1220" },
  skyisle: { scale: 1.08, build: "paladin", weapon: "spear", proj: "lightningSpear", skin: "#f8d9b0" },
  demonlord: { scale: 1.14, build: "overlord", weapon: "scythe", proj: "bugBomb", skin: "#c4b5fd" },
  admin: { scale: 1.04, build: "hacker", weapon: "code", proj: "codePacket", skin: "#06120c" },
};

export function visualOf(f: any) {
  return VISUALS[f?.cfg?.visualType] || VISUALS.ryu;
}

/** /arena 角色 id → 外型 */
export function arenaVisualType(id: string) {
  return (
    {
      warrior_rpg: "warrior",
      mage_rpg: "mage",
      priest_rpg: "priest",
      ryu: "ryu",
      ken: "ken",
      chun: "chun",
      duke_boss: "duke",
      admin_boss: "admin",
    }[id] || "ryu"
  );
}

/** 兩個引擎的招式名稱統一：hadouken/shoryuken/dash/super → skill1/2/3/ult */
export function normKind(k: string) {
  return ({ hadouken: "skill1", shoryuken: "skill2", dash: "skill3", super: "ult" } as any)[k] || k;
}

/* 武器分級外觀：0 = 初始、1 = 初級武器、2 = 高級武器、3 = ???終端機 */
export const RARITY_GLOW: Record<string, string> = {
  common: "#cbd5e1",
  rare: "#38bdf8",
  epic: "#c084fc",
  legend: "#f97316",
  myth: "#ff4d6d",
};

const WEAPON_LOOKS: Record<string, any[]> = {
  greatsword: [
    { name: "很廢的武器", blade: "#8b8f97", edge: "#b8bcc4", hilt: "#6b4f2a", glow: null, fx: null },
    { name: "銀風鐵劍", blade: "#dbe4ee", edge: "#ffffff", hilt: "#38bdf8", glow: "#7dd3fc", fx: "wind" },
    { name: "日蝕殞落之劍", blade: "#1c1917", edge: "#ffb703", hilt: "#dc2626", glow: "#ff6b00", fx: "flame" },
    { name: "???終端機", blade: "#03140b", edge: "#00ff88", hilt: "#00ff88", glow: "#00ff88", fx: "code" },
  ],
  staff: [
    { name: "學徒木杖", shaft: "#7c5a3a", orb: "#c4b5fd", glow: null, fx: null },
    { name: "刻印法杖", shaft: "#4c1d95", orb: "#38bdf8", glow: "#38bdf8", fx: "rune" },
    { name: "全世操縱之杖", shaft: "#ca8a04", orb: "#fef08a", glow: "#ffe066", fx: "thunder" },
    { name: "???終端機", shaft: "#03140b", orb: "#00ff88", glow: "#00ff88", fx: "code" },
  ],
  scepter: [
    { name: "木製念珠", shaft: "#a16207", orb: "#fef3c7", glow: null, fx: null },
    { name: "純潔寶珠", shaft: "#facc15", orb: "#ffffff", glow: "#fff7ae", fx: "holy" },
    { name: "虛空之眼", shaft: "#3b0764", orb: "#c084fc", glow: "#a855f7", fx: "void" },
    { name: "???終端機", shaft: "#03140b", orb: "#00ff88", glow: "#00ff88", fx: "code" },
  ],
};

export function weaponLook(f: any) {
  const vis = visualOf(f);
  const tiers = WEAPON_LOOKS[vis.weapon];
  if (!tiers) return null;
  return tiers[clamp(f.weaponTier || 0, 0, 3)];
}

/** 粒子 / 光效的主色：玩家看武器等級，Boss 看自己的配色 */
export function fxColor(f: any) {
  const look = weaponLook(f);
  return (look && look.glow) || f?.cfg?.color || "#ffffff";
}

/* ───────────── 2. 骨架姿勢 ───────────── */

function basePose(vis: any) {
  const P = {
    lean: 0.06, head: 0, dx: 0, dy: 0,
    sF: 0.55, eF: 1.55, sB: 0.25, eB: 1.75,
    hF: 0.32, kF: -0.38, hB: -0.3, kB: -0.18,
    w: 0.55, flip: false, lying: 0,
  };
  if (vis.build === "goblin") P.lean = 0.32;
  if (vis.build === "noble" || vis.build === "hooded") P.lean = 0.0;
  if (vis.build === "hacker") P.lean = 0.02;
  if (vis.weapon === "fists" || vis.weapon === "kicks") {
    P.sF = 0.75; P.eF = 1.9; P.sB = 0.45; P.eB = 1.95; P.w = 0;
  }
  if (vis.weapon === "staff" || vis.weapon === "scepter" || vis.weapon === "trident" || vis.weapon === "spear" || vis.weapon === "scythe") {
    P.sF = 0.35; P.eF = 1.1; P.w = 1.35;
  }
  return P;
}

function mix(P: any, Q: any, t: number) {
  const out: any = { ...P };
  for (const k in Q) if (typeof Q[k] === "number" && typeof P[k] === "number") out[k] = lerp(P[k], Q[k], t);
  else out[k] = Q[k];
  return out;
}

function computePose(f: any, frame: number, vis: any) {
  const B = basePose(vis);
  const st = f.state || "idle";
  const kicker = vis.weapon === "kicks";
  const fister = vis.weapon === "fists";
  const blade = !kicker && !fister;

  if (st === "ko" || st === "knockdown") {
    const P = mix(B, { lean: -0.3, sF: -0.4, eF: 0.4, sB: -0.9, eB: 0.3, hF: 0.4, kF: -0.4, hB: -0.2, kB: -0.3, head: -0.3 }, 1);
    P.lying = (f.y || FLOOR) >= FLOOR - 1 ? 1 : 0.55;
    return P;
  }
  if (st === "hit") {
    return mix(B, { lean: -0.38, head: -0.35, sF: -0.4, eF: 0.9, sB: -0.85, eB: 0.6, hF: 0.12, kF: -0.25, hB: -0.45, kB: -0.1, dx: -4, w: 0.3 }, 1);
  }
  if (st === "block") {
    return mix(B, { lean: -0.06, sF: 1.05, eF: 1.75, sB: 0.95, eB: 1.85, hF: 0.4, kF: -0.6, hB: -0.35, kB: -0.4, w: blade ? 0.25 : 0 }, 1);
  }
  if (st === "jump") {
    const rising = (f.vy || 0) < 0;
    return mix(B, rising
      ? { hF: 0.95, kF: -1.7, hB: 0.25, kB: -1.45, sF: 1.5, eF: 0.9, sB: 0.9, eB: 1.2, lean: 0.1 }
      : { hF: 0.55, kF: -1.0, hB: -0.15, kB: -0.75, sF: 1.0, eF: 1.3, sB: 0.6, eB: 1.4, lean: 0.06 }, 1);
  }
  if (st === "crouch") {
    return mix(B, { hF: 1.25, kF: -2.2, hB: 0.35, kB: -2.15, lean: 0.28, sF: 0.85, eF: 1.45, sB: 0.6, eB: 1.6 }, 1);
  }
  if (st === "walk") {
    const dir = Math.sign((f.vx || 0) * (f.facing || 1)) || 1;
    const ph = frame * 0.32 * dir;
    const s = Math.sin(ph);
    const c = Math.cos(ph);
    const P = { ...B };
    P.hF = 0.12 + 0.5 * s;
    P.hB = 0.12 - 0.5 * s;
    P.kF = -0.2 - 0.65 * Math.max(0, c);
    P.kB = -0.2 - 0.65 * Math.max(0, -c);
    P.sF = B.sF - 0.18 * s;
    P.sB = B.sB + 0.18 * s;
    P.lean = B.lean + 0.06;
    P.dy = -Math.abs(Math.sin(ph)) * 2;
    return P;
  }
  if (st !== "attack") {
    // idle：呼吸起伏的格鬥架式
    const b = Math.sin(frame * 0.12);
    const P = { ...B };
    P.kF -= 0.06 + b * 0.05;
    P.kB -= 0.06 + b * 0.05;
    P.sF += b * 0.04;
    P.sB += b * 0.04;
    if (vis.build === "hooded" || vis.build === "hacker") P.dy = -4 + Math.sin(frame * 0.08) * 3; // 浮游
    return P;
  }

  // ── 攻擊：預備 → 出招 → 收招 ──
  const kind = normKind(f.attackType);
  const dur = Math.max(1, f.attackDuration || 1);
  const t = clamp(1 - (f.stateTimer || 0) / dur, 0, 1);
  const windEnd = kind === "heavy" || kind === "ult" || kind === "skill1" ? 0.32 : 0.2;
  const actEnd = 0.68;
  let A: any = B; // 預備
  let C: any = B; // 出招
  if (kind === "light") {
    if (kicker) {
      A = { sF: 0.9, eF: 1.9, hF: 0.9, kF: -1.6, lean: -0.05 };
      C = { sF: 0.8, eF: 1.9, sB: 0.3, hF: 1.6, kF: -0.05, hB: -0.15, kB: -0.1, lean: -0.22 };
    } else {
      A = { sF: 0.3, eF: 2.0, lean: 0.02, w: blade ? 0.9 : 0 };
      C = { sF: 1.52, eF: 0.06, sB: 0.1, eB: 1.6, lean: 0.2, hF: 0.55, kF: -0.3, w: blade ? -0.1 : 0 };
    }
  } else if (kind === "heavy") {
    if (kicker || fister) {
      A = { hF: 1.0, kF: -1.9, lean: -0.1, sF: 1.0, eF: 1.6 };
      C = { hF: 2.05, kF: -0.12, hB: -0.12, kB: -0.1, lean: -0.32, sF: 0.6, eF: 1.8, sB: 1.2, eB: 1.0 };
    } else {
      A = { sF: 2.95, eF: 0.25, sB: 2.4, eB: 0.6, lean: -0.15, w: 0.85, head: -0.1 };
      C = { sF: 0.35, eF: 0.12, sB: 0.6, eB: 0.9, lean: 0.38, w: 0.05, hF: 0.65, kF: -0.6 };
    }
  } else if (kind === "sweep") {
    A = { hF: 1.1, kF: -2.0, hB: 0.4, kB: -2.1, lean: 0.35 };
    C = { hF: 1.5, kF: -0.04, hB: 0.55, kB: -2.35, lean: 0.42, sF: 1.25, eF: 0.45, sB: 0.4, eB: 1.2, w: blade ? 0.15 : 0 };
  } else if (kind === "skill1") {
    A = { sF: -0.55, eF: 1.55, sB: 0.85, eB: 1.65, lean: -0.1, hF: 0.4 };
    C = { sF: 1.56, eF: 0.0, sB: 1.45, eB: 0.12, lean: 0.22, hF: 0.6, kF: -0.35, hB: -0.4, w: blade ? 0.0 : 0.05 };
  } else if (kind === "skill2") {
    A = { sF: 0.6, eF: 1.8, hF: 0.7, kF: -1.3, lean: 0.2 };
    C = { sF: 3.0, eF: 0.08, sB: 0.15, eB: 1.4, hF: 1.15, kF: -1.55, hB: -0.15, kB: -0.2, lean: -0.12, w: 0.05 };
  } else if (kind === "skill3") {
    if (kicker || fister) {
      A = { hF: 1.1, kF: -1.8, lean: 0.1 };
      C = { hF: 1.58, kF: -0.02, hB: -0.5, kB: -0.4, lean: -0.15, sF: 0.4, eF: 1.8, sB: 1.8, eB: 0.4 };
    } else {
      A = { lean: 0.35, sF: -0.3, eF: 1.0 };
      C = { lean: 0.62, sF: 1.56, eF: 0.0, sB: -0.85, eB: 0.3, hF: 0.95, kF: -1.15, hB: -0.95, kB: -0.5, w: 0.0 };
    }
  } else if (kind === "ult") {
    A = { sF: 2.7, eF: 0.3, sB: 2.5, eB: 0.4, lean: -0.18, head: -0.25, w: blade ? 0.3 : 0 };
    C = blade && vis.weapon !== "staff" && vis.weapon !== "scepter" && vis.weapon !== "code"
      ? { sF: 0.4, eF: 0.1, sB: 0.7, eB: 0.8, lean: 0.42, w: 0.05, hF: 0.75, kF: -0.7 }
      : { sF: 1.56, eF: 0.0, sB: 1.5, eB: 0.1, lean: 0.25, hF: 0.6, kF: -0.4, w: 0.05 };
  }
  const Pa = mix(B, A, 1);
  const Pc = mix(B, C, 1);
  let P;
  if (t < windEnd) P = mix(B, Pa, smooth(t / windEnd));
  else if (t < actEnd) P = mix(Pa, Pc, smooth(Math.min(1, (t - windEnd) / ((actEnd - windEnd) * 0.45))));
  else P = mix(Pc, B, smooth((t - actEnd) / (1 - actEnd)) * 0.75);
  // 旋風腿：快速左右翻轉，看起來像在空中旋轉
  if (kind === "skill3" && fister && t > windEnd && t < 0.9) P.flip = Math.floor(t * 10) % 2 === 1;
  return P;
}

/* ───────────── 3. 角色繪製 ───────────── */

const OUT = "#05080a";

function seg(ctx, x1, y1, x2, y2, w, col, hi = true) {
  ctx.lineCap = "round";
  ctx.strokeStyle = OUT;
  ctx.lineWidth = w + 3;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  if (hi && w > 5) {
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = w * 0.3;
    ctx.beginPath();
    ctx.moveTo(x1 - 1, y1 - 1);
    ctx.lineTo(x2 - 1, y2 - 1);
    ctx.stroke();
  }
}

function poly(ctx, pts, fill, stroke = OUT, lw = 2) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function circ(ctx, x, y, r, fill, stroke = OUT, lw = 2) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

const dirv = (a: number, L: number) => [Math.sin(a) * L, Math.cos(a) * L];

function dims(vis: any) {
  const d = { th: 23, sh: 23, torso: 36, ua: 19, fa: 18, R: 12, armW: 9, legW: 11, hipW: 10, shW: 14 };
  if (vis.build === "goblin") Object.assign(d, { th: 17, sh: 16, torso: 30, ua: 17, fa: 16, R: 14, armW: 7, legW: 9, hipW: 11, shW: 13 });
  if (vis.build === "brute") Object.assign(d, { torso: 38, armW: 12, legW: 13, hipW: 13, shW: 19 });
  if (vis.build === "noble") Object.assign(d, { torso: 40, ua: 21, fa: 20, shW: 15 });
  if (vis.build === "overlord") Object.assign(d, { torso: 40, ua: 21, fa: 20, armW: 12, legW: 13, hipW: 13, shW: 21 });
  if (vis.build === "paladin") Object.assign(d, { shW: 17 });
  if (vis.build === "qipao") Object.assign(d, { th: 25, sh: 24, torso: 33, R: 11, shW: 12, hipW: 10 });
  return d;
}

/**
 * 繪製角色。opts.ghost：殘影（只畫半透明剪影）；opts.portrait：HUD 頭像（不寫回武器尖端座標）
 * 會把武器尖端的畫面座標寫到 f._tip，給引擎噴武器粒子用。
 */
export function drawFighter(ctx: CanvasRenderingContext2D, f: any, frame: number, opts: any = {}) {
  const vis = visualOf(f);
  const d = dims(vis);
  const P = computePose(f, frame, vis);
  const cfg = f.cfg || {};
  const look = weaponLook(f);
  const overclock = !!f.phase2Triggered;
  const flash = f.state === "hit" && (f.stateTimer || 0) % 4 < 2;
  const blink = (f.invincibleTimer || 0) > 0 && f.state !== "ko" && frame % 4 < 2;
  const W = (c: string) => (flash ? "#ffffff" : c);
  const main = overclock && vis.build === "hacker" ? "#ff4d6d" : cfg.color || "#00e5ff";
  const sec = cfg.secondary || "#ffffff";
  const pal = {
    main: W(main),
    dark: W(shade(main, -0.55)),
    light: W(shade(main, 0.3)),
    sec: W(sec),
    skin: W(vis.skin),
    belt: W(cfg.belt || "#111827"),
    metal: W("#cbd5e1"),
    metalD: W("#64748b"),
    flash,
  };

  ctx.save();
  ctx.translate(f.x, f.y);

  // 地面陰影（跳越高越小）
  if (!opts.portrait) {
    const air = clamp((FLOOR - f.y) / 160, 0, 0.7);
    ctx.fillStyle = `rgba(0,0,0,${0.45 * (1 - air)})`;
    ctx.beginPath();
    ctx.ellipse(0, FLOOR - f.y + 4, (vis.scale > 1.05 ? 36 : 28) * (1 - air * 0.5), 7 * (1 - air * 0.5), 0, 0, TAU);
    ctx.fill();
  }

  const face = (f.facing || 1) * (P.flip ? -1 : 1);
  const sc = vis.scale * (cfg.scaleBoost || 1);
  ctx.scale(face * sc, sc);
  if (opts.ghost) ctx.globalAlpha *= opts.alpha ?? 0.35;
  else if (blink) ctx.globalAlpha *= 0.55;

  if (P.lying) {
    ctx.translate(0, -10 * P.lying);
    ctx.rotate((-Math.PI / 2) * P.lying);
    ctx.translate(-6 * P.lying, 0);
  }

  // ── 關節位置（正向運動學）──
  const depth = (h, k) => d.th * Math.cos(h) + d.sh * Math.cos(h + k);
  const hipY = -Math.max(depth(P.hF, P.kF), depth(P.hB, P.kB)) + P.dy;
  const hip = [P.dx, hipY];
  const kF = [hip[0] + dirv(P.hF, d.th)[0], hip[1] + dirv(P.hF, d.th)[1]];
  const fF = [kF[0] + dirv(P.hF + P.kF, d.sh)[0], kF[1] + dirv(P.hF + P.kF, d.sh)[1]];
  const kB = [hip[0] + dirv(P.hB, d.th)[0], hip[1] + dirv(P.hB, d.th)[1]];
  const fB = [kB[0] + dirv(P.hB + P.kB, d.sh)[0], kB[1] + dirv(P.hB + P.kB, d.sh)[1]];
  const up = [Math.sin(P.lean), -Math.cos(P.lean)];
  const nrm = [Math.cos(P.lean), Math.sin(P.lean)];
  const neck = [hip[0] + up[0] * d.torso, hip[1] + up[1] * d.torso];
  const sh = [neck[0] - up[0] * 3, neck[1] - up[1] * 3];
  const ha = P.lean + P.head;
  const head = [neck[0] + Math.sin(ha) * (d.R + 3), neck[1] - Math.cos(ha) * (d.R + 3)];
  const eB = [sh[0] - 3 + dirv(P.sB, d.ua)[0], sh[1] + dirv(P.sB, d.ua)[1]];
  const hB = [eB[0] + dirv(P.sB + P.eB, d.fa)[0], eB[1] + dirv(P.sB + P.eB, d.fa)[1]];
  const eF = [sh[0] + 3 + dirv(P.sF, d.ua)[0], sh[1] + dirv(P.sF, d.ua)[1]];
  const hF = [eF[0] + dirv(P.sF + P.eF, d.fa)[0], eF[1] + dirv(P.sF + P.eF, d.fa)[1]];
  const wAng = P.sF + P.eF + P.w;
  const J = { hip, kF, fF, kB, fB, neck, sh, head, eB, hB, eF, hF, up, nrm, wAng, d };

  // Administrator：駭客代碼矩陣殘影（身後兩道綠色剪影）
  if (vis.build === "hacker" && !opts.ghost && !opts.portrait) {
    ctx.save();
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    for (let k = 1; k <= 2; k++) {
      ctx.globalAlpha = 0.22 / k;
      const ox = -k * 12 - Math.abs(f.vx || 0) * 3 * k;
      ctx.fillStyle = overclock ? "#ff4d6d" : "#00ff88";
      ctx.fillRect(ox - 14, head[1] - 12, 28, -hipY + 12);
      for (let r = 0; r < 7; r++) {
        ctx.fillText(GLYPHS[(frame + r * 7 + k * 3) % GLYPHS.length], ox, head[1] + r * 14);
      }
    }
    ctx.restore();
  }

  ctx.lineJoin = "round";
  drawBackLayer(ctx, J, vis, pal, f, frame, P);

  // 後腳 / 後手
  const legCol = flash ? "#ffffff" : legColor(vis, pal);
  seg(ctx, hip[0], hip[1], kB[0], kB[1], d.legW, shadeCol(legCol, flash));
  seg(ctx, kB[0], kB[1], fB[0], fB[1], d.legW - 1, shadeCol(legCol, flash));
  drawFoot(ctx, fB, vis, pal, true);
  const armCol = flash ? "#ffffff" : armColor(vis, pal);
  seg(ctx, sh[0] - 3, sh[1], eB[0], eB[1], d.armW, shadeCol(armCol, flash));
  seg(ctx, eB[0], eB[1], hB[0], hB[1], d.armW - 1, shadeCol(armCol, flash));
  circ(ctx, hB[0], hB[1], d.armW * 0.55, handColor(vis, pal), OUT, 1.5);

  // 前腳
  seg(ctx, hip[0], hip[1], kF[0], kF[1], d.legW, legCol);
  seg(ctx, kF[0], kF[1], fF[0], fF[1], d.legW - 1, legCol);
  drawFoot(ctx, fF, vis, pal, false);

  drawTorso(ctx, J, vis, pal, f, frame, P);
  drawHead(ctx, J, vis, pal, f, frame);

  // 前手 + 武器
  if (vis.weapon === "greatsword" || vis.weapon === "rapier" || vis.weapon === "club" || vis.weapon === "dagger") {
    drawWeapon(ctx, J, vis, pal, f, frame, look, opts);
    seg(ctx, sh[0] + 3, sh[1], eF[0], eF[1], d.armW, armCol);
    seg(ctx, eF[0], eF[1], hF[0], hF[1], d.armW - 1, armCol);
    circ(ctx, hF[0], hF[1], d.armW * 0.6, handColor(vis, pal), OUT, 1.5);
  } else {
    seg(ctx, sh[0] + 3, sh[1], eF[0], eF[1], d.armW, armCol);
    seg(ctx, eF[0], eF[1], hF[0], hF[1], d.armW - 1, armCol);
    drawWeapon(ctx, J, vis, pal, f, frame, look, opts);
    circ(ctx, hF[0], hF[1], d.armW * 0.6, handColor(vis, pal), OUT, 1.5);
  }
  drawShoulderPiece(ctx, J, vis, pal);

  // 格擋：六角護盾
  if (f.state === "block" && !opts.ghost) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(0,229,255,0.85)";
    ctx.fillStyle = "rgba(0,229,255,0.16)";
    ctx.lineWidth = 2;
    const cx = 26;
    const cy = hipY + 10;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 6;
      const px = cx + Math.cos(a) * 18;
      const py = cy + Math.sin(a) * 40;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function shadeCol(c: string, flash: boolean) {
  return flash ? "#ffffff" : c[0] === "#" ? shade(c, -0.22) : c;
}

function legColor(vis, pal) {
  switch (vis.build) {
    case "knight": return pal.metalD;
    case "robe": return pal.dark;
    case "vestment": return "#e7e5e4";
    case "gi": return pal.main;
    case "qipao": return pal.dark;
    case "brute": return "#5b4636";
    case "goblin": return pal.skin;
    case "noble": return "#1c0a10";
    case "hooded": return "#0b1220";
    case "paladin": return "#d4a017";
    case "overlord": return "#2e1065";
    case "hacker": return "#111a15";
    default: return pal.main;
  }
}
function armColor(vis, pal) {
  switch (vis.build) {
    case "knight": return pal.metal;
    case "robe": return pal.main;
    case "vestment": return "#f5f5f4";
    case "gi": return pal.skin;
    case "qipao": return pal.main;
    case "brute": return pal.skin;
    case "goblin": return pal.skin;
    case "noble": return pal.main;
    case "hooded": return "#16213a";
    case "paladin": return "#eab308";
    case "overlord": return "#4c1d95";
    case "hacker": return "#16201b";
    default: return pal.skin;
  }
}
function handColor(vis, pal) {
  if (vis.build === "knight" || vis.build === "paladin") return pal.metal;
  if (vis.build === "hacker") return pal.main;
  if (vis.build === "hooded") return "#a5f3fc";
  if (vis.build === "noble") return "#f5f5f4";
  if (vis.build === "overlord") return "#1e1b4b";
  return pal.skin;
}

function drawFoot(ctx, ft, vis, pal, back) {
  const col = vis.build === "goblin" ? pal.skin : vis.build === "gi" || vis.build === "qipao" ? (vis.build === "qipao" ? "#f5f5f4" : pal.skin) : "#1f1a17";
  ctx.lineCap = "round";
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(ft[0] - 2, ft[1]);
  ctx.lineTo(ft[0] + 8, ft[1] + 1);
  ctx.stroke();
  ctx.strokeStyle = back ? shade(col[0] === "#" ? col : "#333333", -0.2) : col;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(ft[0] - 2, ft[1]);
  ctx.lineTo(ft[0] + 8, ft[1] + 1);
  ctx.stroke();
}

/* 背後配件：披風、翅膀、光環、浮游魔導書 */
function drawBackLayer(ctx, J, vis, pal, f, frame, P) {
  const { sh, hip, head, d, nrm } = J;
  const sway = Math.sin(frame * 0.15) * 4;
  const drag = clamp(-(f.vx || 0) * (f.facing || 1) * 2.2, -6, 14);
  const backSh = [sh[0] - nrm[0] * 9, sh[1] - nrm[1] * 9];

  // 披風（戰士、公爵、魔王、天空之主）
  if (vis.build === "knight" || vis.build === "noble" || vis.build === "overlord") {
    const len = vis.build === "noble" ? 82 : 66;
    const col = vis.build === "noble" ? "#7f1d1d" : vis.build === "overlord" ? "#1e0b3b" : shade(f.cfg?.color || "#991b1b", -0.35);
    const lining = vis.build === "noble" ? "#fbbf24" : vis.build === "overlord" ? "#a855f7" : "#fde68a";
    ctx.beginPath();
    ctx.moveTo(backSh[0] + 4, backSh[1] - 2);
    ctx.quadraticCurveTo(backSh[0] - 26 - drag, backSh[1] + len * 0.5 + sway, backSh[0] - 30 - drag * 1.4, backSh[1] + len + sway);
    ctx.lineTo(backSh[0] - 8 - drag * 0.6, backSh[1] + len + 6 - sway);
    ctx.quadraticCurveTo(backSh[0] - 6, backSh[1] + len * 0.5, backSh[0] + 10, backSh[1] + 6);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = lining;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // 惡魔雙翼（公爵）
  if (vis.build === "noble") {
    const flap = Math.sin(frame * 0.17) * 0.25;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(backSh[0] + side * 2, backSh[1] + 4);
      ctx.rotate(-0.5 + flap * side);
      ctx.scale(side === 1 ? 0.85 : 1, 1);
      const col = side === 1 ? "#3f0a1a" : "#5b0b24";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-30, -44);
      ctx.lineTo(-62, -34);
      ctx.quadraticCurveTo(-54, -18, -66, -6);
      ctx.quadraticCurveTo(-48, -6, -48, 8);
      ctx.quadraticCurveTo(-30, 2, -24, 18);
      ctx.quadraticCurveTo(-14, 6, 0, 10);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = "#e11d48";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = "#1c0309";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(-62, -34);
      ctx.moveTo(-30, -44); ctx.lineTo(-66, -6);
      ctx.moveTo(-30, -44); ctx.lineTo(-48, 8);
      ctx.moveTo(-30, -44); ctx.lineTo(-24, 18);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 天使羽翼（天光島嶼之主）
  if (vis.build === "paladin") {
    const flap = Math.sin(frame * 0.14) * 0.18;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(backSh[0], backSh[1] + 2);
      ctx.rotate(-0.35 + flap * side);
      ctx.scale(side === 1 ? 0.85 : 1, 1);
      for (let row = 0; row < 3; row++) {
        for (let i = 0; i < 6 - row; i++) {
          const a = -0.9 + i * 0.32;
          const L = 62 - row * 16 - i * 3;
          ctx.save();
          ctx.rotate(a - Math.PI / 2);
          ctx.beginPath();
          ctx.ellipse(-L * 0.5, 0, L * 0.5, 6 - row, 0, 0, TAU);
          ctx.fillStyle = row === 0 ? "#fffbeb" : row === 1 ? "#fde68a" : "#fbbf24";
          ctx.fill();
          ctx.strokeStyle = "#b45309";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
        }
      }
      ctx.restore();
    }
  }

  // 光環（牧師、天空之主）
  if (vis.build === "vestment" || vis.build === "paladin") {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const hx = head[0] - 6;
    const hy = head[1] - 2;
    const g = ctx.createRadialGradient(hx, hy, 6, hx, hy, 30);
    g.addColorStop(0, "rgba(255,240,170,0.35)");
    g.addColorStop(1, "rgba(255,214,10,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(hx, hy, 30, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#ffd60a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(hx, hy, 19 + Math.sin(frame * 0.1), 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = frame * 0.03 + (i / 6) * TAU;
      ctx.fillStyle = "#fff7ae";
      ctx.fillRect(hx + Math.cos(a) * 19 - 1.5, hy + Math.sin(a) * 19 - 1.5, 3, 3);
    }
    ctx.restore();
  }

  // 浮游魔導書（法師）
  if (vis.build === "robe") {
    const bx = head[0] - 30;
    const by = head[1] - 6 + Math.sin(frame * 0.09) * 5;
    const open = 0.55 + Math.sin(frame * 0.12) * 0.25;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(-0.15);
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
    g.addColorStop(0, "rgba(167,139,250,0.5)");
    g.addColorStop(1, "rgba(167,139,250,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(s * 13 * open + s * 2, -10);
      ctx.lineTo(s * 13 * open + s * 2, 8);
      ctx.lineTo(0, 8);
      ctx.closePath();
      ctx.fillStyle = s < 0 ? "#ede9fe" : "#f5f3ff";
      ctx.fill();
      ctx.strokeStyle = "#4c1d95";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = "#7c3aed";
    ctx.fillRect(-1, -9, 2, 18);
    ctx.fillStyle = "#a78bfa";
    ctx.font = "bold 7px monospace";
    ctx.textAlign = "center";
    ctx.fillText("✦", -6 * open, 2);
    ctx.fillText("ᚱ", 6 * open, 2);
    ctx.restore();
  }

  // 冥盡洞主：身後冰晶冠光
  if (vis.build === "hooded") {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.42;
      const L = 30 + (i % 2) * 10;
      ctx.fillStyle = "rgba(125,211,252,0.35)";
      ctx.beginPath();
      ctx.moveTo(head[0] + Math.cos(a - 0.08) * 12, head[1] + Math.sin(a - 0.08) * 12);
      ctx.lineTo(head[0] + Math.cos(a) * L, head[1] + Math.sin(a) * L);
      ctx.lineTo(head[0] + Math.cos(a + 0.08) * 12, head[1] + Math.sin(a + 0.08) * 12);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawTorso(ctx, J, vis, pal, f, frame, P) {
  const { hip, sh, nrm, up, d, fF, fB } = J;
  const hw = d.hipW;
  const sw = d.shW;
  const quad = [
    [hip[0] - nrm[0] * hw, hip[1] - nrm[1] * hw],
    [hip[0] + nrm[0] * hw, hip[1] + nrm[1] * hw],
    [sh[0] + nrm[0] * sw, sh[1] + nrm[1] * sw],
    [sh[0] - nrm[0] * sw, sh[1] - nrm[1] * sw],
  ];
  const sway = Math.sin(frame * 0.16) * 3 + clamp(-(f.vx || 0) * (f.facing || 1), -4, 4);
  const lowY = Math.max(fF[1], fB[1]) - 4;

  // 長袍下襬（法師、牧師、冥盡洞主、公爵大衣）
  const robe = { robe: pal.dark, vestment: "#f5f5f4", hooded: "#0f1a33", noble: "#4c0519" }[vis.build];
  if (robe) {
    const len = vis.build === "noble" ? (lowY - hip[1]) * 0.75 : lowY - hip[1];
    const top = [hip[0], hip[1] - 2];
    const pts = [
      [top[0] - hw - 1, top[1]],
      [top[0] + hw + 1, top[1]],
      [Math.max(fF[0], top[0]) + 10 + sway * 0.4, top[1] + len],
    ];
    const hemN = vis.build === "hooded" ? 7 : 4;
    const leftX = Math.min(fB[0], top[0]) - 12 + sway;
    const rightX = pts[2][0];
    for (let i = 1; i < hemN; i++) {
      const x = lerp(rightX, leftX, i / hemN);
      const jag = vis.build === "hooded" ? (i % 2 ? 10 : 0) + Math.sin(frame * 0.2 + i) * 3 : Math.sin(frame * 0.18 + i) * 2;
      pts.push([x, top[1] + len - jag]);
    }
    pts.push([leftX, top[1] + len]);
    const grad = ctx.createLinearGradient(0, top[1], 0, top[1] + len);
    grad.addColorStop(0, robe);
    grad.addColorStop(1, shade(robe[0] === "#" ? robe : "#333333", -0.35));
    poly(ctx, pts, pal.flash ? "#ffffff" : grad);
    if (vis.build === "vestment") {
      // 聖職者披帶
      ctx.fillStyle = pal.main;
      ctx.fillRect(top[0] + 3, top[1], 6, len - 4);
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(top[0] + 3, top[1] + len - 10, 6, 3);
    }
    if (vis.build === "robe") {
      ctx.fillStyle = "#fde68a";
      ctx.font = "bold 8px serif";
      ctx.textAlign = "center";
      for (let i = 0; i < 3; i++) ctx.fillText("✦", top[0] - 6 + i * 6, top[1] + len * (0.4 + i * 0.18));
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pts[pts.length - 1][0], pts[pts.length - 1][1] - 3);
      ctx.lineTo(pts[2][0], pts[2][1] - 3);
      ctx.stroke();
    }
  }

  // 軀幹主體
  const torsoCol = {
    knight: pal.metal, robe: pal.main, vestment: "#fafaf9", gi: pal.main, qipao: pal.main,
    brute: "#6b4f3a", goblin: pal.skin, noble: pal.main, hooded: "#16213a", paladin: "#facc15",
    overlord: "#3b0764", hacker: "#121a16",
  }[vis.build] || pal.main;
  const g = ctx.createLinearGradient(quad[0][0], 0, quad[1][0] + 6, 0);
  g.addColorStop(0, shade(torsoCol[0] === "#" ? torsoCol : "#888888", -0.25));
  g.addColorStop(1, torsoCol[0] === "#" ? shade(torsoCol, 0.12) : torsoCol);
  poly(ctx, quad, pal.flash ? "#ffffff" : g);

  const mid = [(hip[0] + sh[0]) / 2, (hip[1] + sh[1]) / 2];
  ctx.save();
  switch (vis.build) {
    case "knight": {
      // 胸甲 + 職業色外袍
      poly(ctx, [
        [sh[0] - nrm[0] * 6, sh[1] + 4], [sh[0] + nrm[0] * 12, sh[1] + 4],
        [mid[0] + nrm[0] * 10, mid[1] + 6], [hip[0] + nrm[0] * 6, hip[1] - 4], [hip[0] - nrm[0] * 6, hip[1] - 4],
      ], pal.main, OUT, 1.5);
      ctx.fillStyle = "#fde68a";
      ctx.fillRect(mid[0] - 2, mid[1] - 8, 4, 14);
      ctx.fillRect(mid[0] - 6, mid[1] - 4, 12, 3);
      break;
    }
    case "gi": {
      // 道服 V 領 + 腰帶
      poly(ctx, [[sh[0], sh[1] + 2], [sh[0] + nrm[0] * 12, sh[1] + 2], [mid[0] + nrm[0] * 3, mid[1] + 4]], pal.skin, null);
      break;
    }
    case "qipao": {
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(sh[0] - 2, sh[1] + 2, 3, 26);
      circ(ctx, sh[0] + 4, sh[1] + 9, 2, "#fbbf24", null);
      circ(ctx, sh[0] + 4, sh[1] + 17, 2, "#fbbf24", null);
      break;
    }
    case "brute": {
      // 皮甲交叉綁帶
      ctx.strokeStyle = "#2b1d14";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sh[0] - sw + 4, sh[1] + 2);
      ctx.lineTo(hip[0] + hw - 2, hip[1] - 4);
      ctx.moveTo(sh[0] + sw - 4, sh[1] + 2);
      ctx.lineTo(hip[0] - hw + 2, hip[1] - 4);
      ctx.stroke();
      circ(ctx, mid[0], mid[1], 4, "#9ca3af", OUT, 1.5);
      break;
    }
    case "goblin": {
      // 肚子 + 纏腰布
      ctx.fillStyle = shade(pal.skin[0] === "#" ? pal.skin : "#4ade80", 0.25);
      ctx.beginPath();
      ctx.ellipse(mid[0] + 4, mid[1] + 4, 7, 9, 0, 0, TAU);
      ctx.fill();
      poly(ctx, [[hip[0] - hw, hip[1] - 2], [hip[0] + hw + 2, hip[1] - 2], [hip[0] + 6, hip[1] + 16 + sway * 0.5], [hip[0] - 4, hip[1] + 14]], "#7c4a1e");
      break;
    }
    case "noble": {
      // 金色鑲邊 + 高領
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sh[0] + nrm[0] * 6, sh[1] + 2);
      ctx.lineTo(hip[0] + nrm[0] * 4, hip[1]);
      ctx.stroke();
      for (let i = 0; i < 3; i++) circ(ctx, sh[0] + nrm[0] * 9, sh[1] + 8 + i * 9, 1.8, "#fbbf24", null);
      poly(ctx, [[sh[0] - 10, sh[1] + 2], [sh[0] - 14, sh[1] - 22], [sh[0] - 2, sh[1] - 6]], "#2a0611", "#e11d48", 1.5);
      break;
    }
    case "hooded": {
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sh[0] + 2, sh[1] + 4);
      ctx.lineTo(hip[0] + 4, hip[1]);
      ctx.stroke();
      ctx.fillStyle = "#67e8f9";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("ᛟ", mid[0] + 3, mid[1] + 3);
      break;
    }
    case "paladin": {
      poly(ctx, [[sh[0] - 4, sh[1] + 4], [sh[0] + nrm[0] * 14, sh[1] + 4], [hip[0] + nrm[0] * 6, hip[1] - 6], [hip[0] - 4, hip[1] - 6]], "#fef3c7", "#b45309", 1.5);
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(mid[0] + 3, mid[1] - 2, 4, 0, TAU);
      ctx.fill();
      break;
    }
    case "overlord": {
      // 發光程式碼紋路
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(0,255,136,${0.5 + Math.sin(frame * 0.2) * 0.3})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sh[0] - 6, sh[1] + 6);
      ctx.lineTo(mid[0], mid[1]);
      ctx.lineTo(mid[0] + 8, mid[1]);
      ctx.lineTo(hip[0] + 4, hip[1] - 6);
      ctx.stroke();
      ctx.fillStyle = "#00ff88";
      ctx.font = "bold 8px monospace";
      ctx.fillText("0xDEAD", mid[0] - 12, mid[1] + 12);
      break;
    }
    case "hacker": {
      ctx.strokeStyle = pal.main;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sh[0] + nrm[0] * 6, sh[1] + 4);
      ctx.lineTo(hip[0] + nrm[0] * 6, hip[1] - 2);
      ctx.stroke();
      ctx.fillStyle = pal.main;
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.fillText("</>", mid[0] + 2, mid[1] + 4);
      break;
    }
  }
  ctx.restore();

  // 腰帶
  if (vis.build === "gi" || vis.build === "knight" || vis.build === "brute" || vis.build === "qipao") {
    const by = hip[1] - 4;
    ctx.fillStyle = vis.build === "knight" ? "#7c2d12" : pal.belt;
    ctx.fillRect(hip[0] - hw - 2, by, hw * 2 + 4, 6);
    if (vis.build === "gi") {
      ctx.strokeStyle = pal.belt;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(hip[0] - hw, by + 3);
      ctx.lineTo(hip[0] - hw - 10 - sway, by + 16);
      ctx.moveTo(hip[0] - hw, by + 3);
      ctx.lineTo(hip[0] - hw - 6 - sway * 0.6, by + 18);
      ctx.stroke();
    }
  }
}

function drawShoulderPiece(ctx, J, vis, pal) {
  const { sh } = J;
  if (vis.build === "knight" || vis.build === "paladin") {
    ctx.beginPath();
    ctx.ellipse(sh[0] + 4, sh[1] + 3, 10, 8, -0.3, 0, TAU);
    ctx.fillStyle = vis.build === "paladin" ? "#fde047" : pal.metal;
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = vis.build === "paladin" ? "#b45309" : pal.main;
    ctx.fillRect(sh[0], sh[1] + 1, 9, 2);
  } else if (vis.build === "overlord" || vis.build === "brute") {
    ctx.beginPath();
    ctx.ellipse(sh[0] + 4, sh[1] + 3, 12, 9, -0.3, 0, TAU);
    ctx.fillStyle = vis.build === "overlord" ? "#2e1065" : "#57534e";
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      poly(ctx, [[sh[0] - 4 + i * 6, sh[1] - 3], [sh[0] - 1 + i * 6, sh[1] - 14 + i], [sh[0] + 2 + i * 6, sh[1] - 3]], "#d6d3d1", OUT, 1);
    }
  } else if (vis.build === "noble") {
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(sh[0] - 4, sh[1] - 1, 14, 4);
    for (let i = 0; i < 4; i++) ctx.fillRect(sh[0] - 3 + i * 4, sh[1] + 3, 1.5, 6);
  }
}

function drawHead(ctx, J, vis, pal, f, frame) {
  const { head, d } = J;
  const [x, y] = head;
  const R = d.R;
  const overclock = !!f.phase2Triggered;
  const eyeCol = (f.cfg?.secondary as string) || "#00e5ff";

  // 冥盡洞主：兜帽遮臉
  if (vis.build === "hooded") {
    poly(ctx, [[x - R - 4, y + R], [x - R - 2, y - 4], [x - 2, y - R - 12], [x + R + 2, y - 2], [x + R + 3, y + R]], "#101b33");
    ctx.fillStyle = "#020617";
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 2, R * 0.7, R * 0.8, 0, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "#67e8f9";
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 10;
    ctx.fillRect(x + 2, y, 4, 2.5);
    ctx.fillRect(x + 8, y, 4, 2.5);
    ctx.restore();
    // 冰之王冠
    for (let i = 0; i < 4; i++) {
      poly(ctx, [[x - 8 + i * 5, y - R - 4], [x - 6 + i * 5, y - R - 16 - (i % 2) * 6], [x - 4 + i * 5, y - R - 4]], "#a5f3fc", "#0e7490", 1);
    }
    return;
  }
  // Administrator：連帽 + 螢幕臉
  if (vis.build === "hacker") {
    poly(ctx, [[x - R - 3, y + R + 2], [x - R - 2, y - 6], [x - 2, y - R - 7], [x + R + 3, y - 4], [x + R + 4, y + R + 2]], "#0d1511", pal.main, 1.5);
    ctx.fillStyle = "#010604";
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 1, R * 0.75, R * 0.8, 0, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const scan = Math.sin(frame * 0.2) * 5;
    ctx.fillStyle = overclock ? "#ff4d6d" : "#ff4d6d";
    ctx.shadowColor = "#ff4d6d";
    ctx.shadowBlur = 12;
    ctx.fillRect(x - 4, y - 1, 16, 3);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 4 + scan, y - 1, 3, 3);
    ctx.restore();
    // 頭頂浮游程式碼環
    ctx.save();
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "center";
    for (let i = 0; i < 8; i++) {
      const a = frame * 0.04 + (i / 8) * TAU;
      const px = x + Math.cos(a) * 22;
      const py = y - 6 + Math.sin(a) * 7;
      ctx.globalAlpha = 0.45 + Math.sin(a) * 0.35;
      ctx.fillStyle = overclock ? "#ff4d6d" : "#00ff88";
      ctx.fillText(GLYPHS[(i * 5 + Math.floor(frame / 6)) % GLYPHS.length], px, py);
    }
    ctx.restore();
    return;
  }

  // 一般頭部
  const skin = pal.skin;
  circ(ctx, x, y, R, skin);
  // 下顎陰影
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.beginPath();
  ctx.arc(x, y, R - 1, 0.2, Math.PI - 0.2);
  ctx.fill();

  // 眼睛
  const eyeY = y - 1;
  const eye = (ex, w = 4, col = "#0b0f14") => {
    ctx.fillStyle = col;
    ctx.fillRect(ex, eyeY - 1.5, w, 3);
  };
  if (vis.build === "goblin") {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "#facc15";
    ctx.fillRect(x + 3, eyeY - 3, 5, 4);
    ctx.restore();
    // 大鼻子 + 獠牙笑
    poly(ctx, [[x + R - 3, y - 1], [x + R + 7, y + 4], [x + R - 3, y + 5]], shade("#4ade80", -0.1), OUT, 1.5);
    ctx.fillStyle = "#1c1917";
    ctx.fillRect(x + 1, y + 6, 9, 3);
    ctx.fillStyle = "#fefce8";
    ctx.fillRect(x + 3, y + 6, 2, 3);
    ctx.fillRect(x + 7, y + 6, 2, 3);
    // 長耳朵
    for (const s of [0, 1]) {
      poly(ctx, [[x - 4 - s * 3, y - 4], [x - R - 16 - s * 4, y - 14 - s * 3], [x - 6 - s * 3, y + 3]], s ? shade("#4ade80", -0.25) : "#4ade80");
    }
  } else if (vis.build === "noble") {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "#ff1744";
    ctx.shadowColor = "#ff1744";
    ctx.shadowBlur = 8;
    ctx.fillRect(x + 3, eyeY - 1.5, 5, 2.5);
    ctx.restore();
    ctx.fillStyle = "#1c1917";
    ctx.beginPath();
    ctx.arc(x - 2, y - 4, R - 1, Math.PI * 0.95, Math.PI * 1.9);
    ctx.fill();
  } else if (vis.build === "brute") {
    eye(x + 4, 4, "#ef4444");
    ctx.fillStyle = "#fefce8";
    poly(ctx, [[x + 4, y + 7], [x + 5, y + 2], [x + 7, y + 7]], "#fefce8", OUT, 1);
  } else if (vis.build === "overlord") {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "#00ff88";
    ctx.shadowColor = "#00ff88";
    ctx.shadowBlur = 8;
    ctx.fillRect(x + 2, eyeY - 1.5, 9, 3);
    ctx.restore();
  } else {
    eye(x + 5, 3.5);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x + 4, eyeY - 4, 6, 1.5);
  }

  // 頭飾 / 頭盔 / 髮型
  switch (vis.build) {
    case "knight": {
      // 騎士頭盔 + 翎羽
      ctx.beginPath();
      ctx.arc(x, y - 1, R + 2, Math.PI * 0.95, Math.PI * 2.15);
      ctx.lineTo(x + R + 2, y + 5);
      ctx.lineTo(x - R - 1, y + 5);
      ctx.closePath();
      ctx.fillStyle = pal.metal;
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#0b0f14";
      ctx.fillRect(x + 1, y - 2, R + 1, 3.5);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = eyeCol;
      ctx.fillRect(x + 5, y - 1.5, 4, 2);
      ctx.restore();
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x + 4 + i * 3, y + 2);
        ctx.lineTo(x + 4 + i * 3, y + 5);
        ctx.stroke();
      }
      const plume = Math.sin(frame * 0.2) * 3;
      ctx.beginPath();
      ctx.moveTo(x - 2, y - R - 1);
      ctx.quadraticCurveTo(x - 14, y - R - 14 + plume, x - 28, y - R - 2 + plume);
      ctx.quadraticCurveTo(x - 16, y - R - 4, x - 2, y - R + 4);
      ctx.closePath();
      ctx.fillStyle = pal.main;
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
    case "robe": {
      // 巫師帽
      const tip = Math.sin(frame * 0.12) * 3;
      ctx.beginPath();
      ctx.ellipse(x, y - R + 3, R + 11, 4.5, -0.05, 0, TAU);
      ctx.fillStyle = "#3b0764";
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - R + 1, y - R + 2);
      ctx.quadraticCurveTo(x - 2, y - R - 26, x - 18 + tip, y - R - 32);
      ctx.quadraticCurveTo(x + 4, y - R - 18, x + R - 1, y - R + 2);
      ctx.closePath();
      ctx.fillStyle = "#4c1d95";
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(x - R + 2, y - R - 2, R * 2 - 4, 3);
      ctx.fillStyle = "#fde68a";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("★", x - 3, y - R - 9);
      break;
    }
    case "vestment": {
      // 白色兜帽 + 金色頭環
      ctx.beginPath();
      ctx.arc(x - 1, y - 1, R + 2, Math.PI * 0.85, Math.PI * 1.75);
      ctx.lineTo(x - 2, y + R);
      ctx.closePath();
      ctx.fillStyle = "#f5f5f4";
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y - 1, R, Math.PI * 1.15, Math.PI * 1.95);
      ctx.stroke();
      circ(ctx, x + 2, y - R + 1, 2.5, "#38bdf8", OUT, 1);
      break;
    }
    case "gi": {
      // 頭帶 / 頭髮
      const hair = vis.hair || "#1c1209";
      if (hair === "#facc15") {
        poly(ctx, [[x - R, y - 2], [x - R - 6, y - 12], [x - 6, y - R - 2], [x - 2, y - R - 10], [x + 4, y - R - 3], [x + 10, y - R - 7], [x + R, y - 4]], hair);
      } else {
        ctx.beginPath();
        ctx.arc(x - 1, y - 2, R, Math.PI * 1.0, Math.PI * 1.85);
        ctx.fillStyle = hair;
        ctx.fill();
      }
      const hb = f.cfg?.headband || "#ef4444";
      ctx.fillStyle = hb;
      ctx.fillRect(x - R, y - 7, R * 2, 4.5);
      const tw = Math.sin(frame * 0.25) * 4;
      ctx.beginPath();
      ctx.moveTo(x - R, y - 6);
      ctx.quadraticCurveTo(x - R - 10, y - 8 + tw, x - R - 20, y - 2 + tw);
      ctx.lineTo(x - R - 17, y + 1 + tw);
      ctx.quadraticCurveTo(x - R - 9, y - 3, x - R, y - 3);
      ctx.fill();
      break;
    }
    case "qipao": {
      // 雙包頭
      ctx.beginPath();
      ctx.arc(x - 1, y - 2, R, Math.PI * 1.0, Math.PI * 1.9);
      ctx.fillStyle = vis.hair;
      ctx.fill();
      for (const bx of [x - 9, x + 6]) {
        circ(ctx, bx, y - R - 1, 6, vis.hair);
        ctx.fillStyle = "#f5f5f4";
        ctx.fillRect(bx - 6, y - R + 1, 12, 3);
      }
      const rib = Math.sin(frame * 0.2) * 3;
      ctx.strokeStyle = f.cfg?.headband || "#00e5ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 12, y - R);
      ctx.lineTo(x - 22, y - R + 10 + rib);
      ctx.stroke();
      break;
    }
    case "brute": {
      // 尖刺牛角頭盔
      ctx.beginPath();
      ctx.arc(x, y - 1, R + 1, Math.PI, TAU);
      ctx.fillStyle = "#57534e";
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#292524";
      ctx.fillRect(x - R - 1, y - 3, R * 2 + 2, 3);
      poly(ctx, [[x - 7, y - R + 1], [x - 18, y - R - 14], [x - 3, y - R - 2]], "#e7e5e4");
      poly(ctx, [[x + 5, y - R + 1], [x + 14, y - R - 15], [x + 9, y - R - 1]], "#e7e5e4");
      break;
    }
    case "noble": {
      // 惡魔捲角
      for (const s of [-1, 1]) {
        ctx.strokeStyle = "#fde047";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x + s * 4, y - R + 3);
        ctx.quadraticCurveTo(x + s * 14, y - R - 8, x + s * 6 - 6, y - R - 20);
        ctx.stroke();
      }
      break;
    }
    case "paladin": {
      // 羽翼頭盔
      ctx.beginPath();
      ctx.arc(x, y - 1, R + 2, Math.PI * 0.95, Math.PI * 2.1);
      ctx.lineTo(x + R, y + 4);
      ctx.closePath();
      ctx.fillStyle = "#facc15";
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#0b0f14";
      ctx.fillRect(x + 2, y - 2, R - 1, 3);
      poly(ctx, [[x - 6, y - R + 2], [x - 22, y - R - 12], [x - 18, y - R - 2], [x - 26, y - R + 2], [x - 8, y - R + 6]], "#fffbeb", "#b45309", 1.5);
      break;
    }
    case "overlord": {
      // 巨大捲角 + 王冠
      for (const s of [-1, 1]) {
        ctx.strokeStyle = "#1e1b4b";
        ctx.lineWidth = 7;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x + s * 5, y - R + 3);
        ctx.bezierCurveTo(x + s * 26, y - R - 4, x + s * 26, y - R - 26, x + s * 10, y - R - 30);
        ctx.stroke();
        ctx.strokeStyle = "#a78bfa";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.fillStyle = "#fbbf24";
      poly(ctx, [[x - 9, y - R + 2], [x - 9, y - R - 8], [x - 4, y - R - 3], [x, y - R - 10], [x + 4, y - R - 3], [x + 9, y - R - 8], [x + 9, y - R + 2]], "#fbbf24", OUT, 1.5);
      break;
    }
  }
}

/* 武器：依職業與武器等級變化外觀（劍身顏色、光暈、符文、雷電、火焰…） */
function drawWeapon(ctx, J, vis, pal, f, frame, look, opts) {
  const { hF, wAng } = J;
  const tier = clamp(f.weaponTier || 0, 0, 3);
  const plus = clamp(f.weaponPlus || 0, 0, 3);
  const attacking = f.state === "attack";
  let tipLocal = null;

  ctx.save();
  ctx.translate(hF[0], hF[1]);
  // 武器方向：angle 0 = 朝下，往前為正 → 轉成 canvas 旋轉角
  ctx.rotate(-wAng + Math.PI / 2);
  // 現在 +x 方向就是武器延伸方向

  const glowOn = look && look.glow && !opts.ghost;
  // 裝備的最高稀有度會在武器外圈再加一層光暈
  if (f.rarityGlow && RARITY_GLOW[f.rarityGlow] && !opts.ghost) {
    const rc = RARITY_GLOW[f.rarityGlow];
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.35 + Math.sin(frame * 0.15) * 0.15;
    ctx.shadowColor = rc;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = rc;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(26, 0, 34, 9, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  const glowA = 0.35 + plus * 0.15 + (attacking ? 0.25 : 0);
  const blade = (len, wid, col, edge) => {
    ctx.beginPath();
    ctx.moveTo(4, -wid / 2);
    ctx.lineTo(len - 8, -wid / 2);
    ctx.lineTo(len, 0);
    ctx.lineTo(len - 8, wid / 2);
    ctx.lineTo(4, wid / 2);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(6, -wid / 2 + 1.5);
    ctx.lineTo(len - 8, -wid / 2 + 1.5);
    ctx.lineTo(len - 2, 0);
    ctx.stroke();
  };
  const aura = (len, wid, col) => {
    if (!glowOn) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = glowA;
    ctx.shadowColor = col;
    ctx.shadowBlur = 14 + plus * 4;
    ctx.fillStyle = rgba(col, 0.55);
    ctx.beginPath();
    ctx.ellipse(len / 2, 0, len / 2 + 4, wid / 2 + 4 + plus, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  };

  switch (vis.weapon) {
    case "greatsword": {
      const L = 50 + tier * 4;
      aura(L, 12, look.glow || "#ffffff");
      // 劍柄 + 護手
      ctx.fillStyle = look.hilt;
      ctx.fillRect(-10, -2.5, 14, 5);
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(2, -9, 4, 18);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(2, -9, 4, 18);
      blade(L, 10 + (tier >= 2 ? 2 : 0), look.blade, look.edge);
      if (tier === 2 && !opts.ghost) {
        // 日蝕：劍身中央的熔岩紋
        ctx.strokeStyle = `rgba(255,120,0,${0.6 + Math.sin(frame * 0.3) * 0.3})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        for (let i = 1; i <= 5; i++) ctx.lineTo(8 + i * ((L - 14) / 5), (i % 2 ? -2 : 2));
        ctx.stroke();
      }
      if (tier === 3 && !opts.ghost) {
        ctx.fillStyle = "#00ff88";
        ctx.font = "bold 7px monospace";
        for (let i = 0; i < 5; i++) ctx.fillText(GLYPHS[(frame + i * 3) % GLYPHS.length], 8 + i * 8, 3);
      }
      tipLocal = [L, 0];
      break;
    }
    case "rapier": {
      const L = 60;
      aura(L, 6, "#ff1744");
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(2, 0, 7, -1.4, 1.4);
      ctx.stroke();
      blade(L, 5, "#be123c", "#fecdd3");
      tipLocal = [L, 0];
      break;
    }
    case "club": {
      ctx.beginPath();
      ctx.moveTo(-6, -3);
      ctx.lineTo(38, -8);
      ctx.lineTo(42, 0);
      ctx.lineTo(38, 8);
      ctx.lineTo(-6, 3);
      ctx.closePath();
      ctx.fillStyle = "#7c4a1e";
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const x = 18 + i * 6;
        poly(ctx, [[x, -6], [x + 2, -12], [x + 4, -6]], "#d6d3d1", OUT, 1);
        poly(ctx, [[x, 6], [x + 2, 12], [x + 4, 6]], "#d6d3d1", OUT, 1);
      }
      tipLocal = [42, 0];
      break;
    }
    case "dagger": {
      ctx.beginPath();
      ctx.moveTo(2, -3);
      ctx.quadraticCurveTo(16, -8, 26, -2);
      ctx.quadraticCurveTo(16, 1, 2, 3);
      ctx.closePath();
      ctx.fillStyle = "#d4d4d8";
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#65a30d";
      ctx.fillRect(10, -1, 10, 2);
      ctx.fillStyle = "#78350f";
      ctx.fillRect(-6, -2, 8, 4);
      tipLocal = [26, -2];
      break;
    }
    case "staff": {
      const L = 54;
      ctx.lineCap = "round";
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.lineTo(L, 0);
      ctx.stroke();
      ctx.strokeStyle = look.shaft;
      ctx.lineWidth = 3.5;
      ctx.stroke();
      // 杖頭：彎鉤托住法珠
      ctx.strokeStyle = tier >= 2 ? "#fbbf24" : look.shaft;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(L + 6, 0, 8, Math.PI * 0.7, Math.PI * 1.3, true);
      ctx.stroke();
      const r = 6 + tier * 1.2 + plus * 0.5;
      if (glowOn) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createRadialGradient(L + 7, 0, 1, L + 7, 0, r * 3.2);
        g.addColorStop(0, rgba(look.glow, 0.9));
        g.addColorStop(1, rgba(look.glow, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(L + 7, 0, r * 3.2, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      circ(ctx, L + 7, 0, r, look.orb, OUT, 1.5);
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillRect(L + 4, -3, 2.5, 2.5);
      if (tier >= 1 && !opts.ghost) {
        // 環繞符文 / 水晶
        for (let i = 0; i < 2 + tier; i++) {
          const a = frame * 0.08 + (i / (2 + tier)) * TAU;
          const px = L + 7 + Math.cos(a) * (r + 8);
          const py = Math.sin(a) * (r + 5);
          ctx.fillStyle = tier === 2 ? "#fef08a" : tier === 3 ? "#00ff88" : "#7dd3fc";
          ctx.font = "bold 8px monospace";
          ctx.fillText(tier === 3 ? GLYPHS[(i + frame) % 10] : tier === 2 ? "◆" : "ᚱ", px - 3, py + 3);
        }
      }
      tipLocal = [L + 7, 0];
      break;
    }
    case "scepter": {
      const L = 44;
      ctx.lineCap = "round";
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(L, 0);
      ctx.stroke();
      ctx.strokeStyle = look.shaft;
      ctx.lineWidth = 3.5;
      ctx.stroke();
      // 十字架
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(L - 10, -9);
      ctx.lineTo(L - 10, 9);
      ctx.stroke();
      ctx.strokeStyle = tier === 2 ? "#a855f7" : "#fbbf24";
      ctx.lineWidth = 3.5;
      ctx.stroke();
      const r = 6 + tier + plus * 0.5;
      if (glowOn) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createRadialGradient(L + 5, 0, 1, L + 5, 0, r * 3);
        g.addColorStop(0, rgba(look.glow, 0.85));
        g.addColorStop(1, rgba(look.glow, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(L + 5, 0, r * 3, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      circ(ctx, L + 5, 0, r, look.orb, OUT, 1.5);
      if (tier === 2) {
        // 虛空之眼：瞳孔
        ctx.fillStyle = "#1e0b3b";
        ctx.beginPath();
        ctx.ellipse(L + 5, 0, 2, r * 0.7, 0, 0, TAU);
        ctx.fill();
      }
      tipLocal = [L + 5, 0];
      break;
    }
    case "trident": {
      const L = 62;
      ctx.lineCap = "round";
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-24, 0);
      ctx.lineTo(L - 10, 0);
      ctx.stroke();
      ctx.strokeStyle = "#0e7490";
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = "#67e8f9";
      ctx.shadowBlur = 12;
      for (const o of [-8, 0, 8]) {
        poly(ctx, [[L - 12, o - 2.5], [L + (o === 0 ? 8 : 0), o], [L - 12, o + 2.5]], "#a5f3fc", null);
      }
      ctx.restore();
      ctx.strokeStyle = "#67e8f9";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(L - 12, -8);
      ctx.lineTo(L - 12, 8);
      ctx.stroke();
      tipLocal = [L + 8, 0];
      break;
    }
    case "spear": {
      const L = 66;
      ctx.lineCap = "round";
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-24, 0);
      ctx.lineTo(L - 12, 0);
      ctx.stroke();
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = "#ffd60a";
      ctx.shadowBlur = 14;
      poly(ctx, [[L - 14, -6], [L + 6, 0], [L - 14, 6]], "#fffbeb", null);
      // 槍尖電弧
      ctx.strokeStyle = "#fde047";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(L + 4, 0);
      for (let i = 1; i < 5; i++) ctx.lineTo(L + 4 - i * 8, (hash(frame + i) - 0.5) * 14);
      ctx.stroke();
      ctx.restore();
      tipLocal = [L + 6, 0];
      break;
    }
    case "scythe": {
      const L = 64;
      ctx.lineCap = "round";
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-26, 0);
      ctx.lineTo(L, 0);
      ctx.stroke();
      ctx.strokeStyle = "#1e1b4b";
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(L, -2);
      ctx.quadraticCurveTo(L - 8, 30, L - 38, 34);
      ctx.quadraticCurveTo(L - 14, 20, L - 4, 2);
      ctx.closePath();
      ctx.fillStyle = "#4c1d95";
      ctx.fill();
      ctx.strokeStyle = "#00ff88";
      ctx.lineWidth = 2;
      ctx.stroke();
      tipLocal = [L - 30, 30];
      break;
    }
    case "code": {
      // Administrator 出招時的全息程式碼刃
      if (attacking) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const col = f.phase2Triggered ? "#ff4d6d" : "#00ff88";
        ctx.shadowColor = col;
        ctx.shadowBlur = 14;
        ctx.fillStyle = rgba(col, 0.35);
        ctx.fillRect(4, -5, 46, 10);
        ctx.fillStyle = col;
        ctx.font = "bold 9px monospace";
        for (let i = 0; i < 6; i++) ctx.fillText(GLYPHS[(frame * 2 + i * 5) % GLYPHS.length], 6 + i * 7.5, 3);
        ctx.restore();
        tipLocal = [50, 0];
      } else {
        tipLocal = [4, 0];
      }
      break;
    }
    default: {
      // 拳腳系：拳套光芒
      if (attacking && !opts.ghost) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const col = f.cfg?.color || "#00e5ff";
        const g = ctx.createRadialGradient(4, 0, 1, 4, 0, 14);
        g.addColorStop(0, rgba(col, 0.8));
        g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(4, 0, 14, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      tipLocal = [4, 0];
    }
  }

  if (tipLocal && !opts.ghost && !opts.portrait) {
    const m = ctx.getTransform();
    f._tip = { x: m.a * tipLocal[0] + m.c * tipLocal[1] + m.e, y: m.b * tipLocal[0] + m.d * tipLocal[1] + m.f };
  }
  ctx.restore();
}

/* ───────────── 4. 粒子系統 ───────────── */

/**
 * kind：spark（預設，拖尾火花）、ember（上升餘燼）、feather（金色羽毛）、shard（冰晶碎片）、
 *       code（程式碼字元）、smoke（煙）、star（閃光星）、rune（符文）、drop（水滴 / 血滴）
 */
export function emit(g: any, kind: string, x: number, y: number, n: number, o: any = {}) {
  for (let i = 0; i < n; i++) {
    const a = o.angle !== undefined ? o.angle + (Math.random() - 0.5) * (o.spread ?? TAU) : Math.random() * TAU;
    const spd = (o.speed ?? 4) * (0.35 + Math.random() * 0.75);
    const life = Math.round((o.life ?? 26) * (0.7 + Math.random() * 0.6));
    g.particles.push({
      kind,
      x: x + (Math.random() - 0.5) * (o.jitter ?? 0),
      y: y + (Math.random() - 0.5) * (o.jitterY ?? o.jitter ?? 0),
      vx: Math.cos(a) * spd + (o.vx ?? 0),
      vy: Math.sin(a) * spd + (o.vy ?? 0),
      size: (o.size ?? 3) * (0.7 + Math.random() * 0.6),
      color: Array.isArray(o.color) ? o.color[(Math.random() * o.color.length) | 0] : o.color || "#ffffff",
      grav: o.grav ?? (kind === "ember" ? -0.05 : kind === "feather" ? 0.02 : kind === "smoke" ? -0.03 : kind === "code" ? -0.02 : 0.18),
      drag: o.drag ?? (kind === "feather" || kind === "smoke" ? 0.96 : 0.985),
      rot: Math.random() * TAU,
      vr: (Math.random() - 0.5) * 0.3,
      seed: Math.random() * 100,
      ch: GLYPHS[(Math.random() * GLYPHS.length) | 0],
      life,
      maxLife: life,
    });
  }
}

export function updateParticles(g: any) {
  for (const p of g.particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.grav ?? 0.18;
    if (p.drag) {
      p.vx *= p.drag;
      p.vy *= p.drag;
    }
    if (p.kind === "feather") p.x += Math.sin((p.life + (p.seed || 0)) * 0.12) * 0.9;
    if (p.vr) p.rot = (p.rot || 0) + p.vr;
    p.life--;
  }
  g.particles = g.particles.filter((p: any) => p.life > 0 && p.y < 470);
  if (g.particles.length > PARTICLE_CAP) g.particles.splice(0, g.particles.length - PARTICLE_CAP);
}

export function drawParticles(ctx: CanvasRenderingContext2D, g: any) {
  ctx.save();
  for (const p of g.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    const k = p.kind || "spark";
    if (k === "spark" || k === "ember") {
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size * (k === "ember" ? 0.8 : 0.6);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2);
      ctx.stroke();
    } else if (k === "star") {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = p.color;
      const s = p.size * (0.6 + Math.sin(p.life * 0.6) * 0.4);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - s * 2);
      ctx.lineTo(p.x + s * 0.5, p.y - s * 0.5);
      ctx.lineTo(p.x + s * 2, p.y);
      ctx.lineTo(p.x + s * 0.5, p.y + s * 0.5);
      ctx.lineTo(p.x, p.y + s * 2);
      ctx.lineTo(p.x - s * 0.5, p.y + s * 0.5);
      ctx.lineTo(p.x - s * 2, p.y);
      ctx.lineTo(p.x - s * 0.5, p.y - s * 0.5);
      ctx.closePath();
      ctx.fill();
    } else if (k === "feather") {
      ctx.globalCompositeOperation = "source-over";
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.sin((p.life + p.seed) * 0.1) * 0.8);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * 0.8, p.size * 2.4, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(180,83,9,0.8)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -p.size * 2.4);
      ctx.lineTo(0, p.size * 2.8);
      ctx.stroke();
      ctx.restore();
    } else if (k === "shard") {
      ctx.globalCompositeOperation = "lighter";
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(0, -p.size * 1.6);
      ctx.lineTo(p.size * 0.7, 0);
      ctx.lineTo(0, p.size * 1.6);
      ctx.lineTo(-p.size * 0.7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (k === "code") {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = p.color;
      ctx.font = `bold ${Math.round(8 + p.size * 1.5)}px monospace`;
      ctx.fillText(p.ch, p.x, p.y);
    } else if (k === "smoke") {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = a * 0.35;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (2.5 - a * 1.5), 0, TAU);
      ctx.fill();
    } else if (k === "rune") {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = p.color;
      ctx.font = `bold ${Math.round(9 + p.size)}px serif`;
      ctx.fillText("ᚠᚱᚨᛟᛉᛋ"[(p.seed | 0) % 6], p.x, p.y);
    } else if (k === "drop") {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size * 0.5, p.size, 0, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

/* ───────────── 5. 招式特效（劍氣、魔法陣、聖光柱、衝擊波…） ───────────── */

export function addFx(g: any, fx: any) {
  if (!g.fx) g.fx = [];
  g.fx.push({ age: 0, delay: 0, ...fx });
}

export function updateFx(g: any) {
  if (!g.fx) g.fx = [];
  for (const fx of g.fx) fx.age++;
  g.fx = g.fx.filter((fx: any) => fx.age < fx.delay + fx.life);
  if (g.hitFlash > 0) g.hitFlash--;
  if (g.cutIn) {
    g.cutIn.age = (g.cutIn.age || 0) + 1;
    if (g.cutIn.age > g.cutIn.life) g.cutIn = null;
  }
}

/** layer: "back" 畫在角色後面（地面法陣、聖光柱），"front" 畫在角色前面（劍氣、火花） */
export function drawFx(ctx: CanvasRenderingContext2D, g: any, layer: string, frame: number) {
  if (!g.fx) return;
  for (const fx of g.fx) {
    const age = fx.age - fx.delay;
    if (age < 0) continue;
    const back = fx.type === "circle" ? !!fx.flat : fx.type === "pillar" || fx.type === "ghost" || fx.type === "crack";
    if ((layer === "back") !== back) continue;
    const t = age / fx.life;
    ctx.save();
    switch (fx.type) {
      case "slash": drawSlash(ctx, fx, t); break;
      case "circle": drawMagicCircle(ctx, fx, t, frame); break;
      case "pillar": drawPillar(ctx, fx, t, frame); break;
      case "ring": drawRing(ctx, fx, t); break;
      case "impact": drawImpact(ctx, fx, t); break;
      case "ghost": drawGhost(ctx, fx, t, frame); break;
      case "bolt": drawBolt(ctx, fx, t, frame); break;
      case "crack": drawCrack(ctx, fx, t); break;
      case "speedlines": drawSpeedLines(ctx, fx, t); break;
      case "wideSlash": drawWideSlash(ctx, fx, t); break;
    }
    ctx.restore();
  }
}

// 半月形劍氣弧光
function drawSlash(ctx, fx, t) {
  const grow = smooth(clamp(t * 3, 0, 1));
  const fade = 1 - smooth(clamp((t - 0.35) / 0.65, 0, 1));
  if (fade <= 0) return;
  ctx.translate(fx.x, fx.y);
  ctx.scale(fx.facing || 1, 1);
  if (fx.tilt) ctx.rotate(fx.tilt);
  ctx.globalCompositeOperation = "lighter";
  const n = 22;
  const a0 = fx.a0;
  const a1 = lerp(fx.a0, fx.a1, grow);
  const r = fx.r * (0.85 + grow * 0.15);
  const th = fx.thick;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = lerp(a0, a1, i / n);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  for (let i = n; i >= 0; i--) {
    const u = i / n;
    const a = lerp(a0, a1, u);
    const w = th * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (0.6 + 0.4 * u);
    ctx.lineTo(Math.cos(a) * (r - w), Math.sin(a) * (r - w));
  }
  ctx.closePath();
  const grad = ctx.createRadialGradient(0, 0, Math.max(1, r - th), 0, 0, r);
  grad.addColorStop(0, rgba(fx.color, 0));
  grad.addColorStop(0.55, rgba(fx.color, 0.55 * fade));
  grad.addColorStop(1, rgba(fx.core || "#ffffff", 0.95 * fade));
  ctx.fillStyle = grad;
  ctx.shadowColor = fx.color;
  ctx.shadowBlur = 18;
  ctx.fill();
}

function drawWideSlash(ctx, fx, t) {
  const fade = 1 - t;
  ctx.globalCompositeOperation = "lighter";
  const y = fx.y;
  const w = 900 * smooth(clamp(t * 4, 0, 1));
  const x0 = fx.facing > 0 ? fx.x : fx.x - w;
  const grad = ctx.createLinearGradient(0, y - 10, 0, y + 10);
  grad.addColorStop(0, rgba(fx.color, 0));
  grad.addColorStop(0.5, `rgba(255,255,255,${0.95 * fade})`);
  grad.addColorStop(1, rgba(fx.color, 0));
  ctx.fillStyle = grad;
  ctx.fillRect(x0, y - 10 * fade - 2, w, 20 * fade + 4);
}

// 魔法陣：雙圈 + 六芒星 + 旋轉符文
function drawMagicCircle(ctx, fx, t, frame) {
  const grow = smooth(clamp(t * 4, 0, 1));
  const fade = 1 - smooth(clamp((t - 0.6) / 0.4, 0, 1));
  const r = fx.r * grow;
  ctx.translate(fx.x, fx.y);
  if (fx.flat) ctx.scale(1, 0.28);
  else ctx.scale(0.42, 1);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = fade;
  ctx.shadowColor = fx.color;
  ctx.shadowBlur = 16;
  ctx.strokeStyle = fx.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.78, 0, TAU);
  ctx.stroke();
  const rot = frame * 0.05 * (fx.spin || 1);
  ctx.beginPath();
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i <= 3; i++) {
      const a = rot + k * (Math.PI / 3) + (i / 3) * TAU;
      const px = Math.cos(a) * r * 0.78;
      const py = Math.sin(a) * r * 0.78;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }
  ctx.stroke();
  ctx.fillStyle = fx.color;
  ctx.font = `bold ${Math.max(8, r * 0.18)}px serif`;
  ctx.textAlign = "center";
  for (let i = 0; i < 10; i++) {
    const a = -rot * 1.5 + (i / 10) * TAU;
    ctx.fillText("ᚠᚱᚨᛟᛉᛋᛞᚹᛗᚾ"[i], Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9 + 3);
  }
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, rgba(fx.color, 0.35));
  g.addColorStop(1, rgba(fx.color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
}

// 聖光柱（天降光柱）
function drawPillar(ctx, fx, t, frame) {
  const grow = smooth(clamp(t * 5, 0, 1));
  const fade = 1 - smooth(clamp((t - 0.55) / 0.45, 0, 1));
  const w = fx.w * grow * (0.75 + 0.25 * fade);
  const top = fx.top ?? 0;
  const bottom = fx.bottom ?? FLOOR + 6;
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createLinearGradient(fx.x - w, 0, fx.x + w, 0);
  g.addColorStop(0, rgba(fx.color, 0));
  g.addColorStop(0.35, rgba(fx.color, 0.45 * fade));
  g.addColorStop(0.5, `rgba(255,255,255,${0.85 * fade})`);
  g.addColorStop(0.65, rgba(fx.color, 0.45 * fade));
  g.addColorStop(1, rgba(fx.color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(fx.x - w, top, w * 2, bottom - top);
  ctx.globalAlpha = fade;
  ctx.fillStyle = rgba(fx.color, 0.5);
  ctx.beginPath();
  ctx.ellipse(fx.x, bottom - 4, w * 1.6, 7, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 6; i++) {
    const yy = bottom - ((frame * 4 + i * 47) % (bottom - top));
    ctx.fillRect(fx.x + Math.sin(i * 2.1 + frame * 0.1) * w * 0.6, yy, 2, 6);
  }
}

function drawRing(ctx, fx, t) {
  const r = lerp(fx.r0 ?? 8, fx.r1 ?? 90, smooth(t));
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 1 - t;
  ctx.strokeStyle = fx.color;
  ctx.lineWidth = (fx.lw ?? 6) * (1 - t) + 1;
  ctx.beginPath();
  ctx.ellipse(fx.x, fx.y, r, r * (fx.squash ?? 1), 0, 0, TAU);
  ctx.stroke();
}

// 命中星芒
function drawImpact(ctx, fx, t) {
  const s = fx.size * (t < 0.25 ? lerp(0.4, 1.15, t / 0.25) : lerp(1.15, 0.6, (t - 0.25) / 0.75));
  ctx.translate(fx.x, fx.y);
  ctx.rotate(fx.rot || 0);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 1 - t * t;
  const spikes = fx.spikes || 8;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * TAU;
    const r = i % 2 === 0 ? s * (i % 4 === 0 ? 1 : 0.7) : s * 0.28;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = fx.color;
  ctx.shadowColor = fx.color;
  ctx.shadowBlur = 16;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.3, 0, TAU);
  ctx.fill();
}

function drawGhost(ctx, fx, t, frame) {
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.5 * (1 - t);
  drawFighter(ctx, fx.snap, fx.snapFrame ?? frame, { ghost: true, alpha: 1 });
  if (fx.color) {
    ctx.globalAlpha = 0.18 * (1 - t);
    ctx.fillStyle = fx.color;
    ctx.fillRect(fx.snap.x - 26, fx.snap.y - 120, 52, 120);
  }
}

function drawBolt(ctx, fx, t, frame) {
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 1 - t;
  const seg = fx.segs || 9;
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const u = i / seg;
    const j = i === 0 || i === seg ? 0 : (hash((fx.seed || 0) + i * 13 + Math.floor(frame / 2) * 7) - 0.5) * (fx.jag ?? 28);
    pts.push([lerp(fx.x1, fx.x2, u) + j, lerp(fx.y1, fx.y2, u)]);
  }
  for (const [w, c] of [[fx.w ?? 9, fx.color], [(fx.w ?? 9) * 0.35, "#ffffff"]]) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.shadowColor = fx.color;
    ctx.shadowBlur = 20;
    ctx.lineJoin = "miter";
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
}

function drawCrack(ctx, fx, t) {
  ctx.globalAlpha = 1 - t;
  ctx.strokeStyle = fx.color;
  ctx.lineWidth = 2;
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 6; i++) {
    const a = Math.PI + (i / 5) * Math.PI;
    let x = fx.x;
    let y = FLOOR + 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 1; k <= 3; k++) {
      x += Math.cos(a + (hash(i * 9 + k) - 0.5)) * 14;
      y += Math.abs(Math.sin(a)) * 2 + 2;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawSpeedLines(ctx, fx, t) {
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.6 * (1 - t);
  ctx.strokeStyle = fx.color;
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const y = fx.y - 90 + hash(i * 3.7 + fx.seed) * 90;
    const len = 40 + hash(i + fx.seed) * 60;
    const x = fx.x - (fx.facing || 1) * (20 + hash(i * 1.3) * 40);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - (fx.facing || 1) * len, y);
    ctx.stroke();
  }
}

/** 氣條全滿 / Boss 二階段時的鬥氣（腳下竄起的火焰狀光芒） */
export function drawAura(ctx: CanvasRenderingContext2D, f: any, frame: number) {
  const vis = visualOf(f);
  const col = f.phase2Triggered ? "#ff4d6d" : "#ffd60a";
  const h = 112 * vis.scale;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(f.x, f.y - h * 0.5, 8, f.x, f.y - h * 0.5, h * 0.8);
  g.addColorStop(0, rgba(col, 0.22));
  g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g;
  ctx.fillRect(f.x - h, f.y - h * 1.35, h * 2, h * 1.45);
  for (let i = 0; i < 7; i++) {
    const x = f.x + (i - 3) * 9 * vis.scale;
    const fh = (30 + hash(i * 7 + Math.floor(frame / 3)) * 40 + 40) * vis.scale;
    ctx.fillStyle = rgba(col, 0.2);
    ctx.beginPath();
    ctx.moveTo(x - 7, f.y);
    ctx.quadraticCurveTo(x - 4, f.y - fh * 0.6, x + Math.sin(frame * 0.3 + i) * 6, f.y - fh);
    ctx.quadraticCurveTo(x + 4, f.y - fh * 0.4, x + 7, f.y);
    ctx.fill();
  }
  ctx.restore();
}

/* ───────────── 6. 出招 / 命中時要噴的特效 ───────────── */

export function snapshot(f: any) {
  return {
    x: f.x, y: f.y, vx: f.vx, vy: f.vy, facing: f.facing, state: f.state, attackType: f.attackType,
    stateTimer: f.stateTimer, attackDuration: f.attackDuration, cfg: f.cfg, weaponTier: f.weaponTier,
    weaponPlus: f.weaponPlus, phase2Triggered: f.phase2Triggered, invincibleTimer: 0,
  };
}

/** 依職業 / Boss 噴出出招特效。windup：出招前的預備幀數（劍氣在真正揮出時才出現） */
export function onAttackStart(g: any, f: any, rawKind: string, opts: any = {}) {
  const kind = normKind(rawKind);
  const vis = visualOf(f);
  const col = fxColor(f);
  const main = f.cfg?.color || "#ffffff";
  const fc = f.facing || 1;
  const s = vis.scale;
  const chestY = f.y - 62 * s;
  const dur = f.attackDuration || 20;
  const wind = Math.round(dur * (kind === "heavy" || kind === "ult" || kind === "skill1" ? 0.32 : 0.2));
  const bladed = ["greatsword", "rapier", "club", "dagger", "trident", "spear", "scythe", "code"].includes(vis.weapon);
  const core = vis.weapon === "code" ? (f.phase2Triggered ? "#ffd1dc" : "#d1fae5") : "#ffffff";

  if (bladed) {
    if (kind === "light") addFx(g, { type: "slash", x: f.x + fc * 18, y: chestY, facing: fc, r: 60 * s, thick: 16, a0: -1.1, a1: 0.75, color: col, core, life: 14, delay: wind });
    if (kind === "heavy") {
      addFx(g, { type: "slash", x: f.x + fc * 10, y: chestY + 6, facing: fc, r: 74 * s, thick: 24, a0: -2.3, a1: 1.0, color: col, core, life: 18, delay: wind });
      addFx(g, { type: "crack", x: f.x + fc * 58, color: col, life: 30, delay: wind + 4 });
      addFx(g, { type: "ring", x: f.x + fc * 58, y: FLOOR, r0: 6, r1: 70, squash: 0.22, color: col, life: 18, delay: wind + 4 });
    }
    if (kind === "sweep") addFx(g, { type: "slash", x: f.x + fc * 10, y: f.y - 14, facing: fc, r: 70 * s, thick: 14, a0: -0.25, a1: 1.15, tilt: -0.1, color: col, core, life: 14, delay: wind });
    if (kind === "skill2") addFx(g, { type: "slash", x: f.x + fc * 14, y: chestY - 8, facing: fc, r: 66 * s, thick: 22, a0: 1.3, a1: -2.0, color: col, core, life: 18, delay: wind });
    if (kind === "skill3") addFx(g, { type: "slash", x: f.x + fc * 30, y: chestY, facing: fc, r: 64 * s, thick: 18, a0: -0.9, a1: 0.9, color: col, core, life: 16, delay: wind + 3 });
    if (kind === "ult") {
      addFx(g, { type: "slash", x: f.x + fc * 20, y: chestY, facing: fc, r: 118 * s, thick: 36, a0: -2.4, a1: 1.1, color: col, core, life: 24, delay: wind });
      addFx(g, { type: "wideSlash", x: f.x, y: chestY + 4, facing: fc, color: col, life: 22, delay: wind + 4 });
    }
  }

  if (vis.weapon === "staff") {
    const tipX = f.x + fc * 52;
    if (kind === "light" || kind === "heavy") {
      addFx(g, { type: "circle", x: tipX, y: chestY - 6, r: kind === "heavy" ? 30 : 20, color: col === main ? "#a78bfa" : col, life: 18, delay: wind });
      emit(g, "rune", tipX, chestY - 6, 5, { color: [col, "#c4b5fd"], speed: 2.5, grav: -0.04, life: 26 });
    }
    if (kind === "skill1") addFx(g, { type: "circle", x: f.x + fc * 56, y: chestY, r: 40, color: "#7dd3fc", life: 28, spin: 2 });
    if (kind === "skill2") {
      addFx(g, { type: "circle", x: f.x, y: FLOOR, r: 58, color: "#a78bfa", life: 30, flat: true });
      addFx(g, { type: "pillar", x: f.x + fc * 8, w: 26, color: "#f97316", life: 24, top: f.y - 190, delay: wind });
      emit(g, "ember", f.x, FLOOR - 10, 18, { color: ["#f97316", "#fbbf24", "#a78bfa"], speed: 3, angle: -Math.PI / 2, spread: 1.2, vy: -2, life: 30 });
    }
    if (kind === "skill3") addFx(g, { type: "circle", x: f.x, y: chestY, r: 36, color: "#00e5ff", life: 20 });
    if (kind === "ult") {
      addFx(g, { type: "circle", x: f.x + fc * 230, y: 110, r: 110, color: "#c084fc", life: 50, flat: true, spin: 1.5 });
      addFx(g, { type: "circle", x: f.x, y: FLOOR, r: 80, color: "#a78bfa", life: 46, flat: true, spin: -1 });
      for (let i = 0; i < 5; i++) emit(g, "star", f.x + fc * (120 + i * 50), 80 + i * 6, 3, { color: ["#ffffff", "#c4b5fd", "#7dd3fc"], speed: 1.5, life: 40 });
    }
  }

  if (vis.weapon === "scepter") {
    if (kind === "light" || kind === "heavy") {
      addFx(g, { type: "ring", x: f.x + fc * 46, y: chestY - 4, r0: 4, r1: kind === "heavy" ? 46 : 30, color: "#ffd60a", life: 14, delay: wind });
      addFx(g, { type: "impact", x: f.x + fc * 46, y: chestY - 4, size: kind === "heavy" ? 26 : 16, spikes: 4, color: "#fff3b0", life: 12, delay: wind });
    }
    if (kind === "skill1") addFx(g, { type: "circle", x: f.x + fc * 50, y: chestY, r: 34, color: "#ffd60a", life: 24 });
    if (kind === "skill2" || kind === "skill3") {
      // 回血技能：聖光柱 + 金色羽毛
      addFx(g, { type: "pillar", x: f.x, w: 34, color: "#ffd60a", life: 36, top: 0 });
      addFx(g, { type: "circle", x: f.x, y: FLOOR, r: 52, color: "#ffd60a", life: 34, flat: true });
      emit(g, "feather", f.x, f.y - 160, 12, { color: ["#fff7ae", "#fde68a", "#ffffff"], speed: 1.2, life: 60, size: 3, jitter: 70, grav: 0.02 });
      emit(g, "star", f.x, f.y - 60, 10, { color: "#fff7ae", speed: 2.5, life: 30 });
    }
    if (kind === "ult") {
      for (const o of [-110, 0, 110]) addFx(g, { type: "pillar", x: f.x + fc * (o + 120), w: 42, color: "#ffd60a", life: 48, top: 0, delay: Math.abs(o) / 20 });
      addFx(g, { type: "ring", x: f.x, y: FLOOR, r0: 20, r1: 220, squash: 0.25, color: "#fde68a", life: 40, lw: 10 });
      emit(g, "feather", f.x + fc * 120, 40, 30, { color: ["#fff7ae", "#fde68a", "#ffffff"], speed: 1.5, life: 80, size: 3.4, jitter: 260, grav: 0.025 });
    }
  }

  if (vis.weapon === "fists" || vis.weapon === "kicks") {
    if (kind === "light" || kind === "heavy" || kind === "sweep") {
      addFx(g, { type: "slash", x: f.x + fc * 26, y: kind === "sweep" ? f.y - 16 : chestY - (kind === "heavy" ? 18 : 0), facing: fc, r: 40, thick: 7, a0: -0.8, a1: 0.8, color: "#ffffff", core: "#ffffff", life: 9, delay: wind });
    }
    if (kind === "skill1") addFx(g, { type: "ring", x: f.x + fc * 44, y: chestY, r0: 30, r1: 4, color: main, life: wind + 2 });
    if (kind === "skill2") {
      const fire = vis.proj === "fireball";
      addFx(g, { type: "pillar", x: f.x + fc * 12, w: 18, color: fire ? "#f97316" : main, life: 22, top: f.y - 210, delay: wind });
      emit(g, fire ? "ember" : "spark", f.x + fc * 12, f.y - 40, 16, { color: fire ? ["#f97316", "#fbbf24"] : [main, "#ffffff"], speed: 4, angle: -Math.PI / 2, spread: 0.9, life: 26 });
    }
    if (kind === "skill3") addFx(g, { type: "ring", x: f.x, y: f.y - 40, r0: 10, r1: 60, squash: 0.35, color: main, life: 18, delay: wind });
    if (kind === "ult") addFx(g, { type: "ring", x: f.x, y: chestY, r0: 10, r1: 160, color: main, life: 30, lw: 10 });
  }

  if (kind === "skill3" || kind === "ult") addFx(g, { type: "speedlines", x: f.x, y: f.y, facing: fc, color: col, life: 18, seed: Math.random() * 100, delay: wind });

  if (kind === "ult") {
    g.cutIn = { snap: snapshot(f), name: opts.name || "", color: col, side: opts.side || (fc > 0 ? "left" : "right"), age: 0, life: 52 };
    addFx(g, { type: "ring", x: f.x, y: chestY, r0: 120, r1: 6, color: col, life: wind + 2, lw: 4 });
  }
}

export function onHit(g: any, attacker: any, defender: any, info: any = {}) {
  const fc = attacker.facing || 1;
  const x = defender.x - fc * 10;
  const y = defender.y - 58 * visualOf(defender).scale;
  if (info.blocked) {
    addFx(g, { type: "impact", x: defender.x + (defender.facing || 1) * 22, y, size: 22, spikes: 6, color: "#00e5ff", life: 10 });
    emit(g, "spark", defender.x + (defender.facing || 1) * 22, y, 10, { color: ["#00e5ff", "#ffffff"], speed: 5, life: 14 });
    return;
  }
  audio.sfx(info.heavy ? "hit_heavy" : "hit");
  const col = info.color || fxColor(attacker);
  addFx(g, { type: "impact", x, y, size: info.heavy ? 40 : 26, color: col, life: info.heavy ? 14 : 10, rot: Math.random() * TAU });
  emit(g, "spark", x, y, info.heavy ? 18 : 10, { color: [col, "#ffffff", "#ffd60a"], speed: info.heavy ? 8 : 5.5, life: 16 });
  if (info.heavy) {
    addFx(g, { type: "ring", x, y, r0: 10, r1: 80, color: "#ffffff", life: 14, lw: 5 });
    g.hitFlash = 3;
  }
  const v = visualOf(attacker);
  if (v.weapon === "code") emit(g, "code", x, y, 8, { color: attacker.phase2Triggered ? "#ff4d6d" : "#00ff88", speed: 3, life: 26 });
  if (v.proj === "bloodCrescent") emit(g, "drop", x, y, 8, { color: "#be123c", speed: 4, life: 28 });
  if (v.proj === "iceShard") emit(g, "shard", x, y, 8, { color: ["#a5f3fc", "#ffffff"], speed: 5, life: 22 });
}

/** 衝刺 / 昇龍 / 奧義會留下殘影；Administrator 移動時也會留下程式碼殘影 */
export function trackAfterimages(g: any, f: any) {
  const kind = normKind(f.attackType);
  const vis = visualOf(f);
  const dashing = f.state === "attack" && (kind === "skill3" || kind === "ult" || kind === "skill2");
  const hackerMove = vis.build === "hacker" && Math.abs(f.vx || 0) > 1.2;
  if ((dashing || hackerMove) && g.frameCounter % 3 === 0) {
    addFx(g, { type: "ghost", snap: snapshot(f), snapFrame: g.frameCounter, color: fxColor(f), life: dashing ? 14 : 10 });
  }
}

/** 已購買武器的光效粒子：銀風、烈焰、雷電、符文、聖光、虛空、程式碼 */
export function emitWeaponParticles(g: any, f: any) {
  const look = weaponLook(f);
  const tip = f._tip;
  if (!tip || f.state === "ko") return;
  if (f.rarityGlow && RARITY_GLOW[f.rarityGlow] && g.frameCounter % 9 === 0) {
    emit(g, "star", tip.x, tip.y, 1, { color: RARITY_GLOW[f.rarityGlow], speed: 1, grav: -0.02, life: 20, size: 2 });
  }
  const plus = clamp(f.weaponPlus || 0, 0, 3);
  let fx = look?.fx;
  const v = visualOf(f);
  if (!look) {
    if (v.weapon === "rapier") fx = "blood";
    else if (v.weapon === "trident") fx = "frost";
    else if (v.weapon === "spear") fx = "thunder";
    else if (v.weapon === "scythe") fx = "void";
    else if (v.weapon === "code" && f.state === "attack") fx = "code";
  }
  if (!fx) return;
  const every = Math.max(2, 6 - plus - (f.state === "attack" ? 2 : 0));
  if (g.frameCounter % every !== 0) return;
  const n = 1 + (plus >= 2 ? 1 : 0) + (f.state === "attack" ? 1 : 0);
  switch (fx) {
    case "wind": emit(g, "spark", tip.x, tip.y, n, { color: ["#e0f2fe", "#7dd3fc"], speed: 1.5, life: 16, size: 2 }); break;
    case "flame": emit(g, "ember", tip.x, tip.y, n + 1, { color: ["#ff6b00", "#ffb703", "#dc2626"], speed: 1.4, vy: -1.2, life: 22, size: 3, jitter: 18 }); break;
    case "thunder": emit(g, "spark", tip.x, tip.y, n + 1, { color: ["#fde047", "#ffffff"], speed: 3.5, life: 8, size: 2, grav: 0 }); break;
    case "rune": emit(g, "rune", tip.x, tip.y, 1, { color: "#7dd3fc", speed: 0.8, grav: -0.04, life: 30, size: 1 }); break;
    case "holy": emit(g, "star", tip.x, tip.y, n, { color: ["#fff7ae", "#ffffff"], speed: 1, grav: -0.02, life: 22, size: 2 }); break;
    case "void": emit(g, "spark", tip.x, tip.y, n, { color: ["#a855f7", "#c084fc", "#1e0b3b"], speed: 1.2, grav: -0.03, life: 22, size: 3 }); break;
    case "code": emit(g, "code", tip.x, tip.y, n, { color: f.phase2Triggered ? "#ff4d6d" : "#00ff88", speed: 0.8, grav: -0.04, life: 26, size: 0.5 }); break;
    case "blood": emit(g, "drop", tip.x, tip.y, 1, { color: "#be123c", speed: 0.5, grav: 0.15, life: 22, size: 2 }); break;
    case "frost": emit(g, "shard", tip.x, tip.y, 1, { color: ["#a5f3fc", "#ffffff"], speed: 0.8, grav: 0.03, life: 22, size: 2 }); break;
  }
}

/* ───────────── 7. 投射物造型 ───────────── */

export function projStyleFor(f: any) {
  return visualOf(f).proj;
}

export function drawProjectile(ctx: CanvasRenderingContext2D, proj: any, frame: number) {
  const dir = Math.sign(proj.vx) || 1;
  const r = proj.radius;
  const col = proj.color;
  const style = proj.style || "orb";
  ctx.save();
  ctx.translate(proj.x, proj.y);
  ctx.scale(dir, 1);
  ctx.globalCompositeOperation = "lighter";
  // 拖尾
  const tail = ctx.createLinearGradient(-r * 4, 0, 0, 0);
  tail.addColorStop(0, rgba(col[0] === "#" ? col : "#ffffff", 0));
  tail.addColorStop(1, rgba(col[0] === "#" ? col : "#ffffff", 0.45));
  ctx.fillStyle = tail;
  ctx.beginPath();
  ctx.ellipse(-r * 1.8, 0, r * 2.4, r * 0.7, 0, 0, TAU);
  ctx.fill();

  switch (style) {
    case "swordWave":
    case "bloodCrescent": {
      // 半月形劍氣波
      const c2 = style === "bloodCrescent" ? "#ff1744" : col;
      ctx.shadowColor = c2;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(-r * 0.6, 0, r * 1.5, -1.25, 1.25);
      ctx.arc(-r * 1.3, 0, r * 1.25, 1.1, -1.1, true);
      ctx.closePath();
      const g = ctx.createLinearGradient(-r, 0, r, 0);
      g.addColorStop(0, rgba(c2, 0.2));
      g.addColorStop(1, "#ffffff");
      ctx.fillStyle = g;
      ctx.fill();
      break;
    }
    case "thunderOrb":
    case "lightningSpear": {
      const c2 = style === "lightningSpear" ? "#fde047" : "#7dd3fc";
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 1.3);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.4, c2);
      g.addColorStop(1, rgba(c2, 0));
      ctx.fillStyle = g;
      if (style === "lightningSpear") {
        ctx.beginPath();
        ctx.moveTo(r * 1.6, 0);
        ctx.lineTo(-r * 1.4, -r * 0.45);
        ctx.lineTo(-r * 1.4, r * 0.45);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.3, 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        let a = hash(frame * 0.7 + k * 11) * TAU;
        ctx.moveTo(0, 0);
        for (let i = 1; i <= 4; i++) {
          a += (hash(frame + k * 5 + i) - 0.5) * 1.2;
          ctx.lineTo(Math.cos(a) * r * 0.45 * i, Math.sin(a) * r * 0.45 * i);
        }
        ctx.stroke();
      }
      break;
    }
    case "holyOrb": {
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 1.5);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.45, "#ffd60a");
      g.addColorStop(1, "rgba(255,214,10,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-2, -r * 0.8, 4, r * 1.6);
      ctx.fillRect(-r * 0.55, -r * 0.3, r * 1.1, 4);
      ctx.strokeStyle = "rgba(255,247,174,0.7)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const a = frame * 0.1 + (i / 8) * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1);
        ctx.lineTo(Math.cos(a) * r * 1.7, Math.sin(a) * r * 1.7);
        ctx.stroke();
      }
      break;
    }
    case "hadouken":
    case "kikoken": {
      const c2 = style === "kikoken" ? "#00e5ff" : "#38bdf8";
      ctx.shadowColor = c2;
      ctx.shadowBlur = 22;
      ctx.fillStyle = rgba(c2, 0.7);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.25, r, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.75, frame * 0.4, frame * 0.4 + 4);
      ctx.stroke();
      if (style === "kikoken") {
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.15, 0, TAU);
        ctx.stroke();
      }
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(r * 0.2, 0, r * 0.4, 0, TAU);
      ctx.fill();
      break;
    }
    case "fireball": {
      ctx.shadowColor = "#f97316";
      ctx.shadowBlur = 22;
      for (let i = 0; i < 5; i++) {
        const fl = Math.sin(frame * 0.5 + i) * 3;
        ctx.fillStyle = ["#7f1d1d", "#dc2626", "#f97316", "#fbbf24", "#fff7ae"][i];
        ctx.beginPath();
        ctx.ellipse(-i * 2 + 2, 0, r * (1.3 - i * 0.2) + fl, r * (0.95 - i * 0.14), 0, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case "dagger": {
      ctx.globalCompositeOperation = "source-over";
      ctx.rotate(frame * 0.6);
      ctx.fillStyle = "#d4d4d8";
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 2; i++) {
        ctx.rotate(Math.PI);
        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.quadraticCurveTo(r * 0.8, -6, r * 1.2, 0);
        ctx.quadraticCurveTo(r * 0.8, 2, 0, 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = "#65a30d";
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, TAU);
      ctx.fill();
      break;
    }
    case "iceShard": {
      ctx.shadowColor = "#67e8f9";
      ctx.shadowBlur = 18;
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(-i * r * 0.6, (i - 1) * r * 0.5);
        ctx.fillStyle = i === 0 ? "#ecfeff" : "#a5f3fc";
        ctx.beginPath();
        ctx.moveTo(r * 1.3, 0);
        ctx.lineTo(0, -r * 0.4);
        ctx.lineTo(-r * 0.8, 0);
        ctx.lineTo(0, r * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case "codePacket": {
      const c2 = col === "#ff4d6d" || proj.overclock ? "#ff4d6d" : "#00ff88";
      ctx.rotate(Math.sin(frame * 0.3) * 0.2);
      ctx.fillStyle = rgba(c2, 0.25);
      ctx.strokeStyle = c2;
      ctx.lineWidth = 2;
      ctx.shadowColor = c2;
      ctx.shadowBlur = 16;
      ctx.fillRect(-r, -r * 0.8, r * 2, r * 1.6);
      ctx.strokeRect(-r, -r * 0.8, r * 2, r * 1.6);
      ctx.fillStyle = c2;
      ctx.font = `bold ${Math.round(r * 0.55)}px monospace`;
      ctx.textAlign = "center";
      ctx.scale(dir, 1);
      ctx.fillText(frame % 20 < 10 ? "rm -rf" : "0xFF", 0, r * 0.2);
      break;
    }
    case "bugBomb": {
      ctx.fillStyle = "#4c1d95";
      ctx.shadowColor = "#a855f7";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "#00ff88";
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + frame * 0.2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.lineTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5 + Math.sin(frame + i) * 3);
        ctx.stroke();
      }
      ctx.fillStyle = "#00ff88";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.scale(dir, 1);
      ctx.fillText("BUG", 0, 4);
      break;
    }
    default: {
      ctx.shadowColor = col;
      ctx.shadowBlur = 18;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = proj.coreColor || "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, 0, TAU);
      ctx.fill();
    }
  }
  if (proj.isSuper) {
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.7 + Math.sin(frame * 0.5) * 3, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

/** 投射物飛行時的拖尾粒子 */
export function emitProjectileTrail(g: any, proj: any) {
  const s = proj.style;
  if (g.frameCounter % 2) return;
  if (s === "fireball") emit(g, "ember", proj.x, proj.y, 2, { color: ["#f97316", "#fbbf24"], speed: 1.2, life: 18, jitter: proj.radius });
  else if (s === "holyOrb") emit(g, "star", proj.x, proj.y, 1, { color: "#fff7ae", speed: 0.8, life: 18 });
  else if (s === "iceShard") emit(g, "shard", proj.x, proj.y, 1, { color: "#a5f3fc", speed: 1, life: 16 });
  else if (s === "codePacket" || s === "bugBomb") emit(g, "code", proj.x, proj.y, 1, { color: s === "bugBomb" ? "#a855f7" : "#00ff88", speed: 1, life: 20 });
  else if (s === "thunderOrb" || s === "lightningSpear") emit(g, "spark", proj.x, proj.y, 2, { color: ["#ffffff", "#fde047", "#7dd3fc"], speed: 3, life: 8, grav: 0 });
  else if (s === "bloodCrescent") emit(g, "drop", proj.x, proj.y, 1, { color: "#be123c", speed: 1, life: 18 });
  else emit(g, "spark", proj.x, proj.y, 1, { color: proj.color, speed: 1.5, life: 12 });
}

/* ───────────── 8. Boss 場地機關 ───────────── */

export function drawHazard(ctx: CanvasRenderingContext2D, hz: any, frame: number, W = 900) {
  ctx.save();
  const warn = hz.warnTimer > 0;
  const act = !warn && hz.activeTimer > 0;
  const pulse = 0.5 + Math.sin(frame * 0.45) * 0.5;

  const label = (txt, y) => {
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.strokeText(txt, hz.x ?? W / 2, y);
    ctx.fillStyle = hz.color;
    ctx.fillText(txt, hz.x ?? W / 2, y);
  };

  switch (hz.type) {
    case "ice_spike": {
      if (warn) {
        ctx.globalAlpha = 0.4 + pulse * 0.5;
        ctx.strokeStyle = "#a5f3fc";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(hz.x, FLOOR + 2, hz.width * 0.7, 8, 0, 0, TAU);
        ctx.stroke();
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(hz.x, FLOOR + 2);
          ctx.lineTo(hz.x + Math.cos(i * 1.3) * hz.width * 0.7, FLOOR + 2 + Math.sin(i * 1.3) * 7);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        label(hz.label, FLOOR - 18);
      } else if (act) {
        const total = hz.activeMax || 22;
        const t = 1 - hz.activeTimer / total;
        const rise = smooth(clamp(t * 5, 0, 1)) * (t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1);
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowColor = "#22d3ee";
        ctx.shadowBlur = 18;
        const spikes = [[0, 140, 22], [-26, 95, 16], [24, 110, 16], [-46, 60, 12], [44, 70, 12]];
        for (const [ox, h, w] of spikes) {
          const hh = h * rise;
          const g = ctx.createLinearGradient(0, FLOOR - hh, 0, FLOOR);
          g.addColorStop(0, "#ffffff");
          g.addColorStop(0.4, "#a5f3fc");
          g.addColorStop(1, "rgba(14,116,144,0.6)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(hz.x + ox - w, FLOOR);
          ctx.lineTo(hz.x + ox - w * 0.2, FLOOR - hh * 0.6);
          ctx.lineTo(hz.x + ox + (ox > 0 ? 6 : ox < 0 ? -6 : 0), FLOOR - hh);
          ctx.lineTo(hz.x + ox + w * 0.3, FLOOR - hh * 0.55);
          ctx.lineTo(hz.x + ox + w, FLOOR);
          ctx.closePath();
          ctx.fill();
        }
      }
      break;
    }
    case "black_water": {
      const total = hz.activeMax || 200;
      const t = act ? 1 - hz.activeTimer / total : 0;
      const grow = warn ? 0.35 + (1 - hz.warnTimer / (hz.warnMax || 34)) * 0.4 : smooth(clamp(t * 6, 0, 1)) * (t > 0.85 ? 1 - (t - 0.85) / 0.15 : 1);
      const w = hz.width * (warn ? grow : 0.4 + grow * 0.6);
      const g = ctx.createRadialGradient(hz.x, FLOOR + 2, 4, hz.x, FLOOR + 2, w);
      g.addColorStop(0, "rgba(2,6,23,0.95)");
      g.addColorStop(0.7, "rgba(8,47,73,0.85)");
      g.addColorStop(1, "rgba(14,116,144,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(hz.x, FLOOR + 2, w, 12, 0, 0, TAU);
      ctx.fill();
      // 發光邊緣 + 漣漪，讓黑水在暗色地板上也看得清楚
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(34,211,238,${0.55 + pulse * 0.35})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = "#22d3ee";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.ellipse(hz.x, FLOOR + 2, w, 12, 0, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = 1;
      for (let k = 0; k < 2; k++) {
        const rr = ((frame * 0.6 + k * 30) % 60) / 60;
        ctx.strokeStyle = `rgba(103,232,249,${0.5 * (1 - rr)})`;
        ctx.beginPath();
        ctx.ellipse(hz.x, FLOOR + 2, w * rr, 12 * rr, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
      // 氣泡
      for (let i = 0; i < 7; i++) {
        const bx = hz.x + (hash(i * 3.1) - 0.5) * w * 1.4;
        const ph = ((frame * 0.05 + hash(i)) % 1);
        ctx.strokeStyle = `rgba(103,232,249,${0.6 * (1 - ph)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(bx, FLOOR - ph * 14, 2 + ph * 3, 0, TAU);
        ctx.stroke();
      }
      if (act) {
        // 黑水觸手
        for (let i = 0; i < 4; i++) {
          const bx = hz.x + (i - 1.5) * (w * 0.45);
          const hh = (34 + hash(i) * 26) * grow;
          const sw = Math.sin(frame * 0.15 + i * 1.7) * 10;
          ctx.strokeStyle = "rgba(2,6,23,0.95)";
          ctx.lineWidth = 7;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(bx, FLOOR + 2);
          ctx.quadraticCurveTo(bx + sw, FLOOR - hh * 0.5, bx - sw * 0.6, FLOOR - hh);
          ctx.stroke();
          ctx.strokeStyle = "rgba(34,211,238,0.85)";
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
      }
      label(hz.label, FLOOR - (act ? 70 : 20));
      break;
    }
    case "sky_lightning": {
      // 天空雷雲
      const cloudA = warn ? 1 - hz.warnTimer / (hz.warnMax || 36) : 1;
      ctx.fillStyle = `rgba(30,27,75,${0.75 * cloudA})`;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.ellipse(hz.x + (i - 2) * 22, 72 + Math.sin(i * 2) * 6, 26 * cloudA + 6, 14 * cloudA + 4, 0, 0, TAU);
        ctx.fill();
      }
      if (warn) {
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `rgba(253,224,71,${0.4 + pulse * 0.6})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(hz.x, FLOOR + 2, hz.width * 0.6 * (1.2 - cloudA * 0.2), 9, 0, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([6, 8]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(hz.x, 86);
        ctx.lineTo(hz.x, FLOOR);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = "bold 22px monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "#fde047";
        ctx.fillText("!", hz.x, FLOOR - 30 - pulse * 6);
        ctx.globalCompositeOperation = "source-over";
        label(hz.label, FLOOR - 58);
      } else if (act) {
        ctx.globalCompositeOperation = "lighter";
        const pts = [];
        for (let i = 0; i <= 10; i++) pts.push([hz.x + (i === 0 || i === 10 ? 0 : (hash(hz.seed + i * 7 + Math.floor(frame / 2)) - 0.5) * 36), lerp(78, FLOOR, i / 10)]);
        for (const [w, c] of [[hz.width * 0.5, "rgba(253,224,71,0.35)"], [12, "#fde047"], [5, "#ffffff"]]) {
          ctx.strokeStyle = c;
          ctx.lineWidth = w;
          ctx.shadowColor = "#fde047";
          ctx.shadowBlur = 24;
          ctx.beginPath();
          pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.stroke();
        }
        const g = ctx.createRadialGradient(hz.x, FLOOR, 2, hz.x, FLOOR, 70);
        g.addColorStop(0, "rgba(255,255,255,0.8)");
        g.addColorStop(1, "rgba(253,224,71,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(hz.x, FLOOR, 70, 18, 0, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case "format_beam": {
      if (warn) {
        ctx.globalAlpha = 0.5 + pulse * 0.5;
        ctx.strokeStyle = hz.color;
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.strokeRect(hz.x - hz.width / 2, 70, hz.width, FLOOR - 70);
        ctx.setLineDash([]);
        ctx.fillStyle = rgba(hz.color, 0.12);
        ctx.fillRect(hz.x - hz.width / 2, 70, hz.width, FLOOR - 70);
        ctx.globalAlpha = 1;
        label(hz.label, FLOOR - 16);
      } else if (act) {
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createLinearGradient(hz.x - hz.width / 2, 0, hz.x + hz.width / 2, 0);
        g.addColorStop(0, rgba(hz.color, 0));
        g.addColorStop(0.3, rgba(hz.color, 0.8));
        g.addColorStop(0.5, "#ffffff");
        g.addColorStop(0.7, rgba(hz.color, 0.8));
        g.addColorStop(1, rgba(hz.color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(hz.x - hz.width / 2, 60, hz.width, FLOOR - 56);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        for (let i = 0; i < 9; i++) ctx.fillText(GLYPHS[(frame + i * 7) % GLYPHS.length], hz.x + (hash(i) - 0.5) * hz.width * 0.6, FLOOR - ((frame * 9 + i * 37) % (FLOOR - 70)));
      }
      break;
    }
    case "laser_sweep": {
      const y = hz.y;
      if (warn) {
        ctx.globalAlpha = 0.35 + pulse * 0.65;
        ctx.strokeStyle = "#ff4d6d";
        ctx.lineWidth = 2;
        ctx.setLineDash([14, 8]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255,77,109,0.10)";
        ctx.fillRect(0, y - hz.thick / 2, W, hz.thick);
        ctx.globalAlpha = 1;
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "center";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        const txt = hz.label;
        ctx.strokeText(txt, W / 2, y - 14);
        ctx.fillStyle = "#ff4d6d";
        ctx.fillText(txt, W / 2, y - 14);
      } else if (act) {
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createLinearGradient(0, y - hz.thick, 0, y + hz.thick);
        g.addColorStop(0, "rgba(255,77,109,0)");
        g.addColorStop(0.35, "rgba(255,77,109,0.85)");
        g.addColorStop(0.5, "#ffffff");
        g.addColorStop(0.65, "rgba(255,77,109,0.85)");
        g.addColorStop(1, "rgba(255,77,109,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, y - hz.thick, W, hz.thick * 2);
        ctx.fillStyle = "#ffffff";
        for (let i = 0; i < 10; i++) ctx.fillRect(((frame * 23 + i * 97) % W), y - 1 + (hash(i + frame) - 0.5) * hz.thick, 18, 2);
      }
      break;
    }
    case "phantom": {
      // 敵人分身：預警箭頭 → 從畫面另一端貼地突進（跳起來閃避）
      if (warn) {
        const edge = hz.dir > 0 ? 20 : W - 20;
        ctx.globalAlpha = 0.4 + pulse * 0.6;
        ctx.fillStyle = "#c084fc";
        ctx.font = "bold 22px monospace";
        ctx.textAlign = "center";
        ctx.fillText(hz.dir > 0 ? "▶▶" : "◀◀", edge + hz.dir * 20, FLOOR - 50);
        ctx.globalAlpha = 1;
        label("分身突進！跳起來閃避", FLOOR - 120);
      } else if (act && hz.snap) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let k = 0; k < 3; k++) {
          ctx.globalAlpha = 0.45 - k * 0.12;
          drawFighter(ctx, { ...hz.snap, x: hz.x - hz.dir * k * 26, facing: hz.dir, state: "attack", attackType: "skill3", stateTimer: 10, attackDuration: 26 }, frame, { ghost: true, alpha: 1 });
        }
        ctx.restore();
      }
      break;
    }
    case "data_block": {
      const s = hz.size;
      if (warn || hz.y < FLOOR - s) {
        // 地面落點陰影 + 準星
        const k = clamp(1 - (FLOOR - (hz.y ?? 0)) / 360, 0.2, 1);
        ctx.fillStyle = `rgba(0,0,0,${0.25 + k * 0.35})`;
        ctx.beginPath();
        ctx.ellipse(hz.x, FLOOR + 3, s * 0.7 * k + 6, 5, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = `rgba(255,77,109,${0.5 + pulse * 0.5})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(hz.x - s * 0.6, FLOOR + 3);
        ctx.lineTo(hz.x + s * 0.6, FLOOR + 3);
        ctx.moveTo(hz.x, FLOOR - 6);
        ctx.lineTo(hz.x, FLOOR + 10);
        ctx.stroke();
      }
      if (!warn && hz.y !== undefined && !hz.landed) {
        const col = hz.color;
        const x = hz.x - s / 2;
        const y = hz.y - s;
        ctx.fillStyle = rgba(col, 0.28);
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.fillRect(x, y, s, s);
        ctx.strokeRect(x, y, s, s);
        poly(ctx, [[x, y], [x + 8, y - 8], [x + s + 8, y - 8], [x + s, y]], rgba(col, 0.45), col, 1.5);
        poly(ctx, [[x + s, y], [x + s + 8, y - 8], [x + s + 8, y + s - 8], [x + s, y + s]], rgba(col, 0.18), col, 1.5);
        ctx.fillStyle = col;
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(frame % 16 < 8 ? "0x1F" : "NULL", hz.x, hz.y - s / 2 + 3);
      }
      break;
    }
  }
  ctx.restore();
}

/* ───────────── 9. 關卡背景 ───────────── */

const stageCache: Record<string, HTMLCanvasElement> = {};

function staticLayer(key: string, W: number, H: number, paint: (c: CanvasRenderingContext2D) => void, dpr = 1) {
  const id = `${key}:${W}x${H}@${dpr}`;
  if (stageCache[id]) return stageCache[id];
  const c = document.createElement("canvas");
  c.width = Math.round(W * dpr);
  c.height = Math.round(H * dpr);
  const cx = c.getContext("2d");
  cx.scale(dpr, dpr);
  paint(cx);
  stageCache[id] = c;
  return c;
}

function vgrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

function skyline(ctx, W, baseY, count, minH, maxH, col, seed, windows = null) {
  let x = -10;
  let i = 0;
  while (x < W + 10) {
    const w = 30 + hash(seed + i) * 50;
    const h = minH + hash(seed + i * 3.3) * (maxH - minH);
    ctx.fillStyle = col;
    ctx.fillRect(x, baseY - h, w, h);
    if (windows) {
      for (let wy = baseY - h + 8; wy < baseY - 8; wy += 11) {
        for (let wx = x + 5; wx < x + w - 5; wx += 9) {
          if (hash(wx * 0.37 + wy * 1.7 + seed) > 0.62) {
            ctx.fillStyle = windows;
            ctx.fillRect(wx, wy, 4, 5);
          }
        }
      }
    }
    x += w + 2;
    i++;
  }
}

/** key：village | cave | mansion | abyss | skyisle | demon | core | dojo */
export function drawStage(ctx: CanvasRenderingContext2D, key: string, frame: number, W: number, H: number, opts: any = {}) {
  const F = FLOOR;
  const dpr = ctx.canvas.width / W;
  const layer = staticLayer(key, W, H, (c) => paintStatic(c, key, W, H), Math.round(dpr * 100) / 100);
  ctx.drawImage(layer, 0, 0, W, H);

  switch (key) {
    case "village": {
      // 屋頂火焰 + 餘燼 + 煙
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const [hx, hy, s] of [[110, 300, 1], [300, 284, 1.3], [560, 296, 1.1], [780, 280, 1.4]]) {
        const fl = Math.sin(frame * 0.3 + hx) * 4;
        const g = ctx.createRadialGradient(hx, hy, 4, hx, hy, 90 * s);
        g.addColorStop(0, "rgba(255,150,40,0.45)");
        g.addColorStop(1, "rgba(255,80,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(hx - 90 * s, hy - 90 * s, 180 * s, 180 * s);
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = ["rgba(220,38,38,0.8)", "rgba(249,115,22,0.85)", "rgba(254,240,138,0.9)"][k];
          ctx.beginPath();
          const w = (26 - k * 7) * s;
          const h = (46 - k * 12) * s + fl * (k + 1) * 0.5;
          ctx.moveTo(hx - w, hy);
          ctx.quadraticCurveTo(hx - w * 0.6, hy - h * 0.5, hx + Math.sin(frame * 0.2 + k) * 4, hy - h);
          ctx.quadraticCurveTo(hx + w * 0.6, hy - h * 0.5, hx + w, hy);
          ctx.fill();
        }
      }
      for (let i = 0; i < 36; i++) {
        const x = hash(i) * W + Math.sin(frame * 0.03 + i) * 12;
        const y = F - ((frame * (0.8 + hash(i + 3)) + hash(i + 9) * 400) % 330);
        ctx.fillStyle = i % 3 ? "rgba(251,146,60,0.9)" : "rgba(254,240,138,0.9)";
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.restore();
      break;
    }
    case "cave": {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const tx of [140, 760]) {
        const fl = 0.85 + Math.sin(frame * 0.4 + tx) * 0.15;
        const g = ctx.createRadialGradient(tx, 200, 4, tx, 200, 130 * fl);
        g.addColorStop(0, "rgba(255,170,60,0.5)");
        g.addColorStop(1, "rgba(255,120,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(tx - 140, 70, 280, 280);
        ctx.fillStyle = "rgba(254,215,102,0.95)";
        ctx.beginPath();
        ctx.ellipse(tx, 196 - fl * 3, 6, 12 * fl, 0, 0, TAU);
        ctx.fill();
      }
      for (let i = 0; i < 6; i++) {
        const mx = 60 + i * 150 + hash(i) * 40;
        const pulse = 0.4 + Math.sin(frame * 0.05 + i) * 0.3;
        ctx.fillStyle = `rgba(74,222,128,${pulse})`;
        ctx.beginPath();
        ctx.ellipse(mx, F - 6, 8, 4, 0, Math.PI, TAU);
        ctx.fill();
      }
      ctx.restore();
      // 水滴
      for (let i = 0; i < 5; i++) {
        const x = 90 + i * 180;
        const y = 70 + ((frame * 3 + i * 70) % 300);
        ctx.fillStyle = "rgba(125,211,252,0.6)";
        ctx.fillRect(x, y, 2, 5);
      }
      break;
    }
    case "mansion": {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(700, 98, 40, 700, 98, 140);
      g.addColorStop(0, `rgba(220,38,38,${0.35 + Math.sin(frame * 0.04) * 0.08})`);
      g.addColorStop(1, "rgba(220,38,38,0)");
      ctx.fillStyle = g;
      ctx.fillRect(560, 0, 280, 260);
      // 窗戶閃爍
      for (let i = 0; i < 8; i++) {
        const on = hash(i + Math.floor(frame / 40)) > 0.35;
        if (!on) continue;
        ctx.fillStyle = "rgba(253,224,71,0.55)";
        ctx.fillRect(150 + (i % 4) * 46, 200 + Math.floor(i / 4) * 44, 12, 18);
      }
      ctx.restore();
      // 蝙蝠
      ctx.fillStyle = "#0a0204";
      for (let i = 0; i < 5; i++) {
        const bx = ((frame * (1.2 + hash(i)) + i * 200) % (W + 80)) - 40;
        const by = 80 + i * 22 + Math.sin(frame * 0.08 + i) * 12;
        const wing = Math.sin(frame * 0.5 + i) * 5;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - 10, by - 4 - wing);
        ctx.lineTo(bx - 4, by);
        ctx.lineTo(bx, by + 3);
        ctx.lineTo(bx + 4, by);
        ctx.lineTo(bx + 10, by - 4 - wing);
        ctx.closePath();
        ctx.fill();
      }
      // 地面霧氣
      ctx.fillStyle = "rgba(190,18,60,0.10)";
      for (let i = 0; i < 6; i++) {
        const fx = ((frame * 0.6 + i * 170) % (W + 200)) - 100;
        ctx.beginPath();
        ctx.ellipse(fx, F - 6, 120, 16, 0, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case "abyss": {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 6; i++) {
        const cx = [70, 180, 300, 620, 760, 850][i];
        const pulse = 0.25 + Math.sin(frame * 0.05 + i) * 0.15;
        const g = ctx.createRadialGradient(cx, 300, 4, cx, 300, 90);
        g.addColorStop(0, `rgba(103,232,249,${pulse})`);
        g.addColorStop(1, "rgba(103,232,249,0)");
        ctx.fillStyle = g;
        ctx.fillRect(cx - 90, 210, 180, 180);
      }
      ctx.restore();
      // 雪 / 冰霧
      for (let i = 0; i < 40; i++) {
        const x = (hash(i) * W + frame * (0.3 + hash(i + 1) * 0.5)) % W;
        const y = (hash(i + 7) * F + frame * (0.6 + hash(i + 2))) % F;
        ctx.fillStyle = "rgba(224,242,254,0.7)";
        ctx.fillRect(x, y, 2, 2);
      }
      // 黑水水面波紋
      ctx.strokeStyle = "rgba(103,232,249,0.25)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const y = F + 10 + i * 9;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.03 + frame * 0.05 + i) * 2);
        ctx.stroke();
      }
      break;
    }
    case "skyisle": {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(150, 96);
      ctx.rotate(frame * 0.003);
      for (let i = 0; i < 12; i++) {
        ctx.rotate(TAU / 12);
        ctx.fillStyle = "rgba(255,236,170,0.06)";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(600, -30);
        ctx.lineTo(600, 30);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      // 雲
      for (const [speed, y, alpha, scale] of [[0.15, 150, 0.35, 1.2], [0.4, 250, 0.55, 0.9], [0.7, 330, 0.7, 1.4]]) {
        for (let i = 0; i < 4; i++) {
          const cx = ((frame * speed + i * 280) % (W + 300)) - 150;
          ctx.fillStyle = `rgba(255,255,255,${alpha})`;
          for (let k = 0; k < 4; k++) {
            ctx.beginPath();
            ctx.ellipse(cx + k * 26 * scale, y + Math.sin(k * 2.3) * 6, 34 * scale, 14 * scale, 0, 0, TAU);
            ctx.fill();
          }
        }
      }
      break;
    }
    case "demon": {
      // 漂浮的錯誤碼符文 + 偶發閃電
      ctx.save();
      ctx.font = "bold 12px monospace";
      const words = ["NULL", "0xDEAD", "{ }", "segfault", "undefined", "NaN", "while(1)", "404"];
      for (let i = 0; i < 10; i++) {
        const x = (hash(i) * W + frame * 0.2 * (i % 3 + 1)) % W;
        const y = 110 + ((hash(i + 4) * 220 - frame * 0.3 * (1 + (i % 2))) % 220 + 220) % 220;
        ctx.fillStyle = i % 2 ? "rgba(168,85,247,0.45)" : "rgba(0,255,136,0.35)";
        ctx.fillText(words[i % words.length], x, y);
      }
      ctx.restore();
      if (frame % 260 < 5) {
        ctx.fillStyle = "rgba(216,180,254,0.18)";
        ctx.fillRect(0, 0, W, F);
      }
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(168,85,247,${0.4 + Math.sin(frame * 0.08) * 0.25})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const x = 70 + i * 150;
        ctx.beginPath();
        ctx.moveTo(x, F + 4);
        ctx.lineTo(x + 20, F + 18);
        ctx.lineTo(x + 8, F + 34);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case "core": {
      const oc = !!opts.overclock;
      // 中央核心環
      ctx.save();
      ctx.translate(W / 2, 200);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 3; i++) {
        ctx.rotate(frame * 0.004 * (i % 2 ? -1 : 1));
        ctx.strokeStyle = oc ? `rgba(255,77,109,${0.25 - i * 0.05})` : `rgba(0,255,136,${0.22 - i * 0.05})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([20 + i * 10, 12]);
        ctx.beginPath();
        ctx.arc(0, 0, 70 + i * 34, 0, TAU);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
      // 矩陣代碼雨（超頻時變成紅色亂碼）
      ctx.save();
      ctx.font = "bold 12px monospace";
      const cols = 34;
      for (let c = 0; c < cols; c++) {
        const x = c * (W / cols) + 6;
        const speed = 2 + hash(c) * 3;
        const headY = ((frame * speed + hash(c + 9) * 600) % (F + 160)) - 80;
        for (let k = 0; k < 9; k++) {
          const y = headY - k * 14;
          if (y < 60 || y > F - 4) continue;
          const a = (1 - k / 9) * (oc ? 0.55 : 0.4);
          ctx.fillStyle = k === 0 ? (oc ? `rgba(255,220,220,${a + 0.3})` : `rgba(210,255,230,${a + 0.3})`) : oc ? `rgba(255,77,109,${a})` : `rgba(0,255,136,${a})`;
          const set = oc ? GARBLE : GLYPHS;
          ctx.fillText(set[(c * 7 + k * 3 + Math.floor(frame / (oc ? 3 : 8))) % set.length], x, y);
        }
      }
      ctx.restore();
      // LED 閃爍
      for (let i = 0; i < 24; i++) {
        if (hash(i + Math.floor(frame / 12)) < 0.5) continue;
        const side = i % 2 ? W - 60 : 30;
        ctx.fillStyle = oc ? "#ff4d6d" : "#00ff88";
        ctx.fillRect(side + (i % 3) * 8, 120 + Math.floor(i / 2) * 20, 4, 3);
      }
      if (oc) {
        const g = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 560);
        g.addColorStop(0, "rgba(120,0,20,0)");
        g.addColorStop(1, `rgba(190,18,60,${0.35 + Math.sin(frame * 0.2) * 0.1})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        if (frame % 60 < 30) {
          ctx.font = "bold 14px monospace";
          ctx.textAlign = "center";
          ctx.fillStyle = "rgba(255,77,109,0.75)";
          ctx.fillText("SYSTEM OVERCLOCK // KERNEL PANIC", W / 2, 84);
        }
      }
      break;
    }
    case "dojo": {
      // 星星閃爍 + 霓虹招牌
      for (let i = 0; i < 40; i++) {
        const a = 0.3 + Math.sin(frame * 0.05 + i * 1.7) * 0.3;
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(hash(i) * W, hash(i + 3) * 160 + 60, 2, 2);
      }
      const on = !(frame % 180 < 8 && frame % 4 < 2);
      ctx.save();
      ctx.font = "bold 22px monospace";
      ctx.textAlign = "center";
      ctx.shadowColor = "#ff4d6d";
      ctx.shadowBlur = on ? 18 : 0;
      ctx.fillStyle = on ? "#ff7a90" : "#5b1a25";
      ctx.fillText("東吳 AI CLUB", 690, 168);
      ctx.restore();
      break;
    }
  }

  if (opts.dim) {
    ctx.fillStyle = `rgba(0,0,0,${opts.dim})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function paintStatic(c: CanvasRenderingContext2D, key: string, W: number, H: number) {
  const F = FLOOR;
  switch (key) {
    case "village": {
      c.fillStyle = vgrad(c, 0, F, [[0, "#1a0505"], [0.55, "#5c1a0b"], [1, "#b4400f"]]);
      c.fillRect(0, 0, W, F);
      c.fillStyle = "#2a0b06";
      c.beginPath();
      c.moveTo(0, 270);
      for (let x = 0; x <= W; x += 60) c.lineTo(x, 240 + Math.sin(x * 0.012) * 30 + hash(x) * 20);
      c.lineTo(W, F);
      c.lineTo(0, F);
      c.fill();
      for (const [hx, w, h] of [[110, 90, 70], [300, 120, 90], [560, 100, 78], [780, 130, 96]]) {
        c.fillStyle = "#120604";
        c.fillRect(hx - w / 2, F - h, w, h);
        c.beginPath();
        c.moveTo(hx - w / 2 - 10, F - h);
        c.lineTo(hx, F - h - 42);
        c.lineTo(hx + w / 2 + 10, F - h);
        c.fill();
        c.fillStyle = "#f97316";
        c.fillRect(hx - 18, F - h + 22, 12, 14);
        c.fillRect(hx + 8, F - h + 22, 12, 14);
      }
      c.fillStyle = vgrad(c, F, H, [[0, "#3f160a"], [1, "#0f0503"]]);
      c.fillRect(0, F, W, H - F);
      for (let i = 0; i < 120; i++) {
        c.fillStyle = "rgba(0,0,0,0.25)";
        c.fillRect(hash(i) * W, F + hash(i + 1) * (H - F), 3, 2);
      }
      c.strokeStyle = "#f97316";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, F);
      c.lineTo(W, F);
      c.stroke();
      break;
    }
    case "cave": {
      c.fillStyle = vgrad(c, 0, F, [[0, "#020a06"], [1, "#0f2a1b"]]);
      c.fillRect(0, 0, W, F);
      c.fillStyle = "#13301f";
      c.beginPath();
      c.moveTo(0, 0);
      for (let x = 0; x <= W; x += 30) c.lineTo(x, 60 + hash(x * 0.3) * 40);
      c.lineTo(W, 0);
      c.fill();
      c.fillStyle = "#0a1f14";
      for (let i = 0; i < 14; i++) {
        const x = hash(i * 2.2) * W;
        c.beginPath();
        c.moveTo(x - 12, 70);
        c.lineTo(x, 110 + hash(i) * 60);
        c.lineTo(x + 12, 70);
        c.fill();
      }
      c.fillStyle = "#0b2417";
      c.beginPath();
      c.moveTo(0, F);
      c.lineTo(0, 120);
      c.quadraticCurveTo(70, 220, 40, F);
      c.fill();
      c.beginPath();
      c.moveTo(W, F);
      c.lineTo(W, 120);
      c.quadraticCurveTo(W - 70, 220, W - 40, F);
      c.fill();
      for (const tx of [140, 760]) {
        c.fillStyle = "#3f2e18";
        c.fillRect(tx - 3, 205, 6, 40);
      }
      c.fillStyle = vgrad(c, F, H, [[0, "#173d26"], [1, "#04100a"]]);
      c.fillRect(0, F, W, H - F);
      for (let i = 0; i < 18; i++) {
        c.fillStyle = "#0e2a1a";
        c.beginPath();
        c.ellipse(hash(i) * W, F + 8 + hash(i + 1) * 30, 14 + hash(i + 2) * 18, 6, 0, 0, TAU);
        c.fill();
      }
      c.strokeStyle = "#4ade80";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, F);
      c.lineTo(W, F);
      c.stroke();
      break;
    }
    case "mansion": {
      c.fillStyle = vgrad(c, 0, F, [[0, "#09010a"], [0.6, "#2a0613"], [1, "#4a0d22"]]);
      c.fillRect(0, 0, W, F);
      c.fillStyle = "#b91c1c";
      c.beginPath();
      c.arc(700, 98, 52, 0, TAU);
      c.fill();
      c.fillStyle = "rgba(127,29,29,0.6)";
      for (const [x, y, r] of [[684, 86, 10], [716, 110, 7], [706, 78, 5]]) {
        c.beginPath();
        c.arc(x, y, r, 0, TAU);
        c.fill();
      }
      c.fillStyle = "#0d0306";
      c.fillRect(120, 180, 200, 200);
      c.fillRect(140, 120, 40, 70);
      c.fillRect(260, 100, 44, 90);
      for (const [x, w] of [[160, 20], [282, 22]]) {
        c.beginPath();
        c.moveTo(x - w - 4, 120 + (x > 200 ? -20 : 0));
        c.lineTo(x, 60 + (x > 200 ? -20 : 0));
        c.lineTo(x + w + 4, 120 + (x > 200 ? -20 : 0));
        c.fill();
      }
      for (let i = 0; i < 8; i++) {
        c.fillStyle = "#2a0a12";
        c.fillRect(150 + (i % 4) * 46, 200 + Math.floor(i / 4) * 44, 12, 18);
      }
      c.strokeStyle = "#0d0306";
      c.lineWidth = 3;
      for (let x = 0; x < W; x += 24) {
        c.beginPath();
        c.moveTo(x, F);
        c.lineTo(x, F - 46);
        c.stroke();
        c.beginPath();
        c.moveTo(x - 4, F - 44);
        c.lineTo(x, F - 52);
        c.lineTo(x + 4, F - 44);
        c.fillStyle = "#0d0306";
        c.fill();
      }
      c.fillRect(0, F - 40, W, 3);
      // 大理石棋盤地板
      for (let row = 0; row < 4; row++) {
        const y0 = F + row * 14;
        for (let col = -2; col < 22; col++) {
          const sk = (row - 1.5) * 10;
          c.fillStyle = (row + col) % 2 ? "#2b0a14" : "#12040a";
          c.beginPath();
          c.moveTo(col * 46 + sk * row * 0.2, y0);
          c.lineTo((col + 1) * 46 + sk * row * 0.2, y0);
          c.lineTo((col + 1) * 46 + sk * (row + 1) * 0.2, y0 + 14);
          c.lineTo(col * 46 + sk * (row + 1) * 0.2, y0 + 14);
          c.fill();
        }
      }
      c.strokeStyle = "#e11d48";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, F);
      c.lineTo(W, F);
      c.stroke();
      break;
    }
    case "abyss": {
      c.fillStyle = vgrad(c, 0, F, [[0, "#01040d"], [0.6, "#041628"], [1, "#0a2c4a"]]);
      c.fillRect(0, 0, W, F);
      const crystal = (x, base, h, w) => {
        const g = c.createLinearGradient(x, base - h, x, base);
        g.addColorStop(0, "#e0f2fe");
        g.addColorStop(0.5, "#38bdf8");
        g.addColorStop(1, "#0c4a6e");
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(x - w, base);
        c.lineTo(x - w * 0.3, base - h * 0.7);
        c.lineTo(x, base - h);
        c.lineTo(x + w * 0.4, base - h * 0.6);
        c.lineTo(x + w, base);
        c.fill();
        c.strokeStyle = "rgba(224,242,254,0.5)";
        c.lineWidth = 1;
        c.stroke();
      };
      for (const [x, h, w] of [[50, 150, 22], [90, 100, 16], [170, 70, 12], [640, 80, 14], [740, 130, 20], [820, 170, 24], [870, 90, 14]]) crystal(x, F, h, w);
      c.fillStyle = "#0c2a44";
      for (let i = 0; i < 18; i++) {
        const x = hash(i * 1.9) * W;
        c.beginPath();
        c.moveTo(x - 8, 60);
        c.lineTo(x, 90 + hash(i) * 50);
        c.lineTo(x + 8, 60);
        c.fill();
      }
      c.fillStyle = "#06111f";
      c.fillRect(0, 50, W, 14);
      c.fillStyle = vgrad(c, F, H, [[0, "#06223a"], [1, "#010611"]]);
      c.fillRect(0, F, W, H - F);
      c.strokeStyle = "#67e8f9";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, F);
      c.lineTo(W, F);
      c.stroke();
      break;
    }
    case "skyisle": {
      c.fillStyle = vgrad(c, 0, F, [[0, "#0b1736"], [0.45, "#1e3a8a"], [0.8, "#b45309"], [1, "#f59e0b"]]);
      c.fillRect(0, 0, W, F);
      const g = c.createRadialGradient(150, 96, 10, 150, 96, 120);
      g.addColorStop(0, "rgba(255,251,235,1)");
      g.addColorStop(0.25, "rgba(253,224,71,0.8)");
      g.addColorStop(1, "rgba(253,224,71,0)");
      c.fillStyle = g;
      c.fillRect(30, 0, 240, 220);
      // 遠方浮空島：岩石底座 + 草地 + 瀑布（帶一點大氣透視的藍色調）
      for (const [x, y, w] of [[380, 210, 120], [640, 170, 90], [820, 240, 70]]) {
        const rock = c.createLinearGradient(0, y, 0, y + w * 0.5);
        rock.addColorStop(0, "#6b5a7a");
        rock.addColorStop(1, "rgba(30,41,90,0.2)");
        c.fillStyle = rock;
        c.beginPath();
        c.moveTo(x - w / 2, y);
        for (let k = 1; k <= 6; k++) c.lineTo(x - w / 2 + (w * k) / 7, y + w * (0.18 + hash(x + k) * 0.32));
        c.lineTo(x + w / 2, y);
        c.closePath();
        c.fill();
        c.fillStyle = "#4d7c5a";
        c.beginPath();
        c.ellipse(x, y, w / 2, 9, 0, 0, TAU);
        c.fill();
        c.fillStyle = "#7fbf7f";
        c.beginPath();
        c.ellipse(x - 4, y - 3, w / 2 - 8, 5, 0, 0, TAU);
        c.fill();
        c.fillStyle = "rgba(219,234,254,0.55)";
        c.fillRect(x + w * 0.18, y + 4, 4, 70);
        c.fillStyle = "rgba(219,234,254,0.25)";
        c.fillRect(x + w * 0.18 - 3, y + 4, 10, 70);
      }
      c.fillStyle = vgrad(c, F, H, [[0, "#fef3c7"], [0.2, "#d6c48f"], [1, "#6b5a2a"]]);
      c.fillRect(0, F, W, H - F);
      c.strokeStyle = "rgba(180,83,9,0.6)";
      c.lineWidth = 1;
      for (let i = -6; i <= 16; i++) {
        c.beginPath();
        c.moveTo(i * 75, F);
        c.lineTo(W / 2 + (i - 5) * 135, H);
        c.stroke();
      }
      c.strokeStyle = "#fbbf24";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(0, F);
      c.lineTo(W, F);
      c.stroke();
      break;
    }
    case "demon": {
      c.fillStyle = vgrad(c, 0, F, [[0, "#06010d"], [0.7, "#2d0f4d"], [1, "#6b1d2a"]]);
      c.fillRect(0, 0, W, F);
      c.fillStyle = "#0a0314";
      c.fillRect(300, 150, 300, F - 150);
      for (const [x, w, h] of [[300, 40, 150], [380, 34, 200], [450, 50, 250], [530, 34, 190], [590, 40, 140]]) {
        c.fillRect(x - w / 2, F - h - 60, w, h);
        c.beginPath();
        c.moveTo(x - w / 2 - 6, F - h - 60);
        c.lineTo(x, F - h - 110);
        c.lineTo(x + w / 2 + 6, F - h - 60);
        c.fill();
      }
      for (let i = 0; i < 10; i++) {
        c.fillStyle = "rgba(168,85,247,0.6)";
        c.fillRect(330 + (i % 5) * 52, 200 + Math.floor(i / 5) * 60, 8, 14);
      }
      c.fillStyle = vgrad(c, F, H, [[0, "#1c0b2e"], [1, "#05010a"]]);
      c.fillRect(0, F, W, H - F);
      c.strokeStyle = "#a855f7";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, F);
      c.lineTo(W, F);
      c.stroke();
      break;
    }
    case "core": {
      c.fillStyle = vgrad(c, 0, F, [[0, "#000402"], [1, "#03140c"]]);
      c.fillRect(0, 0, W, F);
      for (const x of [10, W - 80]) {
        c.fillStyle = "#04120b";
        c.fillRect(x, 100, 70, F - 100);
        c.strokeStyle = "#0b3a24";
        c.lineWidth = 1;
        for (let y = 110; y < F; y += 20) c.strokeRect(x + 6, y, 58, 14);
      }
      c.fillStyle = vgrad(c, F, H, [[0, "#04170e"], [1, "#000"]]);
      c.fillRect(0, F, W, H - F);
      c.strokeStyle = "rgba(0,255,136,0.25)";
      c.lineWidth = 1;
      for (let i = -8; i <= 18; i++) {
        c.beginPath();
        c.moveTo(i * 60, F);
        c.lineTo(W / 2 + (i - 5) * 150, H);
        c.stroke();
      }
      for (let y = F + 10; y < H; y += 12) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(W, y);
        c.stroke();
      }
      c.strokeStyle = "#00ff88";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, F);
      c.lineTo(W, F);
      c.stroke();
      break;
    }
    case "dojo":
    default: {
      c.fillStyle = vgrad(c, 0, F, [[0, "#04050f"], [0.6, "#14163a"], [1, "#2b1f55"]]);
      c.fillRect(0, 0, W, F);
      c.fillStyle = "#f8fafc";
      c.beginPath();
      c.arc(180, 90, 30, 0, TAU);
      c.fill();
      c.fillStyle = "#14163a";
      c.beginPath();
      c.arc(192, 84, 26, 0, TAU);
      c.fill();
      skyline(c, W, F - 40, 20, 60, 170, "#0c0d24", 11, "rgba(253,224,71,0.35)");
      skyline(c, W, F - 30, 20, 30, 90, "#07081a", 47, "rgba(0,229,255,0.35)");
      c.fillStyle = "#1e1b2e";
      c.fillRect(0, F - 30, W, 30);
      c.fillStyle = "#2a2540";
      for (let x = 0; x < W; x += 30) c.fillRect(x, F - 30, 3, 30);
      c.fillRect(0, F - 32, W, 4);
      c.fillStyle = vgrad(c, F, H, [[0, "#2b2a45"], [1, "#0a0a18"]]);
      c.fillRect(0, F, W, H - F);
      c.strokeStyle = "rgba(0,229,255,0.22)";
      c.lineWidth = 1;
      for (let i = -6; i <= 16; i++) {
        c.beginPath();
        c.moveTo(i * 75, F);
        c.lineTo(W / 2 + (i - 5) * 135, H);
        c.stroke();
      }
      c.strokeStyle = "#00e5ff";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, F);
      c.lineTo(W, F);
      c.stroke();
    }
  }
}

/* ───────────── 10. HUD 元件 ───────────── */

/** 斜角血條：side = left（往右遞減）或 right */
export function drawBar(ctx, x, y, w, h, ratio, trail, side, colA, colB, frame) {
  const sl = 10;
  const shape = (wid) => {
    ctx.beginPath();
    if (side === "left") {
      ctx.moveTo(x + w - wid, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w - sl, y + h);
      ctx.lineTo(x + w - wid - sl, y + h);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x + wid, y);
      ctx.lineTo(x + wid + sl, y + h);
      ctx.lineTo(x + sl, y + h);
    }
    ctx.closePath();
  };
  ctx.save();
  shape(w);
  ctx.fillStyle = "rgba(10,6,10,0.85)";
  ctx.fill();
  shape(Math.max(0, trail) * w);
  ctx.fillStyle = "#ff4d6d";
  ctx.fill();
  shape(Math.max(0, ratio) * w);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  const low = ratio < 0.28;
  g.addColorStop(0, low && frame % 20 < 10 ? "#fff7ae" : colA);
  g.addColorStop(1, low ? "#f59e0b" : colB);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(x + (side === "left" ? w - ratio * w : 0), y + 2, ratio * w, 3);
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 10; i++) {
    const tx = x + (w * i) / 10;
    ctx.beginPath();
    ctx.moveTo(tx, y + 1);
    ctx.lineTo(tx, y + h - 1);
    ctx.stroke();
  }
  shape(w);
  ctx.strokeStyle = "#fde68a";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/** 圓形角色頭像（直接把角色畫進去再裁切） */
export function drawPortrait(ctx, cx, cy, r, f, side, frame) {
  const vis = visualOf(f);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
  g.addColorStop(0, rgba(f.cfg?.color || "#00e5ff", 0.55));
  g.addColorStop(1, "rgba(5,8,10,0.95)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  const z = r / 17;
  ctx.translate(cx, cy);
  ctx.scale(z, z);
  drawFighter(ctx, { ...f, x: 0, y: (99 * vis.scale) + 2, state: "idle", attackType: null, vx: 0, vy: 0, facing: side === "left" ? 1 : -1, invincibleTimer: 0 }, frame, { portrait: true });
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = "#fde68a";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

export function outlinedText(ctx, text, x, y, size, fill, stroke = "#000", align = "center", lw = 5) {
  ctx.save();
  ctx.font = `900 ${size}px monospace`;
  ctx.textAlign = align;
  ctx.lineJoin = "round";
  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** 中央大字橫幅（ROUND / FIGHT / K.O. / YOU WIN） */
export function drawBanner(ctx, W, H, text, sub, frame, age = 99) {
  const pop = age < 8 ? 1.6 - (age / 8) * 0.6 : 1;
  ctx.save();
  const bandH = 104;
  const y0 = H / 2 - 58;
  const g = ctx.createLinearGradient(0, y0, 0, y0 + bandH);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.2, "rgba(3,6,10,0.82)");
  g.addColorStop(0.8, "rgba(3,6,10,0.82)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, W, bandH);
  ctx.strokeStyle = "rgba(253,224,71,0.25)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const x = ((frame * 6 + i * 90) % (W + 100)) - 50;
    ctx.beginPath();
    ctx.moveTo(x, y0 + 14);
    ctx.lineTo(x + 30, y0 + 14);
    ctx.moveTo(W - x, y0 + bandH - 14);
    ctx.lineTo(W - x - 30, y0 + bandH - 14);
    ctx.stroke();
  }
  ctx.translate(W / 2, H / 2 - 4);
  ctx.scale(pop, pop);
  const tg = ctx.createLinearGradient(0, -34, 0, 6);
  tg.addColorStop(0, "#fff7ae");
  tg.addColorStop(0.5, "#ffd60a");
  tg.addColorStop(1, "#f97316");
  ctx.font = "900 42px monospace";
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#1a0505";
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = tg;
  ctx.shadowColor = "#ff4d6d";
  ctx.shadowBlur = 18;
  ctx.fillText(text, 0, 0);
  ctx.restore();
  if (sub) outlinedText(ctx, sub, W / 2, H / 2 + 30, 14, "#7dffb6", "#000", "center", 4);
}

/** 頂部中央的回合計時器 */
export function drawTimer(ctx, W, topY, timer) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(W / 2 - 30, topY - 6);
  ctx.lineTo(W / 2 + 30, topY - 6);
  ctx.lineTo(W / 2 + 24, topY + 38);
  ctx.lineTo(W / 2 - 24, topY + 38);
  ctx.closePath();
  ctx.fillStyle = "rgba(7,19,24,0.92)";
  ctx.fill();
  ctx.strokeStyle = "#fde68a";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  outlinedText(ctx, String(timer).padStart(2, "0"), W / 2, topY + 26, 28, timer <= 15 ? "#ff4d6d" : "#ffd60a", "#000", "center", 5);
}

/** 分段必殺氣條（滿格時閃爍）；side = right 時由右往左填 */
export function drawMeter(ctx, x, y, w, h, energy, side, frame) {
  const full = energy >= 100;
  const ratio = clamp(energy / 100, 0, 1);
  ctx.save();
  ctx.fillStyle = "rgba(5,10,14,0.85)";
  ctx.fillRect(x, y, w, h);
  const eg = ctx.createLinearGradient(x, 0, x + w, 0);
  eg.addColorStop(side === "right" ? 1 : 0, "#0ea5e9");
  eg.addColorStop(side === "right" ? 0 : 1, full ? "#ffd60a" : "#00e5ff");
  ctx.fillStyle = full && frame % 10 < 5 ? "#fff7ae" : eg;
  ctx.fillRect(side === "right" ? x + w - ratio * w : x, y, ratio * w, h);
  ctx.strokeStyle = full ? "#ffd60a" : "#00e5ff";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x + (w * i) / 4, y);
    ctx.lineTo(x + (w * i) / 4, y + h);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawCombo(ctx, x, y, count, align, color, pop) {
  const s = 1 + Math.max(0, pop) * 0.06;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  outlinedText(ctx, String(count), 0, 0, 34, color, "#000", align, 6);
  const off = align === "left" ? 8 + String(count).length * 21 : align === "right" ? -(8 + String(count).length * 21) : 0;
  outlinedText(ctx, "HITS!", off, -2, 16, "#ffffff", "#000", align, 4);
  ctx.restore();
}

/** 奧義 Cut-in：斜向橫幅 + 角色特寫 + 招式名 */
export function drawCutIn(ctx, g, W, H, frame) {
  const c = g.cutIn;
  if (!c) return;
  const t = c.age / c.life;
  const slide = t < 0.15 ? smooth(t / 0.15) : t > 0.85 ? 1 - smooth((t - 0.85) / 0.15) : 1;
  const left = c.side === "left";
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${0.45 * slide})`;
  ctx.fillRect(0, 0, W, H);
  const bandY = 120;
  const bandH = 130;
  const off = (1 - slide) * W * (left ? -1 : 1);
  ctx.translate(off, 0);
  ctx.beginPath();
  ctx.moveTo(0, bandY + 20);
  ctx.lineTo(W, bandY);
  ctx.lineTo(W, bandY + bandH - 20);
  ctx.lineTo(0, bandY + bandH);
  ctx.closePath();
  const bg = ctx.createLinearGradient(0, bandY, W, bandY + bandH);
  bg.addColorStop(0, rgba(c.color, 0.85));
  bg.addColorStop(1, "rgba(10,10,20,0.95)");
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 18; i++) {
    const y = bandY + hash(i) * bandH;
    const x = ((frame * 22 * (left ? 1 : -1) + i * 140) % (W + 200) + W + 200) % (W + 200) - 100;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 120, y - 6);
    ctx.stroke();
  }
  // 角色特寫
  const vis = visualOf(c.snap);
  ctx.save();
  const px = left ? 170 : W - 170;
  ctx.translate(px, bandY + bandH / 2 + 10);
  ctx.scale(2.4, 2.4);
  drawFighter(ctx, { ...c.snap, x: 0, y: 99 * vis.scale - 12, state: "attack", attackType: "ult", stateTimer: c.snap.attackDuration * 0.4, facing: left ? 1 : -1 }, frame, { portrait: true });
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.stroke();
  outlinedText(ctx, c.name ? c.name : "SUPER", left ? W * 0.62 : W * 0.38, bandY + bandH / 2 + 12, 30, "#ffffff", "#000", "center", 7);
  outlinedText(ctx, "SUPER ART", left ? W * 0.62 : W * 0.38, bandY + bandH / 2 - 26, 13, "#ffd60a", "#000", "center", 4);
  ctx.restore();
}

/** 浮動文字：彈跳放大後上飄，加黑邊比較好讀 */
export function drawFloatingTexts(ctx, g) {
  for (const ft of g.floatingTexts) {
    const age = ft.maxLife - ft.life;
    const s = age < 6 ? 1.5 - age * 0.08 : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, ft.life / (ft.maxLife * 0.5)));
    ctx.translate(ft.x, ft.y);
    ctx.scale(s, s);
    const dmg = /^-\d/.test(ft.text);
    outlinedText(ctx, ft.text, 0, 0, dmg ? 20 : 14, ft.color, "#000", "center", dmg ? 5 : 4);
    ctx.restore();
  }
}

/** 超頻故障畫面：把畫面橫向切片位移（Administrator 二階段） */
export function glitchPost(ctx, W, H, intensity, frame) {
  if (intensity <= 0) return;
  const n = Math.round(3 + intensity * 5);
  for (let i = 0; i < n; i++) {
    if (hash(i + Math.floor(frame / 3) * 7) > 0.55 + (1 - intensity) * 0.3) continue;
    const y = hash(i * 3.1 + frame) * H;
    const h = 3 + hash(i * 5.7 + frame) * 16;
    const dx = (hash(i * 9.1 + frame) - 0.5) * 36 * intensity;
    const k = ctx.canvas.width / W;
    ctx.drawImage(ctx.canvas, 0, y * k, W * k, h * k, dx, y, W, h);
  }
  ctx.fillStyle = "rgba(255,0,60,0.05)";
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
}

/** 命中時的白色閃屏 */
export function drawHitFlash(ctx, g, W, H) {
  if (!g.hitFlash) return;
  ctx.fillStyle = `rgba(255,255,255,${0.08 * g.hitFlash})`;
  ctx.fillRect(0, 0, W, H);
}
