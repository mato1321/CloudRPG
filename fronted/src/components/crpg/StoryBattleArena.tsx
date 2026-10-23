// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import * as FX from "./battleFx";
import { weaponLoadout } from "../../lib/shop";
import { audio, battleTheme } from "../../lib/audio";
import { useAudioSettings } from "../../lib/useAudio";
import { TouchControls, STORY_BUTTONS } from "./TouchControls";

/* ───────────── 音效：轉給共用音訊引擎（lib/audio.ts） ───────────── */

const STORY_SFX: Record<string, string> = {
  hadouken: "proj", shoryuken: "rising", super: "ult", talk: "talk", hazard: "hazard",
};

class StoryArcadeAudio {
  klass = "warrior";
  play(type: string) {
    if (type === "proj_player") return audio.sfx(`proj_${this.klass}`);
    audio.sfx(STORY_SFX[type] || type);
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

const MOD_LABEL: Record<string, string> = {
  berserk: "狂暴", glass: "玻璃大砲", blackwater: "全場黑水", thunder: "雷暴",
  clone: "分身", regen: "再生", fog: "迷霧", giant: "巨大化",
};

// PvP：對手是其他玩家的 AI 分身，用職業決定招式名稱
const PVP_MOVES: Record<string, any> = {
  warrior: { specialName: "裂地斬", upperName: "狂戰衝擊", dashName: "鋼鐵粉碎", superName: "滅世斷界斬" },
  mage: { specialName: "雷霆脈衝", upperName: "虛空火球", dashName: "極光崩解", superName: "禁忌・星界崩壞" },
  priest: { specialName: "聖光制裁", upperName: "靈魂祈禱", dashName: "神聖脈動", superName: "終焉聖域" },
};

// 每個故事敵人對應的戰鬥場景
const STAGE_OF: Record<string, string> = {
  minions: "village",
  goblin: "cave",
  duke: "mansion",
  abyss: "abyss",
  skyisle: "skyisle",
  demonlord: "demon",
  admin: "core",
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
  paused = false,
  mode = "story", // story | tower | daily | raid | pvp
  enemyOverride = null, // 伺服器 /api/battle/start 回傳的敵人設定（血量倍率、詞綴、團隊 Boss…）
  playerBoost = null, // { atkMul, buffPct, energyStart }
  tutorial = false, // 第一場戰鬥的互動教學
}: any) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { muted } = useAudioSettings();

  // 戰鬥背景音樂：依場地 / 模式選曲；離開戰鬥時換回原本的音樂
  useEffect(() => {
    storySfx.klass = state.klass;
    const prev = audio.theme;
    audio.playTheme(battleTheme(enemyOverride?.pvp ? "dojo" : STAGE_OF[enemyKey] || "dojo", mode));
    return () => audio.playTheme(prev);
  }, [enemyKey, mode]);
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
  // 開啟黑市時暫停戰鬥
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const ov = enemyOverride || null;
    const pProfile = PLAYER_CLASS_PROFILES[state.klass] || PLAYER_CLASS_PROFILES.warrior;
    const mods = new Set<string>(ov?.modifiers || []);
    const raid = ov?.raid || null;
    let profile: any;
    if (ov?.pvp) {
      const oc = PLAYER_CLASS_PROFILES[ov.pvp.klass] || PLAYER_CLASS_PROFILES.warrior;
      profile = {
        ...oc,
        ...PVP_MOVES[ov.pvp.klass],
        name: ov.pvp.name,
        title: `PVP · Lv.${ov.pvp.level} · Rating ${ov.pvp.rating}`,
        visualType: ov.pvp.klass,
        hp: ov.hp,
        atkMul: Math.min(2.2, (ov.atkScale || 1) * 0.85),
        aggr: 0.55,
        block: 0.35,
      };
    } else {
      const base = STORY_ENEMY_PROFILES[enemyKey] || STORY_ENEMY_PROFILES.minions;
      profile = { ...base };
      if (ov) {
        profile.name = ov.name || base.name;
        profile.hp = ov.hp || base.hp;
        profile.atkMul = Number((base.atkMul * (ov.atkScale || 1)).toFixed(2));
        profile.speed = base.speed * (ov.speedScale || 1);
        if (ov.title) profile.title = ov.title;
        if (mods.has("giant")) profile.scaleBoost = 1.22;
      }
    }
    const gearStats = state.gearStats || {};
    const buffPct = playerBoost?.buffPct || 0;

    const skill1 = classCfg.normal?.[0] || { name: "裂地斬", mp: 15, mul: 1.6 };
    const skill2 = classCfg.normal?.[1] || { name: "狂戰衝擊", mp: 18, mul: 1.8 };
    const skill3 = classCfg.normal?.[2] || { name: "鋼鐵粉碎", mp: 20, mul: 2.0 };
    const ultSkill = classCfg.ultimate || { name: "滅世斷界斬", mp: 40, mul: 4.5 };

    // 玩家攻擊倍率（黑市買武器 / 升級後在戰鬥中即時重算）與武器外觀等級
    const calcAtkMul = (s: any) =>
      Number(Math.max(0.88, Math.min(2.6, 0.85 + (s.atk || 20) * 0.008 + (s.level || 1) * 0.03)).toFixed(2));
    const playerAtkMul = Number((calcAtkMul(state) * (1 + buffPct / 100)).toFixed(2));
    const enemyMaxHp = profile.hp;
    const loadout = weaponLoadout(state.inv);

