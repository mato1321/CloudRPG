// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Shell, Panel } from "../components/crpg/Shell";
import * as FX from "../components/crpg/battleFx";

export const Route = createFileRoute("/arena")({
  component: ArenaPage,
  head: () => ({
    meta: [
      { title: "Cloud RPG — Free Versus Street Fighter Arena" },
      { name: "description", content: "Free battle mode: pick any character to fight CPU or 2P local versus with left/right split keyboard controls." },
    ],
  }),
});

/* ───────────── FREE BATTLE ROSTER (8 PLAYABLE CHARACTERS) ───────────── */

const FIGHTERS = [
  {
    id: "warrior_rpg",
    name: "⚔ 戰士 WARRIOR",
    title: "異世界鋼鐵重劍士",
    color: "#ff4d6d",
    secondary: "#ffd60a",
    belt: "#450a0a",
    headband: "#ffffff",
    hp: 340,
    speed: 3.9,
    jumpForce: 12.0,
    atkMul: 1.12,
    specialName: "裂地斬 (劍氣波)",
    upperName: "狂戰衝擊 (對空)",
    dashName: "鋼鐵粉碎 (突進)",
    superName: "滅世斷界斬",
  },
  {
    id: "mage_rpg",
    name: "✦ 法師 MAGE",
    title: "異世界高魔詠唱者",
    color: "#a78bfa",
    secondary: "#00e5ff",
    belt: "#1e1b4b",
    headband: "#00ff88",
    hp: 270,
    speed: 4.3,
    jumpForce: 12.6,
    atkMul: 1.18,
    specialName: "雷霆脈衝 (雷電球)",
    upperName: "虛空火球 (升空)",
    dashName: "極光崩解 (突進)",
    superName: "禁忌・星界崩壞",
  },
  {
    id: "priest_rpg",
    name: "✚ 牧師 PRIEST",
    title: "異世界神諭聖職者",
    color: "#ffd60a",
    secondary: "#00ff88",
    belt: "#422006",
    headband: "#00e5ff",
    hp: 310,
    speed: 4.1,
    jumpForce: 12.4,
    atkMul: 1.05,
    specialName: "聖光制裁 (光彈)",
    upperName: "靈魂祈禱 (聖昇龍)",
    dashName: "神聖脈動 (聖突進)",
    superName: "終焉聖域",
  },
  {
    id: "ryu",
    name: "🥊 RYU-X · 龍",
    title: "孤高格鬥武神",
    color: "#00e5ff",
    secondary: "#ffffff",
    belt: "#111827",
    headband: "#ff4d6d",
    hp: 300,
    speed: 4.0,
    jumpForce: 12.2,
    atkMul: 1.05,
    specialName: "波動拳 (Hadouken)",
    upperName: "昇龍拳 (Shoryuken)",
    dashName: "龍卷旋風腳",
    superName: "真空波動拳 (Shinku Hadouken)",
  },
  {
    id: "ken",
    name: "🔥 KEN-BLAZE · 凱",
    title: "烈焰紅蓮狂龍",
    color: "#f97316",
    secondary: "#ffd60a",
    belt: "#111827",
    headband: "#ffd60a",
    hp: 290,
    speed: 4.4,
    jumpForce: 12.6,
    atkMul: 1.10,
    specialName: "烈焰波動拳",
    upperName: "火焰昇龍拳",
    dashName: "紅蓮旋風腿",
    superName: "神龍烈破 (Shinryuken)",
  },
  {
    id: "chun",
    name: "⚡ CHUN-CYBER · 春麗",
    title: "電光神速腿",
    color: "#00ff88",
    secondary: "#00e5ff",
    belt: "#ffd60a",
    headband: "#00e5ff",
    hp: 280,
    speed: 4.9,
    jumpForce: 13.2,
    atkMul: 1.0,
    specialName: "氣功拳 (Kikoken)",
    upperName: "霸山蹴 (Spinning Kick)",
    dashName: "百裂突進腳",
    superName: "千裂腳・極 (Senretsukyaku)",
  },
  {
    id: "duke_boss",
    name: "🩸 羅劫公爵 DUKE",
    title: "深紅煉獄領主 (BOSS)",
    color: "#e11d48",
    secondary: "#fde047",
    belt: "#4c0519",
    headband: "#ffd60a",
    hp: 360,
    speed: 3.7,
    jumpForce: 11.8,
    atkMul: 1.18,
    specialName: "深紅煉獄波",
    upperName: "血腥公爵昇龍斬",
    dashName: "深紅裂地衝",
    superName: "赤紅滅世血月斬",
  },
  {
    id: "admin_boss",
    name: "💻 ADMINISTRATOR",
    title: "系統最高權限 AI (BOSS)",
    color: "#10b981",
    secondary: "#ff4d6d",
    belt: "#064e3b",
    headband: "#ffffff",
    hp: 420,
    speed: 4.5,
    jumpForce: 12.8,
    atkMul: 1.28,
    specialName: "rm -rf 格式化光波",
    upperName: "KERNEL PANIC 衝擊",
    dashName: "OVERCLOCK 突刺",
    superName: "SYSTEM FORMAT // 終焉清除",
  },
];

const STAGES = [
  { id: "dojo", name: "東吳武道館頂樓", bgTop: "#090d1e", bgFloor: "#132238" },
  { id: "mansion", name: "羅劫公爵大凶宅", bgTop: "#220711", bgFloor: "#3b0d1e" },
  { id: "abyss", name: "冥盡極光神殿", bgTop: "#051923", bgFloor: "#0a2e3f" },
  { id: "core", name: "C:\\mato\\Administrator 核心", bgTop: "#04160e", bgFloor: "#0a291c" },
];

const AI_DIFFICULTIES = [
  { id: "easy", label: "STAGE 1 · EASY (新手)", aggr: 0.25, block: 0.12, hpMul: 0.85, atkScale: 0.80 },
  { id: "normal", label: "STAGE 2 · NORMAL (標準)", aggr: 0.45, block: 0.26, hpMul: 1.0, atkScale: 0.95 },
  { id: "hard", label: "STAGE 3 · HARD (進階)", aggr: 0.65, block: 0.42, hpMul: 1.18, atkScale: 1.12 },
  { id: "master", label: "STAGE 4 · MASTER (魔王級)", aggr: 0.84, block: 0.58, hpMul: 1.38, atkScale: 1.30 },
];

/* ───────────── WEB AUDIO ARCADE SYNTH ───────────── */

class ArcadeAudio {
  ctx: AudioContext | null = null;
  muted = false;

