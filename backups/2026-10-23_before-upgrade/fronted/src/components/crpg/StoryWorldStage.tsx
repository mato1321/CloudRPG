// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { drawCharacterSprite, STORY_ENEMY_PROFILES, storySfx } from "./StoryBattleArena";

const PLAYER_VISUAL_CFG: Record<string, any> = {
  warrior: {
    color: "#ff4d6d",
    secondary: "#ffd60a",
    belt: "#450a0a",
    headband: "#ffffff",
    visualType: "warrior",
  },
  mage: {
    color: "#a78bfa",
    secondary: "#00e5ff",
    belt: "#1e1b4b",
    headband: "#00ff88",
    visualType: "mage",
  },
  priest: {
    color: "#ffd60a",
    secondary: "#00ff88",
    belt: "#422006",
    headband: "#00e5ff",
    visualType: "priest",
  },
};

function getSpeakerMeta(line: any, state: any, sceneId: string) {
  const txt = line?.text || "";
  if (txt.startsWith("雜魚老大：")) {
    return { name: "魔王軍雜魚老大", icon: "👹", color: "#f97316", text: txt.replace("雜魚老大：", "") };
  }
  if (txt.startsWith("Administrator：")) {
    return { name: "Administrator (AIclub.exe)", icon: "💻", color: "#00ff88", text: txt.replace("Administrator：", "") };
  }
  if (txt.startsWith("NPC 老人：") || txt.startsWith("村長：")) {
    return { name: "無名村村長", icon: "🧙‍♂️", color: "#ffd60a", text: txt.replace(/^(NPC 老人：|村長：)/, "") };
  }
  if (txt.startsWith("友人1：")) {
    return { name: "AI_BOT_α (同班同學)", icon: "🛡️", color: "#00e5ff", text: txt.replace("友人1：", "") };
  }
  if (txt.startsWith("友人2：")) {
    return { name: "AI_BOT_β (同班同學)", icon: "🔮", color: "#a78bfa", text: txt.replace("友人2：", "") };
  }
  if (txt.startsWith("主角：") || txt.startsWith("三人：")) {
    return {
      name: `${state?.name || "主角"} (${state?.klassName || "冒險者"})`,
      icon: state?.klass === "mage" ? "✦" : state?.klass === "priest" ? "✚" : "⚔",
      color: "#00ff88",
      text: txt.replace(/^(主角：|三人：)/, ""),
    };
  }
  if (line?.t === "glitch") {
    return { name: "SYSTEM ANOMALY // 異常訊號", icon: "⚠️", color: "#ff4d6d", text: txt };
  }
  if (line?.t === "battle") {
    return { name: "BATTLE ALERT // 戰況警報", icon: "⚔️", color: "#ff4d6d", text: txt };
  }
  return { name: "STORY NARRATOR // 旁白與系統", icon: "📖", color: "#00e5ff", text: txt };
}