    const g: any = {
      frameCounter: 0,
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
      hazards: [], // Boss 場地機關（冰刺、黑水、落雷、格式化光束、全畫面雷射、數據方塊）
      fx: [], // 招式特效（劍氣、魔法陣、聖光柱、殘影…）
      hitFlash: 0,
      cutIn: null,
      overclockTimer: 0,
      stageKey: ov?.pvp ? "dojo" : STAGE_OF[enemyKey] || "dojo",
      mode,
      mods,
      raid,
      timer: ov?.timeLimit || 99,
      // 戰鬥統計：結算時回報伺服器（傷害、連擊、用掉的道具）
      stats: { start: performance.now(), damage: 0, maxCombo: 0, items: { herb: 0, mana: 0, totem: 0 } },
      lastP1Attack: null,
      tutorial: tutorial
        ? {
            step: 0,
            startX: 200,
            flash: 0,
            steps: [
              { text: "按住 [D] 往前走 →", done: () => g.p1.x > g.tutorial.startX + 80 },
              { text: "按 [F] 輕攻擊", done: () => g.lastP1Attack === "light" },
              { text: "按 [G] 重攻擊", done: () => g.lastP1Attack === "heavy" },
              { text: "按 [R] 放出技能 1（遠程）", done: () => g.lastP1Attack === "skill1" },
              { text: "按 [W] 跳躍（可以閃避攻擊）", done: () => g.p1.y < FLOOR_Y - 40 },
            ],
          }
        : null,
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
        energy: Math.min(100, 40 + (playerBoost?.energyStart || 0)),
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
        rarityGlow: state.rarityGlow || null,
        weaponTier: loadout.tier,
        weaponPlus: loadout.plus,
        slowTimer: 0,
        cfg: {
          name: `${state.name} (${classCfg.name})`,
          color: pProfile.color,
          secondary: pProfile.secondary,
          belt: pProfile.belt,
          headband: pProfile.headband,
          speed: pProfile.speed * (1 + (gearStats.speed || 0) / 100),
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
        weaponTier: ov?.pvp ? ov.pvp.weaponTier : 2,
        weaponPlus: ov?.pvp ? ov.pvp.weaponPlus : 0,
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
      if (pausedRef.current) return;
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
        addFloatingText(g.p1.x, g.p1.y - 108, `隊友支援冷卻中 (${secLeft}s)`, "#3a8c5e", 24);
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
      addFloatingText(startX, FLOOR_Y - 135, `${ally.name} 參戰支援！`, "#00e5ff", 40);
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
      g.stats.items.herb++;
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
      g.stats.items.mana++;
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
        addFloatingText(attacker.x, attacker.y - 105, "需於黑市購買「進階技能書・卷一」", "#ffd60a", 38);
        storySfx.play("block");
        return;
      }
      if (kind === "skill3" && !curState.learnedSkill3) {
        addFloatingText(attacker.x, attacker.y - 105, "需於黑市購買「進階技能書・卷二」", "#ffd60a", 38);
        storySfx.play("block");
        return;
      }
      if (kind === "ult" && !curState.learnedUlt) {
        addFloatingText(attacker.x, attacker.y - 105, "需於黑市購買「終極奧義技能書」", "#ff4d6d", 38);
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
        addFloatingText(attacker.x, attacker.y - 115, ultSkill.name, "#ffd60a", 42);
      }

      attacker.state = "attack";
      attacker.attackType = kind;
      attacker.hasHitCurrentAttack = false;
      attacker.facing = defender.x >= attacker.x ? 1 : -1;
      g.lastP1Attack = kind;

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
        storySfx.play("proj_player");
        addFloatingText(attacker.x, attacker.y - 95, skill1.name, attacker.cfg.color, 28);
        g.projectiles.push({
          owner: "p1",
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
            style: FX.projStyleFor(attacker),
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
            style: FX.projStyleFor(attacker),
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

      FX.onAttackStart(g, attacker, kind, { name: ultSkill.name, side: "left" });
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
        addFloatingText(attacker.x, attacker.y - 115, attacker.cfg.superName, "#ff4d6d", 38);
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
          style: FX.projStyleFor(attacker),
          overclock: !!attacker.phase2Triggered,
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
            style: FX.projStyleFor(attacker),
            overclock: !!attacker.phase2Triggered,
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
      FX.onAttackStart(g, attacker, kind, { name: attacker.cfg.superName, side: "right" });
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
      // 黑水陷阱：減速
      const spd = f.cfg.speed * ((f.slowTimer || 0) > 0 ? 0.5 : 1);
      if (f.slowTimer > 0) f.slowTimer--;
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
        if (leftKey) f.vx = -spd * 0.85;
        else if (rightKey) f.vx = spd * 0.85;
        storySfx.play("jump");
        FX.emit(g, "smoke", f.x, FLOOR_Y - 4, 6, { color: "#9ca3af", speed: 1.8, angle: Math.PI, spread: Math.PI, life: 22, size: 4 });
        return;
      }

      if (downKey && f.y >= FLOOR_Y) {
        f.state = "crouch";
        f.vx = 0;
        return;
      }

      if (leftKey) {
        f.vx = -spd;
        if (f.y >= FLOOR_Y) f.state = "walk";
      } else if (rightKey) {
        f.vx = spd;
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
      if (g.tutorial && g.tutorial.step < g.tutorial.steps.length) {
        updateFighterControl(ai, target, false, false, false, false);
        return;
      }
      if (ai.aiCooldown > 0) ai.aiCooldown--;
      if (ai.hazardCooldown > 0) ai.hazardCooldown--;

      // Administrator：半血觸發「系統強制超頻 (Phase 2)」→ 背景紅色亂碼、全畫面雷射、數據方塊轟炸
      if (enemyKey === "admin" && !ai.phase2Triggered && ai.hp <= ai.hpMax * 0.5) {
        ai.phase2Triggered = true;
        g.superFlash = 25;
        g.screenShake = 16;
        g.hitStop = 18;
        g.hitFlash = 8;
        g.overclockTimer = 90;
        audio.sfx("overclock");
        addFloatingText(ai.x, ai.y - 125, "SYSTEM OVERCLOCK // 系統強制超頻！", "#ff4d6d", 60);
        FX.emit(g, "code", ai.x, ai.y - 60, 40, { color: "#ff4d6d", speed: 6, life: 40 });
        FX.addFx(g, { type: "ring", x: ai.x, y: ai.y - 60, r0: 10, r1: 320, color: "#ff4d6d", life: 34, lw: 10 });
        ai.cfg.speed = 5.2;
        ai.cfg.aggr = 0.88;
        ai.hazardCooldown = 70;
      }

      // Boss 場地機關：冥盡洞主（冰刺 / 黑水）、天光島嶼之主（落雷）、Administrator（光束 / 雷射 / 數據方塊）
      const half = ai.hp <= ai.hpMax * 0.5;
      if (ai.cfg.hazardType && ai.hazardCooldown === 0 && g.phase === "fight") {
        ai.hazardCycle = (ai.hazardCycle || 0) + 1;
        audio.sfx("warn");
        const cx = (x: number) => Math.max(70, Math.min(830, x));
        const tx = cx(target.x);
        if (enemyKey === "abyss") {
          ai.hazardCooldown = half ? 150 : 200;
          if (ai.hazardCycle % 2 === 1) {
            const xs = half ? [tx, tx - 120, tx + 120] : [tx];
            xs.forEach((x, i) =>
              g.hazards.push({ type: "ice_spike", x: cx(x), width: 60, warnTimer: 38 + i * 12, activeTimer: 24, activeMax: 24, damage: 24, hasHit: false, color: "#a5f3fc", label: "深淵冰刺" })
            );
          } else {
            const dur = half ? 260 : 200;
            g.hazards.push({ type: "black_water", x: tx, width: 110, warnTimer: 34, warnMax: 34, activeTimer: dur, activeMax: dur, damage: 6, hasHit: false, color: "#22d3ee", label: "黑水陷阱 · 減速" });
          }
        } else if (enemyKey === "skyisle") {
          ai.hazardCooldown = half ? 150 : 205;
          const xs = half ? [tx, tx - 150, tx + 150] : [tx];
          xs.forEach((x, i) =>
            g.hazards.push({ type: "sky_lightning", x: cx(x), width: 64, warnTimer: 42 + i * 14, warnMax: 42 + i * 14, activeTimer: 18, activeMax: 18, damage: 28, hasHit: false, seed: Math.random() * 100, color: "#fde047", label: "天罰落雷" })
          );
        } else if (enemyKey === "admin") {
          const beam = (x: number) => ({ type: "format_beam", x, width: 68, warnTimer: 35, activeTimer: 24, damage: 32, hasHit: false, color: "#ff4d6d", label: "rm -rf 格式化光束" });
          if (!ai.phase2Triggered) {
            ai.hazardCooldown = 210;
            g.hazards.push(beam(tx));
          } else {
            ai.hazardCooldown = 150;
            const m = ai.hazardCycle % 3;
            if (m === 0) {
              const high = Math.random() < 0.5;
              g.hazards.push({ type: "laser_sweep", y: high ? FLOOR_Y - 78 : FLOOR_Y - 22, thick: 18, high, warnTimer: 46, activeTimer: 16, damage: 30, hasHit: false, color: "#ff4d6d", label: high ? "▼ 蹲下閃避！全畫面雷射" : "▲ 跳起閃避！全畫面雷射" });
            } else if (m === 1) {
              for (let i = 0; i < 6; i++) {
                const x = i === 0 ? tx : cx(80 + Math.random() * 740);
                g.hazards.push({ type: "data_block", x, y: -20, vy: 0, size: 34, warnTimer: 26 + i * 9, activeTimer: 90, damage: 22, hasHit: false, color: "#ff4d6d" });
              }
            } else {
              g.hazards.push(beam(tx), beam(cx(tx + (Math.random() > 0.5 ? 160 : -160))));
            }
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
      // 哥布林：矮小敏捷，常常跳來跳去
      if (enemyKey === "goblin" && ai.y >= FLOOR_Y && ai.state !== "attack" && Math.random() < 0.012) {
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
      isHeavy: boolean,
      unblockable = false
    ) {
      if (defender.invincibleTimer > 0 || defender.state === "ko" || defender.state === "knockdown") {
        return;
      }

      const holdingBack = isHoldingBack(defender, attacker);
      const canBlock =
        !unblockable &&
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
        FX.onHit(g, attacker, defender, { blocked: true });
        addFloatingText(defender.x, defender.y - 95, "GUARD!", "#00e5ff", 18);
        callbacksRef.current.onSyncHpMp?.(g.p1.hp, g.p1.mp, g.p2.hp);
        return;
      }

      const comboScale = Math.max(0.55, 1 - attacker.comboCount * 0.08);
      let finalDamage = Math.max(4, Math.round(rawDamage * attacker.cfg.atkMul * comboScale));
      if (g.mods.has("glass")) finalDamage *= 2;
      // 教學戰：敵人傷害大幅降低，而且玩家不會被打到 35% 以下（保證能贏）
      if (g.tutorial && defender === g.p1) finalDamage = Math.max(1, Math.round(finalDamage * 0.35));
      defender.hp = Math.max(0, defender.hp - finalDamage);
      if (g.tutorial && defender === g.p1) defender.hp = Math.max(Math.round(defender.hpMax * 0.35), defender.hp);
      attacker.comboCount += 1;
      attacker.comboTimer = 52;
      if (attacker === g.p1) {
        g.stats.damage += finalDamage;
        g.stats.maxCombo = Math.max(g.stats.maxCombo, attacker.comboCount);
      }
      attacker.energy = Math.min(100, attacker.energy + 14 * (attacker === g.p1 ? 1 + (gearStats.energy || 0) / 100 : 1));
      defender.energy = Math.min(100, defender.energy + 10);

      g.hitStop = isHeavy ? 5 : 3;
      g.screenShake = isHeavy ? 9 : 4;

      FX.onHit(g, attacker, defender, { heavy: isHeavy });
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
        storySfx.play("heal");
        spawnParticles(defender.x, defender.y - 50, "#a78bfa", 30, 7);
        addFloatingText(defender.x, defender.y - 115, "不死圖騰發動！復活 60% HP", "#a78bfa", 45);
        g.stats.items.totem++;
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
      g.hitFlash = 8;
      FX.addFx(g, { type: "ring", x: loser.x, y: loser.y - 50, r0: 10, r1: 240, color: "#ffffff", life: 30, lw: 10 });
      FX.addFx(g, { type: "impact", x: loser.x, y: loser.y - 55, size: 70, color: "#ffd60a", life: 22 });
      FX.emit(g, "spark", loser.x, loser.y - 45, 34, { color: ["#ff4d6d", "#ffd60a", "#ffffff"], speed: 9, life: 26 });

      if (winner === g.p1) {
        g.bannerText = "YOU WIN !!";
        setTimeout(() => audio.sfx("victory"), 500);
        g.subBannerText = `成功擊敗 ${g.p2.cfg.name}！`;
      } else {
        g.bannerText = "DEFEATED...";
        setTimeout(() => audio.sfx("defeat"), 500);
        g.subBannerText = "回村莊整備購買技能書或強化裝備後再戰！";
      }
    }

    function onHazardStrike(hz: any) {
      audio.sfx(`hz_${hz.type}`);
      if (hz.type === "sky_lightning") {
        g.screenShake = 10;
        g.hitFlash = 4;
        FX.emit(g, "spark", hz.x, FLOOR_Y - 6, 22, { color: ["#fde047", "#ffffff"], speed: 7, angle: -Math.PI / 2, spread: 2.4, life: 18 });
        FX.addFx(g, { type: "ring", x: hz.x, y: FLOOR_Y, r0: 8, r1: 90, squash: 0.25, color: "#fde047", life: 18 });
      } else if (hz.type === "ice_spike") {
        g.screenShake = 7;
        FX.emit(g, "shard", hz.x, FLOOR_Y - 20, 16, { color: ["#a5f3fc", "#ffffff"], speed: 6, angle: -Math.PI / 2, spread: 1.6, life: 26 });
      } else if (hz.type === "laser_sweep") {
        g.screenShake = 9;
        g.hitFlash = 3;
      } else if (hz.type === "format_beam") {
        g.screenShake = 6;
        FX.emit(g, "code", hz.x, FLOOR_Y - 60, 14, { color: "#ff4d6d", speed: 4, life: 30 });
      } else if (hz.type === "black_water") {
        FX.emit(g, "drop", hz.x, FLOOR_Y - 4, 12, { color: "#0c4a6e", speed: 4, angle: -Math.PI / 2, spread: 1.4, life: 24 });
      }
    }

    // 持續傷害（黑水）：不會擊倒、不會打斷動作
    function applyDot(f: any, dmg: number, label: string) {
      if (f.state === "ko") return;
      f.hp = Math.max(1, f.hp - dmg);
      addFloatingText(f.x, f.y - 100, `-${dmg} ${label}`, "#22d3ee", 22);
      callbacksRef.current.onSyncHpMp?.(g.p1.hp, g.p1.mp, g.p2.hp);
    }

    function updateGame() {
      g.frameCounter++;
      if (g.assistCooldown > 0) g.assistCooldown--;

      // 黑市買的武器 / 強化 / ATK 在戰鬥中即時生效（武器外觀跟著進化）
      const cur = stateRef.current || {};
      const lo = weaponLoadout(cur.inv);
      g.p1.weaponTier = lo.tier;
      g.p1.weaponPlus = lo.plus;
      g.p1.cfg.atkMul = Number((calcAtkMul(cur) * (1 + buffPct / 100)).toFixed(2));
      if (g.overclockTimer > 0) g.overclockTimer--;

      if (g.superFlash > 0) g.superFlash--;
      if (g.screenShake > 0) g.screenShake = Math.max(0, g.screenShake - 0.8);

      FX.updateParticles(g);
      FX.updateFx(g);

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
          storySfx.play("warn");
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
          const win = g.raid ? g.p1.hp > 0 : g.p1.hp > 0 && g.p2.hp <= 0;
          callbacksRef.current.onBattleEnd?.(win, Math.max(1, g.p1.hp), g.p1.mp, {
            durationMs: Math.round(performance.now() - g.stats.start),
            damage: g.stats.damage,
            maxCombo: g.stats.maxCombo,
            itemsUsed: g.stats.items,
            hpLeft: Math.max(0, g.p1.hp),
          });
        }
        return;
      }

      if (g.phase === "done") return;

      // 團隊 Boss：真實秒數倒數，時間到就結算傷害
      if (g.raid) {
        if (g.frameCounter % 48 === 0 && g.timer > 0) {
          g.timer--;
          if (g.timer === 0) {
            g.phase = "ko";
            g.phaseTimer = 80;
            g.bannerText = "TIME UP !!";
            g.subBannerText = `本次對 Boss 造成 ${g.stats.damage.toLocaleString()} 傷害`;
            storySfx.play("ko");
            return;
          }
        }
      }

      // 詞綴：再生、全場黑水、雷暴、分身突進
      if (g.mods.size && g.phase === "fight") {
        const f = g.frameCounter;
        if (g.mods.has("regen") && f % 48 === 0 && g.p2.hp > 0) g.p2.hp = Math.min(g.p2.hpMax, g.p2.hp + Math.ceil(g.p2.hpMax * 0.006));
        if (g.mods.has("blackwater") && f % 330 === 100 && !g.hazards.some((h: any) => h.type === "black_water")) {
          g.hazards.push({ type: "black_water", x: Math.max(70, Math.min(830, g.p1.x)), width: 100, warnTimer: 34, warnMax: 34, activeTimer: 200, activeMax: 200, damage: 5, hasHit: false, color: "#22d3ee", label: "黑水陷阱 · 減速" });
        }
        if (g.mods.has("thunder") && f % 260 === 60) {
          g.hazards.push({ type: "sky_lightning", x: Math.max(70, Math.min(830, g.p1.x)), width: 64, warnTimer: 44, warnMax: 44, activeTimer: 18, activeMax: 18, damage: 22, hasHit: false, seed: Math.random() * 100, color: "#fde047", label: "雷暴" });
        }
        if (g.mods.has("clone") && f % 300 === 150) {
          const dir = g.p1.x > 450 ? 1 : -1; // 從玩家背後的另一端衝過來
          g.hazards.push({ type: "phantom", dir, x: dir > 0 ? -40 : 940, warnTimer: 40, activeTimer: 70, damage: 20, hasHit: false, color: "#c084fc", snap: FX.snapshot(g.p2) });
        }
      }

      // 互動教學：完成一步就跳下一步
      const tut = g.tutorial;
      if (tut && tut.step < tut.steps.length) {
        if (tut.flash > 0) tut.flash--;
        else if (tut.steps[tut.step].done()) {
          tut.step++;
          tut.flash = 28;
          storySfx.play("assist");
          addFloatingText(g.p1.x, g.p1.y - 120, tut.step < tut.steps.length ? "很好！" : "教學完成！打倒雜魚老大吧！", "#00ff88", 40);
        }
      }

      // Slowed round timer: 1 tick per 75 logic steps (~1.6 real seconds)
      if (!g.raid && g.frameCounter % 75 === 0 && g.timer > 0) {
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
            addFloatingText(g.p1.x, g.p1.y - 115, `${as.name} 聖光祈禱 +${healAmt} HP!`, "#ffd60a", 36);
            spawnParticles(g.p1.x, g.p1.y - 45, "#ffd60a", 18, 5);
          }
          const projColor = as.klass === "mage" ? "#a78bfa" : as.klass === "priest" ? "#ffd60a" : "#ff4d6d";
          g.projectiles.push({
            owner: "p1",
            style: FX.VISUALS[as.klass]?.proj || "orb",
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

      // Boss 場地機關：預警 → 發動 → 判定
      const p1 = g.p1;
      const p1Top = p1.y - (p1.state === "crouch" ? 60 : 100);
      for (const hz of g.hazards) {
        if (hz.warnTimer > 0) {
          hz.warnTimer--;
          if (hz.warnTimer === 0) onHazardStrike(hz);
          continue;
        }
        if (hz.activeTimer <= 0) continue;
        hz.activeTimer--;
        const near = Math.abs(p1.x - hz.x);
        if (hz.type === "black_water") {
          if (near < hz.width * 0.85 && p1.y >= FLOOR_Y - 2) {
            p1.slowTimer = 4;
            if (g.frameCounter % 32 === 0) applyDot(p1, hz.damage, "黑水侵蝕");
          }
        } else if (hz.type === "data_block") {
          hz.vy = (hz.vy || 0) + 0.7;
          hz.y += hz.vy;
          if (!hz.hasHit && near < hz.size * 0.6 + 14 && hz.y > p1Top && hz.y - hz.size < p1.y) {
            hz.hasHit = true;
            applyHit(g.p2, p1, hz.damage, 4.5, -6, false, true, true);
          }
          if (hz.y >= FLOOR_Y) {
            hz.activeTimer = 0;
            g.screenShake = Math.max(g.screenShake, 4);
            FX.emit(g, "code", hz.x, FLOOR_Y - 10, 10, { color: hz.color, speed: 4, life: 26 });
            FX.emit(g, "spark", hz.x, FLOOR_Y - 6, 8, { color: [hz.color, "#ffffff"], speed: 5, angle: -Math.PI / 2, spread: 2.2, life: 14 });
          }
        } else if (hz.type === "phantom") {
          hz.x += hz.dir * 15;
          if (!hz.hasHit && Math.abs(p1.x - hz.x) < 32 && p1.y > FLOOR_Y - 45) {
            hz.hasHit = true;
            applyHit(g.p2, p1, hz.damage, 7, -6, false, true, true);
          }
          if (hz.x < -80 || hz.x > 980) hz.activeTimer = 0;
        } else if (hz.type === "laser_sweep") {
          if (!hz.hasHit && hz.y + hz.thick * 0.5 > p1Top && hz.y - hz.thick * 0.5 < p1.y) {
            hz.hasHit = true;
            applyHit(g.p2, p1, hz.damage, 6, -8, false, true, true);
          }
        } else if (
          !hz.hasHit &&
          near < hz.width * (hz.type === "ice_spike" ? 0.75 : 0.6) &&
          (hz.type !== "ice_spike" || p1.y > FLOOR_Y - 60)
        ) {
          hz.hasHit = true;
          applyHit(g.p2, p1, hz.damage, 5.0, -8, false, true, true);
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

      FX.trackAfterimages(g, g.p1);
      FX.trackAfterimages(g, g.p2);
      FX.emitWeaponParticles(g, g.p1);
      FX.emitWeaponParticles(g, g.p2);
      if ((g.p1.slowTimer || 0) > 0 && g.frameCounter % 6 === 0) {
        FX.emit(g, "drop", g.p1.x, FLOOR_Y - 6, 2, { color: "#0c4a6e", speed: 1.5, angle: -Math.PI / 2, spread: 1.2, life: 18 });
      }

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
      const frame = g.frameCounter;
      const overclock = !!g.p2.phase2Triggered;
      ctx.save();

      if (g.screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * g.screenShake * 2, (Math.random() - 0.5) * g.screenShake * 2);
      }

      FX.drawStage(ctx, g.stageKey, frame, W, H, { overclock, dim: g.superFlash > 0 ? 0.35 : 0 });
      for (const hz of g.hazards) FX.drawHazard(ctx, hz, frame, W);
      FX.drawFx(ctx, g, "back", frame);

      // 隊友支援進場
      if (g.activeAssist) {
        const as = g.activeAssist;
        const asColor = as.klass === "mage" ? "#a78bfa" : as.klass === "priest" ? "#ffd60a" : "#ff4d6d";
        FX.drawFighter(
          ctx,
          {
            x: as.x,
            y: as.y,
            facing: as.facing,
            state: "attack",
            attackType: "skill1",
            stateTimer: Math.max(1, as.timer - 14),
            attackDuration: 28,
            weaponTier: 1,
            cfg: { color: asColor, secondary: "#00e5ff", belt: "#111827", headband: "#ffffff", visualType: as.klass },
          },
          frame,
          { portrait: true }
        );
        FX.outlinedText(ctx, `${as.name}`, as.x, as.y - 128, 11, "#00e5ff", "#000", "center", 3);
      }

      // 出招的一方畫在前面
      const order = g.p2.state === "attack" && g.p1.state !== "attack" ? [g.p1, g.p2] : [g.p2, g.p1];
      for (const f of order) {
        if (f.energy >= 100 || f.phase2Triggered) FX.drawAura(ctx, f, frame);
        FX.drawFighter(ctx, f, frame);
      }

      for (const proj of g.projectiles) FX.drawProjectile(ctx, proj, frame);
      FX.drawFx(ctx, g, "front", frame);
      FX.drawParticles(ctx, g);
      FX.drawFloatingTexts(ctx, g);
      ctx.restore();

      // 迷霧詞綴：只看得到玩家周圍
      if (g.mods.has("fog")) {
        const fg = ctx.createRadialGradient(g.p1.x, g.p1.y - 60, 90, g.p1.x, g.p1.y - 60, 420);
        fg.addColorStop(0, "rgba(0,0,0,0)");
        fg.addColorStop(1, "rgba(0,0,0,0.82)");
        ctx.fillStyle = fg;
        ctx.fillRect(0, 0, W, H);
      }

      FX.drawHitFlash(ctx, g, W, H);
      FX.glitchPost(ctx, W, H, overclock ? (g.overclockTimer > 0 ? 1 : 0.45) : 0, frame);
      drawHUD(ctx, W, H);
      drawTutorial(ctx, W);
      FX.drawCutIn(ctx, g, W, H, frame);
      if (g.overclockTimer > 0 && g.phase === "fight") {
        FX.drawBanner(ctx, W, H, "SYSTEM OVERCLOCK", "Administrator 第二階段：全畫面雷射 · 數據方塊轟炸！", frame, 90 - g.overclockTimer);
      }
      if (pausedRef.current) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, W, H);
        FX.outlinedText(ctx, "PAUSED · 黑市交易中", W / 2, H / 2, 26, "#ffd60a", "#000", "center", 6);
        FX.outlinedText(ctx, "關閉黑市後繼續戰鬥", W / 2, H / 2 + 28, 13, "#7dffb6", "#000", "center", 4);
      }
    }

    function drawTutorial(ctx: CanvasRenderingContext2D, W: number) {
      const tut = g.tutorial;
      if (!tut || g.phase !== "fight" || tut.step >= tut.steps.length) return;
      const step = tut.steps[tut.step];
      const y = 96;
      ctx.save();
      ctx.fillStyle = "rgba(3,10,8,0.85)";
      ctx.strokeStyle = tut.flash > 0 ? "#00ff88" : "#ffd60a";
      ctx.lineWidth = 2;
      ctx.fillRect(W / 2 - 200, y - 26, 400, 52);
      ctx.strokeRect(W / 2 - 200, y - 26, 400, 52);
      ctx.restore();
      FX.outlinedText(ctx, `教學 ${tut.step + 1}/${tut.steps.length}`, W / 2, y - 8, 11, "#7dffb6", "#000", "center", 3);
      FX.outlinedText(ctx, step.text, W / 2, y + 15, 18, "#ffd60a", "#000", "center", 4);
      for (let i = 0; i < tut.steps.length; i++) {
        ctx.fillStyle = i < tut.step ? "#00ff88" : i === tut.step ? "#ffd60a" : "#1f3a2e";
        ctx.fillRect(W / 2 - 50 + i * 22, y + 30, 14, 4);
      }
    }

    function drawHUD(ctx: CanvasRenderingContext2D, W: number, H: number) {
      const frame = g.frameCounter;
      const barW = 320;
      const barH = 20;
      const topY = 16;
      const p1X = 66;
      const p2X = W - 66 - barW;

      // 頭像 + 斜角血條
      FX.drawPortrait(ctx, 34, 36, 24, g.p1, "left", frame);
      FX.drawPortrait(ctx, W - 34, 36, 24, g.p2, "right", frame);
      FX.drawBar(ctx, p1X, topY, barW, barH, g.p1.hp / g.p1.hpMax, g.p1.trailHp / g.p1.hpMax, "left", "#7dffb6", "#00b86b", frame);
      const oc = !!g.p2.phase2Triggered;
      if (g.raid) {
        // 團隊 Boss：顯示全服共享血量（扣掉這場自己打的傷害）
        const left = Math.max(0, g.raid.hp - g.stats.damage);
        FX.drawBar(ctx, p2X, topY, barW, barH, left / g.raid.hpMax, g.raid.hp / g.raid.hpMax, "right", "#ff8fa3", "#9f1239", frame);
      } else {
        FX.drawBar(ctx, p2X, topY, barW, barH, g.p2.hp / g.p2.hpMax, g.p2.trailHp / g.p2.hpMax, "right", oc ? "#ff8fa3" : "#ff7a90", oc ? "#9f1239" : "#e11d48", frame);
      }

      // P1 MP 條 + 名稱 + 武器
      ctx.fillStyle = "rgba(5,10,14,0.85)";
      ctx.fillRect(p1X, topY + barH + 5, 200, 7);
      ctx.fillStyle = "#00e5ff";
      ctx.fillRect(p1X, topY + barH + 5, 200 * Math.max(0, Math.min(1, g.p1.mp / g.p1.mpMax)), 7);
      ctx.strokeStyle = "rgba(0,229,255,0.6)";
      ctx.lineWidth = 1;
      ctx.strokeRect(p1X, topY + barH + 5, 200, 7);
      FX.outlinedText(ctx, `MP ${g.p1.mp}/${g.p1.mpMax}`, p1X + 206, topY + barH + 12, 10, "#7dd3fc", "#000", "left", 3);
      FX.outlinedText(ctx, `${g.p1.cfg.name}  HP ${g.p1.hp}/${g.p1.hpMax}`, p1X, topY + barH + 27, 12, "#7dffb6", "#000", "left", 3);
      const look = FX.weaponLook(g.p1);
      if (g.p1.weaponTier > 0 && look) {
        FX.outlinedText(ctx, `${look.name}${g.p1.weaponPlus > 0 ? ` +${g.p1.weaponPlus}` : ""}`, p1X, topY + barH + 43, 11, look.glow || "#ffd60a", "#000", "left", 3);
      }

      // P2 名稱 / 稱號 / 二階段
      const p2Label = g.raid
        ? `${g.p2.cfg.name}  全服血量 ${Math.max(0, g.raid.hp - g.stats.damage).toLocaleString()}/${g.raid.hpMax.toLocaleString()}`
        : `${g.p2.cfg.name}  HP ${g.p2.hp}/${g.p2.hpMax}`;
      FX.outlinedText(ctx, p2Label, p2X + barW, topY + barH + 18, 12, "#ff7a90", "#000", "right", 3);
      if (g.raid) FX.outlinedText(ctx, `本場傷害 ${g.stats.damage.toLocaleString()}`, W / 2, topY + 58, 14, "#ffd60a", "#000", "center", 4);
      if (g.mods.size) {
        FX.outlinedText(ctx, [...g.mods].map((m) => MOD_LABEL[m] || m).join(" · "), p2X + barW, topY + barH + 64, 10, "#c084fc", "#000", "right", 3);
      }
      FX.outlinedText(ctx, g.p2.cfg.title || "", p2X + barW, topY + barH + 33, 10, "#fda4af", "#000", "right", 3);
      if (oc && frame % 30 < 20) {
        FX.outlinedText(ctx, "PHASE 2 · OVERCLOCK", p2X + barW, topY + barH + 49, 11, "#ff4d6d", "#000", "right", 3);
      }

      FX.drawTimer(ctx, W, topY, g.timer);

      // 連擊數
      if (g.p1.comboCount >= 2 && g.p1.comboTimer > 0) FX.drawCombo(ctx, 24, 124, g.p1.comboCount, "left", "#ffd60a", g.p1.comboTimer - 46);
      if (g.p2.comboCount >= 2 && g.p2.comboTimer > 0) FX.drawCombo(ctx, W - 24, 124, g.p2.comboCount, "right", "#ff4d6d", g.p2.comboTimer - 46);

      // 必殺氣條（分段）
      const mX = 36;
      const mY = H - 18;
      const full = g.p1.energy >= 100;
      FX.drawMeter(ctx, mX, mY, 240, 10, g.p1.energy, "left", frame);
      FX.outlinedText(
        ctx,
        full ? "SUPER MAX! 按 [Q/I] 施放終極奧義！" : `SUPER 氣條 ${Math.floor(g.p1.energy)}%`,
        mX,
        mY - 5,
        11,
        full ? "#ffd60a" : "#7be0a8",
        "#000",
        "left",
        3
      );

      // 隊友支援
      const assistReady = g.assistCooldown <= 0;
      FX.outlinedText(
        ctx,
        assistReady ? "隊友支援 READY! 按 [E] 召喚三人組連攜攻擊" : `隊友支援冷卻 (${Math.ceil((g.assistCooldown * 21) / 1000)}s)`,
        W - 36,
        mY + 7,
        11,
        assistReady ? "#00ff88" : "#3a8c5e",
        "#000",
        "right",
        3
      );

      // 中央橫幅
      if (g.phase !== "fight") {
        if (g._banner !== g.bannerText) {
          g._banner = g.bannerText;
          g.bannerAge = 0;
        }
        FX.drawBanner(ctx, W, H, g.bannerText, g.subBannerText, frame, g.bannerAge++);
      }
    }

    let animId = 0;
    let lastTime = performance.now();
    let accumulator = 0;
    const STEP_MS = 21;

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

      const canvas = canvasRef.current;
      if (canvas) {
        dpr = FX.setupCanvas(canvas, 900, 430);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          if (pausedRef.current) {
            keys.clear();
            accumulator = 0;
          }
          let substeps = 0;
          while (!pausedRef.current && accumulator >= STEP_MS && substeps < 3) {
            updateGame();
            accumulator -= STEP_MS;
            substeps++;
          }
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
            STORY BATTLE ARENA
          </span>
          <span className="text-[#ffd60a] font-bold">
            VS {STORY_ENEMY_PROFILES[enemyKey]?.name || enemyCfg.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => audio.setMuted(!muted)}
            className="px-2 py-0.5 border border-[#0f3a26] text-[#7be0a8] hover:border-[#00ff88] text-[11px]"
          >
            {muted ? "聲音：關" : "聲音：開"}
          </button>
          {onOpenShopModal && (
            <button
              type="button"
              onClick={onOpenShopModal}
              className="px-2 py-0.5 border border-[#ffd60a] text-[#ffd60a] hover:bg-[#ffd60a]/10 text-[11px]"
            >
              快速開啟黑市
            </button>
          )}
          {!enemyCfg?.isFinal && (
            <button
              type="button"
              onClick={onFlee}
              className="px-2 py-0.5 border border-[#3a0f1c] text-[#ff4d6d] hover:border-[#ff4d6d] text-[11px]"
            >
              撤退回村莊
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
        <TouchControls buttons={STORY_BUTTONS} anchor={canvasRef} />
        {typingInInput && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              (document.activeElement as HTMLElement)?.blur?.();
            }}
            className="absolute inset-0 flex items-center justify-center bg-black/45 rounded text-[#ffd60a] crpg-glow-yellow text-sm font-bold tracking-wide"
          >
            鍵盤目前在指令輸入框 — 點擊戰場或按 Esc 回到角色操控
          </button>
        )}
      </div>

      {/* Interactive Skill & Keyboard Hotkey Bar */}
      <div className="w-full max-w-[900px] grid grid-cols-2 md:grid-cols-5 gap-1.5 text-[11px]">
        <div className="border border-[#0f3a26] bg-[#071510] px-2.5 py-1.5">
          <div className="text-[#00ff88] font-bold">移動與普攻</div>
          <div className="text-[#cfeedd] mt-0.5">
            [W/A/S/D] 移動 · [F/J] 輕擊 · [G/K] 重擊
          </div>
        </div>

        <div className="border border-[#0f3a26] bg-[#071510] px-2.5 py-1.5">
          <div className="text-[#00e5ff] font-bold">初始與卷一技能</div>
          <div className="text-[#cfeedd] mt-0.5">
            [R/L] {skill1.name} ·{" "}
            {state.learnedSkill2 ? (
              <span className="text-[#ffd60a]">[T/U] {skill2.name}</span>
            ) : (
              <span className="text-[#3a8c5e]">[T/U] 卷一</span>
            )}
          </div>
        </div>

        <div className="border border-[#0f3a26] bg-[#071510] px-2.5 py-1.5">
          <div className="text-[#a78bfa] font-bold">卷二與終極奧義</div>
          <div className="text-[#cfeedd] mt-0.5">
            {state.learnedSkill3 ? (
              <span className="text-[#00e5ff]">[Y/O] {skill3.name}</span>
            ) : (
              <span className="text-[#3a8c5e]">[Y/O] 卷二</span>
            )}{" "}
            ·{" "}
            {state.learnedUlt ? (
              <span className="text-[#ff4d6d] font-bold">[Q/I] {ultSkill.name}</span>
            ) : (
              <span className="text-[#3a8c5e]">[Q/I] 奧義書</span>
            )}
          </div>
        </div>

        <div className="border border-[#0f3a26] bg-[#071510] px-2.5 py-1.5">
          <div className="text-[#00ff88] font-bold">三人組連攜支援</div>
          <div className="text-[#cfeedd] mt-0.5">
            按 <span className="text-[#ffd60a] font-bold">[E]</span> 召喚 AI 隊友進場放招支援！
          </div>
        </div>

        <div className="border border-[#0f3a26] bg-[#071510] px-2.5 py-1.5">
          <div className="text-[#ffd60a] font-bold">道具快捷鍵</div>
          <div className="text-[#cfeedd] mt-0.5">
            [H] 草藥({state.inv?.herb || 0}) · [B] 魔力水({state.inv?.mana || 0})
          </div>
        </div>
      </div>
    </div>
  );
}
