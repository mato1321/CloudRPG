// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

/* ───────────── WEB AUDIO ARCADE SYNTH ───────────── */

class StoryArcadeAudio {
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

  play(
    type:
      | "light"
      | "heavy"
      | "block"
      | "hadouken"
      | "shoryuken"
      | "dash"
      | "super"
      | "ko"
      | "jump"
      | "heal"
      | "assist"
      | "talk"
      | "portal"
      | "hazard"
  ) {
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
      } else if (type === "heal") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.22);
        gain.gain.setValueAtTime(0.24, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === "assist") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.setValueAtTime(550, now + 0.07);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.22);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === "talk") {
        osc.type = "square";
        osc.frequency.setValueAtTime(520 + Math.random() * 160, now);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.035);
        osc.start(now);
        osc.stop(now + 0.035);
      } else if (type === "portal") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(920, now + 0.35);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === "hazard") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(480, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.28);
        gain.gain.setValueAtTime(0.26, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
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

export const storySfx = new StoryArcadeAudio();

/* ───────────── STORY ENEMY FIGHTER PROFILES (PROGRESSIVE DIFFICULTY) ───────────── */

export const STORY_ENEMY_PROFILES: Record<string, any> = {
  minions: {
    name: "魔王軍雜魚老大",
    title: "STAGE 1 · 燒村先鋒隊長",
    color: "#f97316",
    secondary: "#ffd60a",
    belt: "#1f2937",
    headband: "#ef4444",
    visualType: "minions",
    hp: 200,
    atkMul: 0.65,
    speed: 3.3,
    jumpForce: 11.8,
    aggr: 0.22,
    block: 0.08,
    specialName: "雜魚火球",
    upperName: "採棉花上勾拳",
    dashName: "惡霸衝撞",
    superName: "魔王軍圍毆連擊",
    bgTop: "#2b0909",
    bgFloor: "#3f130a",
  },
  goblin: {
    name: "哥布林狂戰王",
    title: "STAGE 2 · 洞窟掠奪者",
    color: "#22c55e",
    secondary: "#a3e635",
    belt: "#3f2e18",
    headband: "#eab308",
    visualType: "goblin",
    hp: 240,
    atkMul: 0.78,
    speed: 3.7,
    jumpForce: 12.2,
    aggr: 0.3,
    block: 0.12,
    specialName: "毒刃投擲",
    upperName: "哥布林飛踢",
    dashName: "狂暴飛撲",
    superName: "百鬼夜行亂舞",
    bgTop: "#061e12",
    bgFloor: "#0d2e1e",
  },
  duke: {
    name: "羅劫公爵 DUKE",
    title: "BOSS 1 · 赤紅傳說之石守護者",
    color: "#e11d48",
    secondary: "#fde047",
    belt: "#4c0519",
    headband: "#ffd60a",
    visualType: "duke",
    hp: 320,
    atkMul: 0.95,
    speed: 3.9,
    jumpForce: 12.4,
    aggr: 0.42,
    block: 0.22,
    specialName: "深紅煉獄波",
    upperName: "血腥公爵昇龍斬",
    dashName: "血影突襲",
    superName: "赤紅滅世血月斬",
    bgTop: "#260713",
    bgFloor: "#3d0a1e",
  },
  abyss: {
    name: "冥盡洞主 ABYSS",
    title: "BOSS 2 · 蒼藍傳說之石守護者",
    color: "#00e5ff",
    secondary: "#a78bfa",
    belt: "#0f172a",
    headband: "#38bdf8",
    visualType: "abyss",
    hazardType: "ice_spike",
    hp: 400,
    atkMul: 1.12,
    speed: 4.1,
    jumpForce: 12.6,
    aggr: 0.52,
    block: 0.3,
    specialName: "深淵寒冰波",
    upperName: "冥河激流衝",
    dashName: "暗流漩渦突進",
    superName: "絕對零度・冥盡崩壞",
    bgTop: "#041628",
    bgFloor: "#082846",
  },
  skyisle: {
    name: "天光島嶼之主",
    title: "BOSS 3 · 黃金傳說之石守護者",
    color: "#ffd60a",
    secondary: "#ffffff",
    belt: "#422006",
    headband: "#00e5ff",
    visualType: "skyisle",
    hazardType: "sky_lightning",
    hp: 480,
    atkMul: 1.25,
    speed: 4.4,
    jumpForce: 13.0,
    aggr: 0.6,
    block: 0.38,
    specialName: "天光裁決閃",
    upperName: "神罰雷鳴昇",
    dashName: "閃電音速衝",
    superName: "天界隕落・聖光審判",
    bgTop: "#1a1605",
    bgFloor: "#332b0a",
  },
  demonlord: {
    name: "魔王 (21世紀程式語言版)",
    title: "STAGE 6 · 舊世代 Bug 聚合體",
    color: "#a855f7",
    secondary: "#00ff88",
    belt: "#1e1b4b",
    headband: "#f43f5e",
    visualType: "demonlord",
    hp: 550,
    atkMul: 1.35,
    speed: 4.5,
    jumpForce: 13.0,
    aggr: 0.68,
    block: 0.45,
    specialName: "NullPointer 波動",
    upperName: "StackOverflow 昇龍",
    dashName: "InfiniteLoop 突進",
    superName: "Segmentation Fault 滅世",
    bgTop: "#19082b",
    bgFloor: "#2d0f4d",
  },
  admin: {
    name: "Administrator",
    title: "FINAL BOSS · C:\\mato\\AIclub.exe",
    color: "#00ff88",
    secondary: "#ff4d6d",
    belt: "#022c22",
    headband: "#ffffff",
    visualType: "admin",
    hazardType: "format_beam",
    hp: 680,
    atkMul: 1.5,
    speed: 4.7,
    jumpForce: 13.4,
    aggr: 0.78,
    block: 0.55,
    specialName: "rm -rf / 抹除光波",
    upperName: "KERNEL PANIC 衝擊",
    dashName: "OVERCLOCK 瞬移斬",
    superName: "SYSTEM FORMAT // 全人類格式化",
    bgTop: "#021810",
    bgFloor: "#052e20",
  },
};

const PLAYER_CLASS_PROFILES: Record<string, any> = {
  warrior: {
    color: "#ff4d6d",
    secondary: "#ffd60a",
    belt: "#450a0a",
    headband: "#ffffff",
    speed: 3.9,
    jumpForce: 12.0,
  },
  mage: {
    color: "#a78bfa",
    secondary: "#00e5ff",
    belt: "#1e1b4b",
    headband: "#00ff88",
    speed: 4.2,
    jumpForce: 12.4,
  },
  priest: {
    color: "#ffd60a",
    secondary: "#00ff88",
    belt: "#422006",
    headband: "#00e5ff",
    speed: 4.0,
    jumpForce: 12.2,
  },
};

export function StoryBattleArena({
  state,
  enemyKey,
  enemyCfg,
  classCfg,
  onUseHerb,
  onUseMana,
  onUseTotem,
  onSyncHpMp,
  onBattleEnd,
  onFlee,
  onLog,
  onOpenShopModal,
}: any) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [muted, setMuted] = useState(false);
  const [typingInInput, setTypingInInput] = useState(false);

  // ✅ 修復「角色無法移動」：指令輸入框 (autoFocus) 會吃掉 WASD，
  // 戰鬥開始時把鍵盤交還給戰場，並在輸入框取得焦點時顯示提示
  useEffect(() => {
    const isTextInput = (el: Element | null) =>
      !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
    if (isTextInput(document.activeElement)) (document.activeElement as HTMLElement).blur();
    const sync = () => setTypingInInput(isTextInput(document.activeElement));
    sync();
    document.addEventListener("focusin", sync);
    document.addEventListener("focusout", sync);
    return () => {
      document.removeEventListener("focusin", sync);
      document.removeEventListener("focusout", sync);
    };
  }, [enemyKey]);

  const stateRef = useRef(state);
  stateRef.current = state;

  const callbacksRef = useRef({
    onUseHerb,
    onUseMana,
    onUseTotem,
    onSyncHpMp,
    onBattleEnd,
    onFlee,
    onLog,
    onOpenShopModal,
  });
  callbacksRef.current = {
    onUseHerb,
    onUseMana,
    onUseTotem,
    onSyncHpMp,
    onBattleEnd,
    onFlee,
    onLog,
    onOpenShopModal,
  };

  useEffect(() => {
    const profile = STORY_ENEMY_PROFILES[enemyKey] || STORY_ENEMY_PROFILES.minions;
    const pProfile = PLAYER_CLASS_PROFILES[state.klass] || PLAYER_CLASS_PROFILES.warrior;

    const skill1 = classCfg.normal?.[0] || { name: "裂地斬", mp: 15, mul: 1.6 };
    const skill2 = classCfg.normal?.[1] || { name: "狂戰衝擊", mp: 18, mul: 1.8 };
    const skill3 = classCfg.normal?.[2] || { name: "鋼鐵粉碎", mp: 20, mul: 2.0 };
    const ultSkill = classCfg.ultimate || { name: "滅世斷界斬", mp: 40, mul: 4.5 };

    // Calculate player atkMul and weapon tier visual
    const playerAtkMul = Number(
      Math.max(0.88, Math.min(2.6, 0.85 + (state.atk || 20) * 0.008 + (state.level || 1) * 0.03)).toFixed(2)
    );
    const enemyMaxHp = profile.hp;
    const weaponTier =
      (state.inv?.terminus || 0) > 0
        ? 3
        : (state.inv?.weapon_adv || 0) > 0
        ? 2
        : (state.inv?.weapon_basic || 0) > 0
        ? 1
        : 0;

    const g: any = {
      frameCounter: 0,
      timer: 99,
      hitStop: 0,
      screenShake: 0,
      superFlash: 0,
      phase: "intro", // intro | fight | ko | done
      phaseTimer: 65,
      bannerText: `VS ${profile.name}`,
      subBannerText: profile.title,
      projectiles: [],
      particles: [],
      floatingTexts: [],
      hazards: [], // Boss ground hazards (ice spikes, sky lightning, format beams)
      activeAssist: null, // Party assist entity when [E] is pressed
      assistCooldown: 0, // Cooldown frames (max 380 frames ~ 8s)
      p1: {
        isAI: false,
        x: 200,
        y: 380,
        vx: 0,
        vy: 0,
        facing: 1,
        hp: state.hp,
        hpMax: state.hpMax,
        trailHp: state.hp,
        mp: state.mp,
        mpMax: state.mpMax,
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
        klass: state.klass,
        weaponTier,
        cfg: {
          name: `${state.name} (${classCfg.name})`,
          color: pProfile.color,
          secondary: pProfile.secondary,
          belt: pProfile.belt,
          headband: pProfile.headband,
          speed: pProfile.speed,
          jumpForce: pProfile.jumpForce,
          atkMul: playerAtkMul,
          visualType: state.klass,
        },
      },
      p2: {
        isAI: true,
        x: 700,
        y: 380,
        vx: 0,
        vy: 0,
        facing: -1,
        hp: enemyMaxHp,
        hpMax: enemyMaxHp,
        trailHp: enemyMaxHp,
        energy: 25,
        energyMax: 100,
        state: "idle",
        attackType: null,
        stateTimer: 0,
        attackDuration: 0,
        hasHitCurrentAttack: false,
        comboCount: 0,
        comboTimer: 0,
        invincibleTimer: 0,
        aiCooldown: 28,
        hazardCooldown: 150,
        phase2Triggered: false,
        weaponTier: 2,
        cfg: {
          ...profile,
        },
      },
    };

    const keys = new Set<string>();

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") {
        // 在指令框按 Esc → 回到角色操控
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", " "].includes(e.key)) {
        e.preventDefault();
      }
      const code = e.code;
      const isFirst = !keys.has(code);
      keys.add(code);

      if (g.phase !== "fight" || !isFirst) return;

      const crouch = keys.has("KeyS") || keys.has("ArrowDown");

      if (code === "KeyF" || code === "KeyJ") {
        triggerPlayerAttack("light");
      } else if (code === "KeyG" || code === "KeyK") {
        triggerPlayerAttack(crouch ? "sweep" : "heavy");
      } else if (code === "KeyR" || code === "KeyL") {
        triggerPlayerAttack("skill1");
      } else if (code === "KeyT" || code === "KeyU") {
        triggerPlayerAttack("skill2");
      } else if (code === "KeyY" || code === "KeyO") {
        triggerPlayerAttack("skill3");
      } else if (code === "KeyQ" || code === "KeyI") {
        triggerPlayerAttack("ult");
      } else if (code === "KeyE") {
        triggerPartyAssist();
      } else if (code === "KeyH") {
        useBattleHerb();
      } else if (code === "KeyB") {
        useBattleMana();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.code);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const FLOOR_Y = 380;
    const GRAVITY = 0.56;

    function spawnParticles(x: number, y: number, color: string, count = 12, speed = 5) {
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

    function addFloatingText(x: number, y: number, text: string, color: string, life = 34) {
      g.floatingTexts.push({ x, y, text, color, life, maxLife: life });
    }

    // 🤝 Party Assist System ([E] key)
    function triggerPartyAssist() {
      if (g.assistCooldown > 0) {
        const secLeft = Math.ceil((g.assistCooldown * 21) / 1000);
        addFloatingText(g.p1.x, g.p1.y - 108, `⏳ 隊友支援冷卻中 (${secLeft}s)`, "#3a8c5e", 24);
        return;
      }
      const partyList = stateRef.current?.party || [];
      const ally = partyList[g.frameCounter % Math.max(1, partyList.length)] || {
        name: "AI_BOT_α",
        klass: stateRef.current?.klass === "mage" ? "warrior" : "mage",
      };
      g.assistCooldown = 360; // ~7.5 seconds
      storySfx.play("assist");

      const startX = Math.max(60, Math.min(840, g.p1.x - g.p1.facing * 50));
      g.activeAssist = {
        name: ally.name,
        klass: ally.klass,
        x: startX,
        y: FLOOR_Y - 120,
        vy: 4,
        facing: g.p1.facing,
        timer: 42,
        hasFired: false,
      };
      addFloatingText(startX, FLOOR_Y - 135, `🤝 ${ally.name} 參戰支援！`, "#00e5ff", 40);
      spawnParticles(startX, FLOOR_Y - 60, "#00e5ff", 18, 6);
    }

    function useBattleHerb() {
      const cur = stateRef.current;
      if ((cur?.inv?.herb || 0) <= 0) {
        addFloatingText(g.p1.x, g.p1.y - 95, "沒有草藥！", "#ff4d6d", 25);
        return;
      }
      if (g.p1.hp >= g.p1.hpMax) {
        addFloatingText(g.p1.x, g.p1.y - 95, "HP 已滿", "#00ff88", 22);
        return;
      }
      g.p1.hp = Math.min(g.p1.hpMax, g.p1.hp + 60);
      storySfx.play("heal");
      spawnParticles(g.p1.x, g.p1.y - 45, "#00ff88", 18, 5);
      addFloatingText(g.p1.x, g.p1.y - 95, "+60 HP (草藥)", "#00ff88", 32);
      callbacksRef.current.onUseHerb?.(g.p1.hp);
    }

    function useBattleMana() {
      const cur = stateRef.current;
      if ((cur?.inv?.mana || 0) <= 0) {
        addFloatingText(g.p1.x, g.p1.y - 95, "沒有魔力藥水！", "#00e5ff", 25);
        return;
      }
      g.p1.mp = Math.min(g.p1.mpMax, g.p1.mp + 60);
      g.p1.energy = Math.min(100, g.p1.energy + 50);
      storySfx.play("heal");
      spawnParticles(g.p1.x, g.p1.y - 45, "#00e5ff", 18, 5);
      addFloatingText(g.p1.x, g.p1.y - 95, "+60 MP / +50% 氣條", "#00e5ff", 32);
      callbacksRef.current.onUseMana?.(g.p1.mp);
    }

    function triggerPlayerAttack(kind: string) {
      const attacker = g.p1;
      const defender = g.p2;
      const curState = stateRef.current;

      if (["hit", "block", "knockdown", "ko"].includes(attacker.state)) return;
      if (attacker.state === "attack") {
        const canCancel =
          attacker.attackType === "light" && ["skill1", "skill2", "skill3", "ult"].includes(kind);
        if (!canCancel) return;
      }

      if (kind === "skill2" && !curState.learnedSkill2) {
        addFloatingText(attacker.x, attacker.y - 105, "🔒 需於黑市購買「進階技能書・卷一」", "#ffd60a", 38);
        storySfx.play("block");
        return;
      }
      if (kind === "skill3" && !curState.learnedSkill3) {
        addFloatingText(attacker.x, attacker.y - 105, "🔒 需於黑市購買「進階技能書・卷二」", "#ffd60a", 38);
        storySfx.play("block");
        return;
      }
      if (kind === "ult" && !curState.learnedUlt) {
        addFloatingText(attacker.x, attacker.y - 105, "🔒 需於黑市購買「終極奧義技能書」", "#ff4d6d", 38);
        storySfx.play("block");
        return;
      }

      if (kind === "skill1") {
        if (attacker.mp < skill1.mp) {
          addFloatingText(attacker.x, attacker.y - 95, `MP 不足 (${skill1.mp})`, "#00e5ff", 26);
          return;
        }
        attacker.mp -= skill1.mp;
      } else if (kind === "skill2") {
        if (attacker.mp < skill2.mp) {
          addFloatingText(attacker.x, attacker.y - 95, `MP 不足 (${skill2.mp})`, "#00e5ff", 26);
          return;
        }
        attacker.mp -= skill2.mp;
        if (skill2.heal) {
          attacker.hp = Math.min(attacker.hpMax, attacker.hp + skill2.heal);
          addFloatingText(attacker.x, attacker.y - 120, `+${skill2.heal} HP`, "#00ff88", 30);
        }
      } else if (kind === "skill3") {
        if (attacker.mp < skill3.mp) {
          addFloatingText(attacker.x, attacker.y - 95, `MP 不足 (${skill3.mp})`, "#00e5ff", 26);
          return;
        }
        attacker.mp -= skill3.mp;
        if (skill3.heal) {
          attacker.hp = Math.min(attacker.hpMax, attacker.hp + skill3.heal);
          addFloatingText(attacker.x, attacker.y - 120, `+${skill3.heal} HP`, "#00ff88", 30);
        }
      } else if (kind === "ult") {
        if (attacker.energy < 100 && attacker.mp < ultSkill.mp) {
          addFloatingText(attacker.x, attacker.y - 102, `需 100% 氣條 或 ${ultSkill.mp} MP！`, "#ff4d6d", 30);
          return;
        }
        if (attacker.energy >= 100) {
          attacker.energy = 0;
        } else {
          attacker.mp -= ultSkill.mp;
        }
        if (ultSkill.heal) {
          attacker.hp = Math.min(attacker.hpMax, attacker.hp + ultSkill.heal);
          addFloatingText(attacker.x, attacker.y - 130, `+${ultSkill.heal} HP`, "#00ff88", 35);
        }
        g.superFlash = 18;
        g.hitStop = 8;
        attacker.invincibleTimer = 30;
        storySfx.play("super");
        spawnParticles(attacker.x, attacker.y - 55, attacker.cfg.color, 26, 7);
        addFloatingText(attacker.x, attacker.y - 115, `★ ${ultSkill.name} ★`, "#ffd60a", 42);
      }

      attacker.state = "attack";
      attacker.attackType = kind;
      attacker.hasHitCurrentAttack = false;
      attacker.facing = defender.x >= attacker.x ? 1 : -1;

      if (kind === "light") {
        attacker.attackDuration = 16;
        attacker.stateTimer = 16;
        storySfx.play("light");
      } else if (kind === "heavy") {
        attacker.attackDuration = 24;
        attacker.stateTimer = 24;
        attacker.vx = attacker.facing * 3.0;
        storySfx.play("heavy");
      } else if (kind === "sweep") {
        attacker.attackDuration = 26;
        attacker.stateTimer = 26;
        attacker.vx = attacker.facing * 3.8;
        storySfx.play("heavy");
      } else if (kind === "skill1") {
        attacker.attackDuration = 28;
        attacker.stateTimer = 28;
        storySfx.play("hadouken");
        addFloatingText(attacker.x, attacker.y - 95, skill1.name, attacker.cfg.color, 28);
        g.projectiles.push({
          owner: "p1",
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
      } else if (kind === "skill2") {
        attacker.attackDuration = 32;
        attacker.stateTimer = 32;
        attacker.vy = -11.0;
        attacker.vx = attacker.facing * 3.5;
        attacker.invincibleTimer = 14;
        storySfx.play("shoryuken");
        addFloatingText(attacker.x, attacker.y - 100, skill2.name, "#ffd60a", 30);
        spawnParticles(attacker.x, attacker.y - 20, "#ffd60a", 16, 5);
      } else if (kind === "skill3") {
        attacker.attackDuration = 26;
        attacker.stateTimer = 26;
        attacker.vx = attacker.facing * 7.8;
        attacker.invincibleTimer = 10;
        storySfx.play("dash");
        addFloatingText(attacker.x, attacker.y - 100, skill3.name, "#00e5ff", 30);
        spawnParticles(attacker.x, attacker.y - 40, "#00e5ff", 16, 5);
        if (stateRef.current.klass === "mage") {
          g.projectiles.push({
            owner: "p1",
            x: attacker.x + attacker.facing * 52,
            y: attacker.y - 52,
            vx: attacker.facing * 9.5,
            radius: 22,
            damage: Math.round(32 * attacker.cfg.atkMul),
            color: "#00e5ff",
            coreColor: "#ffffff",
            isSuper: false,
            hitsLeft: 1,
          });
        }
      } else if (kind === "ult") {
        attacker.attackDuration = 40;
        attacker.stateTimer = 40;
        for (let i = 0; i < 3; i++) {
          g.projectiles.push({
            owner: "p1",
            x: attacker.x + attacker.facing * (52 - i * 28),
            y: attacker.y - 54,
            vx: attacker.facing * 10.0,
            radius: 28,
            damage: Math.round(26 * attacker.cfg.atkMul),
            color: "#ffd60a",
            coreColor: attacker.cfg.color,
            isSuper: true,
            hitsLeft: 1,
          });
        }
      }

      callbacksRef.current.onSyncHpMp?.(attacker.hp, attacker.mp, g.p2.hp);
    }

    function triggerEnemyAttack(kind: string) {
      const attacker = g.p2;
      const defender = g.p1;
      if (["hit", "block", "knockdown", "ko", "attack"].includes(attacker.state)) return;

      if (kind === "ult") {
        attacker.energy = 0;
        g.superFlash = 16;
        g.hitStop = 7;
        attacker.invincibleTimer = 22;
        storySfx.play("super");
        spawnParticles(attacker.x, attacker.y - 55, attacker.cfg.color, 24, 6);
        addFloatingText(attacker.x, attacker.y - 115, `★ ${attacker.cfg.superName} ★`, "#ff4d6d", 38);
      }

      attacker.state = "attack";
      attacker.attackType = kind;
      attacker.hasHitCurrentAttack = false;
      attacker.facing = defender.x >= attacker.x ? 1 : -1;

      if (kind === "light") {
        attacker.attackDuration = 16;
        attacker.stateTimer = 16;
        storySfx.play("light");
      } else if (kind === "heavy") {
        attacker.attackDuration = 24;
        attacker.stateTimer = 24;
        attacker.vx = attacker.facing * 3.0;
        storySfx.play("heavy");
      } else if (kind === "sweep") {
        attacker.attackDuration = 26;
        attacker.stateTimer = 26;
        attacker.vx = attacker.facing * 3.8;
        storySfx.play("heavy");
      } else if (kind === "skill1") {
        attacker.attackDuration = 28;
        attacker.stateTimer = 28;
        storySfx.play("hadouken");
        addFloatingText(attacker.x, attacker.y - 95, attacker.cfg.specialName, attacker.cfg.color, 26);
        g.projectiles.push({
          owner: "p2",
          x: attacker.x + attacker.facing * 48,
          y: attacker.y - 52,
          vx: attacker.facing * 7.8,
          radius: 18,
          damage: Math.round(28 * attacker.cfg.atkMul),
          color: attacker.cfg.color,
          coreColor: attacker.cfg.secondary,
          isSuper: false,
          hitsLeft: 1,
        });
      } else if (kind === "skill2") {
        attacker.attackDuration = 32;
        attacker.stateTimer = 32;
        attacker.vy = -11.0;
        attacker.vx = attacker.facing * 3.5;
        attacker.invincibleTimer = 12;
        storySfx.play("shoryuken");
        addFloatingText(attacker.x, attacker.y - 100, attacker.cfg.upperName, "#ffd60a", 28);
      } else if (kind === "skill3") {
        attacker.attackDuration = 26;
        attacker.stateTimer = 26;
        attacker.vx = attacker.facing * 7.5;
        storySfx.play("dash");
        addFloatingText(attacker.x, attacker.y - 100, attacker.cfg.dashName, "#00e5ff", 28);
      } else if (kind === "ult") {
        attacker.attackDuration = 40;
        attacker.stateTimer = 40;
        for (let i = 0; i < 3; i++) {
          g.projectiles.push({
            owner: "p2",
            x: attacker.x + attacker.facing * (52 - i * 28),
            y: attacker.y - 54,
            vx: attacker.facing * 9.5,
            radius: 26,
            damage: Math.round(24 * attacker.cfg.atkMul),
            color: "#ff4d6d",
            coreColor: attacker.cfg.color,
            isSuper: true,
            hitsLeft: 1,
          });
        }
      }
    }

    function updateFighterControl(
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
            spawnParticles(f.x, FLOOR_Y, "#7be0a8", 5, 2.2);
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
        f.vx *= 0.78;
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
        storySfx.play("jump");
        spawnParticles(f.x, FLOOR_Y, "#00ff88", 6, 2.8);
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

    function updateEnemyAI() {
      const ai = g.p2;
      const target = g.p1;
      if (ai.aiCooldown > 0) ai.aiCooldown--;
      if (ai.hazardCooldown > 0) ai.hazardCooldown--;

      // Administrator Phase 2 Overclock trigger at <= 55% HP
      if (enemyKey === "admin" && !ai.phase2Triggered && ai.hp <= ai.hpMax * 0.55) {
        ai.phase2Triggered = true;
        g.superFlash = 25;
        g.screenShake = 14;
        storySfx.play("super");
        addFloatingText(ai.x, ai.y - 125, "⚠️ KERNEL OVERCLOCK // 系統二階段超頻啟動！", "#ff4d6d", 55);
        spawnParticles(ai.x, ai.y - 50, "#ff4d6d", 32, 7);
        ai.cfg.speed = 5.2;
        ai.cfg.aggr = 0.88;
      }

      // Boss Special Ground Hazards (Abyss, SkyIsle, Administrator)
      if (ai.cfg.hazardType && ai.hazardCooldown === 0 && g.phase === "fight") {
        ai.hazardCooldown = ai.phase2Triggered ? 130 : 210;
        const hType = ai.cfg.hazardType;
        if (hType === "ice_spike") {
          g.hazards.push({
            type: "ice_spike",
            x: Math.max(80, Math.min(820, target.x)),
            width: 56,
            warnTimer: 38,
            activeTimer: 22,
            damage: 24,
            hasHit: false,
            color: "#00e5ff",
            label: "❄️ 深淵冰刺預警",
          });
        } else if (hType === "sky_lightning") {
          g.hazards.push({
            type: "sky_lightning",
            x: Math.max(80, Math.min(820, target.x)),
            width: 64,
            warnTimer: 36,
            activeTimer: 20,
            damage: 28,
            hasHit: false,
            color: "#ffd60a",
            label: "⚡ 天罰落雷預警",
          });
        } else if (hType === "format_beam") {
          const count = ai.phase2Triggered ? 2 : 1;
          for (let i = 0; i < count; i++) {
            const hx = i === 0 ? target.x : Math.max(90, Math.min(810, target.x + (Math.random() > 0.5 ? 160 : -160)));
            g.hazards.push({
              type: "format_beam",
              x: hx,
              width: 68,
              warnTimer: 35,
              activeTimer: 24,
              damage: 32,
              hasHit: false,
              color: "#ff4d6d",
              label: "💻 rm -rf 格式化光束",
            });
          }
        }
      }

      const dist = Math.abs(target.x - ai.x);
      const dir = target.x >= ai.x ? 1 : -1;
      const aggr = ai.cfg.aggr || 0.42;

      let moveLeft = false;
      let moveRight = false;
      let moveUp = false;

      const incoming = g.projectiles.find(
        (p: any) => p.owner === "p1" && Math.abs(p.x - ai.x) < 130 && Math.abs(p.x - ai.x) > 30
      );
      if (incoming && ai.y >= FLOOR_Y && Math.random() < aggr * 0.65) {
        moveUp = true;
      }

      if (dist > 165) {
        if (ai.aiCooldown === 0 && Math.random() < 0.024 * aggr) {
          if (ai.energy >= 100 && Math.random() < 0.4) {
            triggerEnemyAttack("ult");
          } else {
            triggerEnemyAttack("skill1");
          }
          ai.aiCooldown = Math.round(48 / aggr);
        } else {
          if (dir > 0) moveRight = true;
          else moveLeft = true;
        }
      } else if (dist > 82) {
        if (ai.aiCooldown === 0 && Math.random() < 0.05 * aggr) {
          const r = Math.random();
          if (target.y < FLOOR_Y - 40 && r < 0.55) triggerEnemyAttack("skill2");
          else if (r < 0.35) triggerEnemyAttack("skill3");
          else if (r < 0.7) triggerEnemyAttack("heavy");
          else triggerEnemyAttack("sweep");
          ai.aiCooldown = Math.round(36 / aggr);
        } else if (Math.random() < 0.5) {
          if (dir > 0) moveRight = true;
          else moveLeft = true;
        }
      } else {
        if (ai.aiCooldown === 0 && Math.random() < 0.09 * aggr) {
          const r = Math.random();
          if (ai.energy >= 100 && r < 0.3) triggerEnemyAttack("ult");
          else if (r < 0.45) triggerEnemyAttack("light");
          else if (r < 0.78) triggerEnemyAttack("heavy");
          else triggerEnemyAttack("skill2");
          ai.aiCooldown = Math.round(28 / aggr);
        } else if (target.state === "attack" && Math.random() < (ai.cfg.block || 0.25)) {
          if (dir > 0) moveLeft = true;
          else moveRight = true;
        }
      }

      updateFighterControl(ai, target, moveLeft, moveRight, moveUp, false);
    }

    function isHoldingBack(f: any, opponent: any) {
      if (f.isAI) {
        return f.state === "walk" && Math.sign(f.vx) === -f.facing;
      }
      const holdLeft = keys.has("KeyA") || keys.has("ArrowLeft");
      const holdRight = keys.has("KeyD") || keys.has("ArrowRight");
      const holdDown = keys.has("KeyS") || keys.has("ArrowDown");
      if (opponent.x >= f.x && holdLeft) return true;
      if (opponent.x < f.x && holdRight) return true;
      if (holdDown && f.state === "crouch") return true;
      return false;
    }

    function applyHit(
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
        storySfx.play("block");
        spawnParticles(defender.x + defender.facing * 18, defender.y - 52, "#00e5ff", 10, 4);
        addFloatingText(defender.x, defender.y - 95, "GUARD!", "#00e5ff", 18);
        callbacksRef.current.onSyncHpMp?.(g.p1.hp, g.p1.mp, g.p2.hp);
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

      spawnParticles(
        defender.x,
        defender.y - 52,
        isHeavy ? "#ffd60a" : "#ff4d6d",
        isHeavy ? 18 : 11,
        isHeavy ? 6.5 : 4.5
      );
      addFloatingText(
        defender.x + (Math.random() * 20 - 10),
        defender.y - 90,
        `-${finalDamage}`,
        isHeavy ? "#ffd60a" : "#ff4d6d",
        26
      );

      if (defender === g.p1 && defender.hp <= 0 && (stateRef.current?.inv?.totem || 0) > 0) {
        const reviveHp = Math.max(1, Math.round(defender.hpMax * 0.6));
        defender.hp = reviveHp;
        defender.invincibleTimer = 60;
        g.superFlash = 20;
        storySfx.play("super");
        spawnParticles(defender.x, defender.y - 50, "#a78bfa", 30, 7);
        addFloatingText(defender.x, defender.y - 115, "★ 不死圖騰發動！復活 60% HP ★", "#a78bfa", 45);
        callbacksRef.current.onUseTotem?.(reviveHp);
        return;
      }

      callbacksRef.current.onSyncHpMp?.(g.p1.hp, g.p1.mp, g.p2.hp);

      if (defender.hp <= 0) {
        triggerKO(attacker, defender);
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

    function checkMeleeHit(attacker: any, defender: any) {
      if (attacker.state !== "attack" || attacker.hasHitCurrentAttack) return;
      if (attacker.attackType === "skill1" || attacker.attackType === "ult") return;

      const elapsed = attacker.attackDuration - attacker.stateTimer;
      if (elapsed < 4 || elapsed > attacker.attackDuration - 5) return;

      const reach =
        attacker.attackType === "light"
          ? 76
          : attacker.attackType === "sweep"
          ? 88
          : attacker.attackType === "skill2"
          ? 84
          : attacker.attackType === "skill3"
          ? 94
          : 86;

      const dx = (defender.x - attacker.x) * attacker.facing;
      const dy = Math.abs(defender.y - attacker.y);

      if (dx >= -18 && dx <= reach && dy <= 85) {
        attacker.hasHitCurrentAttack = true;
        if (attacker.attackType === "light") {
          applyHit(attacker, defender, 16, 4.2, 0, false, false);
        } else if (attacker.attackType === "heavy") {
          applyHit(attacker, defender, 28, 8.0, 0, false, true);
        } else if (attacker.attackType === "sweep") {
          applyHit(attacker, defender, 24, 5.8, -5.5, true, true);
        } else if (attacker.attackType === "skill2") {
          applyHit(attacker, defender, 38, 7.2, -10.8, false, true);
        } else if (attacker.attackType === "skill3") {
          applyHit(attacker, defender, 34, 9.2, -7.0, false, true);
        }
      }
    }

    function triggerKO(winner: any, loser: any) {
      loser.hp = 0;
      loser.state = "ko";
      loser.vx = -loser.facing * 8.5;
      loser.vy = -9.5;
      g.hitStop = 14;
      g.screenShake = 16;
      g.phase = "ko";
      g.phaseTimer = 95;
      storySfx.play("ko");
      spawnParticles(loser.x, loser.y - 45, "#ff4d6d", 34, 8);
      spawnParticles(loser.x, loser.y - 45, "#ffd60a", 24, 6);

      if (winner === g.p1) {
        g.bannerText = "YOU WIN !!";
        g.subBannerText = `成功擊敗 ${g.p2.cfg.name}！`;
      } else {
        g.bannerText = "DEFEATED...";
        g.subBannerText = "回村莊整備購買技能書或強化裝備後再戰！";
      }
    }

    function updateGame() {
      g.frameCounter++;
      if (g.assistCooldown > 0) g.assistCooldown--;

      // Keep weaponTier updated if player bought weapons
      const curInv = stateRef.current?.inv || {};
      g.p1.weaponTier =
        curInv.terminus > 0 ? 3 : curInv.weapon_adv > 0 ? 2 : curInv.weapon_basic > 0 ? 1 : 0;

      if (g.superFlash > 0) g.superFlash--;
      if (g.screenShake > 0) g.screenShake = Math.max(0, g.screenShake - 0.8);

      g.particles.forEach((p: any) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.18;
        p.life--;
      });
      g.particles = g.particles.filter((p: any) => p.life > 0);

      g.floatingTexts.forEach((ft: any) => {
        ft.y -= 1.0;
        ft.life--;
      });
      g.floatingTexts = g.floatingTexts.filter((ft: any) => ft.life > 0);

      if (g.hitStop > 0) {
        g.hitStop--;
        return;
      }

      if (g.phase === "intro") {
        g.phaseTimer--;
        if (g.phaseTimer === 24) {
          g.bannerText = "FIGHT !!";
          g.subBannerText = "鍵盤操作角色擊敗故事強敵！按 [E] 可呼叫隊友支援！";
          storySfx.play("super");
        }
        if (g.phaseTimer <= 0) {
          g.phase = "fight";
        }
        return;
      }

      if (g.phase === "ko") {
        if (g.frameCounter % 2 === 0) {
          updateFighterControl(g.p1, g.p2, false, false, false, false);
          updateFighterControl(g.p2, g.p1, false, false, false, false);
        }
        g.phaseTimer--;
        if (g.phaseTimer <= 0 && g.phase !== "done") {
          g.phase = "done";
          const win = g.p1.hp > 0 && g.p2.hp <= 0;
          callbacksRef.current.onBattleEnd?.(win, Math.max(1, g.p1.hp), g.p1.mp);
        }
        return;
      }

      if (g.phase === "done") return;

      // Slowed round timer: 1 tick per 75 logic steps (~1.6 real seconds)
      if (g.frameCounter % 75 === 0 && g.timer > 0) {
        g.timer--;
        if (g.timer === 0) {
          const p1Ratio = g.p1.hp / g.p1.hpMax;
          const p2Ratio = g.p2.hp / g.p2.hpMax;
          if (p1Ratio >= p2Ratio) triggerKO(g.p1, g.p2);
          else triggerKO(g.p2, g.p1);
          g.bannerText = "TIME OVER";
          return;
        }
      }

      // Passive MP regen
      if (g.frameCounter % 45 === 0 && g.p1.mp < g.p1.mpMax) {
        g.p1.mp = Math.min(g.p1.mpMax, g.p1.mp + 2);
      }

      // Update Active Party Assist
      if (g.activeAssist) {
        const as = g.activeAssist;
        as.timer--;
        if (as.y < FLOOR_Y) {
          as.y = Math.min(FLOOR_Y, as.y + 14);
        }
        if (!as.hasFired && as.timer <= 26) {
          as.hasFired = true;
          if (as.klass === "priest") {
            const healAmt = 35;
            g.p1.hp = Math.min(g.p1.hpMax, g.p1.hp + healAmt);
            storySfx.play("heal");
            addFloatingText(g.p1.x, g.p1.y - 115, `✚ ${as.name} 聖光祈禱 +${healAmt} HP!`, "#ffd60a", 36);
            spawnParticles(g.p1.x, g.p1.y - 45, "#ffd60a", 18, 5);
          }
          const projColor = as.klass === "mage" ? "#a78bfa" : as.klass === "priest" ? "#ffd60a" : "#ff4d6d";
          g.projectiles.push({
            owner: "p1",
            x: as.x + as.facing * 44,
            y: as.y - 52,
            vx: as.facing * 9.2,
            radius: 22,
            damage: Math.round(30 * g.p1.cfg.atkMul),
            color: projColor,
            coreColor: "#ffffff",
            isSuper: false,
            hitsLeft: 1,
          });
          storySfx.play("hadouken");
        }
        if (as.timer <= 0) {
          spawnParticles(as.x, as.y - 45, "#00e5ff", 10, 4);
          g.activeAssist = null;
        }
      }

      // Update Boss Ground Hazards
      for (const hz of g.hazards) {
        if (hz.warnTimer > 0) {
          hz.warnTimer--;
          if (hz.warnTimer === 0) {
            storySfx.play("hazard");
            g.screenShake = 6;
            spawnParticles(hz.x, FLOOR_Y - 20, hz.color, 18, 6);
          }
        } else if (hz.activeTimer > 0) {
          hz.activeTimer--;
          if (
            !hz.hasHit &&
            Math.abs(g.p1.x - hz.x) < hz.width * 0.65 &&
            (hz.type !== "ice_spike" || g.p1.y > FLOOR_Y - 55)
          ) {
            hz.hasHit = true;
            applyHit(g.p2, g.p1, hz.damage, 5.0, -7.5, false, true);
          }
        }
      }
      g.hazards = g.hazards.filter((hz: any) => hz.warnTimer > 0 || hz.activeTimer > 0);

      updateFighterControl(
        g.p1,
        g.p2,
        keys.has("KeyA") || keys.has("ArrowLeft"),
        keys.has("KeyD") || keys.has("ArrowRight"),
        keys.has("KeyW") || keys.has("ArrowUp"),
        keys.has("KeyS") || keys.has("ArrowDown")
      );

      updateEnemyAI();

      // Push-box collision
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

      checkMeleeHit(g.p1, g.p2);
      checkMeleeHit(g.p2, g.p1);

      for (const proj of g.projectiles) {
        proj.x += proj.vx;
        if (g.frameCounter % 2 === 0) {
          spawnParticles(proj.x, proj.y, proj.color, 1, 1.5);
        }

        const target = proj.owner === "p1" ? g.p2 : g.p1;
        const attacker = proj.owner === "p1" ? g.p1 : g.p2;

        if (
          proj.hitsLeft > 0 &&
          Math.abs(proj.x - target.x) < proj.radius + 24 &&
          Math.abs(proj.y - (target.y - 48)) < proj.radius + 42
        ) {
          proj.hitsLeft--;
          applyHit(
            attacker,
            target,
            proj.damage,
            proj.isSuper ? 8.5 : 6.0,
            proj.isSuper ? -7.0 : 0,
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
            spawnParticles((p1Proj.x + p2Proj.x) / 2, p1Proj.y, "#ffd60a", 14, 5);
            storySfx.play("block");
          }
        }
      }

      g.projectiles = g.projectiles.filter((p: any) => p.hitsLeft > 0 && p.x > -60 && p.x < 960);
    }

    function renderGame(ctx: CanvasRenderingContext2D) {
      const W = 900;
      const H = 430;
      ctx.save();

      if (g.screenShake > 0) {
        const dx = (Math.random() - 0.5) * g.screenShake * 2;
        const dy = (Math.random() - 0.5) * g.screenShake * 2;
        ctx.translate(dx, dy);
      }

      // Stage Background
      const isOverclock = g.p2.phase2Triggered;
      const bgGrad = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
      bgGrad.addColorStop(
        0,
        g.superFlash > 0 ? "#3b0764" : isOverclock ? "#2d0612" : profile.bgTop || "#071318"
      );
      bgGrad.addColorStop(1, g.superFlash > 0 ? "#581c87" : isOverclock ? "#14040a" : "#0a1f17");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, FLOOR_Y);

      // Cyber Grid
      ctx.strokeStyle = isOverclock ? "rgba(255, 77, 109, 0.18)" : "rgba(0, 255, 136, 0.12)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 45) {
        ctx.beginPath();
        ctx.moveTo(x, 70);
        ctx.lineTo(x, FLOOR_Y);
        ctx.stroke();
      }
      for (let y = 100; y < FLOOR_Y; y += 45) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // Administrator Matrix Rain / Overclock Code
      if (enemyKey === "admin") {
        ctx.fillStyle = isOverclock ? "rgba(255, 77, 109, 0.25)" : "rgba(0, 255, 136, 0.18)";
        ctx.font = "11px monospace";
        for (let i = 0; i < 14; i++) {
          const rx = (i * 68 + g.frameCounter * 2) % W;
          const ry = 95 + ((i * 53 + g.frameCounter * 3) % (FLOOR_Y - 110));
          ctx.fillText(isOverclock ? "KERNEL_PANIC // rm -rf" : "01001101 AIclub.exe", rx, ry);
        }
      }

      // Floor
      const floorGrad = ctx.createLinearGradient(0, FLOOR_Y, 0, H);
      floorGrad.addColorStop(0, profile.bgFloor || "#0f3a26");
      floorGrad.addColorStop(1, "#040b08");
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);

      ctx.strokeStyle = isOverclock ? "#ff4d6d" : "#00ff88";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, FLOOR_Y);
      ctx.lineTo(W, FLOOR_Y);
      ctx.stroke();

      // Render Boss Ground Hazards
      for (const hz of g.hazards) {
        ctx.save();
        if (hz.warnTimer > 0) {
          const pulse = 0.35 + Math.sin(g.frameCounter * 0.4) * 0.25;
          ctx.fillStyle = hz.color;
          ctx.globalAlpha = pulse;
          ctx.fillRect(hz.x - hz.width / 2, FLOOR_Y - 8, hz.width, 8);
          ctx.strokeStyle = hz.color;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(hz.x - hz.width / 2, 90, hz.width, FLOOR_Y - 90);
          ctx.globalAlpha = 0.9;
          ctx.font = "bold 11px monospace";
          ctx.textAlign = "center";
          ctx.fillText(hz.label, hz.x, FLOOR_Y - 16);
        } else if (hz.activeTimer > 0) {
          ctx.fillStyle = hz.color;
          ctx.shadowColor = hz.color;
          ctx.shadowBlur = 18;
          if (hz.type === "ice_spike") {
            ctx.beginPath();
            ctx.moveTo(hz.x - hz.width / 2, FLOOR_Y);
            ctx.lineTo(hz.x, FLOOR_Y - 135);
            ctx.lineTo(hz.x + hz.width / 2, FLOOR_Y);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.fillRect(hz.x - hz.width / 2, 70, hz.width, FLOOR_Y - 70);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(hz.x - hz.width * 0.2, 70, hz.width * 0.4, FLOOR_Y - 70);
          }
        }
        ctx.restore();
      }

      // Render Sideline AI Party Companions cheering & Active Assist
      if (g.activeAssist) {
        const as = g.activeAssist;
        const asColor = as.klass === "mage" ? "#a78bfa" : as.klass === "priest" ? "#ffd60a" : "#ff4d6d";
        drawCharacterSprite(
          ctx,
          {
            x: as.x,
            y: as.y,
            facing: as.facing,
            state: "attack",
            attackType: "skill1",
            energy: 100,
            weaponTier: 1,
            cfg: {
              color: asColor,
              secondary: "#00e5ff",
              belt: "#111827",
              headband: "#ffffff",
              visualType: as.klass,
            },
          },
          g.frameCounter
        );
      }

      // Fighters
      drawCharacterSprite(ctx, g.p1, g.frameCounter);
      drawCharacterSprite(ctx, g.p2, g.frameCounter);

      // Projectiles
      for (const proj of g.projectiles) {
        ctx.save();
        ctx.shadowColor = proj.color;
        ctx.shadowBlur = proj.isSuper ? 26 : 16;
        ctx.fillStyle = proj.color;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = proj.coreColor || "#ffffff";
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Particles
      for (const p of g.particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.restore();
      }

      // Floating texts
      for (const ft of g.floatingTexts) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
        ctx.font = "bold 15px monospace";
        ctx.fillStyle = ft.color;
        ctx.shadowColor = ft.color;
        ctx.shadowBlur = 10;
        ctx.textAlign = "center";
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }

      drawHUD(ctx, W, H);
      ctx.restore();
    }

    function drawHUD(ctx: CanvasRenderingContext2D, W: number, H: number) {
      const barW = 340;
      const barH = 20;
      const p1X = 36;
      const p2X = W - 36 - barW;
      const topY = 18;

      // Timer Box
      ctx.fillStyle = "#071318";
      ctx.strokeStyle = "#ffd60a";
      ctx.lineWidth = 2;
      ctx.fillRect(W / 2 - 32, topY - 4, 64, 40);
      ctx.strokeRect(W / 2 - 32, topY - 4, 64, 40);

      ctx.fillStyle = g.timer <= 15 ? "#ff4d6d" : "#ffd60a";
      ctx.font = "bold 24px monospace";
      ctx.textAlign = "center";
      ctx.fillText(String(g.timer).padStart(2, "0"), W / 2, topY + 24);

      // P1 HP Bar
      ctx.fillStyle = "#1a0f14";
      ctx.fillRect(p1X, topY, barW, barH);
      const p1TrailW = Math.max(0, (g.p1.trailHp / g.p1.hpMax) * barW);
      const p1HpW = Math.max(0, (g.p1.hp / g.p1.hpMax) * barW);
      ctx.fillStyle = "#ff4d6d";
      ctx.fillRect(p1X + (barW - p1TrailW), topY, p1TrailW, barH);
      ctx.fillStyle = g.p1.hp / g.p1.hpMax < 0.28 ? "#ffd60a" : "#00ff88";
      ctx.fillRect(p1X + (barW - p1HpW), topY, p1HpW, barH);
      ctx.strokeStyle = "#00ff88";
      ctx.strokeRect(p1X, topY, barW, barH);

      // P1 MP Bar
      const mpBarW = 220;
      ctx.fillStyle = "#071318";
      ctx.fillRect(p1X, topY + barH + 4, mpBarW, 7);
      ctx.fillStyle = "#00e5ff";
      ctx.fillRect(p1X, topY + barH + 4, Math.max(0, (g.p1.mp / g.p1.mpMax) * mpBarW), 7);

      // P2 HP Bar
      ctx.fillStyle = "#1a0f14";
      ctx.fillRect(p2X, topY, barW, barH);
      const p2TrailW = Math.max(0, (g.p2.trailHp / g.p2.hpMax) * barW);
      const p2HpW = Math.max(0, (g.p2.hp / g.p2.hpMax) * barW);
      ctx.fillStyle = "#ff4d6d";
      ctx.fillRect(p2X, topY, p2TrailW, barH);
      ctx.fillStyle = g.p2.hp / g.p2.hpMax < 0.28 ? "#ffd60a" : "#ff4d6d";
      ctx.fillRect(p2X, topY, p2HpW, barH);
      ctx.strokeStyle = "#ff4d6d";
      ctx.strokeRect(p2X, topY, barW, barH);

      ctx.font = "bold 12px monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = "#00ff88";
      ctx.fillText(
        `${g.p1.cfg.name}  HP:${g.p1.hp}/${g.p1.hpMax}  MP:${g.p1.mp}/${g.p1.mpMax}`,
        p1X,
        topY + barH + 24
      );

      ctx.textAlign = "right";
      ctx.fillStyle = "#ff4d6d";
      ctx.fillText(`${g.p2.cfg.name}  HP:${g.p2.hp}/${g.p2.hpMax}`, p2X + barW, topY + barH + 18);

      // Combos
      if (g.p1.comboCount >= 2) {
        ctx.textAlign = "left";
        ctx.font = "bold 22px monospace";
        ctx.fillStyle = "#ffd60a";
        ctx.fillText(`${g.p1.comboCount} HIT COMBO!`, p1X, 108);
      }

      // Bottom Super Meter & Assist Cooldown
      const meterW = 240;
      const meterH = 10;
      const meterY = H - 18;

      ctx.fillStyle = "#091410";
      ctx.fillRect(p1X, meterY, meterW, meterH);
      ctx.fillStyle = g.p1.energy >= 100 ? "#ffd60a" : "#00e5ff";
      ctx.fillRect(p1X, meterY, (g.p1.energy / 100) * meterW, meterH);
      ctx.strokeStyle = "#00e5ff";
      ctx.strokeRect(p1X, meterY, meterW, meterH);
      ctx.textAlign = "left";
      ctx.font = "bold 11px monospace";
      ctx.fillStyle = g.p1.energy >= 100 ? "#ffd60a" : "#7be0a8";
      ctx.fillText(
        g.p1.energy >= 100
          ? "⚡ SUPER MAX! 按 [Q/I] 施放終極奧義！"
          : `SUPER 氣條 ${Math.floor(g.p1.energy)}%`,
        p1X,
        meterY - 4
      );

      // Party Assist Badge
      ctx.textAlign = "right";
      const assistReady = g.assistCooldown <= 0;
      ctx.fillStyle = assistReady ? "#00ff88" : "#3a8c5e";
      ctx.fillText(
        assistReady
          ? "🤝 隊友支援 READY! 按 [E] 召喚三人組連攜攻擊"
          : `⏳ 隊友支援冷卻 (${Math.ceil((g.assistCooldown * 21) / 1000)}s)`,
        W - 36,
        meterY + 6
      );

      // Center Banner
      if (g.phase !== "fight") {
        ctx.fillStyle = "rgba(3, 10, 8, 0.78)";
        ctx.fillRect(0, H / 2 - 55, W, 105);
        ctx.strokeStyle = "#ffd60a";
        ctx.lineWidth = 2;
        ctx.strokeRect(0, H / 2 - 55, W, 105);

        ctx.textAlign = "center";
        ctx.font = "bold 36px monospace";
        ctx.fillStyle = "#ffd60a";
        ctx.fillText(g.bannerText, W / 2, H / 2 - 4);

        if (g.subBannerText) {
          ctx.font = "bold 14px monospace";
          ctx.fillStyle = "#00ff88";
          ctx.fillText(g.subBannerText, W / 2, H / 2 + 28);
        }
      }
    }

    let animId = 0;
    let lastTime = performance.now();
    let accumulator = 0;
    const STEP_MS = 21;

    function step(now: number) {
      const dt = Math.min(80, Math.max(0, now - lastTime));
      lastTime = now;
      accumulator += dt;

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          let substeps = 0;
          while (accumulator >= STEP_MS && substeps < 3) {
            updateGame();
            accumulator -= STEP_MS;
            substeps++;
          }
          renderGame(ctx);
        }
      }
      animId = requestAnimationFrame(step);
    }

    animId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [enemyKey]);

  const skill1 = classCfg.normal?.[0] || { name: "技能1", mp: 15 };
  const skill2 = classCfg.normal?.[1] || { name: "技能2", mp: 18 };
  const skill3 = classCfg.normal?.[2] || { name: "技能3", mp: 20 };
  const ultSkill = classCfg.ultimate || { name: "終極奧義", mp: 40 };

  return (
    <div className="border-b border-[#0f3a26] bg-[#040c09] p-2.5 flex flex-col items-center gap-2">
      <div className="w-full flex flex-wrap items-center justify-between gap-2 text-xs px-1">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-[#ff4d6d]/20 border border-[#ff4d6d] text-[#ff4d6d] font-bold">
            🥊 STORY BATTLE ARENA
          </span>
          <span className="text-[#ffd60a] font-bold">
            VS {STORY_ENEMY_PROFILES[enemyKey]?.name || enemyCfg.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              storySfx.muted = !muted;
              setMuted(!muted);
            }}
            className="px-2 py-0.5 border border-[#0f3a26] text-[#7be0a8] hover:border-[#00ff88] text-[11px]"
          >
            {muted ? "🔇 音效關" : "🔊 音效開"}
          </button>
          {onOpenShopModal && (
            <button
              type="button"
              onClick={onOpenShopModal}
              className="px-2 py-0.5 border border-[#ffd60a] text-[#ffd60a] hover:bg-[#ffd60a]/10 text-[11px]"
            >
              🛒 快速開啟黑市
            </button>
          )}
          {!enemyCfg?.isFinal && (
            <button
              type="button"
              onClick={onFlee}
              className="px-2 py-0.5 border border-[#3a0f1c] text-[#ff4d6d] hover:border-[#ff4d6d] text-[11px]"
            >
              🏃 撤退回村莊
            </button>
          )}
        </div>
      </div>

      <div className="relative w-full max-w-[900px]">
        <canvas
          ref={canvasRef}
          width={900}
          height={430}
          className="w-full aspect-[900/430] border border-[#0f3a26] bg-[#050c09] rounded shadow-lg"
        />
        {typingInInput && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              (document.activeElement as HTMLElement)?.blur?.();
            }}
            className="absolute inset-0 flex items-center justify-center bg-black/45 rounded text-[#ffd60a] crpg-glow-yellow text-sm font-bold tracking-wide"
          >
            ⌨ 鍵盤目前在指令輸入框 — 點擊戰場或按 Esc 回到角色操控
          </button>
        )}
      </div>

      {/* Interactive Skill & Keyboard Hotkey Bar */}
      <div className="w-full max-w-[900px] grid grid-cols-2 md:grid-cols-5 gap-1.5 text-[11px]">
        <div className="border border-[#0f3a26] bg-[#071510] px-2.5 py-1.5">
          <div className="text-[#00ff88] font-bold">🕹️ 移動與普攻</div>
          <div className="text-[#cfeedd] mt-0.5">
            [W/A/S/D] 移動 · [F/J] 輕擊 · [G/K] 重擊
          </div>
        </div>

        <div className="border border-[#0f3a26] bg-[#071510] px-2.5 py-1.5">
          <div className="text-[#00e5ff] font-bold">⚡ 初始與卷一技能</div>
          <div className="text-[#cfeedd] mt-0.5">
            [R/L] {skill1.name} ·{" "}
            {state.learnedSkill2 ? (
              <span className="text-[#ffd60a]">[T/U] {skill2.name}</span>
            ) : (
              <span className="text-[#3a8c5e]">[T/U] 🔒卷一</span>
            )}
          </div>
        </div>

        <div className="border border-[#0f3a26] bg-[#071510] px-2.5 py-1.5">
          <div className="text-[#a78bfa] font-bold">🔥 卷二與終極奧義</div>
          <div className="text-[#cfeedd] mt-0.5">
            {state.learnedSkill3 ? (
              <span className="text-[#00e5ff]">[Y/O] {skill3.name}</span>
            ) : (
              <span className="text-[#3a8c5e]">[Y/O] 🔒卷二</span>
            )}{" "}
            ·{" "}
            {state.learnedUlt ? (
              <span className="text-[#ff4d6d] font-bold">[Q/I] ★{ultSkill.name}</span>
            ) : (
              <span className="text-[#3a8c5e]">[Q/I] 🔒奧義書</span>
            )}
          </div>
        </div>

        <div className="border border-[#0f3a26] bg-[#071510] px-2.5 py-1.5">
          <div className="text-[#00ff88] font-bold">🤝 三人組連攜支援</div>
          <div className="text-[#cfeedd] mt-0.5">
            按 <span className="text-[#ffd60a] font-bold">[E]</span> 召喚 AI 隊友進場放招支援！
          </div>
        </div>

        <div className="border border-[#0f3a26] bg-[#071510] px-2.5 py-1.5">
          <div className="text-[#ffd60a] font-bold">🧪 道具快捷鍵</div>
          <div className="text-[#cfeedd] mt-0.5">
            [H] 草藥({state.inv?.herb || 0}) · [B] 魔力水({state.inv?.mana || 0})
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────── SHARED DISTINCTIVE CHARACTER & BOSS SPRITE RENDERER ───────────── */