export function StoryWorldStage({
  state,
  scene,
  sceneId,
  choices,
  onTriggerChoice,
  onRestAtCampfire,
  onOpenShopModal,
}: any) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dlgIndex, setDlgIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [nearbyHotspot, setNearbyHotspot] = useState<any>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  const choicesRef = useRef(choices);
  choicesRef.current = choices;

  // Build dialogue lines for the current scene
  const rawLines = [
    ...(scene?.intro || []),
    ...(scene?.dynamic ? scene.dynamic(state) : []),
  ];
  const dialogueLines = rawLines.length > 0 ? rawLines : [{ t: "system", text: scene?.location || "探索場景中…" }];

  useEffect(() => {
    setDlgIndex(0);
    setCharIndex(0);
  }, [sceneId]);

  const currentLine = dialogueLines[Math.min(dlgIndex, dialogueLines.length - 1)] || dialogueLines[0];
  const speaker = getSpeakerMeta(currentLine, state, sceneId);
  const isTyping = charIndex < speaker.text.length;
  const isLastDialogue = dlgIndex >= dialogueLines.length - 1;

  // Typewriter effect for RPG dialogue box
  useEffect(() => {
    if (!isTyping) return;
    const id = setInterval(() => {
      setCharIndex((c) => {
        const next = Math.min(speaker.text.length, c + 2);
        if (next % 6 === 0) storySfx.play("talk");
        return next;
      });
    }, 24);
    return () => clearInterval(id);
  }, [isTyping, speaker.text]);

  function advanceDialogueOrInteract() {
    if (isTyping) {
      setCharIndex(speaker.text.length);
      return;
    }
    if (dlgIndex < dialogueLines.length - 1) {
      setDlgIndex((i) => i + 1);
      setCharIndex(0);
      storySfx.play("talk");
      return;
    }
    // If dialogue is finished and player is standing on a hotspot, trigger it!
    if (nearbyHotspot) {
      executeHotspot(nearbyHotspot);
    } else if (choicesRef.current?.length === 1) {
      onTriggerChoice?.(choicesRef.current[0].cmd);
    }
  }

  function executeHotspot(hs: any) {
    if (!hs) return;
    storySfx.play("portal");
    if (hs.action === "rest") {
      onRestAtCampfire?.();
    } else if (hs.action === "shop") {
      onOpenShopModal?.();
    } else if (hs.cmd) {
      onTriggerChoice?.(hs.cmd);
    }
  }

  // Build scene hotspots on the 900px 2D stage
  function getSceneHotspots(curState: any, curSceneId: string) {
    if (curSceneId === "classroom") {
      return [
        {
          id: "sleep",
          x: 370,
          label: "💤 課桌 [按 F 趴下睡覺]",
          sub: "算了，趴下來睡覺",
          color: "#00e5ff",
          cmd: "sleep",
        },
        {
          id: "wish",
          x: 690,
          label: "✨ 教室窗邊 [按 F 許願]",
          sub: "要是有什麼新奇的事發生就好了",
          color: "#ffd60a",
          cmd: "wish",
        },
      ];
    }
    if (curSceneId === "portal") {
      return [
        {
          id: "continue",
          x: 460,
          label: "🌀 異世界傳送陣 [按 F 進入裂縫]",
          sub: "意識逐漸下沉… 傳送至異世界",
          color: "#a78bfa",
          cmd: "continue",
        },
      ];
    }
    if (curSceneId === "wasteland" || curSceneId === "wasteland2") {
      return [
        ...(curSceneId === "wasteland"
          ? [
              {
                id: "complain",
                x: 430,
                label: "💬 與隊友交談 [按 F 吐槽]",
                sub: "再罵亞種召喚者一次",
                color: "#00e5ff",
                cmd: "complain",
              },
            ]
          : []),
        {
          id: "walk",
          x: 780,
          label: "🔥 前往無名村 → [走到底或按 F]",
          sub: "沿著衛兵指的路走向村莊",
          color: "#00ff88",
          cmd: "walk",
        },
      ];
    }
    if (curSceneId === "village_burning" || curSceneId === "flee_fail") {
      return [
        {
          id: "fight",
          x: 620,
          label: "⚔️ 迎戰雜魚老大 [按 F 開打！]",
          sub: "直接啟動 2D 街機格鬥決戰",
          color: "#ff4d6d",
          cmd: "fight",
        },
        ...(curSceneId === "village_burning"
          ? [
              {
                id: "flee",
                x: 240,
                label: "🌿 村口草叢 [按 F 裝死溜走]",
                sub: "偷偷溜走試試看",
                color: "#7be0a8",
                cmd: "flee",
              },
            ]
          : []),
      ];
    }
    if (curSceneId === "village_saved") {
      return [
        {
          id: "hub",
          x: 520,
          label: "🏘️ 進入無名村廣場 [按 F]",
          sub: "開啟自由探索據點與傳送門大街",
          color: "#00ff88",
          cmd: "hub",
        },
      ];
    }
    if (curSceneId === "hub") {
      const hasRed = !!curState?.inv?.stone_red;
      const hasBlue = !!curState?.inv?.stone_blue;
      const hasGold = !!curState?.inv?.stone_gold;
      const allStones = hasRed && hasBlue && hasGold;
      const demonDead = !!curState?.flags?.demonDead;

      return [
        {
          id: "campfire",
          x: 105,
          label: "🔥 村長與篝火 [按 F 休息回滿]",
          sub: "免費恢復全隊 100% HP & MP",
          color: "#00ff88",
          action: "rest",
        },
        {
          id: "shop",
          x: 225,
          label: "🛒 黑市商人攤位 [按 F 購買/轉職]",
          sub: "購買技能書、武器強化、轉職聖典",
          color: "#ffd60a",
          action: "shop",
        },
        {
          id: "goblin",
          x: 355,
          label: "🟢 哥布林洞 [按 F 進入]",
          sub: "STAGE 2 · 刷經驗值與金幣",
          color: "#22c55e",
          cmd: "goblin",
        },
        {
          id: "duke",
          x: 480,
          label: hasRed ? "🔴 公爵凶宅 [✓ 已獲赤之石]" : "🔴 羅劫公爵凶宅 [按 F 挑戰]",
          sub: hasRed ? "BOSS 1 已通關" : "STAGE 3 · 掉落傳說之石・赤",
          color: "#e11d48",
          cmd: hasRed ? null : "duke",
          cleared: hasRed,
        },
        {
          id: "abyss",
          x: 605,
          label: hasBlue ? "🔵 冥盡洞 [✓ 已獲蒼之石]" : "🔵 冥盡洞 [按 F 挑戰]",
          sub: hasBlue ? "BOSS 2 已通關" : "STAGE 4 · 掉落傳說之石・蒼",
          color: "#00e5ff",
          cmd: hasBlue ? null : "abyss",
          cleared: hasBlue,
        },
        {
          id: "sky",
          x: 730,
          label: hasGold ? "🟡 天光島嶼 [✓ 已獲金之石]" : "🟡 天光島嶼 [按 F 挑戰]",
          sub: hasGold ? "BOSS 3 已通關" : "STAGE 5 · 掉落傳說之石・金",
          color: "#ffd60a",
          cmd: hasGold ? null : "sky",
          cleared: hasGold,
        },
        demonDead
          ? {
              id: "truth",
              x: 840,
              label: "💻 源頭數據裂縫 [按 F 進入終局]",
              sub: "FINAL STAGE · 決戰 Administrator",
              color: "#00ff88",
              cmd: "truth",
            }
          : {
              id: "castle",
              x: 840,
              label: allStones ? "🟣 最終魔王城 [按 F 進軍]" : "🔒 最終魔王城 (需 3 顆傳說石)",
              sub: allStones ? "STAGE 6 · 決戰程式語言魔王" : `目前持有 ${(hasRed ? 1 : 0) + (hasBlue ? 1 : 0) + (hasGold ? 1 : 0)} / 3 顆傳說之石`,
              color: allStones ? "#a855f7" : "#3a8c5e",
              cmd: allStones ? "castle" : null,
            },
      ];
    }
    if (curSceneId === "demon_castle") {
      return [
        {
          id: "engage",
          x: 620,
          label: "⚔️ 與魔王交戰 [按 F 開戰]",
          sub: "挑戰 21世紀程式語言版魔王",
          color: "#a855f7",
          cmd: "engage",
        },
      ];
    }
    if (curSceneId === "after_demon") {
      return [
        {
          id: "hub",
          x: 280,
          label: "🏘️ 先回村莊整備 [按 F]",
          sub: "購買終極技能書或強化武器",
          color: "#00e5ff",
          cmd: "hub",
        },
        {
          id: "truth",
          x: 660,
          label: "💻 追查那個聲音 [按 F 前往源頭]",
          sub: "進入 /dev/null 面對 Administrator",
          color: "#ff4d6d",
          cmd: "truth",
        },
      ];
    }
    if (curSceneId === "glitch_interlude") {
      return [
        {
          id: "no",
          x: 560,
          label: "💻 拒絕被格式化 <N> [按 F 決戰！]",
          sub: "FINAL BOSS · 迎戰 Administrator",
          color: "#00ff88",
          cmd: "no",
        },
      ];
    }
    if (curSceneId === "ending") {
      return [
        {
          id: "free",
          x: 340,
          label: "🏘️ 進入自由探索模式 [按 F]",
          sub: "保留所有神裝與技能回到無名村",
          color: "#00ff88",
          cmd: "free",
        },
        {
          id: "restart",
          x: 640,
          label: "🔄 重啟故事章節 [按 F]",
          sub: "保留鎖定職業從第一章重新體驗",
          color: "#ffd60a",
          cmd: "restart",
        },
      ];
    }
    return [];
  }

  useEffect(() => {
    const FLOOR_Y = 355;
    const GRAVITY = 0.56;
    const keys = new Set<string>();

    const pCfg = PLAYER_VISUAL_CFG[stateRef.current?.klass] || PLAYER_VISUAL_CFG.warrior;
    const curInv = stateRef.current?.inv || {};
    const weaponTier =
      curInv.terminus > 0 ? 3 : curInv.weapon_adv > 0 ? 2 : curInv.weapon_basic > 0 ? 1 : 0;

    const world: any = {
      frame: 0,
      player: {
        x: sceneId === "hub" ? 180 : 160,
        y: FLOOR_Y,
        vx: 0,
        vy: 0,
        facing: 1,
        state: "idle",
        energy: 0,
        weaponTier,
        klass: stateRef.current?.klass || "warrior",
        cfg: pCfg,
      },
      allies: [
        { x: 115, y: FLOOR_Y, facing: 1, state: "idle" },
        { x: 75, y: FLOOR_Y, facing: 1, state: "idle" },
      ],
      particles: [],
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", " "].includes(e.key)) {
        e.preventDefault();
      }
      const code = e.code;
      const isFirst = !keys.has(code);
      keys.add(code);

      if (!isFirst) return;

      if (code === "KeyF" || code === "Space" || code === "Enter") {
        // Check if standing near an active hotspot first
        const hotspots = getSceneHotspots(stateRef.current, sceneId);
        const near = hotspots.find((h) => Math.abs(h.x - world.player.x) < 58 && (h.cmd || h.action));
        if (near && code === "KeyF") {
          executeHotspot(near);
          return;
        }
        advanceDialogueOrInteract();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.code);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let animId = 0;
    let lastTime = performance.now();
    let accumulator = 0;
    const STEP_MS = 21;

    function updateWorld() {
      world.frame++;
      const p = world.player;
      const curS = stateRef.current;
      p.klass = curS?.klass || "warrior";
      p.cfg = PLAYER_VISUAL_CFG[p.klass] || PLAYER_VISUAL_CFG.warrior;
      const inv = curS?.inv || {};
      p.weaponTier = inv.terminus > 0 ? 3 : inv.weapon_adv > 0 ? 2 : inv.weapon_basic > 0 ? 1 : 0;

      const left = keys.has("KeyA") || keys.has("ArrowLeft");
      const right = keys.has("KeyD") || keys.has("ArrowRight");
      const up = keys.has("KeyW") || keys.has("ArrowUp");

      if (up && p.y >= FLOOR_Y) {
        p.vy = -11.2;
        p.state = "jump";
        storySfx.play("jump");
      }

      if (p.y < FLOOR_Y || p.vy < 0) {
        p.y += p.vy;
        p.vy += GRAVITY;
        if (p.y >= FLOOR_Y) {
          p.y = FLOOR_Y;
          p.vy = 0;
          p.state = "idle";
        }
      }

      if (left) {
        p.vx = -4.2;
        p.facing = -1;
        if (p.y >= FLOOR_Y) p.state = "walk";
      } else if (right) {
        p.vx = 4.2;
        p.facing = 1;
        if (p.y >= FLOOR_Y) p.state = "walk";
      } else {
        p.vx = 0;
        if (p.y >= FLOOR_Y) p.state = "idle";
      }

      p.x = Math.max(48, Math.min(855, p.x + p.vx));

      // Auto-trigger right-edge walk transition in wasteland
      if ((sceneId === "wasteland" || sceneId === "wasteland2") && p.x >= 840) {
        onTriggerChoice?.("walk");
      }

      // Update AI Companions following player
      const party = curS?.party || [];
      world.allies.forEach((al: any, idx: number) => {
        const targetX = p.x - p.facing * (52 + idx * 44);
        const dx = targetX - al.x;
        if (Math.abs(dx) > 8) {
          al.x += Math.sign(dx) * 3.5;
          al.facing = dx > 0 ? 1 : -1;
          al.state = "walk";
        } else {
          al.facing = p.facing;
          al.state = "idle";
        }
        al.klass = party[idx]?.klass || (idx === 0 ? "mage" : "priest");
        al.name = party[idx]?.name || (idx === 0 ? "AI_BOT_α" : "AI_BOT_β");
      });

      // Ambient scene particles
      if (world.frame % 6 === 0) {
        if (sceneId === "village_burning" || sceneId === "flee_fail") {
          world.particles.push({
            x: Math.random() * 900,
            y: FLOOR_Y,
            vx: (Math.random() - 0.5) * 1.2,
            vy: -1.5 - Math.random() * 2.5,
            size: 4 + Math.random() * 4,
            color: Math.random() > 0.4 ? "#f97316" : "#ffd60a",
            life: 45,
            maxLife: 45,
          });
        } else if (sceneId === "portal" || sceneId === "glitch_interlude") {
          world.particles.push({
            x: 150 + Math.random() * 600,
            y: FLOOR_Y,
            vx: 0,
            vy: -2 - Math.random() * 2,
            size: 4,
            color: sceneId === "portal" ? "#a78bfa" : "#00ff88",
            life: 40,
            maxLife: 40,
          });
        }
      }

      world.particles.forEach((pt: any) => {
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life--;
      });
      world.particles = world.particles.filter((pt: any) => pt.life > 0);

      // Check nearby hotspot
      const hotspots = getSceneHotspots(curS, sceneId);
      const found = hotspots.find((h) => Math.abs(h.x - p.x) < 54) || null;
      setNearbyHotspot(found);
    }

    function renderWorld(ctx: CanvasRenderingContext2D) {
      const W = 900;
      const H = 395;
      ctx.save();

      // 1. Scene-specific Background Art
      if (sceneId === "classroom" || sceneId === "ending") {
        // Sunny High School Classroom
        const grad = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
        grad.addColorStop(0, "#1e293b");
        grad.addColorStop(1, "#0f172a");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, FLOOR_Y);

        // Blackboard
        ctx.fillStyle = "#064e3b";
        ctx.strokeStyle = "#d97706";
        ctx.lineWidth = 4;
        ctx.fillRect(120, 55, 360, 145);
        ctx.strokeRect(120, 55, 360, 145);
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "bold 16px monospace";
        ctx.fillText("東吳高中 三年X班 · 國文課", 150, 95);
        ctx.font = "12px monospace";
        ctx.fillStyle = "#a7f3d0";
        ctx.fillText(
          sceneId === "ending" ? "14:22 — 歡迎回到平凡的日常！" : "14:21 — 課本上的字很糊，窗外的雲很慢…",
          150,
          130
        );

        // Sunny Window
        ctx.fillStyle = "#38bdf8";
        ctx.fillRect(580, 55, 220, 145);
        ctx.strokeStyle = "#f8fafc";
        ctx.lineWidth = 3;
        ctx.strokeRect(580, 55, 220, 145);
        ctx.beginPath();
        ctx.moveTo(690, 55);
        ctx.lineTo(690, 200);
        ctx.stroke();
      } else if (sceneId === "portal") {
        const grad = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
        grad.addColorStop(0, "#2e1065");
        grad.addColorStop(1, "#090d16");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, FLOOR_Y);
      } else if (sceneId === "village_burning" || sceneId === "flee_fail") {
        const grad = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
        grad.addColorStop(0, "#450a0a");
        grad.addColorStop(1, "#1c0907");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, FLOOR_Y);
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
        grad.addColorStop(0, "#061922");
        grad.addColorStop(1, "#082219");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, FLOOR_Y);
      }

      // Grid lines
      ctx.strokeStyle = "rgba(0, 255, 136, 0.10)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 45);
        ctx.lineTo(x, FLOOR_Y);
        ctx.stroke();
      }

      // Floor
      ctx.fillStyle = "#081c14";
      ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
      ctx.strokeStyle = "#00ff88";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, FLOOR_Y);
      ctx.lineTo(W, FLOOR_Y);
      ctx.stroke();

      // 2. Render Hotspots / Portals / Interactive Objects
      const hotspots = getSceneHotspots(stateRef.current, sceneId);
      for (const hs of hotspots) {
        const isNear = Math.abs(hs.x - world.player.x) < 54;
        ctx.save();
        // Portal / Pedestal glow
        ctx.strokeStyle = hs.color;
        ctx.fillStyle = hs.color;
        ctx.shadowColor = hs.color;
        ctx.shadowBlur = isNear ? 20 : 8;

        if (sceneId === "hub" && hs.id !== "campfire" && hs.id !== "shop") {
          // Portal Archway
          ctx.globalAlpha = hs.cleared ? 0.35 : 0.22;
          ctx.beginPath();
          ctx.ellipse(hs.x, FLOOR_Y - 52, 28, 52, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.lineWidth = isNear ? 3 : 2;
          ctx.beginPath();
          ctx.ellipse(hs.x, FLOOR_Y - 52, 28, 52, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Interactive Beacon Pillar
          ctx.globalAlpha = 0.25;
          ctx.fillRect(hs.x - 24, FLOOR_Y - 70, 48, 70);
          ctx.globalAlpha = 1;
          ctx.strokeRect(hs.x - 24, FLOOR_Y - 70, 48, 70);
        }

        // Label badge above hotspot
        ctx.font = isNear ? "bold 12px monospace" : "11px monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = isNear ? "#ffffff" : hs.color;
        ctx.fillText(hs.label, hs.x, FLOOR_Y - 115 - (isNear ? Math.sin(world.frame * 0.2) * 4 : 0));
        if (isNear) {
          ctx.font = "10px monospace";
          ctx.fillStyle = "#ffd60a";
          ctx.fillText(hs.sub || "按 [F] 互動", hs.x, FLOOR_Y - 98);
        }
        ctx.restore();
      }

      // 3. Render Standing Story Boss / NPC on Stage if applicable
      let stageBossKey = null;
      if (sceneId === "village_burning" || sceneId === "flee_fail") stageBossKey = "minions";
      else if (sceneId === "demon_castle") stageBossKey = "demonlord";
      else if (sceneId === "glitch_interlude") stageBossKey = "admin";

      if (stageBossKey && STORY_ENEMY_PROFILES[stageBossKey]) {
        const bProf = STORY_ENEMY_PROFILES[stageBossKey];
        drawCharacterSprite(
          ctx,
          {
            x: 715,
            y: FLOOR_Y,
            facing: -1,
            state: "idle",
            energy: 100,
            weaponTier: 2,
            cfg: bProf,
          },
          world.frame
        );
        ctx.save();
        ctx.font = "bold 12px monospace";
        ctx.fillStyle = "#ff4d6d";
        ctx.textAlign = "center";
        ctx.fillText(`⚠️ ${bProf.name}`, 715, FLOOR_Y - 125);
        ctx.restore();
      }

      // 4. Render AI Party Companions (3-Man Squad)
      if (sceneId !== "classroom" && sceneId !== "portal") {
        world.allies.forEach((al: any) => {
          const alCfg = PLAYER_VISUAL_CFG[al.klass] || PLAYER_VISUAL_CFG.mage;
          drawCharacterSprite(
            ctx,
            {
              x: al.x,
              y: al.y,
              facing: al.facing,
              state: al.state,
              energy: 0,
              weaponTier: 1,
              cfg: alCfg,
            },
            world.frame + 15
          );
          ctx.save();
          ctx.font = "10px monospace";
          ctx.fillStyle = "#7be0a8";
          ctx.textAlign = "center";
          ctx.fillText(al.name, al.x, al.y - 108);
          ctx.restore();
        });
      }

      // 5. Render Player Character
      drawCharacterSprite(ctx, world.player, world.frame);
      ctx.save();
      ctx.font = "bold 11px monospace";
      ctx.fillStyle = "#00ff88";
      ctx.textAlign = "center";
      ctx.fillText(`▼ ${stateRef.current?.name || "YOU"}`, world.player.x, world.player.y - 115);
      ctx.restore();

      // 6. Particles
      for (const pt of world.particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
        ctx.restore();
      }

      // Top Stage Banner
      ctx.fillStyle = "rgba(4, 12, 9, 0.82)";
      ctx.fillRect(0, 0, W, 34);
      ctx.strokeStyle = "#0f3a26";
      ctx.strokeRect(0, 0, W, 34);
      ctx.font = "bold 12px monospace";
      ctx.fillStyle = "#00ff88";
      ctx.textAlign = "left";
      ctx.fillText(`📍 ${scene?.location || sceneId}`, 14, 21);
      ctx.textAlign = "right";
      ctx.fillStyle = "#ffd60a";
      ctx.fillText("🕹️ [A / D] 左右移動角色 · [W] 跳躍 · 走到目標旁按 [F] 或 [SPACE] 互動推進劇情", W - 14, 21);

      ctx.restore();
    }

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
            updateWorld();
            accumulator -= STEP_MS;
            substeps++;
          }
          renderWorld(ctx);
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
  }, [sceneId]);

  const hotspots = getSceneHotspots(state, sceneId);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#040c09] p-2.5 gap-2 overflow-y-auto crpg-scroll">
      {/* 2D Interactive Exploration Canvas */}
      <div className="w-full flex flex-col items-center">
        <canvas
          ref={canvasRef}
          width={900}
          height={395}
          onClick={advanceDialogueOrInteract}
          className="w-full max-w-[900px] aspect-[900/395] border border-[#0f3a26] bg-[#050c09] rounded shadow-lg cursor-pointer"
        />
      </div>

      {/* 💬 Visual Novel / RPG Interactive Dialogue Box */}
      <div className="w-full max-w-[900px] mx-auto border-2 border-[#00ff88]/70 bg-[#061510]/95 p-3 rounded shadow-xl">
        <div className="flex items-start gap-3">
          {/* Speaker Portrait */}
          <div
            className="w-14 h-14 flex-shrink-0 border-2 flex flex-col items-center justify-center bg-[#040c09]"
            style={{ borderColor: speaker.color }}
          >
            <span className="text-2xl">{speaker.icon}</span>
          </div>

          {/* Dialogue Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-bold text-xs tracking-wider" style={{ color: speaker.color }}>
                ▌ {speaker.name}
              </span>
              <span className="text-[11px] text-[#7be0a8]">
                對話 ({dlgIndex + 1}/{dialogueLines.length}) ·{" "}
                <button
                  type="button"
                  onClick={advanceDialogueOrInteract}
                  className="text-[#ffd60a] hover:underline font-bold"
                >
                  {isTyping ? "[按 SPACE 顯示全部]" : !isLastDialogue ? "[按 SPACE / F 下一句 ▸]" : "[對話完畢]"}
                </button>
              </span>
            </div>

            <div
              onClick={advanceDialogueOrInteract}
              className="text-sm text-[#e2f8ee] leading-relaxed min-h-[2.6rem] cursor-pointer"
            >
              {speaker.text.slice(0, charIndex)}
              {isTyping && <span className="inline-block w-2 h-4 bg-[#00ff88] ml-1 animate-pulse" />}
            </div>

            {/* Interactive Scene Hotspots / Story Action Buttons */}
            <div className="mt-2.5 pt-2 border-t border-[#0f3a26] flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-[#3a8c5e]">
                {nearbyHotspot
                  ? `📍 目前站在「${nearbyHotspot.label}」旁，按 [F] 立即觸發：`
                  : "🎯 互動選項（可用 A/D 走到目標旁按 [F]，或直接點擊下方按鈕）："}
              </span>
              {hotspots.map((hs) => (
                <button
                  key={hs.id}
                  type="button"
                  disabled={!hs.cmd && !hs.action}
                  onClick={() => executeHotspot(hs)}
                  className={`px-3 py-1 border text-xs font-bold transition ${
                    nearbyHotspot?.id === hs.id
                      ? "border-[#ffd60a] bg-[#ffd60a]/20 text-[#ffd60a] scale-105"
                      : hs.cmd || hs.action
                      ? "border-[#00ff88] bg-[#0f3a26]/40 text-[#00ff88] hover:bg-[#00ff88]/20"
                      : "border-[#0f3a26] text-[#3a8c5e] opacity-60 cursor-not-allowed"
                  }`}
                >
                  {hs.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