  init() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  play(type: "light" | "heavy" | "block" | "hadouken" | "shoryuken" | "dash" | "super" | "ko" | "jump") {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      if (type === "light") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === "heavy") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(38, now + 0.16);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);
        osc.start(now);
        osc.stop(now + 0.16);
      } else if (type === "block") {
        osc.type = "square";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(420, now + 0.07);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);
        osc.start(now);
        osc.stop(now + 0.07);
      } else if (type === "hadouken") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(620, now + 0.12);
        osc.frequency.exponentialRampToValueAtTime(190, now + 0.28);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === "shoryuken") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(760, now + 0.25);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === "dash") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.22);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === "super") {
        osc.type = "square";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(660, now + 0.08);
        osc.frequency.setValueAtTime(880, now + 0.16);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.45);
        gain.gain.setValueAtTime(0.38, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      } else if (type === "jump") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(190, now);
        osc.frequency.exponentialRampToValueAtTime(420, now + 0.11);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.11);
        osc.start(now);
        osc.stop(now + 0.11);
      } else if (type === "ko") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(28, now + 0.65);
        gain.gain.setValueAtTime(0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
        osc.start(now);
        osc.stop(now + 0.65);
      }
    } catch {}
  }
}

const sfx = new ArcadeAudio();

/* ───────────── MAIN COMPONENT ───────────── */

function ArenaPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [mode, setMode] = useState<"cpu" | "pvp">("pvp");
  const [p1Pick, setP1Pick] = useState("warrior_rpg");
  const [p2Pick, setP2Pick] = useState("ryu");
  const [aiDiffId, setAiDiffId] = useState("normal");
  const [stageIdx, setStageIdx] = useState(0);
  const [muted, setMuted] = useState(false);
  const [matchStateText, setMatchStateText] = useState("READY — 自由選擇角色開始對戰！");

  const gameRef = useRef<any>(null);

  function createFighterEntity(cfg: any, x: number, facing: number, isAI: boolean, diffObj: any) {
    const hpMul = isAI ? (diffObj?.hpMul ?? 1.0) : 1.0;
    const atkScale = isAI ? (diffObj?.atkScale ?? 1.0) : 1.0;
    const finalHp = Math.round(cfg.hp * hpMul);
    const visualType = cfg.visualType || FX.arenaVisualType(cfg.id);
    return {
      cfg: {
        ...cfg,
        visualType,
        hp: finalHp,
        atkMul: Number((cfg.atkMul * atkScale).toFixed(2)),
        aiAggression: diffObj?.aggr ?? 0.45,
        aiBlockRate: diffObj?.block ?? 0.26,
      },
      isAI,
      x,
      y: 380,
      vx: 0,
      vy: 0,
      facing,
      hp: finalHp,
      hpMax: finalHp,
      trailHp: finalHp,
      energy: 40,
      energyMax: 100,
      state: "idle",
      attackType: null,
      stateTimer: 0,
      attackDuration: 0,
      hasHitCurrentAttack: false,
      comboCount: 0,
      comboTimer: 0,
      invincibleTimer: 0,
      aiCooldown: 0,
      weaponTier: ["warrior", "mage", "priest"].includes(visualType) ? 2 : 0,
      weaponPlus: 1,
    };
  }

  function startNewMatch(
    customMode = mode,
    customP1 = p1Pick,
    customP2 = p2Pick,
    customStage = stageIdx,
    customDiff = aiDiffId
  ) {
    const f1 = FIGHTERS.find((f) => f.id === customP1) || FIGHTERS[0];
    const f2 = FIGHTERS.find((f) => f.id === customP2) || FIGHTERS[1];
    const stg = STAGES[customStage] || STAGES[0];
    const diffObj = AI_DIFFICULTIES.find((d) => d.id === customDiff) || AI_DIFFICULTIES[1];

    gameRef.current = {
      mode: customMode,
      stage: stg,
      diffObj,
      round: 1,
      p1Wins: 0,
      p2Wins: 0,
      timer: 99,
      frameCounter: 0,
      hitStop: 0,
      screenShake: 0,
      superFlash: 0,
      phase: "intro",
      phaseTimer: 70,
      bannerText: "ROUND 1",
      subBannerText:
        customMode === "pvp"
          ? "雙人模式：1P 左半邊鍵盤 (WASD+FGRTYQ) vs 2P 右半邊鍵盤 (方向鍵+JKLUOI)"
          : `自由對戰 (${diffObj.label})`,
      winner: null,
      projectiles: [],
      particles: [],
      floatingTexts: [],
      fx: [],
      hitFlash: 0,
      cutIn: null,
      stageKey: stg.id,
      p1: createFighterEntity(f1, 200, 1, false, diffObj),
      p2: createFighterEntity(f2, 700, -1, customMode === "cpu", diffObj),
    };
    setMatchStateText(
      `🥊 [${customMode === "pvp" ? "雙人同鍵盤對戰" : "單人 VS 電腦"}] ${f1.name} VS ${f2.name}`
    );
  }

  function resetRound(g: any) {
    const f1 = g.p1.cfg;
    const f2 = g.p2.cfg;
    const p1Energy = g.p1.energy;
    const p2Energy = g.p2.energy;
    g.p1 = createFighterEntity(f1, 200, 1, false, g.diffObj);
    g.p2 = createFighterEntity(f2, 700, -1, g.mode === "cpu", g.diffObj);
    g.p1.energy = Math.min(100, p1Energy + 25);
    g.p2.energy = Math.min(100, p2Energy + 25);
    g.projectiles = [];
    g.particles = [];
    g.floatingTexts = [];
    g.fx = [];
    g.cutIn = null;
    g.timer = 99;
    g.phase = "intro";
    g.phaseTimer = 70;
    g.bannerText = g.round === 3 ? "FINAL ROUND" : `ROUND ${g.round}`;
    g.subBannerText = "GET READY!";
  }

  useEffect(() => {
    startNewMatch(mode, p1Pick, p2Pick, stageIdx, aiDiffId);

    const keys = new Set<string>();

    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", " "].includes(e.key)) {
        if ((e.target as HTMLElement)?.tagName !== "INPUT") {
          e.preventDefault();
        }
      }

      const code = e.code;
      const isFirstPress = !keys.has(code);
      keys.add(code);

      const g = gameRef.current;
      if (!g) return;

      if (isFirstPress && (code === "Space" || code === "Enter") && g.phase === "match_over") {
        startNewMatch(g.mode, p1Pick, p2Pick, stageIdx, aiDiffId);
        return;
      }

      if (g.phase !== "fight" || !isFirstPress) return;

      // ─────────────────────────────────────────────────────────
      // 👈 1P LEFT-SIDE KEYBOARD CONTROLS (WASD + F, G, R, T, Y, Q)
      // ─────────────────────────────────────────────────────────
      const p1Crouching = keys.has("KeyS");
      if (code === "KeyF") {
        triggerAttack(g, g.p1, g.p2, "light");
      } else if (code === "KeyG") {
        triggerAttack(g, g.p1, g.p2, p1Crouching ? "sweep" : "heavy");
      } else if (code === "KeyR") {
        triggerAttack(g, g.p1, g.p2, "hadouken");
      } else if (code === "KeyT") {
        triggerAttack(g, g.p1, g.p2, "shoryuken");
      } else if (code === "KeyY") {
        triggerAttack(g, g.p1, g.p2, "dash");
      } else if (code === "KeyQ") {
        triggerAttack(g, g.p1, g.p2, "super");
      }

      // If in single-player CPU mode, also allow 1P to use J/K/L/U/O/I on right hand if preferred
      if (g.mode === "cpu") {
        if (code === "KeyJ") triggerAttack(g, g.p1, g.p2, "light");
        else if (code === "KeyK") triggerAttack(g, g.p1, g.p2, p1Crouching ? "sweep" : "heavy");
        else if (code === "KeyL") triggerAttack(g, g.p1, g.p2, "hadouken");
        else if (code === "KeyU") triggerAttack(g, g.p1, g.p2, "shoryuken");
        else if (code === "KeyO") triggerAttack(g, g.p1, g.p2, "dash");
        else if (code === "KeyI") triggerAttack(g, g.p1, g.p2, "super");
      }

      // ─────────────────────────────────────────────────────────
      // 👉 2P RIGHT-SIDE KEYBOARD CONTROLS (Arrow Keys + J,K,L,U,O,I or Numpad 1~6)
      // ─────────────────────────────────────────────────────────
      if (g.mode === "pvp") {
        const p2Crouch = keys.has("ArrowDown");
        if (code === "KeyJ" || code === "Numpad1") {
          triggerAttack(g, g.p2, g.p1, "light");
        } else if (code === "KeyK" || code === "Numpad2") {
          triggerAttack(g, g.p2, g.p1, p2Crouch ? "sweep" : "heavy");
        } else if (code === "KeyL" || code === "Numpad3") {
          triggerAttack(g, g.p2, g.p1, "hadouken");
        } else if (code === "KeyU" || code === "Numpad4") {
          triggerAttack(g, g.p2, g.p1, "shoryuken");
        } else if (code === "KeyO" || code === "Numpad6") {
          triggerAttack(g, g.p2, g.p1, "dash");
        } else if (code === "KeyI" || code === "Numpad5") {
          triggerAttack(g, g.p2, g.p1, "super");
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.code);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let animId = 0;
    const FLOOR_Y = 380;
    const GRAVITY = 0.56;

    function triggerAttack(g: any, attacker: any, defender: any, kind: string) {
      if (["hit", "block", "knockdown", "ko"].includes(attacker.state)) return;
      if (attacker.state === "attack") {
        const canCancelToSpecial =
          attacker.attackType === "light" && ["hadouken", "shoryuken", "dash", "super"].includes(kind);
        if (!canCancelToSpecial) return;
      }

      if (kind === "super") {
        if (attacker.energy < 100) {
          addFloatingText(g, attacker.x, attacker.y - 102, `⚡ 氣條未滿 (${Math.floor(attacker.energy)}/100%)`, "#00e5ff", 24);
          return;
        } else {
          attacker.energy = 0;
          g.superFlash = 18;
          g.hitStop = 8;
          attacker.invincibleTimer = 28;
          sfx.play("super");
          spawnParticles(g, attacker.x, attacker.y - 55, attacker.cfg.color, 26, 7);
          addFloatingText(g, attacker.x, attacker.y - 115, `★ ${attacker.cfg.superName} ★`, "#ffd60a", 38);
        }
      }

      attacker.state = "attack";
      attacker.attackType = kind;
      attacker.hasHitCurrentAttack = false;
      attacker.facing = defender.x >= attacker.x ? 1 : -1;

      if (kind === "light") {
        attacker.attackDuration = 16;
        attacker.stateTimer = 16;
        sfx.play("light");
      } else if (kind === "heavy") {
        attacker.attackDuration = 24;
        attacker.stateTimer = 24;
        attacker.vx = attacker.facing * 3.0;
        sfx.play("heavy");
      } else if (kind === "sweep") {
        attacker.attackDuration = 26;
        attacker.stateTimer = 26;
        attacker.vx = attacker.facing * 3.8;
        sfx.play("heavy");
      } else if (kind === "hadouken") {
        attacker.attackDuration = 28;
        attacker.stateTimer = 28;
        sfx.play("hadouken");
        addFloatingText(g, attacker.x, attacker.y - 95, attacker.cfg.specialName, attacker.cfg.color, 25);
        g.projectiles.push({
          owner: attacker === g.p1 ? "p1" : "p2",
          style: FX.projStyleFor(attacker),
          x: attacker.x + attacker.facing * 48,
          y: attacker.y - 52,
          vx: attacker.facing * 8.0,
          radius: 18,
          damage: Math.round(28 * attacker.cfg.atkMul),
          color: attacker.cfg.color,
          coreColor: attacker.cfg.secondary,
          isSuper: false,
          hitsLeft: 1,
        });
      } else if (kind === "shoryuken") {
        attacker.attackDuration = 32;
        attacker.stateTimer = 32;
        attacker.vy = -11.0;
        attacker.vx = attacker.facing * 3.5;
        attacker.invincibleTimer = 14;
        sfx.play("shoryuken");
        addFloatingText(g, attacker.x, attacker.y - 100, attacker.cfg.upperName, "#ffd60a", 28);
        spawnParticles(g, attacker.x, attacker.y - 20, "#ffd60a", 14, 5);
      } else if (kind === "dash") {
        attacker.attackDuration = 26;
        attacker.stateTimer = 26;
        attacker.vx = attacker.facing * 7.8;
        attacker.invincibleTimer = 10;
        sfx.play("dash");
        addFloatingText(g, attacker.x, attacker.y - 100, attacker.cfg.dashName || "突進技", "#00e5ff", 28);
        spawnParticles(g, attacker.x, attacker.y - 40, "#00e5ff", 14, 5);
      } else if (kind === "super") {
        attacker.attackDuration = 40;
        attacker.stateTimer = 40;
        for (let i = 0; i < 3; i++) {
          g.projectiles.push({
            owner: attacker === g.p1 ? "p1" : "p2",
            style: FX.projStyleFor(attacker),
            x: attacker.x + attacker.facing * (52 - i * 28),
            y: attacker.y - 54,
            vx: attacker.facing * 10.0,
            radius: 30,
            damage: Math.round(26 * attacker.cfg.atkMul),
            color: "#ffd60a",
            coreColor: attacker.cfg.color,
            isSuper: true,
            hitsLeft: 1,
          });
        }
      }
      FX.onAttackStart(g, attacker, kind, { name: attacker.cfg.superName, side: attacker === g.p1 ? "left" : "right" });
    }

    function spawnParticles(g: any, x: number, y: number, color: string, count = 12, speed = 5) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = (0.3 + Math.random() * 0.9) * speed;
        g.particles.push({
          x,
          y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd - 1.2,
          size: 3 + Math.random() * 4,
          color,
          life: 16 + Math.floor(Math.random() * 14),
          maxLife: 30,
        });
      }
    }

    function addFloatingText(g: any, x: number, y: number, text: string, color: string, life = 30) {
      g.floatingTexts.push({ x, y, text, color, life, maxLife: life });
    }

    function updateFighterControl(
      g: any,
      f: any,
      opponent: any,
      leftKey: boolean,
      rightKey: boolean,
      upKey: boolean,
      downKey: boolean
    ) {
      if (f.trailHp > f.hp) {
        f.trailHp = Math.max(f.hp, f.trailHp - 0.8);
      }
      if (f.invincibleTimer > 0) f.invincibleTimer--;
      if (f.comboTimer > 0) {
        f.comboTimer--;
        if (f.comboTimer === 0) f.comboCount = 0;
      }

      if (f.y < FLOOR_Y || f.vy < 0) {
        f.y += f.vy;
        f.vy += GRAVITY;
        if (f.y >= FLOOR_Y) {
          f.y = FLOOR_Y;
          f.vy = 0;
          if (f.state === "jump") {
            f.state = "idle";
            FX.emit(g, "smoke", f.x, FLOOR_Y - 4, 5, { color: "#9ca3af", speed: 1.6, angle: Math.PI, spread: Math.PI, life: 22, size: 4 });
          }
        }
      }

      if (f.stateTimer > 0) {
        f.stateTimer--;
        if (f.stateTimer === 0 && f.state !== "ko") {
          f.state = f.y < FLOOR_Y ? "jump" : "idle";
          f.attackType = null;
        }
      }

      f.x += f.vx;
      if (f.y >= FLOOR_Y && f.state !== "walk") {
        f.vx *= 0.76;
      }

      f.x = Math.max(55, Math.min(845, f.x));

      if (["hit", "block", "knockdown", "ko", "attack"].includes(f.state)) {
        return;
      }

      if (f.y >= FLOOR_Y) {
        f.facing = opponent.x >= f.x ? 1 : -1;
      }

      if (upKey && f.y >= FLOOR_Y) {
        f.vy = -f.cfg.jumpForce;
        f.state = "jump";
        if (leftKey) f.vx = -f.cfg.speed * 0.85;
        else if (rightKey) f.vx = f.cfg.speed * 0.85;
        sfx.play("jump");
        FX.emit(g, "smoke", f.x, FLOOR_Y - 4, 6, { color: "#9ca3af", speed: 1.8, angle: Math.PI, spread: Math.PI, life: 22, size: 4 });
        return;
      }

      if (downKey && f.y >= FLOOR_Y) {
        f.state = "crouch";
        f.vx = 0;
        return;
      }

      if (leftKey) {
        f.vx = -f.cfg.speed;
        if (f.y >= FLOOR_Y) f.state = "walk";
      } else if (rightKey) {
        f.vx = f.cfg.speed;
        if (f.y >= FLOOR_Y) f.state = "walk";
      } else {
        if (f.y >= FLOOR_Y) {
          f.vx = 0;
          f.state = "idle";
        }
      }
    }

    function updateAI(g: any, ai: any, target: any) {
      if (ai.aiCooldown > 0) ai.aiCooldown--;
      const dist = Math.abs(target.x - ai.x);
      const dirToTarget = target.x >= ai.x ? 1 : -1;
      const aggr = ai.cfg.aiAggression || 0.58;

      let moveLeft = false;
      let moveRight = false;
      let moveUp = false;
      let moveDown = false;

      const incomingProj = g.projectiles.find(
        (p: any) => p.owner === "p1" && Math.abs(p.x - ai.x) < 130 && Math.abs(p.x - ai.x) > 30
      );
      if (incomingProj && ai.y >= FLOOR_Y && Math.random() < aggr * 0.85) {
        moveUp = true;
      }

      if (dist > 155) {
        if (ai.aiCooldown === 0 && Math.random() < 0.025 * aggr) {
          if (ai.energy >= 100 && Math.random() < 0.45) {
            triggerAttack(g, ai, target, "super");
          } else {
            triggerAttack(g, ai, target, "hadouken");
          }
          ai.aiCooldown = 32;
        } else {
          if (dirToTarget > 0) moveRight = true;
          else moveLeft = true;
        }
      } else if (dist > 78) {
        if (ai.aiCooldown === 0 && Math.random() < 0.06 * aggr) {
          const r = Math.random();
          if (target.y < FLOOR_Y - 40 && r < 0.65) {
            triggerAttack(g, ai, target, "shoryuken");
          } else if (r < 0.35) {
            triggerAttack(g, ai, target, "dash");
          } else if (r < 0.68) {
            triggerAttack(g, ai, target, "heavy");
          } else {
            triggerAttack(g, ai, target, "sweep");
          }
          ai.aiCooldown = 22;
        } else if (Math.random() < 0.5) {
          if (dirToTarget > 0) moveRight = true;
          else moveLeft = true;
        }
      } else {
        if (ai.aiCooldown === 0 && Math.random() < 0.11 * aggr) {
          const r = Math.random();
          if (ai.energy >= 100 && r < 0.35) {
            triggerAttack(g, ai, target, "super");
          } else if (r < 0.45) {
            triggerAttack(g, ai, target, "light");
          } else if (r < 0.75) {
            triggerAttack(g, ai, target, "heavy");
          } else {
            triggerAttack(g, ai, target, "shoryuken");
          }
          ai.aiCooldown = 18;
        } else if (target.state === "attack" && Math.random() < (ai.cfg.aiBlockRate || 0.32)) {
          if (dirToTarget > 0) moveLeft = true;
          else moveRight = true;
        }
      }

      updateFighterControl(g, ai, target, moveLeft, moveRight, moveUp, moveDown);
    }

    function isHoldingBack(f: any, opponent: any) {
      if (f.isAI) {
        return f.state === "walk" && Math.sign(f.vx) === -f.facing;
      }
      const isP1 = f === gameRef.current?.p1;
      const holdLeft = isP1 ? keys.has("KeyA") : keys.has("ArrowLeft");
      const holdRight = isP1 ? keys.has("KeyD") : keys.has("ArrowRight");
      const holdDown = isP1 ? keys.has("KeyS") : keys.has("ArrowDown");
      if (opponent.x >= f.x && holdLeft) return true;
      if (opponent.x < f.x && holdRight) return true;
      if (holdDown && f.state === "crouch") return true;
      return false;
    }

    function applyHit(
      g: any,
      attacker: any,
      defender: any,
      rawDamage: number,
      knockbackX: number,
      launchY: number,
      isLowAttack: boolean,
      isHeavy: boolean
    ) {
      if (defender.invincibleTimer > 0 || defender.state === "ko" || defender.state === "knockdown") {
        return;
      }

      const holdingBack = isHoldingBack(defender, attacker);
      const canBlock =
        !["attack", "hit", "knockdown", "ko"].includes(defender.state) &&
        holdingBack &&
        (!isLowAttack || defender.state === "crouch");

      if (canBlock) {
        const chipDamage = Math.max(2, Math.round(rawDamage * 0.15));
        defender.hp = Math.max(1, defender.hp - chipDamage);
        defender.state = "block";
        defender.stateTimer = 12;
        defender.vx = -defender.facing * (knockbackX * 0.55);
        attacker.energy = Math.min(100, attacker.energy + 6);
        defender.energy = Math.min(100, defender.energy + 8);
        sfx.play("block");
        FX.onHit(g, attacker, defender, { blocked: true });
        addFloatingText(g, defender.x, defender.y - 95, "GUARD!", "#00e5ff", 18);
        return;
      }

      const comboScale = Math.max(0.55, 1 - attacker.comboCount * 0.08);
      const finalDamage = Math.max(4, Math.round(rawDamage * attacker.cfg.atkMul * comboScale));
      defender.hp = Math.max(0, defender.hp - finalDamage);
      attacker.comboCount += 1;
      attacker.comboTimer = 52;
      attacker.energy = Math.min(100, attacker.energy + 14);
      defender.energy = Math.min(100, defender.energy + 10);

      g.hitStop = isHeavy ? 5 : 3;
      g.screenShake = isHeavy ? 9 : 4;

      FX.onHit(g, attacker, defender, { heavy: isHeavy });
      addFloatingText(
        g,
        defender.x + (Math.random() * 20 - 10),
        defender.y - 90,
        `-${finalDamage}`,
        isHeavy ? "#ffd60a" : "#ff4d6d",
        24
      );

      if (defender.hp <= 0) {
        triggerRoundKO(g, attacker, defender);
        return;
      }

      if (launchY < 0 || isLowAttack) {
        defender.state = "knockdown";
        defender.stateTimer = 28;
        defender.invincibleTimer = 18;
        defender.vx = attacker.facing * knockbackX;
        defender.vy = launchY < 0 ? launchY : -6.5;
      } else {
        defender.state = "hit";
        defender.stateTimer = isHeavy ? 18 : 13;
        defender.vx = attacker.facing * knockbackX;
      }
    }

    function checkMeleeHit(g: any, attacker: any, defender: any) {
      if (attacker.state !== "attack" || attacker.hasHitCurrentAttack) return;
      if (attacker.attackType === "hadouken" || attacker.attackType === "super") return;

      const elapsed = attacker.attackDuration - attacker.stateTimer;
      if (elapsed < 4 || elapsed > attacker.attackDuration - 5) return;

      const reach =
        attacker.attackType === "light"
          ? 74
          : attacker.attackType === "sweep"
          ? 88
          : attacker.attackType === "shoryuken"
          ? 80
          : attacker.attackType === "dash"
          ? 94
          : 86;

      const dx = (defender.x - attacker.x) * attacker.facing;
      const dy = Math.abs(defender.y - attacker.y);

      if (dx >= -18 && dx <= reach && dy <= 85) {
        attacker.hasHitCurrentAttack = true;
        if (attacker.attackType === "light") {
          applyHit(g, attacker, defender, 16, 4.5, 0, false, false);
        } else if (attacker.attackType === "heavy") {
          applyHit(g, attacker, defender, 28, 8.5, 0, false, true);
        } else if (attacker.attackType === "sweep") {
          applyHit(g, attacker, defender, 24, 6.0, -5.5, true, true);
        } else if (attacker.attackType === "shoryuken") {
          applyHit(g, attacker, defender, 38, 7.5, -11.5, false, true);
        } else if (attacker.attackType === "dash") {
          applyHit(g, attacker, defender, 34, 10.0, -7.5, false, true);
        }
      }
    }

    function triggerRoundKO(g: any, winner: any, loser: any) {
      loser.hp = 0;
      loser.state = "ko";
      loser.vx = -loser.facing * 9.5;
      loser.vy = -10.5;
      g.hitStop = 14;
      g.screenShake = 16;
      g.phase = "ko";
      g.phaseTimer = 125;
      sfx.play("ko");
      g.hitFlash = 8;
      FX.addFx(g, { type: "ring", x: loser.x, y: loser.y - 50, r0: 10, r1: 240, color: "#ffffff", life: 30, lw: 10 });
      FX.addFx(g, { type: "impact", x: loser.x, y: loser.y - 55, size: 70, color: "#ffd60a", life: 22 });
      FX.emit(g, "spark", loser.x, loser.y - 45, 34, { color: ["#ff4d6d", "#ffd60a", "#ffffff"], speed: 9, life: 26 });

      if (winner === g.p1) g.p1Wins += 1;
      else g.p2Wins += 1;

      g.bannerText = "K. O. !!";
      g.subBannerText = `${winner === g.p1 ? "1P" : g.mode === "cpu" ? "CPU" : "2P"} (${winner.cfg.name}) 贏得本回合！`;
    }

    let lastTime = performance.now();
    let accumulator = 0;
    const STEP_MS = 21; // ~47.6 logic ticks/sec — classic Street Fighter arcade feel

    let dpr = 1;
    const perf = FX.createPerfMonitor(() => {
      const c = canvasRef.current?.getContext("2d");
      if (c) FX.setLowQuality(c, true);
    });

    function step(now: number) {
      const dt = Math.min(80, Math.max(0, now - lastTime));
      perf(dt);
      lastTime = now;
      accumulator += dt;

      const g = gameRef.current;
      const canvas = canvasRef.current;
      if (g && canvas) {
        dpr = FX.setupCanvas(canvas, 900, 450);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          let substeps = 0;
          while (accumulator >= STEP_MS && substeps < 3) {
            updateGame(g);
            accumulator -= STEP_MS;
            substeps++;
          }
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          renderGame(ctx, g);
        }
      }
      animId = requestAnimationFrame(step);
    }

    function updateGame(g: any) {
      g.frameCounter++;

      if (g.superFlash > 0) g.superFlash--;
      if (g.screenShake > 0) g.screenShake = Math.max(0, g.screenShake - 0.8);

      FX.updateParticles(g);
      FX.updateFx(g);

      g.floatingTexts.forEach((ft: any) => {
        ft.y -= 1.1;
        ft.life--;
      });
      g.floatingTexts = g.floatingTexts.filter((ft: any) => ft.life > 0);

      if (g.hitStop > 0) {
        g.hitStop--;
        return;
      }

      if (g.phase === "intro") {
        g.phaseTimer--;
        if (g.phaseTimer === 25) {
          g.bannerText = "FIGHT !!";
          g.subBannerText = "";
          sfx.play("super");
        }
        if (g.phaseTimer <= 0) {
          g.phase = "fight";
        }
        return;
      }

      if (g.phase === "ko") {
        if (g.frameCounter % 2 === 0) {
          updateFighterControl(g, g.p1, g.p2, false, false, false, false);
          updateFighterControl(g, g.p2, g.p1, false, false, false, false);
        }
        g.phaseTimer--;
        if (g.phaseTimer <= 0) {
          if (g.p1Wins >= 2 || g.p2Wins >= 2) {
            g.phase = "match_over";
            const matchWinner = g.p1Wins >= 2 ? g.p1 : g.p2;
            const winSide = g.p1Wins >= 2 ? "1P" : g.mode === "cpu" ? "CPU" : "2P";
            g.winner = matchWinner;
            g.bannerText = `${winSide} · ${matchWinner.cfg.name} WINS!`;
            g.subBannerText = "按 [SPACE] 再戰一場，或於上方自由切換角色！";
            setMatchStateText(`🏆 勝負揭曉：${winSide} (${matchWinner.cfg.name}) 獲勝！`);
          } else {
            g.round += 1;
            resetRound(g);
          }
        }
        return;
      }

      if (g.phase === "match_over") {
        return;
      }

      // Slowed round timer: 1 tick per 75 logic steps (~1.6 real seconds)
      if (g.frameCounter % 75 === 0 && g.timer > 0) {
        g.timer--;
        if (g.timer === 0) {
          const p1Ratio = g.p1.hp / g.p1.hpMax;
          const p2Ratio = g.p2.hp / g.p2.hpMax;
          if (p1Ratio >= p2Ratio) triggerRoundKO(g, g.p1, g.p2);
          else triggerRoundKO(g, g.p2, g.p1);
          g.bannerText = "TIME OVER";
          return;
        }
      }

      // 1P Movement: Strictly Left-Side (W, A, S, D)
      updateFighterControl(
        g,
        g.p1,
        g.p2,
        keys.has("KeyA"),
        keys.has("KeyD"),
        keys.has("KeyW"),
        keys.has("KeyS")
      );

      // 2P Movement: Strictly Right-Side (Arrow Keys) or AI
      if (g.mode === "cpu") {
        updateAI(g, g.p2, g.p1);
      } else {
        updateFighterControl(
          g,
          g.p2,
          g.p1,
          keys.has("ArrowLeft"),
          keys.has("ArrowRight"),
          keys.has("ArrowUp"),
          keys.has("ArrowDown")
        );
      }

      const minDist = 48;
      const dist = Math.abs(g.p1.x - g.p2.x);
      if (dist < minDist && Math.abs(g.p1.y - g.p2.y) < 70) {
        const overlap = (minDist - dist) / 2;
        if (g.p1.x <= g.p2.x) {
          g.p1.x = Math.max(55, g.p1.x - overlap);
          g.p2.x = Math.min(845, g.p2.x + overlap);
        } else {
          g.p1.x = Math.min(845, g.p1.x + overlap);
          g.p2.x = Math.max(55, g.p2.x - overlap);
        }
      }

      checkMeleeHit(g, g.p1, g.p2);
      checkMeleeHit(g, g.p2, g.p1);

      FX.trackAfterimages(g, g.p1);
      FX.trackAfterimages(g, g.p2);
      FX.emitWeaponParticles(g, g.p1);
      FX.emitWeaponParticles(g, g.p2);

      for (const proj of g.projectiles) {
        proj.x += proj.vx;
        FX.emitProjectileTrail(g, proj);

        const target = proj.owner === "p1" ? g.p2 : g.p1;
        const attacker = proj.owner === "p1" ? g.p1 : g.p2;

        if (
          proj.hitsLeft > 0 &&
          Math.abs(proj.x - target.x) < proj.radius + 24 &&
          Math.abs(proj.y - (target.y - 48)) < proj.radius + 42
        ) {
          proj.hitsLeft--;
          applyHit(
            g,
            attacker,
            target,
            proj.damage,
            proj.isSuper ? 9.0 : 6.5,
            proj.isSuper ? -7.5 : 0,
            false,
            true
          );
        }
      }

      for (const p1Proj of g.projectiles) {
        if (p1Proj.owner !== "p1" || p1Proj.hitsLeft <= 0) continue;
        for (const p2Proj of g.projectiles) {
          if (p2Proj.owner !== "p2" || p2Proj.hitsLeft <= 0) continue;
          if (Math.abs(p1Proj.x - p2Proj.x) < p1Proj.radius + p2Proj.radius) {
            if (!p1Proj.isSuper) p1Proj.hitsLeft = 0;
            if (!p2Proj.isSuper) p2Proj.hitsLeft = 0;
            spawnParticles(g, (p1Proj.x + p2Proj.x) / 2, p1Proj.y, "#ffd60a", 16, 6);
            sfx.play("block");
          }
        }
      }

      g.projectiles = g.projectiles.filter((p: any) => p.hitsLeft > 0 && p.x > -60 && p.x < 960);
    }

    function renderGame(ctx: CanvasRenderingContext2D, g: any) {
      const W = 900;
      const H = 450;
      const frame = g.frameCounter;
      ctx.save();

      if (g.screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * g.screenShake * 2, (Math.random() - 0.5) * g.screenShake * 2);
      }

      FX.drawStage(ctx, g.stageKey || "dojo", frame, W, H, { dim: g.superFlash > 0 ? 0.35 : 0 });
      FX.drawFx(ctx, g, "back", frame);

      // 出招的一方畫在前面
      const order = g.p2.state === "attack" && g.p1.state !== "attack" ? [g.p1, g.p2] : [g.p2, g.p1];
      for (const f of order) {
        if (f.energy >= 100) FX.drawAura(ctx, f, frame);
        FX.drawFighter(ctx, f, frame);
      }

      for (const proj of g.projectiles) FX.drawProjectile(ctx, proj, frame);
      FX.drawFx(ctx, g, "front", frame);
      FX.drawParticles(ctx, g);
      FX.drawFloatingTexts(ctx, g);
      ctx.restore();

      FX.drawHitFlash(ctx, g, W, H);
      drawHUD(ctx, g, W, H);
      FX.drawCutIn(ctx, g, W, H, frame);
    }

    function drawHUD(ctx: CanvasRenderingContext2D, g: any, W: number, H: number) {
      const frame = g.frameCounter;
      const barW = 320;
      const barH = 22;
      const topY = 18;
      const p1X = 68;
      const p2X = W - 68 - barW;

      FX.drawPortrait(ctx, 34, 40, 26, g.p1, "left", frame);
      FX.drawPortrait(ctx, W - 34, 40, 26, g.p2, "right", frame);
      FX.drawBar(ctx, p1X, topY, barW, barH, g.p1.hp / g.p1.hpMax, g.p1.trailHp / g.p1.hpMax, "left", "#7dffb6", "#00b86b", frame);
      FX.drawBar(ctx, p2X, topY, barW, barH, g.p2.hp / g.p2.hpMax, g.p2.trailHp / g.p2.hpMax, "right", "#7de8ff", "#0891b2", frame);
      FX.drawTimer(ctx, W, topY, g.timer);

      FX.outlinedText(ctx, `👈 1P: ${g.p1.cfg.name}`, p1X, topY + barH + 18, 13, "#7dffb6", "#000", "left", 3);
      FX.outlinedText(ctx, `${g.mode === "cpu" ? "🤖 CPU" : "2P 👉"}: ${g.p2.cfg.name}`, p2X + barW, topY + barH + 18, 13, "#7de8ff", "#000", "right", 3);
      FX.outlinedText(ctx, "★".repeat(g.p1Wins) + "☆".repeat(Math.max(0, 2 - g.p1Wins)), p1X + barW - 4, topY + barH + 18, 15, "#ffd60a", "#000", "right", 3);
      FX.outlinedText(ctx, "★".repeat(g.p2Wins) + "☆".repeat(Math.max(0, 2 - g.p2Wins)), p2X + 4, topY + barH + 18, 15, "#ffd60a", "#000", "left", 3);

      if (g.p1.comboCount >= 2 && g.p1.comboTimer > 0) FX.drawCombo(ctx, 24, 128, g.p1.comboCount, "left", "#ffd60a", g.p1.comboTimer - 46);
      if (g.p2.comboCount >= 2 && g.p2.comboTimer > 0) FX.drawCombo(ctx, W - 24, 128, g.p2.comboCount, "right", "#7de8ff", g.p2.comboTimer - 46);

      const meterW = 260;
      const meterY = H - 22;
      FX.drawMeter(ctx, 40, meterY, meterW, 12, g.p1.energy, "left", frame);
      FX.drawMeter(ctx, W - 40 - meterW, meterY, meterW, 12, g.p2.energy, "right", frame);
      FX.outlinedText(
        ctx,
        g.p1.energy >= 100 ? "⚡ 1P SUPER MAX! 按 [Q] 施放超必殺技！" : `1P SUPER ${Math.floor(g.p1.energy)}%`,
        40,
        meterY - 5,
        11,
        g.p1.energy >= 100 ? "#ffd60a" : "#7be0a8",
        "#000",
        "left",
        3
      );
      FX.outlinedText(
        ctx,
        g.p2.energy >= 100
          ? g.mode === "pvp"
            ? "⚡ 2P SUPER MAX! 按 [I] 或 [Numpad 5] 施放！"
            : "⚡ CPU SUPER MAX!"
          : `${g.mode === "cpu" ? "CPU" : "2P"} SUPER ${Math.floor(g.p2.energy)}%`,
        W - 40,
        meterY - 5,
        11,
        g.p2.energy >= 100 ? "#ffd60a" : "#7be0a8",
        "#000",
        "right",
        3
      );

      if (g.phase !== "fight") {
        if (g._banner !== g.bannerText) {
          g._banner = g.bannerText;
          g.bannerAge = 0;
        }
        FX.drawBanner(ctx, W, H, g.bannerText, g.subBannerText, frame, g.bannerAge++);
      }
    }

    animId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [mode, p1Pick, p2Pick, stageIdx, aiDiffId]);

  function toggleMute() {
    sfx.muted = !muted;
    setMuted(!muted);
  }

  return (
    <Shell>
      <div className="flex-1 overflow-y-auto pr-1 space-y-3 crpg-scroll">
        {/* Top Mode & Stage Controls */}
        <div className="crpg-panel p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[#ffd60a] crpg-glow-yellow font-bold text-sm mr-2">
              🥊 ARENA 自由對戰模式 // FREE VERSUS
            </span>
            <button
              onClick={() => setMode("pvp")}
              className={`px-3 py-1.5 border font-bold transition ${
                mode === "pvp"
                  ? "border-[#00e5ff] text-[#00e5ff] crpg-glow-cyan bg-[#0f3a26]/50"
                  : "border-[#0f3a26] text-[#3a8c5e]"
              }`}
            >
              [ 1P vs 2P 雙人同鍵盤自由對打 (左右分區) ]
            </button>
            <button
              onClick={() => setMode("cpu")}
              className={`px-3 py-1.5 border font-bold transition ${
                mode === "cpu"
                  ? "border-[#00ff88] text-[#00ff88] crpg-glow bg-[#0f3a26]/50"
                  : "border-[#0f3a26] text-[#3a8c5e]"
              }`}
            >
              [ 1P vs CPU 單人自由對戰電腦 ]
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {mode === "cpu" && (
              <div className="flex items-center gap-1">
                <span className="text-[#3a8c5e]">AI難度:</span>
                {AI_DIFFICULTIES.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setAiDiffId(d.id)}
                    className={`px-2 py-1 border text-[11px] ${
                      aiDiffId === d.id
                        ? "border-[#ffd60a] text-[#ffd60a] bg-[#ffd60a]/10"
                        : "border-[#0f3a26] text-[#3a8c5e]"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={toggleMute}
              className="px-2.5 py-1 border border-[#0f3a26] text-[#cfeedd] hover:border-[#00ff88]"
            >
              {muted ? "音效：關" : "音效：開"}
            </button>
            <button
              onClick={() => startNewMatch(mode, p1Pick, p2Pick, stageIdx, aiDiffId)}
              className="px-3 py-1.5 border border-[#ffd60a] text-[#ffd60a] crpg-glow-yellow hover:bg-[#ffd60a]/10 font-bold"
            >
              ↻ 重新開戰 (REMATCH)
            </button>
            <Link
              to="/play"
              className="px-3 py-1.5 border border-[#00ff88] text-[#00ff88] hover:bg-[#00ff88]/10"
            >
              ▶ 前往故事模式 [PLAY]
            </Link>
          </div>
        </div>

        {/* Left 1P & Right 2P / CPU Character Pickers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
          <Panel title="👈 選擇 1P 角色 (左半邊鍵盤：WASD 移動 + F / G / R / T / Y / Q 出招)">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FIGHTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setP1Pick(f.id)}
                  className={`p-2 border text-left transition ${
                    p1Pick === f.id
                      ? "border-[#00ff88] bg-[#0f3a26]/50 text-[#00ff88] shadow-sm"
                      : "border-[#0f3a26] text-[#7be0a8] hover:border-[#3a8c5e]"
                  }`}
                >
                  <div className="font-bold truncate">{f.name}</div>
                  <div className="text-[10px] text-[#cfeedd] truncate">{f.title}</div>
                  <div className="text-[10px] mt-1 text-[#ffd60a]">
                    HP {f.hp} · ATK ×{f.atkMul}
                  </div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel
            title={
              mode === "pvp"
                ? "👉 選擇 2P 角色 (右半邊鍵盤：方向鍵 ↑←↓→ 移動 + J/K/L/U/O/I 或 數字鍵 Numpad 1~6 出招)"
                : "🤖 選擇 CPU 電腦對手角色 (自由選擇任何格鬥家或故事 BOSS 對戰)"
            }
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FIGHTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setP2Pick(f.id)}
                  className={`p-2 border text-left transition ${
                    p2Pick === f.id
                      ? "border-[#00e5ff] bg-[#0f3a26]/50 text-[#00e5ff] shadow-sm"
                      : "border-[#0f3a26] text-[#7be0a8] hover:border-[#3a8c5e]"
                  }`}
                >
                  <div className="font-bold truncate">{f.name}</div>
                  <div className="text-[10px] text-[#cfeedd] truncate">{f.title}</div>
                  <div className="text-[10px] mt-1 text-[#ffd60a]">
                    HP {f.hp} · ATK ×{f.atkMul}
                  </div>
                </button>
              ))}
            </div>
          </Panel>
        </div>

        {/* Main 60 FPS Street Fighter Canvas */}
        <div className="crpg-panel p-2 flex flex-col items-center">
          <div className="w-full flex flex-wrap justify-between items-center px-2 pb-1.5 text-[11px] text-[#7be0a8] gap-2">
            <span>{matchStateText}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[#3a8c5e]">對戰場地：</span>
              {STAGES.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => setStageIdx(idx)}
                  className={`px-2 py-0.5 border text-[10px] ${
                    stageIdx === idx
                      ? "border-[#00ff88] text-[#00ff88]"
                      : "border-[#0f3a26] text-[#3a8c5e]"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
          <canvas
            ref={canvasRef}
            width={900}
            height={450}
            className="w-full max-w-[900px] aspect-[900/450] border border-[#0f3a26] bg-[#050c09] rounded"
          />
        </div>

        {/* Split Left / Right Keyboard Controls Cheat Sheet */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <Panel title="👈 左半邊鍵盤：1P 專屬操作區 (PLAYER 1 — LEFT KEYBOARD)">
            <div className="grid grid-cols-2 gap-2 text-[#cfeedd]">
              <div>
                <span className="text-[#00ff88] font-bold">[W / A / S / D]</span>：跳躍 / 左右移動 / 蹲下格擋
              </div>
              <div>
                <span className="text-[#00ff88] font-bold">[F] 輕擊</span>：快速連擊（可取消接技能）
              </div>
              <div>
                <span className="text-[#00ff88] font-bold">[G] 重擊 / [S+G] 掃堂腿</span>：高傷擊退／下段擊倒
              </div>
              <div>
                <span className="text-[#00e5ff] font-bold">[R] 技能 1 (遠程波)</span>：發射飛行氣功波／劍氣
              </div>
              <div>
                <span className="text-[#ffd60a] font-bold">[T] 技能 2 (昇龍技)</span>：無敵對空擊飛上勾拳
              </div>
              <div>
                <span className="text-[#a78bfa] font-bold">[Y] 技能 3 (突進技)</span>：高速霸體突進攻擊
              </div>
              <div className="col-span-2">
                <span className="text-[#ff4d6d] font-bold">[Q] ★ 超必殺技 (SUPER)</span>：氣條 100% 時施放三連毀滅超必殺！（單人打電腦時亦相容 J/K/L/U/O/I）
              </div>
            </div>
          </Panel>

          <Panel title="👉 右半邊鍵盤：2P 專屬操作區 (PLAYER 2 — RIGHT KEYBOARD)">
            <div className="grid grid-cols-2 gap-2 text-[#cfeedd]">
              <div>
                <span className="text-[#00e5ff] font-bold">[↑ / ← / ↓ / →]</span>：跳躍 / 左右移動 / 蹲下格擋
              </div>
              <div>
                <span className="text-[#00e5ff] font-bold">[J] 或 [Numpad 1]</span>：輕擊（快速連擊）
              </div>
              <div>
                <span className="text-[#00e5ff] font-bold">[K] 或 [Numpad 2]</span>：重擊／[↓+K] 下段掃堂腿
              </div>
              <div>
                <span className="text-[#00ff88] font-bold">[L] 或 [Numpad 3]</span>：技能 1（遠程氣功波）
              </div>
              <div>
                <span className="text-[#ffd60a] font-bold">[U] 或 [Numpad 4]</span>：技能 2（無敵對空昇龍）
              </div>
              <div>
                <span className="text-[#a78bfa] font-bold">[O] 或 [Numpad 6]</span>：技能 3（高速霸體突進）
              </div>
              <div className="col-span-2">
                <span className="text-[#ff4d6d] font-bold">[I] 或 [Numpad 5]</span>：★ 超必殺技（100% 氣條施放 — 完全獨立於鍵盤右半區，雙人絕不撞手！）
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </Shell>
  );
}
