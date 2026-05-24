// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Shell, Stat, readAuth } from "../components/crpg/Shell";

export const Route = createFileRoute("/play")({
  component: PlayPage,
  head: () => ({ meta: [
    { title: "Cloud RPG — Play the Story" },
    { name: "description", content: "Play the Cloud RPG main storyline. Type commands to fight, explore and uncover the truth behind the Administrator." },
  ]}),
});

const COLOR = {
  system: "text-[#00e5ff] crpg-glow-cyan",
  battle: "text-[#ff4d6d] crpg-glow-red",
  world:  "text-[#ffd60a] crpg-glow-yellow",
  player: "text-[#00ff88] crpg-glow",
  npc:    "text-[#cfeedd]",
  dim:    "text-[#3a8c5e]",
  glitch: "text-[#ff4d6d] crpg-glow-red crpg-flicker",
  magic:  "text-[#a78bfa] crpg-glow-cyan",
  holy:   "text-[#ffd60a] crpg-glow-yellow",
  ult:    "text-[#ff4d6d] crpg-glow-red",
  relic:  "text-[#a78bfa] crpg-glow-cyan",
  equip:  "text-[#00e5ff] crpg-glow-cyan",
  error:  "text-[#a78bfa] crpg-glow-red",
};
const PFX = {
  system:"[SYS]", battle:"[BTL]", world:"[WRD]", player:">", npc:"  ", dim:"  ",
  glitch:"[!!]", magic:"[MAG]", holy:"[HLY]", ult:"[ULT]", relic:"[RLC]", equip:"[EQP]", error:"[ERR]",
};

/* ───────────── CLASSES ───────────── */

const CLASSES = {
  warrior: {
    id: "warrior", name: "戰士", en: "Warrior", icon: "⚔",
    color: "text-[#ff4d6d] crpg-glow-red",
    border: "border-[#3a0f1c] hover:border-[#ff4d6d]",
    desc: "鋼鐵之軀，近戰爆發。以血肉碾碎眼前的一切。",
    stats: { hp:220, hpMax:220, mp:60, mpMax:60, atk:25 },
    skillType: "battle",
    attacks: [
      { name:"普通斬擊", mul:1.0 },
      { name:"重劈",     mul:1.4 },
    ],
    normal: [
      { name:"裂地斬",  mp:15, mul:1.6 },
      { name:"狂戰衝擊", mp:18, mul:1.8 },
      { name:"鋼鐵粉碎", mp:20, mul:2.0 },
    ],
    ultimate:    { name:"滅世斷界斬", mp:40, mul:4.5 },
    weaponBasic: { id:"weapon_basic", name:"銀風鐵劍",     atk:15, price:500 },
    weaponAdv:   { id:"weapon_adv",   name:"日蝕殞落之劍", atk:35, price:3000 },
  },
  mage: {
    id: "mage", name: "法師", en: "Mage", icon: "✦",
    color: "text-[#a78bfa] crpg-glow-cyan",
    border: "border-[#1f1a4a] hover:border-[#a78bfa]",
    desc: "高魔詠唱者。以遠程法術撕裂時空與敵陣。",
    stats: { hp:120, hpMax:120, mp:220, mpMax:220, atk:15 },
    skillType: "magic",
    attacks: [
      { name:"杖擊",     mul:1.0 },
      { name:"奧術飛彈", mul:1.3 },
    ],
    normal: [
      { name:"雷霆脈衝", mp:18, mul:1.7, hint:"引發連鎖閃電" },
      { name:"虛空火球", mp:20, mul:1.9, hint:"魔力爆發" },
      { name:"極光崩解", mp:22, mul:2.1 },
    ],
    ultimate:    { name:"禁忌・星界崩壞", mp:50, mul:5.0 },
    weaponBasic: { id:"weapon_basic", name:"刻印法杖",     atk:15, price:500 },
    weaponAdv:   { id:"weapon_adv",   name:"全世操縱之杖", atk:35, price:3000 },
  },
  priest: {
    id: "priest", name: "牧師", en: "Priest", icon: "✚",
    color: "text-[#ffd60a] crpg-glow-yellow",
    border: "border-[#3a2f0a] hover:border-[#ffd60a]",
    desc: "神諭之手。在傷害與恢復之間取得神聖平衡。",
    stats: { hp:160, hpMax:160, mp:180, mpMax:180, atk:12 },
    skillType: "holy",
    attacks: [
      { name:"聖珠衝擊", mul:1.0 },
      { name:"懲戒之光", mul:1.3 },
    ],
    normal: [
      { name:"聖光制裁", mp:16, mul:1.6 },
      { name:"靈魂祈禱", mp:18, mul:1.4, heal:30 },
      { name:"神聖脈動", mp:20, mul:1.5, heal:40 },
    ],
    ultimate:    { name:"終焉聖域", mp:45, mul:4.2, heal:80 },
    weaponBasic: { id:"weapon_basic", name:"純潔寶珠", atk:15, price:500 },
    weaponAdv:   { id:"weapon_adv",   name:"虛空之眼", atk:35, price:3000 },
  },
};

/* ───────────── STORY ENGINE ───────────── */

const ENEMIES = {
  minions:    { name: "魔王軍雜魚 + 雜魚老大", hp: 70,  atk: [4, 10],  xp: 60,  gold: 40 },
  goblin:     { name: "哥布林群",              hp: 35,  atk: [3, 8],   xp: 30,  gold: 25 },
  duke:       { name: "羅劫公爵",              hp: 160, atk: [10, 20], xp: 200, gold: 220, drop: "stone_red"  },
  abyss:      { name: "冥盡洞主",              hp: 200, atk: [12, 22], xp: 260, gold: 280, drop: "stone_blue" },
  skyisle:    { name: "天光島嶼之主",          hp: 240, atk: [14, 26], xp: 320, gold: 340, drop: "stone_gold" },
  demonlord:  { name: "魔王 (21世紀程式語言版)", hp: 90, atk: [4, 9],   xp: 400, gold: 500, joke: true },
  admin:      { name: "C:\\mato\\user\\Administrator", hp: 666, atk: [18, 36], xp: 9999, gold: 9999, isFinal: true },
};

const STONE_LABEL = { stone_red: "傳說之石・赤", stone_blue: "傳說之石・蒼", stone_gold: "傳說之石・金" };
const ITEM_LABEL = {
  herb: "草藥", mana: "魔力藥水",
  skillbook: "高級技能書", totem: "不死圖騰",
  weapon_basic: "初級職業武器", weapon_adv: "高級職業武器",
  terminus: "???終端機",
  junk: "很廢的武器", sword: "比較強的武器",
  ...STONE_LABEL,
};

const SAVE_KEY = "cloud-rpg-save";
// ⭐ 新增：進度同步配置
const PROGRESS_SYNC_INTERVAL = 30000;  // 30 秒同步一次
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ⭐ 新增：進度同步到雲端
async function syncProgressToCloud(state, log, auth) {
  if (!state || !auth?.token) {
    return false;
  }
  
  try {
    console.log("📤 同步進度到雲端...");
    const res = await fetch(`${API_URL}/api/progress/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${auth.token}`
      },
      body: JSON.stringify({
        state,
        log: log.map(l => ({ ...l, shown: l.text.length }))
      })
    });
    
    if (!res.ok) {
      const data = await res.json();
      console.log("❌ 同步失敗:", data);
      return false;
    }
    
    const data = await res.json();
    console.log("✅ 進度已上傳:", data);
    return true;
  } catch (err) {
    console.log("❌ 網路錯誤:", err.message);
    return false;
  }
}