export function drawCharacterSprite(ctx: CanvasRenderingContext2D, f: any, frame: number) {
  ctx.save();
  ctx.translate(f.x, f.y);

  const vType = f.cfg?.visualType || f.klass || "warrior";
  const wTier = f.weaponTier || 0;

  // Ground shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.beginPath();
  ctx.ellipse(0, 4, vType === "duke" || vType === "admin" ? 34 : 28, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.scale(f.facing, 1);

  const isCrouch = f.state === "crouch" || f.attackType === "sweep";
  const isKO = f.state === "ko" || f.state === "knockdown";
  const scaleH = vType === "goblin" ? 0.82 : vType === "duke" || vType === "skyisle" ? 1.08 : 1.0;
  ctx.scale(scaleH, scaleH);

  const bodyHeight = isCrouch ? 58 : 88;
  const breath = f.state === "idle" ? Math.sin(frame * 0.14) * 3 : 0;
  const walkSwing = f.state === "walk" ? Math.sin(frame * 0.32) * 10 : 0;

  if (isKO) {
    ctx.translate(0, -16);
    ctx.rotate(-Math.PI / 2.2);
  }

  // Aura / Super Glow
  if (f.energy >= 100 || f.phase2Triggered) {
    ctx.shadowColor = f.phase2Triggered ? "#ff4d6d" : "#ffd60a";
    ctx.shadowBlur = 16 + Math.sin(frame * 0.25) * 6;
  } else {
    ctx.shadowColor = f.cfg.color;
    ctx.shadowBlur = f.state === "attack" ? 14 : 6;
  }

  // Back Accessories: Cape / Wings / Halo
  const shoulderY = -bodyHeight + 14 + breath;
  const headY = -bodyHeight - 14 + breath;

  if (vType === "warrior" || vType === "duke") {
    // Flowing Cape
    ctx.fillStyle = vType === "duke" ? "#881337" : "#991b1b";
    ctx.beginPath();
    ctx.moveTo(-12, shoulderY - 4);
    ctx.lineTo(-34 - Math.sin(frame * 0.2) * 6, -12 + Math.cos(frame * 0.2) * 4);
    ctx.lineTo(-16, -8);
    ctx.closePath();
    ctx.fill();
  }

  if (vType === "duke") {
    // Bat / Demon Wings
    ctx.fillStyle = "#4c0519";
    ctx.strokeStyle = "#e11d48";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, shoulderY);
    ctx.lineTo(-46, shoulderY - 38 + Math.sin(frame * 0.2) * 6);
    ctx.lineTo(-36, shoulderY - 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (vType === "skyisle") {
    // Golden Angelic Wings
    ctx.fillStyle = "#fef08a";
    ctx.strokeStyle = "#eab308";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, shoulderY);
    ctx.lineTo(-50, shoulderY - 42 + Math.sin(frame * 0.18) * 5);
    ctx.lineTo(-32, shoulderY - 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (vType === "priest") {
    // Sacred Golden Halo behind head
    ctx.save();
    ctx.strokeStyle = "#ffd60a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(-4, headY - 4, 19, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Legs
  ctx.strokeStyle = f.cfg.color;
  ctx.lineWidth = 10;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(-8, -32);
  ctx.lineTo(-14 - walkSwing * 0.6, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(8, -32);
  if (f.state === "attack" && f.attackType === "heavy") {
    ctx.lineTo(58, -56);
  } else if (f.state === "attack" && f.attackType === "sweep") {
    ctx.lineTo(62, -6);
  } else {
    ctx.lineTo(14 + walkSwing * 0.6, 0);
  }
  ctx.stroke();

  // Torso
  ctx.fillStyle = f.state === "hit" ? "#ffffff" : f.cfg.color;
  ctx.fillRect(-16, -bodyHeight + breath, 32, bodyHeight - 30);

  // Armor / Robe Trim
  ctx.fillStyle = f.cfg.belt || "#111827";
  ctx.fillRect(-17, -38 + breath, 34, 7);

  // Head
  ctx.fillStyle = f.state === "hit" ? "#ff4d6d" : vType === "goblin" ? "#4ade80" : "#f8fafc";
  ctx.beginPath();
  ctx.arc(0, headY, 13, 0, Math.PI * 2);
  ctx.fill();

  // Class / Boss Headgear
  if (vType === "mage") {
    // Wizard Pointed Hat
    ctx.fillStyle = "#4c1d95";
    ctx.strokeStyle = "#a78bfa";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-18, headY - 6);
    ctx.lineTo(18, headY - 6);
    ctx.lineTo(-4, headY - 34);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (vType === "warrior") {
    // Knight Crest Helmet
    ctx.fillStyle = "#ffd60a";
    ctx.beginPath();
    ctx.moveTo(-6, headY - 12);
    ctx.lineTo(6, headY - 24);
    ctx.lineTo(12, headY - 10);
    ctx.closePath();
    ctx.fill();
  } else if (vType === "duke" || vType === "demonlord") {
    // Demon Horns
    ctx.strokeStyle = "#fde047";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-6, headY - 10);
    ctx.lineTo(-14, headY - 25);
    ctx.moveTo(6, headY - 10);
    ctx.lineTo(14, headY - 25);
    ctx.stroke();
  } else if (vType === "goblin") {
    // Pointy Goblin Ears
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.moveTo(-10, headY - 2);
    ctx.lineTo(-24, headY - 10);
    ctx.lineTo(-10, headY + 4);
    ctx.fill();
  } else {
    // Headband
    ctx.fillStyle = f.cfg.headband || "#ff4d6d";
    ctx.fillRect(-13, headY - 7, 26, 5);
    ctx.beginPath();
    ctx.moveTo(-13, headY - 5);
    ctx.lineTo(-28 - Math.sin(frame * 0.22) * 5, headY - 2 + Math.cos(frame * 0.22) * 4);
    ctx.lineTo(-25, headY + 4);
    ctx.closePath();
    ctx.fill();
  }

  // Eyes / Visor
  ctx.fillStyle = vType === "admin" ? "#ff4d6d" : f.cfg.secondary || "#00e5ff";
  ctx.fillRect(2, headY - 3, vType === "admin" ? 11 : 8, 4);

  // Arms & Distinctive Weapons
  const weaponGlowColor =
    wTier >= 3 ? "#00ff88" : wTier === 2 ? "#ffd60a" : wTier === 1 ? "#00e5ff" : f.cfg.secondary || "#ffffff";

  ctx.strokeStyle = f.state === "hit" ? "#ffffff" : f.cfg.secondary || "#ffffff";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(4, shoulderY);

  const isAttacking = f.state === "attack";
  let handX = 24;
  let handY = shoulderY + 4 + breath;

  if (isAttacking && f.attackType === "light") {
    handX = 52;
    handY = shoulderY;
  } else if (isAttacking && f.attackType === "skill2") {
    handX = 28;
    handY = shoulderY - 50;
  } else if (isAttacking && f.attackType === "skill3") {
    handX = 60;
    handY = shoulderY - 4;
  } else if (isAttacking && (f.attackType === "skill1" || f.attackType === "ult")) {
    handX = 44;
    handY = shoulderY + 2;
  } else if (f.state === "block") {
    handX = 18;
    handY = shoulderY - 12;
  }

  ctx.lineTo(handX, handY);
  ctx.stroke();

  if (f.state === "block") {
    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 3;
    ctx.strokeRect(18, -bodyHeight, 8, bodyHeight - 15);
  } else {
    // Draw Class / Boss Weapon in Hand
    ctx.save();
    ctx.translate(handX, handY);
    ctx.shadowColor = weaponGlowColor;
    ctx.shadowBlur = wTier > 0 ? 14 : 6;

    if (vType === "warrior" || vType === "duke") {
      // Greatsword
      const angle = isAttacking ? 0.15 : -0.65;
      ctx.rotate(angle);
      ctx.fillStyle = wTier >= 2 ? "#ffd60a" : vType === "duke" ? "#e11d48" : "#e2e8f0";
      ctx.fillRect(0, -4, 38 + wTier * 4, 7);
      // Crossguard
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(-2, -11, 5, 22);
      if (isAttacking) {
        ctx.strokeStyle = weaponGlowColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(10, 0, 36, -0.9, 0.9);
        ctx.stroke();
      }
    } else if (vType === "mage") {
      // Arcane Staff + Glowing Orb
      ctx.strokeStyle = "#a78bfa";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-4, 18);
      ctx.lineTo(14, -26);
      ctx.stroke();
      ctx.fillStyle = weaponGlowColor;
      ctx.beginPath();
      ctx.arc(15, -28, 7 + wTier * 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (vType === "priest") {
      // Holy Scepter Cross & Orb
      ctx.strokeStyle = "#ffd60a";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-2, 14);
      ctx.lineTo(12, -22);
      ctx.stroke();
      ctx.fillStyle = "#00ff88";
      ctx.beginPath();
      ctx.arc(12, -24, 6 + wTier, 0, Math.PI * 2);
      ctx.fill();
    } else if (vType === "abyss" || vType === "skyisle") {
      // Boss Trident / Thunder Spear
      ctx.strokeStyle = f.cfg.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-10, 10);
      ctx.lineTo(36, -18);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
}