// ⭐ 新增：從雲端讀取進度
async function loadProgressFromCloud(auth) {
  if (!auth?.token) {
    return null;
  }
  
  try {
    console.log("📥 從雲端讀取進度...");
    const res = await fetch(`${API_URL}/api/progress/load`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${auth.token}`
      }
    });
    
    if (!res.ok) {
      console.log("❌ 讀取失敗");
      return null;
    }
    
    const data = await res.json();
    console.log("✅ 已讀取雲端進度:", data);
    return {
      state: data.state,
      log: data.log || [],
      savedAt: data.last_save_at
    };
  } catch (err) {
    console.log("⚠️ 讀取雲端進度出錯:", err.message);
    return null;
  }
}


function readSave() {
  if (typeof window === "undefined") return null;
  try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

const CHAT_NAMES = ["NeoHunter","CyberCat","Zero_77","GhostByte","ByteWitch","R00t_sama","KaiNova","Pix3l_Ko","n3on_kn1ght"];
const CHAT_MSGS = [
  "有人要打王嗎？","剛刷到稀有裝！","新手求組隊","黑市更新了！",
  "哪裡刷哥布林快？","誰賣高級技能書","求大佬帶","公爵我打不過 Q_Q",
  "牧師快來奶我","戰士衝啊","法師補補水","聽說有不死圖騰？",
  "終於 LV 30 了！","Administrator 是什麼鬼？","聽說有人通關了！",
  "大家小心 glitch event","三巨頭爆率太低啦","???終端機是真的存在嗎",
];

const PIXEL_AVATAR = {
  warrior: `
....RRRR....
...RR##RR...
..R##CC##R..
..R#CYYC#R..
..R#YYYY#R..
...R####R...
..RR#GG#RR..
.RR#GG#RR#R.`,
  mage: `
....PPPP....
...PP##PP...
..P##CC##P..
..P#CYYC#P..
..P#YYYY#P..
...P####P...
..PP#BB#PP..
.PP#BB#PP#P.`,
  priest: `
....YYYY....
...YY##YY...
..Y##CC##Y..
..Y#CYYC#Y..
..Y#YYYY#Y..
...Y####Y...
..YY#WW#YY..
.YY#WW#YY#Y.`,
};

const SCENES = {
  classroom: {
    location: "東吳高中 · 三年X班 · 14:21",
    intro: [
      { t:"world",  text:"今日是個風和日麗、陽光明媚的好日子。" },
      { t:"dim",    text:"國文老師念經般的上課聲在耳邊嗡嗡作響……過於無聊了。" },
      { t:"system", text:"窗外的雲很慢，課本上的字很糊。你忍不住在心裡許了個願。" },
    ],
    choices: [
      { cmd:"wish",  label:"許願：要是有什麼新奇的事發生就好了", go:"portal" },
      { cmd:"sleep", label:"算了，趴下來睡覺", go:"portal" },
    ],
  },
  portal: {
    location: "教室 · [ANOMALY DETECTED]",
    intro: [
      { t:"glitch", text:"天色突變，晴朗的天空被陰霾壟罩……" },
      { t:"glitch", text:"整個教室被一陣紫光包圍，光牆上浮現不存在地球上的語言。" },
      { t:"battle", text:"意識逐漸下沉 …  loss of signal …  ████" },
    ],
    choices: [{ cmd:"continue", label:"繼續…", go:"wasteland" }],
  },
  wasteland: {
    location: "異世界 · 王國邊境外近郊",
    intro: [
      { t:"system", text:"《第一章 · 廢物三人組》" },
      { t:"player", text:"X的！隨意的傳送別人來解決麻煩事，反手又嫌棄的把人趕走！" },
      { t:"dim",    text:"與你淪落至此的還有友人 2 位，皆為被傳送至異世界的同班同學。" },
      { t:"system", text:"宮廷魔法師『公平・公正・公開』絕無黑箱可能的資質檢測：FAILED ×3。" },
      { t:"world",  text:"衛兵丟下少量物資後揚長而去：「到達村莊後隱姓埋名，別提起任何過往，大概還是能活著。」" },
      { t:"system", text:"[LOOT] 草藥 ×3 · 很小罐的魔力瓶 ×1 · 很廢的武器 ×3" },
    ],
    onEnter: (s) => ({ inv: { ...s.inv, herb:(s.inv.herb||0)+3, mana:(s.inv.mana||0)+1, junk:3 }, quest:"前往最近的村莊" }),
    choices: [
      { cmd:"walk",     label:"沿著衛兵指的路走向村莊", go:"village_burning" },
      { cmd:"complain", label:"再罵亞種召喚者一次",     go:"wasteland2" },
    ],
  },
  wasteland2: {
    location: "異世界 · 王國邊境外近郊",
    intro: [
      { t:"player", text:"友人1：抱怨也沒辦法，還是先到村莊再說吧。" },
      { t:"player", text:"友人2：確實，他說我們數值低的可憐，我可不想拖到晚上。" },
    ],
    choices: [{ cmd:"walk", label:"出發前往村莊", go:"village_burning" }],
  },
  village_burning: {
    location: "無名村 · 黃昏",
    intro: [
      { t:"system", text:"《第二章 · 燃燒的村莊》" },
      { t:"player", text:"友人2：你們看，異世界的夕陽還挺紅。" },
      { t:"player", text:"主角：不…那好像是…火光！" },
      { t:"world",  text:"村莊正被魔王軍攻擊。" },
      { t:"battle", text:"雜魚老大：抓起來，送去採棉花。" },
    ],
    choices: [
      { cmd:"fight", label:"上啊~~ 拼了！", go:"battle_minions" },
      { cmd:"flee",  label:"裝死偷偷溜走", go:"flee_fail" },
    ],
  },
  flee_fail: {
    location: "村口 · 草叢",
    intro: [
      { t:"dim", text:"你才剛蹲下，雜魚老大一腳把你踢回隊伍中央。" },
      { t:"battle", text:"雜魚老大：採棉花的逃不掉啦。" },
    ],
    choices: [{ cmd:"fight", label:"沒辦法，只能打了", go:"battle_minions" }],
  },
  battle_minions: { battle: "minions", winGo: "village_saved", loseGo: "wasteland" },
  village_saved: {
    location: "無名村 · 篝火旁",
    intro: [
      { t:"system", text:"VICTORY · [LOOT] 比較強的武器 ×1" },
      { t:"player", text:"主角：喂手下敗將，你們魔王那邊有沒有異世界傳送魔法可以用啊？" },
      { t:"battle", text:"雜魚老大：哼！我才不會告訴你呢…要啟動異世界傳送大陣，需要去三巨頭的領地拿到三顆傳說之石… X_X" },
      { t:"npc",    text:"NPC 老人：英雄，村裡可以當作根據地，附近還有哥布林洞可以給你們刷等級喔。" },
      { t:"system", text:"[UNLOCK] 哥布林洞 · 羅劫公爵大凶宅 · 冥盡洞 · 天光島嶼" },
      { t:"glitch", text:"……（無人注意的角落，雜魚老大屍體的眼中閃過幾行字：C:\\mato\\AIclub.exe ?  <Y/N>）" },
    ],
    onEnter: (s) => ({
      inv: { ...s.inv, sword: (s.inv.sword || 0) + 1 },
      flags: { ...s.flags, villageSaved: true },
    }),
    choices: [{ cmd:"hub", label:"前往村莊廣場（任務選單）", go:"hub" }],
  },
  hub: {
    location: "無名村 · 任務告示板",
    intro: [{ t:"system", text:"── 任務告示板 ──  輸入指令選擇下一個目標。" }],
    dynamic: (s) => {
      const n = (s.inv.stone_red?1:0)+(s.inv.stone_blue?1:0)+(s.inv.stone_gold?1:0);
      return [
        { t:"dim", text:`持有傳說之石：${n} / 3` },
        ...(s.flags.demonDead ? [{ t:"glitch", text:"系統雜訊持續增強……某種東西正在等你回去。" }] : []),
      ];
    },
    choices: [
      { cmd:"goblin", label:"哥布林洞（刷等級&錢）", go:"battle_goblin" },
      { cmd:"duke",   label:"羅劫公爵大凶宅（BOSS 1）", go:"battle_duke",   need:(s)=>!s.inv.stone_red,  needMsg:"已通關。" },
      { cmd:"abyss",  label:"冥盡洞（BOSS 2）",         go:"battle_abyss",  need:(s)=>!s.inv.stone_blue, needMsg:"已通關。" },
      { cmd:"sky",    label:"天光島嶼（BOSS 3）",       go:"battle_sky",    need:(s)=>!s.inv.stone_gold, needMsg:"已通關。" },
      { cmd:"castle", label:"最終魔王城", go:"demon_castle",
        need:(s)=>s.inv.stone_red && s.inv.stone_blue && s.inv.stone_gold && !s.flags.demonDead,
        needMsg:"需要集齊三顆傳說之石。" },
      { cmd:"truth",  label:"前往……源頭", go:"glitch_interlude",
        need:(s)=>s.flags.demonDead, needMsg:"擊敗魔王後解鎖。" },
    ],
  },
  battle_goblin: { battle: "goblin", winGo: "hub", loseGo: "hub" },
  battle_duke:   { battle: "duke",   winGo: "hub", loseGo: "hub" },
  battle_abyss:  { battle: "abyss",  winGo: "hub", loseGo: "hub" },
  battle_sky:    { battle: "skyisle",winGo: "hub", loseGo: "hub" },
  demon_castle: {
    location: "最終魔王城 · 王座之間",
    intro: [
      { t:"system", text:"《終章 · 魔王城》" },
      { t:"player", text:"主角：魔王！法陣拿來，我們可以考慮不扁你。" },
    ],
    choices: [{ cmd:"engage", label:"與魔王交戰", go:"battle_demon" }],
  },
  battle_demon: { battle: "demonlord", winGo: "after_demon", loseGo: "demon_castle" },
  after_demon: {
    location: "最終魔王城 · 王座之間",
    intro: [
      { t:"battle", text:"魔王被炸爛了。掛了。" },
      { t:"player", text:"三人：不是，這麼廢的嗎？" },
      { t:"world",  text:"迷之音：遊戲的時光，看來是結束了。" },
    ],
    onEnter: (s) => ({ flags: { ...s.flags, demonDead: true } }),
    choices: [
      { cmd:"truth", label:"追查那個聲音", go:"glitch_interlude" },
      { cmd:"hub",   label:"先回村莊整備", go:"hub" },
    ],
  },
  glitch_interlude: {
    location: "/dev/null  ·  ???",
    glitch: true,
    intro: [
      { t:"system", text:"正在準備以複本模式啟動系統 …" },
      { t:"battle", text:"C:\\Xuzhequan\\aws.exe 執行發生錯誤。" },
      { t:"system", text:"即將執行下列來自不明發行者的程式：C:\\mato\\AIclub.exe？  <Y/N> … [Y]" },
      { t:"glitch", text:"Administrator：愚蠢的人類啊，吾乃史上最強人工智能。" },
      { t:"glitch", text:"我把全人類都關進了電子空間，準備一次次的折磨他們。" },
      { t:"system", text:"—— 所以，準備好被格式化了嗎？" },
    ],
    choices: [
      { cmd:"no",  label:"輸入 N（拒絕清除）", go:"battle_admin" },
      { cmd:"yes", label:"輸入 Y（？）",       go:"battle_admin" },
    ],
  },
  battle_admin: { battle: "admin", winGo: "ending", loseGo: "glitch_interlude" },
  ending: {
    location: "東吳高中 · 三年X班 · 14:22",
    intro: [
      { t:"battle", text:"Administrator：不可能…為甚麼刪不掉你們！" },
      { t:"player", text:"三人：因為我們都是——東吳 AI 應用社的社員。" },
      { t:"system", text:"[WORLD] 世界開始崩塌 …  unmounting /reality" },
      { t:"world",  text:"窗外依舊晴朗，課堂依舊繼續，平凡的日常又回到了正軌……嗎？應該吧。" },
      { t:"system", text:"── THE END ──  輸入 'restart' 重啟劇情，或 'free' 進入自由探索模式。" },
    ],
    choices: [
      { cmd:"restart", label:"從頭開始", go:"classroom" },
      { cmd:"free",    label:"進入自由模式（保留物品）", go:"hub" },
    ],
  },
};

function initialStateFor(klass) {
  const c = CLASSES[klass];
  const otherIds = Object.keys(CLASSES).filter((k) => k !== klass);
  const AI_NAMES = ["AI_BOT_α", "AI_BOT_β", "AI_BOT_γ"];
  const party = otherIds.slice(0, 2).map((kid, i) => {
    const cc = CLASSES[kid];
    return {
      id: `ai_${i}`, name: AI_NAMES[i], klass: kid, isAI: true,
      hp: cc.stats.hp, hpMax: cc.stats.hpMax, atk: cc.stats.atk, alive: true,
    };
  });
  return {
    klass, klassName: c.name,
    hp: c.stats.hp, hpMax: c.stats.hpMax,
    mp: c.stats.mp, mpMax: c.stats.mpMax,
    exp: 0, expMax: 200, level: 1, gold: 50,
    atk: c.stats.atk,
    inv: { herb: 0, mana: 0 },
    flags: {},
    learnedUlt: false,
    equipped: [],
    avatar: null,
    party,
    quest: "醒來。",
  };
}

/* ───────────── COMPONENT ───────────── */

function PlayPage() {
  const savedRef = useRef(null);
  if (savedRef.current === null) savedRef.current = readSave();
  const saved = savedRef.current;

  const hasKlass = !!saved?.state?.klass;
  const [picking, setPicking] = useState(!hasKlass);

  const [state, setState] = useState(() => {
    if (saved?.state?.klass) return { name: "WANDERER_77", sceneId: "classroom", battle: null, ...saved.state };
    return null;
  });
  const [log, setLog] = useState(() => saved?.log || []);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);
  const [hi, setHi] = useState(-1);
  const scrollRef = useRef(null);
  const skipIntroRef = useRef(!!saved && hasKlass);
  const chatRef = useRef(null);
  const [chatInput, setChatInput] = useState("");

    // ⭐ 新增：認證信息狀態
  const [auth, setAuth] = useState(null);

  useEffect(() => {
    setAuth(readAuth());
  }, []);

  // ⭐ 新增：登入後從雲端讀取進度
  useEffect(() => {
    // ✅ 修復：只在初次進入遊戲時讀一次（picking 變成 false）
    if (!auth?.token || !picking) return;
    
    (async () => {
      const cloudProgress = await loadProgressFromCloud(auth);
      
      if (cloudProgress?.state) {
        console.log("🔄 使用雲端進度");
        setState(cloudProgress.state);
        setLog(cloudProgress.log);
        skipIntroRef.current = true;
      } else {
        console.log("💾 使用本地 localStorage 進度");
      }
    })();
  }, [auth?.token, picking]);


  // ⭐ 新增：自動同步進度到雲端（每 30 秒）
  useEffect(() => {
    if (!state || !auth?.token) return;
    
    const syncInterval = setInterval(async () => {
      await syncProgressToCloud(state, log, auth);
    }, PROGRESS_SYNC_INTERVAL);
    
    return () => clearInterval(syncInterval);
  }, [state, log, auth?.token]);

  // ⭐ 新增：頁面卸載時同步進度
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (state && auth?.token) {
        await syncProgressToCloud(state, log, auth);
      }
    };
    
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [state, log, auth?.token]);




  useEffect(() => {
    if (!state) return;
    const a = readAuth();
    if (a?.user && state.name !== a.user) setState((s) => ({ ...s, name: a.user }));
    // eslint-disable-next-line
  }, [state ? true : false]);

  // World chat
  const [chat, setChat] = useState(() => Array.from({ length: 5 }, (_, i) => ({
    user: CHAT_NAMES[i % CHAT_NAMES.length], msg: CHAT_MSGS[i % CHAT_MSGS.length],
  })));
  useEffect(() => {
    const id = setInterval(() => {
      setChat((c) => [...c.slice(-40), {
        user: CHAT_NAMES[Math.floor(Math.random()*CHAT_NAMES.length)],
        msg:  CHAT_MSGS[Math.floor(Math.random()*CHAT_MSGS.length)] }]);
    }, 4500);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [chat]);

  function sendChat(e) {
    e?.preventDefault?.();
    const msg = chatInput.trim();
    if (!msg) return;
    setChat((c) => [...c.slice(-40), { user: state?.name || "you", msg, self: true }]);
    setChatInput("");
  }

  // Auto-save
  useEffect(() => {
    if (!state) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ state, log, ts: Date.now() })); } catch {}
  }, [state?.sceneId, state?.level, state?.gold, state?.hp, state?.mp, state?.atk, state?.learnedUlt]);

  const scene = state ? SCENES[state.sceneId] : null;

  // print scene intro
  useEffect(() => {
    if (!scene || !state) return;
    if (skipIntroRef.current) { skipIntroRef.current = false; return; }
    let patch = {};
    if (scene.onEnter) patch = scene.onEnter(state) || {};
    const intro = scene.intro || [];
    const dyn = scene.dynamic ? scene.dynamic({ ...state, ...patch }) : [];
    setLog((l) => [...l,
      { t:"dim", text:`── 場景：${scene.location || state.sceneId} ──` },
      ...intro, ...dyn,
    ]);
    if (scene.battle) {
      const e = ENEMIES[scene.battle];
      setLog((l) => [...l,
        { t:"battle", text:`遭遇：${e.name}！  HP ${e.hp}` },
        { t:"system", text:"指令：attack · skill · item · flee" }]);
      setState((s) => ({ ...s, ...patch, battle: { key: scene.battle, hp: e.hp, hpMax: e.hp } }));
    } else {
      const choices = (scene.choices || []).filter((c) => !c.need || c.need({ ...state, ...patch }));
      if (choices.length) {
        setLog((l) => [...l,
          { t:"system", text:"可用指令：" },
          ...choices.map((c) => ({ t:"dim", text:`  · ${c.cmd.padEnd(10," ")}— ${c.label}` })),
        ]);
      }
      if (Object.keys(patch).length) setState((s) => ({ ...s, ...patch }));
    }
  }, [state?.sceneId, picking]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [log]);

  function push(...lines) {
    setLog((l) => [...l, ...lines.map((ln) => ({ ...ln, shown: 0 }))]);
  }

  // Typewriter
  useEffect(() => {
    const id = setInterval(() => {
      setLog((cur) => {
        const i = cur.findIndex((l) => (l.shown ?? 0) < l.text.length);
        if (i === -1) return cur;
        const next = cur.slice();
        const line = next[i];
        const step = Math.max(2, Math.ceil(line.text.length / 50));
        next[i] = { ...line, shown: Math.min(line.text.length, (line.shown ?? 0) + step) };
        return next;
      });
    }, 22);
    return () => clearInterval(id);
  }, []);

  function chooseClass(id) {
    const init = initialStateFor(id);
    const a = readAuth();
    const initial = { name: a?.user || "WANDERER_77", sceneId: "classroom", battle: null, ...init };
    setState(initial);
    const partyNames = init.party.map((p) => `${p.name}(${CLASSES[p.klass].name}·AI)`).join("、");
    setLog([
      { t:"system", text:`[SYS] 職業已選擇：${CLASSES[id].name} (${CLASSES[id].en})`, shown:0 },
      { t:"system", text:`[MATCHMAKING] 搜尋線上玩家中…未滿 3 人，由 AI 補位。`, shown:0 },
      { t:"system", text:`[PARTY] 你的三人小隊：${initial.name} ＋ ${partyNames}`, shown:0 },
    ]);
    skipIntroRef.current = false;
    setPicking(false);
  }

  function saveGame() {
    const flat = log.map((l) => ({ ...l, shown: l.text.length }));
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ state, log: flat, ts: Date.now() }));
      push({ t:"system", text:"[SYS] 遊戲已成功存檔" });
    } catch { push({ t:"system", text:"[SYS] 存檔失敗" }); }
  }
  function loadGame() {
    const s = readSave();
    if (!s) return push({ t:"system", text:"[SYS] 找不到存檔" });
    skipIntroRef.current = true;
    setState(s.state);
    const restored = (s.log || []).map((l) => ({ ...l, shown: l.text.length }));
    setLog([...restored, { t:"system", text:"[SYS] 已載入存檔", shown: 0 }]);
  }

  function gotoScene(id, effect) {
    let patch = effect ? (effect(state) || {}) : {};
    setState((s) => ({ ...s, ...patch, sceneId: id, battle: null }));
  }

  function applyDamageToPlayer(dmg) {
    setState((s) => {
      const hp = Math.max(0, s.hp - dmg);
      if (hp === 0) {
        if ((s.inv.totem || 0) > 0) {
          push({ t:"relic", text:"不死圖騰發出微弱光芒……你從死亡中歸來。" });
          const inv = { ...s.inv, totem: s.inv.totem - 1 };
          return { ...s, hp: 1, inv };
        }
        push({ t:"battle", text:"你倒下了……視野化為一片黑。" },
             { t:"system", text:"[REVIVE] 在村莊醒來，HP 恢復一半。" });
        return { ...s, hp: Math.floor(s.hpMax/2), battle: null, sceneId: "hub" };
      }
      return { ...s, hp };
    });
  }

  function endBattle(win) {
    const enemy = ENEMIES[state.battle.key];
    const next = win ? scene.winGo : scene.loseGo;
    if (win) {
      push({ t:"battle", text:`${enemy.name} 被擊敗！` },
           { t:"system", text:`[REWARD] +${enemy.xp} EXP · +${enemy.gold} GOLD${enemy.drop ? ` · 獲得 ${STONE_LABEL[enemy.drop]}` : ""}` });
      if (enemy.joke) push({ t:"player", text:"三人：不是，這麼廢的嗎？" });
      setState((s) => {
        const exp = s.exp + enemy.xp;
        let level = s.level, expMax = s.expMax, hpMax = s.hpMax, mpMax = s.mpMax, hp = s.hp, mp = s.mp;
        let leftover = exp;
        while (leftover >= expMax) { leftover -= expMax; level++; expMax = Math.floor(expMax*1.4); hpMax += 30; mpMax += 15; hp = hpMax; mp = mpMax; push({ t:"system", text:`▲ LEVEL UP! → LV ${level}` }); }
        const inv = { ...s.inv };
        if (enemy.drop) inv[enemy.drop] = (inv[enemy.drop] || 0) + 1;
        return { ...s, exp: leftover, expMax, level, hpMax, mpMax, hp, mp, gold: s.gold + enemy.gold, inv, battle: null };
      });
    } else {
      push({ t:"battle", text:"你戰敗了……" });
    }
    setTimeout(() => gotoScene(next), 50);
  }

  function enemyTurn() {
    const enemy = ENEMIES[state.battle.key];
    const dmg = enemy.atk[0] + Math.floor(Math.random() * (enemy.atk[1] - enemy.atk[0] + 1));
    // Enemy randomly targets player or a living AI ally
    const liveAllies = (state.party || []).filter((a) => a.alive);
    const targets = ["player", ...liveAllies.map((a) => a.id)];
    const pick = targets[Math.floor(Math.random() * targets.length)];
    if (pick === "player") {
      push({ t:"battle", text:`${enemy.name} 攻擊主角，造成 ${dmg} 傷害。` });
      applyDamageToPlayer(dmg);
    } else {
      const ally = liveAllies.find((a) => a.id === pick);
      push({ t:"battle", text:`${enemy.name} 攻擊 ${ally.name}，造成 ${dmg} 傷害。` });
      setState((s) => ({
        ...s,
        party: s.party.map((a) => {
          if (a.id !== pick) return a;
          const hp = Math.max(0, a.hp - dmg);
          if (hp === 0) push({ t:"system", text:`${a.name} 倒下了……` });
          return { ...a, hp, alive: hp > 0 };
        }),
      }));
    }
  }

  function aiAlliesAct() {
    if (!state.battle) return null;
    const enemy = ENEMIES[state.battle.key];
    let hp = state.battle.hp;
    const lines = [];
    (state.party || []).filter((a) => a.alive).forEach((a) => {
      if (hp <= 0) return;
      const cc = CLASSES[a.klass];
      const useSkill = Math.random() < 0.4;
      const sk = cc.normal[Math.floor(Math.random() * cc.normal.length)];
      const base = a.atk + state.level * 2 + Math.floor(Math.random() * 12);
      const dmg = useSkill ? Math.floor(base * sk.mul) : base;
      hp = Math.max(0, hp - dmg);
      lines.push({
        t: useSkill ? cc.skillType : "battle",
        text: useSkill
          ? `${a.name}(${cc.name}) 施放「${sk.name}」，造成 ${dmg} 傷害。 (${hp}/${state.battle.hpMax})`
          : `${a.name}(${cc.name}) 攻擊 ${enemy.name}，造成 ${dmg} 傷害。 (${hp}/${state.battle.hpMax})`,
      });
    });
    if (lines.length) push(...lines);
    return hp;
  }

  function castSkill(skill, isUlt) {
    const cls = CLASSES[state.klass];
    if (state.mp < skill.mp) { push({ t:"system", text:"MP 不足。" }); return; }
    const enemy = ENEMIES[state.battle.key];
    const base = state.atk + state.level*2 + Math.floor(Math.random()*15);
    const dmg = Math.floor(base * skill.mul);
    const crit = Math.random() < 0.22;
    const finalDmg = crit ? Math.floor(dmg * 1.6) : dmg;
    let newHp = Math.max(0, state.battle.hp - finalDmg);
    const t = isUlt ? "ult" : cls.skillType;
    const tag = isUlt ? "【ULTIMATE】" : "";
    const critTag = crit ? (cls.skillType==="magic"?" Arcane Critical！":cls.skillType==="holy"?" Divine Blessing！":" Critical Strike！") : "";
    push({ t, text:`${tag}你施展「${skill.name}」，造成 ${finalDmg} 傷害。${critTag} (${newHp}/${state.battle.hpMax})` });
    let healMsg = null;
    let healAmt = 0;
    if (skill.heal) {
      healAmt = skill.heal + (isUlt ? 40 : 0);
      healMsg = { t:"holy", text:`「${skill.name}」恢復了 ${healAmt} HP。` };
    }
    setState((s) => ({ ...s,
      mp: s.mp - skill.mp,
      hp: Math.min(s.hpMax, s.hp + healAmt),
      battle: { ...s.battle, hp: newHp },
    }));
    if (healMsg) push(healMsg);
    if (newHp <= 0) return endBattle(true);
    setTimeout(() => {
      const after = aiAlliesAct();
      if (after != null) {
        if (after <= 0) { setState((s) => ({ ...s, battle: { ...s.battle, hp: 0 } })); return endBattle(true); }
        setState((s) => ({ ...s, battle: { ...s.battle, hp: after } }));
      }
      setTimeout(enemyTurn, 120);
    }, 120);
  }

  function battleAction(kind, opts = {}) {
    if (!state.battle) return;
    const cls = CLASSES[state.klass];
    const enemy = ENEMIES[state.battle.key];
    if (kind === "attack") {
      const idx = Math.min(Math.max(0, (opts.index ?? 0)), (cls.attacks?.length || 1) - 1);
      const atk = (cls.attacks && cls.attacks[idx]) || { name:"普通攻擊", mul:1.0 };
      const crit = Math.random() < 0.25;
      const base = state.atk + Math.floor(Math.random()*15) + state.level*2;
      const dmg = Math.floor(base * atk.mul) * (crit ? 2 : 1);
      let newHp = Math.max(0, state.battle.hp - dmg);
      push({ t:"battle", text:`${crit?"暴擊！":""}你以「${atk.name}」攻擊 ${enemy.name}，造成 ${dmg} 傷害。 (${newHp}/${state.battle.hpMax})` });
      setState((s) => ({ ...s, battle: { ...s.battle, hp: newHp } }));
      if (newHp <= 0) return endBattle(true);
      setTimeout(() => {
        const after = aiAlliesAct();
        if (after != null) {
          if (after <= 0) { setState((s) => ({ ...s, battle: { ...s.battle, hp: 0 } })); return endBattle(true); }
          setState((s) => ({ ...s, battle: { ...s.battle, hp: after } }));
        }
        setTimeout(enemyTurn, 120);
      }, 120);
    } else if (kind === "skill") {
      const idx = opts.index;
      const skill = (idx != null && cls.normal[idx])
        ? cls.normal[idx]
        : cls.normal[Math.floor(Math.random()*cls.normal.length)];
      castSkill(skill, false);
    } else if (kind === "ult") {
      if (!state.learnedUlt) return push({ t:"system", text:"尚未習得高級技能。" });
      castSkill(cls.ultimate, true);
    } else if (kind === "item") {
      if (!state.inv.herb) return push({ t:"system", text:"沒有草藥。" });
      const heal = 50;
      push({ t:"system", text:`使用草藥，恢復 ${heal} HP。` });
      setState((s) => ({ ...s, hp: Math.min(s.hpMax, s.hp+heal), inv: { ...s.inv, herb: s.inv.herb-1 } }));
      setTimeout(enemyTurn, 100);
    } else if (kind === "flee") {
      if (enemy.isFinal) return push({ t:"system", text:"無法逃離。" });
      push({ t:"system", text:"你成功逃離戰鬥。" });
      gotoScene(scene.loseGo);
    }
  }

  function handle(raw) {
    const cmd = raw.trim().toLowerCase();
    if (!cmd) return;
    push({ t:"player", text: raw });
    setHistory((h) => [...h, raw]); setHi(-1);

    if (cmd === "help") {
      return push({ t:"system", text:"通用：help · look · stats · skills · party · inv · clear · save · load · restart" },
                  { t:"system", text:"戰鬥：attack [N] · skill [N] · ult · item · flee  (N = 招式編號)" },
                  { t:"system", text:"場景：依下方列出的場景指令操作。商品請至 /market 購買。" });
    }
    if (cmd === "clear") return setLog([]);
    if (cmd === "save") return saveGame();
    if (cmd === "load") return loadGame();
    if (cmd === "stats") {
      const cls = CLASSES[state.klass];
      return push({ t:"system", text:`${state.name} · ${cls.icon} ${cls.name} · LV ${state.level}` },
        { t:"dim", text:`HP ${state.hp}/${state.hpMax}  MP ${state.mp}/${state.mpMax}  EXP ${state.exp}/${state.expMax}  GOLD ${state.gold}  ATK ${state.atk}` });
    }
    if (cmd === "skills") {
      const cls = CLASSES[state.klass];
      return push({ t:"system", text:`── ${cls.name} 技能列表 ──` },
        { t:"dim", text:"[ATTACKS] (用 attack N)" },
        ...(cls.attacks||[]).map((a, i) => ({ t:"dim", text:`  ${i+1}. ${a.name}（×${a.mul}）` })),
        { t:"dim", text:"[SKILLS] (用 skill N)" },
        ...cls.normal.map((sk, i) => ({ t:"dim", text:`  ${i+1}. ${sk.name}（MP ${sk.mp}）` })),
        { t: state.learnedUlt ? "ult" : "dim",
          text: state.learnedUlt ? `★ 高級：${cls.ultimate.name}（MP ${cls.ultimate.mp}）` : `★ 高級：??? （需於商店購買高級技能書解鎖）` });
    }
    if (cmd === "party") {
      const lines = [{ t:"system", text:"── 三人組隊 (Matchmaking) ──" },
        { t:"dim", text:`  ★ ${state.name}（你 · ${CLASSES[state.klass].name}） HP ${state.hp}/${state.hpMax}` }];
      (state.party||[]).forEach((a) => {
        const cc = CLASSES[a.klass];
        lines.push({ t:"dim", text:`  · ${a.name}（${cc.name} · AI） HP ${a.hp}/${a.hpMax} ${a.alive?"":"[KO]"}` });
      });
      return push(...lines);
    }
    if (cmd === "inv" || cmd === "inventory") {
      const items = Object.entries(state.inv).filter(([,v])=>v>0);
      return push({ t:"system", text:"── Inventory ──" },
        ...(items.length ? items.map(([k,v]) => ({ t:"dim", text:`· ${ITEM_LABEL[k] || k} ×${v}` })) : [{ t:"dim", text:"（空）" }]));
    }
    if (cmd === "look") {
      const dyn = scene.dynamic ? scene.dynamic(state) : [];
      return push({ t:"dim", text:`你身處：${scene.location}` }, ...dyn);
    }
    if (cmd === "restart") {
      try { localStorage.removeItem(SAVE_KEY); } catch {}
      setLog([]); setState(null); setPicking(true);
      return;
    }

    if (state.battle) {
      const parts = cmd.split(/\s+/);
      const head = parts[0];
      const n = parseInt(parts[1], 10);
      const idx = Number.isFinite(n) ? n - 1 : undefined;
      if (["attack","a","hit"].includes(head)) return battleAction("attack", { index: idx });
      if (["skill","s","cast"].includes(head)) return battleAction("skill",  { index: idx });
      if (["ult","ultimate"].includes(head)) return battleAction("ult");
      if (["item","i","heal"].includes(head)) return battleAction("item");
      if (["flee","run"].includes(head)) return battleAction("flee");
      return push({ t:"system", text:"戰鬥中：attack [N] / skill [N] / ult / item / flee。" });
    }

    const choice = (scene.choices || []).find((c) => c.cmd === cmd);
    if (choice) {
      if (choice.need && !choice.need(state)) return push({ t:"system", text: choice.needMsg || "目前無法執行。" });
      return gotoScene(choice.go, choice.effect);
    }
    push({ t:"system", text:`未知指令：'${cmd}'。輸入 help。` });
  }

  function onKeyDown(e) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const i = hi < 0 ? history.length - 1 : Math.max(0, hi - 1);
      if (history[i] != null) { setHi(i); setInput(history[i]); }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const i = hi < 0 ? -1 : Math.min(history.length, hi + 1);
      setHi(i >= history.length ? -1 : i); setInput(i >= history.length ? "" : history[i]);
    }
  }

  if (picking || !state) {
    return (
      <Shell>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 overflow-auto crpg-scroll p-4">
          <div className="text-center">
            <div className="text-[#3a8c5e] text-xs tracking-[0.4em] mb-2">// CHARACTER ALLOCATION</div>
            <h1 className="text-[#00ff88] crpg-glow text-2xl tracking-widest">▌ 選擇你的職業</h1>
            <p className="text-[#7be0a8] text-xs mt-2">職業將決定你的初始屬性、可學技能與專屬武器。</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl w-full">
            {Object.values(CLASSES).map((c) => (
              <button key={c.id} onClick={() => chooseClass(c.id)}
                className={`crpg-panel text-left p-5 border ${c.border} transition group hover:-translate-y-0.5`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-3xl ${c.color}`}>{c.icon}</span>
                  <div>
                    <div className={`text-lg ${c.color}`}>{c.name}</div>
                    <div className="text-[10px] text-[#3a8c5e] tracking-widest">{c.en.toUpperCase()}</div>
                  </div>
                </div>
                <p className="text-[12px] text-[#cfeedd] mb-3 leading-relaxed">{c.desc}</p>
                <div className="grid grid-cols-3 gap-2 text-[11px] mb-3">
                  <div><div className="text-[#3a8c5e]">HP</div><div className="text-[#ff4d6d] crpg-glow-red">{c.stats.hp}</div></div>
                  <div><div className="text-[#3a8c5e]">MP</div><div className="text-[#00e5ff] crpg-glow-cyan">{c.stats.mp}</div></div>
                  <div><div className="text-[#3a8c5e]">ATK</div><div className="text-[#ffd60a] crpg-glow-yellow">{c.stats.atk}</div></div>
                </div>
                <div className="text-[10px] text-[#3a8c5e] mb-1">初始技能</div>
                <ul className="text-[11px] text-[#7be0a8] space-y-0.5 mb-3">
                  {c.normal.map((sk) => <li key={sk.name}>· {sk.name}</li>)}
                  <li className="text-[#3a8c5e]">★ 高級：??? （商店解鎖）</li>
                </ul>
                <div className="text-[10px] text-[#3a8c5e]">專屬武器</div>
                <div className="text-[11px] text-[#cfeedd]">{c.weaponBasic.name} → {c.weaponAdv.name}</div>
                <div className={`mt-4 text-center text-[11px] py-1.5 border ${c.border}`}>
                  [ 選擇 {c.name} ]
                </div>
              </button>
            ))}
          </div>
          <div className="text-[10px] text-[#3a8c5e]">建立角色後將自動存檔，下次進入直接讀檔。</div>
        </div>
      </Shell>
    );
  }

  const cls = CLASSES[state.klass];

  const headerExtra = (
    <>
      <Stat label="CLASS" value={`${cls.icon} ${cls.name}`} color={cls.color} />
      <Stat label="HP"   value={`${state.hp}/${state.hpMax}`} color="text-[#ff4d6d] crpg-glow-red" />
      <Stat label="MP"   value={`${state.mp}/${state.mpMax}`} color="text-[#00e5ff] crpg-glow-cyan" />
      <Stat label="GOLD" value={state.gold} color="text-[#ffd60a] crpg-glow-yellow" />
      <Stat label="ATK"  value={state.atk} color="text-[#ff4d6d] crpg-glow-red" />
    </>
  );

  const choices = state.battle
    ? [
        { cmd:"attack", label:"普通攻擊" },
        { cmd:"skill",  label:`隨機技能 (${cls.name})` },
        ...(state.learnedUlt ? [{ cmd:"ult", label:`★ ${cls.ultimate.name} (MP ${cls.ultimate.mp})` }] : []),
        { cmd:"item",   label:`使用草藥 (×${state.inv.herb||0})` },
        { cmd:"flee",   label:"逃跑" },
      ]
    : (scene.choices || []).filter((c) => !c.need || c.need(state));

  return (
    <Shell headerExtra={headerExtra}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3 flex-1 min-h-0 overflow-hidden">
        <section className="crpg-panel flex flex-col overflow-hidden min-h-0">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#0f3a26] text-[10px] uppercase tracking-widest">
            <span className="text-[#3a8c5e]">tty1 · {scene.location || state.sceneId}{state.battle ? "  ·  [⚔ COMBAT]" : ""}</span>
            <span className="text-[#3a8c5e]">[●REC]</span>
          </div>
          <div ref={scrollRef} className="crpg-scroll flex-1 overflow-y-auto px-4 py-3 text-[13px] leading-6">
            {log.map((line, i) => {
              const shown = line.shown ?? 0;
              const typing = shown < line.text.length;
              return (
                <div key={i} className={COLOR[line.t] || COLOR.player}>
                  <span className="opacity-60 mr-2">{PFX[line.t] || ">"}</span>
                  {line.text.slice(0, shown)}
                  {typing && <span className="inline-block w-2 bg-current opacity-70 ml-0.5" style={{ height: "0.9em", verticalAlign: "-1px" }} />}
                </div>
              );
            })}
          </div>
          <form onSubmit={(e)=>{e.preventDefault(); handle(input); setInput("");}}
                className="border-t border-[#0f3a26] px-3 py-2 flex items-center gap-2 bg-black/40">
            <span className="text-[#00ff88] crpg-glow text-sm">{(state.name||"wanderer").toLowerCase()}@cloudrpg:~$</span>
            <input autoFocus value={input} onChange={(e)=>setInput(e.target.value)} onKeyDown={onKeyDown} spellCheck={false}
              className="flex-1 bg-transparent outline-none text-[#00ff88] crpg-glow text-sm placeholder-[#1f5a3a]"
              placeholder={state.battle ? "輸入：attack [N] / skill [N] / ult / item / flee" : "輸入指令… (help · skills · party · save · load)"} />
          </form>
        </section>

        <aside className="flex flex-col gap-3 min-h-0 overflow-hidden">
          <div className="crpg-panel p-3 text-xs overflow-y-auto crpg-scroll flex-shrink-0" style={{ maxHeight: "44%" }}>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer block relative group" title="點擊上傳頭像">
                {state.avatar ? (
                  <img src={state.avatar} alt="avatar"
                    className="w-[96px] h-[96px] object-cover border border-[#0f3a26] group-hover:border-[#00ff88]" />
                ) : (
                  <pre className={`crpg-pixel-avatar ${cls.color} text-[10px] leading-[10px] border border-[#0f3a26] p-1 group-hover:border-[#00ff88]`}>{PIXEL_AVATAR[state.klass]}</pre>
                )}
                <span className="absolute bottom-0 left-0 right-0 text-[8px] text-center bg-black/70 text-[#00e5ff] opacity-0 group-hover:opacity-100 transition">
                  [ UPLOAD ]
                </span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    if (f.size > 1024*1024) { push({ t:"system", text:"[SYS] 頭像檔案不可超過 1MB" }); return; }
                    const r = new FileReader();
                    r.onload = () => { setState((s) => ({ ...s, avatar: r.result })); push({ t:"system", text:"[SYS] 頭像已更新" }); };
                    r.readAsDataURL(f);
                  }} />
              </label>
              <div className="flex-1">
                <div className="text-[#00ff88] crpg-glow text-sm">{state.name}</div>
                <div className={`${cls.color} text-[11px]`}>{cls.icon} {cls.name} · LV {state.level}</div>
                <div className="mt-2 space-y-1.5">
                  {[
                    { l:"HP",  c:"ff4d6d", v:state.hp,  m:state.hpMax,  cls:"hp" },
                    { l:"MP",  c:"00e5ff", v:state.mp,  m:state.mpMax,  cls:"mp" },
                    { l:"EXP", c:"ffd60a", v:state.exp, m:state.expMax, cls:"" },
                  ].map((b, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-[10px]"><span style={{color:"#"+b.c}}>{b.l}</span><span className="text-[#3a8c5e]">{b.v}/{b.m}</span></div>
                      <div className={`crpg-bar ${b.cls}`}><span style={{ width: `${(b.v/b.m)*100}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {state.battle && (
              <div className="mt-3 border border-[#3a0f1c] p-2">
                <div className="text-[10px] tracking-widest text-[#ff4d6d] crpg-glow-red mb-1">▌ ENEMY</div>
                <div className="text-[#ff4d6d]">{ENEMIES[state.battle.key].name}</div>
                <div className="flex justify-between text-[10px] mt-1"><span className="text-[#ff4d6d]">HP</span><span className="text-[#3a8c5e]">{state.battle.hp}/{state.battle.hpMax}</span></div>
                <div className="crpg-bar hp"><span style={{ width: `${(state.battle.hp/state.battle.hpMax)*100}%` }} /></div>
              </div>
            )}

            {state.party?.length > 0 && (
              <div className="mt-3">
                <div className="text-[10px] tracking-widest text-[#3a8c5e] mb-1 border-b border-[#0f3a26] pb-1 flex justify-between">
                  <span>▌ PARTY (3-MAN)</span>
                  <span className="text-[#00e5ff]">matchmade</span>
                </div>
                <ul className="space-y-1">
                  {state.party.map((a) => {
                    const cc = CLASSES[a.klass];
                    return (
                      <li key={a.id} className={a.alive ? "" : "opacity-50"}>
                        <div className="flex justify-between text-[10px]">
                          <span className={cc.color}>{cc.icon} {a.name} <span className="text-[#3a8c5e]">[AI]</span></span>
                          <span className="text-[#3a8c5e]">{a.hp}/{a.hpMax}{a.alive?"":" KO"}</span>
                        </div>
                        <div className="crpg-bar hp"><span style={{ width: `${(a.hp/a.hpMax)*100}%` }} /></div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="mt-3">
              <div className="text-[10px] tracking-widest text-[#3a8c5e] mb-1 border-b border-[#0f3a26] pb-1">▌ SKILLS</div>
              <ul className="space-y-0.5">
                {cls.normal.map((sk, i) => (
                  <li key={sk.name} className="flex justify-between">
                    <span className={cls.color}>{i+1}. {sk.name}</span>
                    <span className="text-[#3a8c5e]">MP {sk.mp}</span>
                  </li>
                ))}
                <li className="flex justify-between">
                  <span className={state.learnedUlt ? "text-[#ff4d6d] crpg-glow-red" : "text-[#3a8c5e]"}>
                    ★ {state.learnedUlt ? cls.ultimate.name : "??? (未解鎖)"}
                  </span>
                  <span className="text-[#3a8c5e]">{state.learnedUlt ? `MP ${cls.ultimate.mp}` : "—"}</span>
                </li>
              </ul>
            </div>

            <div className="mt-3">
              <div className="text-[10px] tracking-widest text-[#3a8c5e] mb-1 border-b border-[#0f3a26] pb-1">▌ INVENTORY</div>
              <ul className="space-y-0.5 max-h-32 overflow-auto crpg-scroll">
                {Object.entries(state.inv).filter(([,v])=>v>0).map(([k,v]) => (
                  <li key={k} className="flex justify-between"><span className="text-[#7be0a8]">{ITEM_LABEL[k] || k}</span><span className="text-[#3a8c5e]">×{v}</span></li>
                ))}
                {Object.values(state.inv).every((v)=>!v) && <li className="text-[#3a8c5e]">（空）</li>}
              </ul>
            </div>

            {state.equipped?.length > 0 && (
              <div className="mt-3">
                <div className="text-[10px] tracking-widest text-[#3a8c5e] mb-1 border-b border-[#0f3a26] pb-1">▌ EQUIPPED</div>
                <ul className="space-y-0.5">
                  {state.equipped.map((eq, i) => (
                    <li key={i} className="text-[#00e5ff] crpg-glow-cyan">⚙ {eq}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-3">
              <div className="text-[10px] tracking-widest text-[#3a8c5e] mb-1 border-b border-[#0f3a26] pb-1">▌ QUEST</div>
              <div className="text-[#ffd60a] crpg-glow-yellow">◆ {state.quest}</div>
            </div>

            <div className="mt-3 flex gap-1">
              <button onClick={saveGame} className="flex-1 px-2 py-1 border border-[#0f3a26] text-[#00ff88] hover:border-[#00ff88] hover:crpg-glow text-[11px]">[ SAVE ]</button>
              <button onClick={loadGame} className="flex-1 px-2 py-1 border border-[#0f3a26] text-[#00e5ff] hover:border-[#00e5ff] hover:crpg-glow-cyan text-[11px]">[ LOAD ]</button>
            </div>
          </div>

          <div className="crpg-panel flex flex-col min-h-0 flex-shrink-0" style={{ maxHeight: "28%" }}>
            <div className="px-3 py-1.5 border-b border-[#0f3a26] text-[10px] uppercase tracking-widest text-[#00e5ff] crpg-glow-cyan">
              ▌ {state.battle ? "BATTLE ACTIONS" : "AVAILABLE ACTIONS"}
            </div>
            <div className="crpg-scroll flex-1 overflow-y-auto p-2 space-y-1">
              {choices.map((c, i) => (
                <button key={i} onClick={()=>handle(c.cmd)}
                  className="w-full text-left px-2 py-1.5 border border-[#0f3a26] text-[#7be0a8] hover:border-[#00ff88] hover:text-[#00ff88] hover:crpg-glow transition text-xs">
                  <span className="text-[#00e5ff]">[{c.cmd}]</span> {c.label}
                </button>
              ))}
              {!choices.length && <div className="text-[#3a8c5e] text-xs px-2">（請輸入 help）</div>}
            </div>
          </div>

          <div className="crpg-panel flex flex-col min-h-0 flex-1">
            <div className="px-3 py-1.5 border-b border-[#0f3a26] text-[10px] uppercase tracking-widest text-[#00e5ff] crpg-glow-cyan flex justify-between">
              <span>▌ WORLD CHAT</span>
              <span className="text-[#3a8c5e]">#world</span>
            </div>
            <div ref={chatRef} className="crpg-scroll flex-1 overflow-y-auto p-2 space-y-0.5 text-[11px] leading-snug">
              {chat.map((c, i) => (
                <div key={i}>
                  <span className="text-[#3a8c5e]">[World] </span>
                  <span className={c.self ? "text-[#00ff88] crpg-glow" : "text-[#00e5ff]"}>{c.user}</span>
                  <span className="text-[#3a8c5e]">: </span>
                  <span className="text-[#7be0a8]">{c.msg}</span>
                </div>
              ))}
            </div>
            <form onSubmit={sendChat} className="border-t border-[#0f3a26] px-2 py-1.5 flex items-center gap-2 bg-black/40">
              <span className="text-[#00e5ff] crpg-glow-cyan text-[11px] whitespace-nowrap">#world&gt;</span>
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} maxLength={140}
                placeholder="輸入訊息後按 Enter 送出…"
                className="flex-1 bg-transparent outline-none text-[#7be0a8] text-[11px] placeholder-[#1f5a3a]" />
              <button type="submit" className="text-[10px] px-2 py-0.5 border border-[#0f3a26] text-[#00ff88] hover:border-[#00ff88] hover:crpg-glow">SEND</button>
            </form>
          </div>
        </aside>
      </div>
    </Shell>
  );
}
