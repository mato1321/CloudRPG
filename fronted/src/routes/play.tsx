// @ts-nocheck
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Shell, Stat, readAuth, clearAuth } from "../components/crpg/Shell";
import { StoryBattleArena } from "../components/crpg/StoryBattleArena";
import { ShopModal } from "../components/crpg/ShopModal";
import { CLASSES, defaultParty } from "../lib/classes";
import { api } from "../lib/api";
import { ChatPanel } from "../components/crpg/ChatPanel";
import { BindAccountModal } from "../components/crpg/BindAccountModal";
import { RARITY_COLOR, statText } from "../lib/gear";

export const Route = createFileRoute("/play")({
  // ✅ 修復水合錯誤：整頁狀態來自 localStorage，伺服器端渲染一定對不上，改成只在瀏覽器渲染
  ssr: false,
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

/* 職業設定移到 lib/classes.ts（各遊戲模式共用） */

/* ───────────── STORY ENGINE ───────────── */

const ENEMIES = {
  minions:    { name: "魔王軍雜魚 + 雜魚老大", hp: 200, atk: [5, 11],  xp: 100, gold: 150 },
  goblin:     { name: "哥布林群",              hp: 240, atk: [7, 14],  xp: 140, gold: 220 },
  duke:       { name: "羅劫公爵",              hp: 320, atk: [11, 20], xp: 260, gold: 450, drop: "stone_red"  },
  abyss:      { name: "冥盡洞主",              hp: 400, atk: [14, 24], xp: 340, gold: 600, drop: "stone_blue" },
  skyisle:    { name: "天光島嶼之主",          hp: 480, atk: [17, 28], xp: 420, gold: 800, drop: "stone_gold" },
  demonlord:  { name: "魔王 (21世紀程式語言版)", hp: 550, atk: [20, 32], xp: 600, gold: 1200, joke: true },
  admin:      { name: "C:\\mato\\user\\Administrator", hp: 680, atk: [24, 40], xp: 9999, gold: 9999, isFinal: true },
};

const INFINITE_GOLD = 999999999;
// 管理員由後端 ADMIN_USERNAMES 決定：伺服器會把管理員的金幣回傳成 INFINITE_GOLD
function isAdminState(s) {
  return (s?.gold ?? 0) >= INFINITE_GOLD;
}

const STONE_LABEL = { stone_red: "傳說之石・赤", stone_blue: "傳說之石・蒼", stone_gold: "傳說之石・金" };
const ITEM_LABEL = {
  herb: "草藥", mana: "魔力藥水",
  skillbook_1: "進階技能書・卷一",
  skillbook_2: "進階技能書・卷二",
  skillbook: "終極奧義技能書",
  totem: "不死圖騰",
  weapon_basic: "初級職業武器", weapon_adv: "高級職業武器",
  terminus: "???終端機",
  junk: "很廢的武器", sword: "比較強的武器",
  ...STONE_LABEL,
};

const SAVE_KEY = "cloud-rpg-save";
const PROGRESS_SYNC_INTERVAL = 30000;  // 30 秒同步一次劇情進度

// 「經濟」欄位（金幣、物品、等級、裝備…）由伺服器說了算；本地只保存劇情欄位
const ECON_KEYS = ["klass","klassName","level","exp","expMax","gold","atk","hpMax","mpMax","inv","learnedSkill2","learnedSkill3","learnedUlt","equipped","gear","equippedGear","gearStats","weaponTier","weaponPlus","rarityGlow","bossesDefeated"];
const pickEcon = (p) => Object.fromEntries(ECON_KEYS.filter((k) => p && k in p).map((k) => [k, p[k]]));

// 訪客可以玩的範圍：第一章（打倒雜魚老大）。之後要綁定帳號才能繼續
const GUEST_SCENES = new Set(["classroom","portal","wasteland","wasteland2","village_burning","flee_fail","battle_minions","village_saved"]);

async function syncProgressToCloud(state, log, keepalive = false) {
  try {
    await api("/api/progress/save", {
      body: { state, log: log.slice(-300).map((l) => ({ ...l, shown: l.text.length })) },
      keepalive,
    });
    return true;
  } catch (e) {
    return e.status === 401 ? "expired" : false;
  }
}

function readSave() {
  if (typeof window === "undefined") return null;
  try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

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
    claim: "wasteland_loot",
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
    claim: "village_sword",
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
    inv: { herb: 2, mana: 1 },
    flags: {},
    classLocked: true,
    learnedSkill2: false,
    learnedSkill3: false,
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
    if (saved?.state?.klass) {
      return { name: "WANDERER_77", sceneId: "classroom", battle: null, ...saved.state };
    }
    return null;
  });
  const [log, setLog] = useState(() => saved?.log || []);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);
  const [hi, setHi] = useState(-1);
  const scrollRef = useRef(null);
  const skipIntroRef = useRef(!!saved && hasKlass);
  const [showShopModal, setShowShopModal] = useState(false);
  const [shopTab, setShopTab] = useState("shop");
  const [bindPrompt, setBindPrompt] = useState(null);
  // 目前這場故事戰鬥的伺服器憑證、開始時間、文字指令模式用掉的道具
  const battleRef = useRef({ id: null, start: 0, items: { herb: 0, mana: 0, totem: 0 } });

  const [auth, setAuth] = useState(null);
  const online = !!auth?.token;
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => {
    setAuth(readAuth());
    const sync = () => setAuth(readAuth());
    window.addEventListener("cloud-rpg-auth-change", sync);
    return () => window.removeEventListener("cloud-rpg-auth-change", sync);
  }, []);

  // ✅ Token 過期（後端回 401）→ 清掉登入狀態並回登入頁，本機存檔保留
  function onAuthExpired() {
    clearAuth();
    window.dispatchEvent(new Event("cloud-rpg-auth-change"));
    navigate({ to: "/login" });
  }

  function applyProfile(p) {
    if (!p) return;
    setState((s) => (s ? { ...s, ...pickEcon(p) } : s));
  }

  function openShop(tab = "shop") {
    setShopTab(tab);
    setShowShopModal(true);
  }

  // ⭐ 登入後讀取雲端：劇情用較新的那份，金幣 / 物品 / 等級一律以伺服器為準
  useEffect(() => {
    if (!auth?.token) return;
    let cancelled = false;
    (async () => {
      let cloud;
      try {
        cloud = await api("/api/progress/load");
      } catch (e) {
        if (e.status === 401) onAuthExpired();
        return;
      }
      if (cancelled) return;

      if (!cloud.hasProfile) {
        // 帳號還沒有角色：本機有訪客進度 → 匯入（伺服器只承認第一章可驗證的獎勵）
        const local = readSave();
        if (local?.state?.klass) {
          try {
            const r = await api("/api/profile/import-guest", {
              body: { klass: local.state.klass, claims: local.state.flags?.claims || [], beatMinions: !!local.state.flags?.villageSaved },
            });
            if (cancelled) return;
            setState((s) => ({ ...(s || local.state), name: auth.user, ...pickEcon(r.profile) }));
            setPicking(false);
            push({ t: "system", text: r.imported ? "[SYS] 訪客進度已綁定到帳號，之後會自動同步到雲端。" : "[SYS] 已載入帳號資料。" });
          } catch (e) {
            push({ t: "system", text: `[!!] 綁定失敗：${e.message}` });
          }
        } else {
          setState(null);
          setPicking(true);
        }
        return;
      }

      const cloudTs = cloud.last_save_at ? Date.parse(cloud.last_save_at + "Z") : 0;
      const snap = savedRef.current;
      const useLocal = snap?.state?.klass === cloud.state.klass && (snap?.ts || 0) > cloudTs && !!cloud.state.sceneId;
      const story = useLocal ? snap.state : cloud.state;
      setState({
        name: auth.user,
        sceneId: "classroom",
        flags: {},
        party: defaultParty(cloud.state.klass),
        quest: "醒來。",
        ...story,
        ...pickEcon(cloud.state),
        battle: null,
      });
      if (!useLocal) setLog((cloud.log || []).map((l) => ({ ...l, shown: l.text?.length ?? 0 })));
      // 存檔停在戰鬥場景時重新觸發戰鬥（要重新向伺服器領憑證）
      skipIntroRef.current = !!story.sceneId && !SCENES[story.sceneId]?.battle;
      setPicking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [auth?.token]);

  // ⭐ 自動同步劇情進度到雲端（每 30 秒）
  useEffect(() => {
    if (!state || !auth?.token) return;
    const syncInterval = setInterval(async () => {
      if ((await syncProgressToCloud(state, log)) === "expired") onAuthExpired();
    }, PROGRESS_SYNC_INTERVAL);
    return () => clearInterval(syncInterval);
  }, [state, log, auth?.token]);

  // ⭐ 關閉頁面時同步（keepalive：頁面關掉後請求也會送完）
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (state && auth?.token) syncProgressToCloud(state, log, true);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [state, log, auth?.token]);

  useEffect(() => {
    if (!state) return;
    const a = readAuth();
    if (a?.user && state.name !== a.user) setState((s) => ({ ...s, name: a.user }));
    // eslint-disable-next-line
  }, [state ? true : false, auth?.user]);

  // Auto-save（本機）
  useEffect(() => {
    if (!state) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ state, log, ts: Date.now() })); } catch {}
  }, [state?.sceneId, state?.klass, state?.level, state?.gold, state?.hp, state?.mp, state?.atk, state?.learnedSkill2, state?.learnedSkill3, state?.learnedUlt, state?.inv, state?.equipped, state?.flags]);

  const scene = state ? SCENES[state.sceneId] : null;

  // print scene intro
  useEffect(() => {
    if (!scene || !state) return;
    if (skipIntroRef.current) { skipIntroRef.current = false; return; }
    let patch = {};
    if (scene.onEnter) patch = scene.onEnter(state) || {};
    if (scene.claim) {
      if (online) {
        // 劇情撿到的東西由伺服器發放（每個帳號只能領一次）
        for (const k of ECON_KEYS) delete patch[k];
        api("/api/story/claim", { body: { reward_id: scene.claim } }).then((r) => applyProfile(r.profile)).catch(() => {});
      } else {
        const claims = [...new Set([...(state.flags?.claims || []), scene.claim])];
        patch.flags = { ...(state.flags || {}), ...(patch.flags || {}), claims };
      }
    }
    const intro = scene.intro || [];
    const dyn = scene.dynamic ? scene.dynamic({ ...state, ...patch }) : [];
    setLog((l) => [...l,
      { t:"dim", text:`── 場景：${scene.location || state.sceneId} ──` },
      ...intro, ...dyn,
    ]);
    if (scene.battle) {
      const e = ENEMIES[scene.battle];
      setLog((l) => [...l,
        { t:"battle", text:`遭遇：${e.name}！  [已啟動 2D 街機格鬥決戰模式]` },
        { t:"system", text:"鍵盤操作：[WASD]移動/格擋 · [F/J]輕擊 · [G/K]重擊 · [R/L]技能1 · [T/U]技能2 · [Y/O]技能3 · [Q/I]奧義 · [H]草藥" }]);
      setState((s) => ({ ...s, ...patch, battle: { key: scene.battle, hp: e.hp * 3, hpMax: e.hp * 3 } }));
      battleRef.current = { id: null, start: Date.now(), items: { herb: 0, mana: 0, totem: 0 } };
      if (online) {
        api("/api/battle/start", { body: { mode: "story", key: scene.battle } })
          .then((b) => { battleRef.current.id = b.battle_id; })
          .catch((err) => {
            push({ t: "system", text: `[!!] ${err.message}` });
            setTimeout(() => gotoScene(scene.loseGo), 400);
          });
      }
    } else {
      const choices = (scene.choices || []).filter((c) => !c.need || c.need({ ...state, ...patch }));
      if (choices.length) {
        setLog((l) => [...l,
          { t:"system", text:"可用指令：" },
          ...choices.map((c) => ({ t:"dim", text:`  · ${c.cmd.padEnd(10," ")}— ${c.label}` })),
        ]);
      }
      if (Object.keys(patch).length) setState((s) => ({ ...s, ...patch }));
      // 訪客打倒第一個 Boss → 提示綁定帳號
      if (!online && state.sceneId === "village_saved") {
        setTimeout(() => setBindPrompt("你打倒了第一個 Boss！"), 2500);
      }
    }
  }, [state?.sceneId, picking]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [log]);

  // 戰鬥結束後把鍵盤焦點還給指令輸入框（戰鬥中由 StoryBattleArena 接管鍵盤）
  const inBattle = !!state?.battle;
  useEffect(() => { if (!inBattle) inputRef.current?.focus(); }, [inBattle]);

  function push(...lines) {
    setLog((l) => [...l, ...lines.map((ln) => ({ ...ln, shown: 0 }))]);
  }

  // 打字機效果（比原本快一倍；按「跳過」或輸入 skip 立刻顯示全部）
  useEffect(() => {
    const id = setInterval(() => {
      setLog((cur) => {
        const i = cur.findIndex((l) => (l.shown ?? 0) < l.text.length);
        if (i === -1) return cur;
        const next = cur.slice();
        const line = next[i];
        const step = Math.max(3, Math.ceil(line.text.length / 25));
        next[i] = { ...line, shown: Math.min(line.text.length, (line.shown ?? 0) + step) };
        return next;
      });
    }, 16);
    return () => clearInterval(id);
  }, []);

  function skipText() {
    setLog((cur) => cur.map((l) => ({ ...l, shown: l.text.length })));
  }
  const typing = log.some((l) => (l.shown ?? 0) < l.text.length);

  async function chooseClass(id) {
    const init = initialStateFor(id);
    const a = readAuth();
    let econ = {};
    if (a?.token) {
      try {
        econ = pickEcon((await api("/api/profile/create", { body: { klass: id } })).profile);
      } catch (e) {
        if (e.status === 409) econ = pickEcon((await api("/api/profile")).profile);
        else return push({ t: "system", text: `[!!] ${e.message}` });
      }
    }
    const initial = { name: a?.user || "WANDERER_77", sceneId: "classroom", battle: null, ...init, ...econ };
    setState(initial);
    const partyNames = init.party.map((p) => `${p.name}(${CLASSES[p.klass].name}·AI)`).join("、");
    setLog([
      { t:"system", text:`[SYS] 職業已選定並鎖定：${CLASSES[id].name} (${CLASSES[id].en}) — 選定後不可更改（若需轉職請至 [MARKET] 黑市購買「轉職聖典」）`, shown:0 },
      { t:"system", text:`[MATCHMAKING] 搜尋線上玩家中…未滿 3 人，由 AI 補位。`, shown:0 },
      { t:"system", text:`[PARTY] 你的三人小隊：${initial.name} ＋ ${partyNames}`, shown:0 },
      ...(a?.token ? [] : [{ t:"system", text:"[SYS] 訪客模式：免註冊直接開玩！打倒第一個 Boss 後可以綁定帳號保存進度。", shown:0 }]),
    ]);
    skipIntroRef.current = false;
    setPicking(false);
  }

  function saveGame() {
    const flat = log.map((l) => ({ ...l, shown: l.text.length }));
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ state, log: flat, ts: Date.now() }));
      push({ t:"system", text: online ? "[SYS] 遊戲已存檔（雲端每 30 秒自動同步）" : "[SYS] 遊戲已存檔到這台電腦（綁定帳號後可雲端保存）" });
      if (online) syncProgressToCloud(state, log);
    } catch { push({ t:"system", text:"[SYS] 存檔失敗" }); }
  }
  function loadGame() {
    if (online) return push({ t:"system", text:"[SYS] 帳號進度以雲端為準，重新整理頁面即可載入最新進度。" });
    const s = readSave();
    if (!s) return push({ t:"system", text:"[SYS] 找不到存檔" });
    skipIntroRef.current = true;
    setState(s.state);
    const restored = (s.log || []).map((l) => ({ ...l, shown: l.text.length }));
    setLog([...restored, { t:"system", text:"[SYS] 已載入存檔", shown: 0 }]);
  }

  function gotoScene(id, effect) {
    if (!online && !GUEST_SCENES.has(id)) {
      push({ t: "system", text: "[SYS] 接下來的冒險需要帳號才能保存（免費、10 秒完成）。" });
      setBindPrompt("想繼續冒險嗎？");
      return;
    }
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

  function endBattle(win, finalHp = null, finalMp = null, stats = null) {
    if (!state?.battle) return;
    const enemy = ENEMIES[state.battle.key];
    const next = win ? scene.winGo : scene.loseGo;
    const sc = scene;
    if (online) {
      const b = battleRef.current;
      const id = b.id;
      b.id = null;
      const items = { ...b.items };
      for (const k of ["herb", "mana", "totem"]) items[k] = (items[k] || 0) + (stats?.itemsUsed?.[k] || 0);
      setState((s) => (s ? { ...s, battle: null, hp: finalHp ?? s.hp, mp: finalMp ?? s.mp, flags: { ...(s.flags || {}), tutorialDone: true } } : s));
      if (!id) {
        push({ t: "system", text: "[!!] 戰鬥憑證遺失（可能是網路問題），本場不計。" });
        setTimeout(() => gotoScene(sc.loseGo), 50);
        return;
      }
      api("/api/battle/finish", {
        body: {
          battle_id: id,
          win,
          duration_ms: stats?.durationMs ?? Date.now() - b.start,
          damage: stats?.damage ?? 0,
          hp_left: Math.max(0, finalHp ?? state.hp),
          max_combo: stats?.maxCombo ?? 0,
          items_used: items,
        },
      })
        .then((r) => {
          const rw = r.rewards || {};
          if (win) {
            const drops = Object.keys(rw.items || {}).map((k) => STONE_LABEL[k] || ITEM_LABEL[k] || k);
            push({ t: "battle", text: `${enemy.name} 被擊敗！` },
                 { t: "system", text: `[REWARD] +${rw.xp} EXP · +${rw.gold} GOLD${drops.length ? ` · 獲得 ${drops.join("、")}` : ""}` });
            if (enemy.joke) push({ t: "player", text: "三人：不是，這麼廢的嗎？" });
          } else {
            push({ t: "battle", text: "你戰敗了……在據點恢復一半體力後重新出發。" });
          }
          for (const g of rw.gear || []) push({ t: "relic", text: `[LOOT] ${g.name}（${statText(g.stats)}）→ 輸入 shop 打開「裝備背包」穿上它！` });
          if (r.levelUps > 0) push({ t: "system", text: `▲ LEVEL UP! → LV ${r.profile.level}（HP、MP、ATK 全面提升）` });
          setState((s) => {
            if (!s) return s;
            const p = r.profile;
            const up = r.levelUps > 0;
            return {
              ...s,
              ...pickEcon(p),
              hp: up ? p.hpMax : win ? Math.min(p.hpMax, Math.max(1, finalHp ?? s.hp)) : Math.max(1, Math.floor(p.hpMax / 2)),
              mp: up ? p.mpMax : Math.min(p.mpMax, finalMp ?? s.mp),
            };
          });
          setTimeout(() => gotoScene(next), 50);
        })
        .catch((e) => {
          push({ t: "system", text: `[!!] 結算失敗：${e.message}` });
          setState((s) => (s ? { ...s, hp: Math.max(1, Math.floor(s.hpMax / 2)) } : s));
          setTimeout(() => gotoScene(sc.loseGo), 50);
        });
      return;
    }
    setState((s) => (s ? { ...s, flags: { ...(s.flags || {}), tutorialDone: true } } : s));
    if (win) {
      push({ t:"battle", text:`${enemy.name} 被擊敗！` },
           { t:"system", text:`[REWARD] +${enemy.xp} EXP · +${enemy.gold} GOLD${enemy.drop ? ` · 獲得 ${STONE_LABEL[enemy.drop]}` : ""}` });
      if (enemy.joke) push({ t:"player", text:"三人：不是，這麼廢的嗎？" });
      setState((s) => {
        if (!s) return s;
        const exp = s.exp + enemy.xp;
        let level = s.level, expMax = s.expMax, hpMax = s.hpMax, mpMax = s.mpMax, atk = s.atk;
        let hp = finalHp != null ? finalHp : s.hp;
        let mp = finalMp != null ? finalMp : s.mp;
        let leftover = exp;
        while (leftover >= expMax) {
          leftover -= expMax;
          level++;
          expMax = Math.floor(expMax*1.4);
          hpMax += 30;
          mpMax += 15;
          atk += 4;
          hp = hpMax;
          mp = mpMax;
          push({ t:"system", text:`▲ LEVEL UP! → LV ${level} (HP+30, MP+15, ATK+4)` });
        }
        const inv = { ...s.inv };
        if (enemy.drop) inv[enemy.drop] = (inv[enemy.drop] || 0) + 1;
        return { ...s, exp: leftover, expMax, level, hpMax, mpMax, hp, mp, atk, gold: s.gold + enemy.gold, inv, battle: null };
      });
    } else {
      push({ t:"battle", text:"你戰敗了……在據點恢復一半體力後重新出發。" });
      setState((s) => s ? ({ ...s, hp: Math.max(1, Math.floor(s.hpMax / 2)), battle: null }) : s);
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
      const idx = opts.index ?? 0;
      if (idx === 1 && !state.learnedSkill2) {
        return push({ t:"system", text:`[LOCKED] 尚未習得「${cls.normal[1].name}」，請至 [MARKET] 黑市購買「進階技能書・卷一」解鎖！` });
      }
      if (idx === 2 && !state.learnedSkill3) {
        return push({ t:"system", text:`[LOCKED] 尚未習得「${cls.normal[2].name}」，請至 [MARKET] 黑市購買「進階技能書・卷二」解鎖！` });
      }
      const skill = (idx != null && cls.normal[idx]) ? cls.normal[idx] : cls.normal[0];
      castSkill(skill, false);
    } else if (kind === "ult") {
      if (!state.learnedUlt) return push({ t:"system", text:"[LOCKED] 尚未習得終極奧義，請至 [MARKET] 黑市購買「終極奧義技能書」解鎖！" });
      castSkill(cls.ultimate, true);
    } else if (kind === "item") {
      if (!state.inv.herb) return push({ t:"system", text:"沒有草藥。" });
      const heal = 60;
      push({ t:"system", text:`使用草藥，恢復 ${heal} HP。` });
      battleRef.current.items.herb++;
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
                  { t:"system", text:"場景：依下方列出的場景指令操作。shop 快速黑市 · gear 裝備背包 · skip 跳過劇情文字" });
    }
    if (cmd === "skip") return skipText();
    if (cmd === "gear" || cmd === "bag") {
      openShop("gear");
      return push({ t:"system", text:"[SYS] 開啟裝備背包（ESC 關閉）" });
    }
    if (cmd === "shop" || cmd === "market") {
      openShop("shop");
      return push({ t:"system", text:"[SYS] 開啟快速黑市（ESC 關閉）" });
    }
    if (cmd === "clear") return setLog([]);
    if (cmd === "save") return saveGame();
    if (cmd === "load") return loadGame();
    if (cmd === "stats") {
      const cls = CLASSES[state.klass];
      return push({ t:"system", text:`${state.name} · ${cls.name} · LV ${state.level}` },
        { t:"dim", text:`HP ${state.hp}/${state.hpMax}  MP ${state.mp}/${state.mpMax}  EXP ${state.exp}/${state.expMax}  GOLD ${state.gold}  ATK ${state.atk}` });
    }
    if (cmd === "skills") {
      const cls = CLASSES[state.klass];
      return push({ t:"system", text:`── ${cls.name} 技能列表 (鍵盤街機戰鬥快捷鍵) ──` },
        { t:"dim", text:"[普通攻擊] [F/J] 輕擊 · [G/K] 重擊" },
        ...(cls.attacks||[]).map((a, i) => ({ t:"dim", text:`  ${i+1}. ${a.name}（×${a.mul}）` })),
        { t:"dim", text:"[職業技能] (可在 /market 購買技能書擴充)" },
        { t:"player", text:`  1. [R/L] ${cls.normal[0].name}（MP ${cls.normal[0].mp}）— 已習得` },
        { t: state.learnedSkill2 ? "player" : "dim", text:`  2. [T/U] ${state.learnedSkill2 ? cls.normal[1].name : "??? (需於商店購買「進階技能書・卷一」)"}` },
        { t: state.learnedSkill3 ? "player" : "dim", text:`  3. [Y/O] ${state.learnedSkill3 ? cls.normal[2].name : "??? (需於商店購買「進階技能書・卷二」)"}` },
        { t: state.learnedUlt ? "ult" : "dim",
          text: state.learnedUlt ? `奧義 [Q/I]：${cls.ultimate.name}（100% 氣條施放）` : `奧義 [Q/I]：??? （需於商店購買「終極奧義技能書」解鎖）` });
    }
    if (cmd === "party") {
      const lines = [{ t:"system", text:"── 三人組隊 (Matchmaking) ──" },
        { t:"dim", text:`  ${state.name}（你 · ${CLASSES[state.klass].name}） HP ${state.hp}/${state.hpMax}` }];
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
      // Keep locked class! Only reset story scene to classroom
      const lockedKlass = state.klass;
      const cls = CLASSES[lockedKlass];
      skipIntroRef.current = false;
      setLog([
        { t:"system", text:`[SYS] 故事章節已重啟。你的職業已鎖定為「${cls.name}」不可直接更改。`, shown:0 },
        { t:"system", text:`[SYS] 若欲轉換職業，請前往 [MARKET] 黑市購買高價「轉職聖典」！`, shown:0 },
      ]);
      setState((s) => ({
        ...s,
        sceneId: "classroom",
        battle: null,
        hp: s.hpMax,
        mp: s.mpMax,
        quest: "醒來。",
      }));
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
            <div className="text-[#3a8c5e] text-xs tracking-[0.4em] mb-2">// CHARACTER ALLOCATION (PERMANENT LOCK)</div>
            <h1 className="text-[#00ff88] crpg-glow text-2xl tracking-widest">▌ 選擇你的初始職業（選定後鎖定）</h1>
            <p className="text-[#7be0a8] text-xs mt-2">
              故事模式採用 2D 鍵盤街機格鬥決戰！選定職業後<span className="text-[#ff4d6d] font-bold">不可直接更改</span>（若需更換職業，須至 [MARKET] 黑市購買高價「轉職聖典」）。
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl w-full">
            {Object.values(CLASSES).map((c) => (
              <button key={c.id} onClick={() => chooseClass(c.id)}
                className={`crpg-panel text-left p-5 border ${c.border} transition group hover:-translate-y-0.5`}>
                <div className="flex items-center gap-3 mb-3">
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
                <div className="text-[10px] text-[#3a8c5e] mb-1">街機格鬥技能（商店可買技能書擴充）</div>
                <ul className="text-[11px] text-[#7be0a8] space-y-0.5 mb-3">
                  <li>· 初始技能 [R/L]：{c.normal[0].name}</li>
                  <li className="text-[#3a8c5e]">· 進階卷一 [T/U]：{c.normal[1].name}（商店解鎖）</li>
                  <li className="text-[#3a8c5e]">· 進階卷二 [Y/O]：{c.normal[2].name}（商店解鎖）</li>
                  <li className="text-[#3a8c5e]">終極奧義 [Q/I]：{c.ultimate.name}（商店解鎖）</li>
                </ul>
                <div className="text-[10px] text-[#3a8c5e]">專屬武器</div>
                <div className="text-[11px] text-[#cfeedd]">{c.weaponBasic.name} → {c.weaponAdv.name}</div>
                <div className={`mt-4 text-center text-[11px] py-1.5 border ${c.border}`}>
                  [ 鎖定選擇 {c.name} ]
                </div>
              </button>
            ))}
          </div>
          <div className="text-[10px] text-[#ffd60a]">建立角色後職業即永久綁定並自動存檔；欲學更多技能或轉職請前往 [MARKET] 黑市商店。</div>
        </div>
      </Shell>
    );
  }

  const cls = CLASSES[state.klass] || CLASSES.warrior;

  const headerExtra = (
    <>
      <Stat label="CLASS" value={`${cls.name} [LOCKED]`} color={cls.color} />
      <Stat label="HP"   value={`${state.hp}/${state.hpMax}`} color="text-[#ff4d6d] crpg-glow-red" />
      <Stat label="MP"   value={`${state.mp}/${state.mpMax}`} color="text-[#00e5ff] crpg-glow-cyan" />
      <Stat label="GOLD" value={state.gold} color="text-[#ffd60a] crpg-glow-yellow" />
      <Stat label="ATK"  value={state.atk} color="text-[#ff4d6d] crpg-glow-red" />
    </>
  );

  const choices = state.battle
    ? [
        { cmd:"attack", label:`普通攻擊 (${cls.attacks?.[0]?.name || "輕擊"})` },
        { cmd:"skill 1", label:`技能1：${cls.normal[0].name}` },
        ...(state.learnedSkill2 ? [{ cmd:"skill 2", label:`技能2：${cls.normal[1].name}` }] : []),
        ...(state.learnedSkill3 ? [{ cmd:"skill 3", label:`技能3：${cls.normal[2].name}` }] : []),
        ...(state.learnedUlt ? [{ cmd:"ult", label:`奧義：${cls.ultimate.name}` }] : []),
        { cmd:"item",   label:`使用草藥 (×${state.inv.herb||0})` },
        { cmd:"flee",   label:"逃跑" },
      ]
    : (scene.choices || []).filter((c) => !c.need || c.need(state));

  return (
    <Shell headerExtra={headerExtra}>
      {showShopModal && (
        <ShopModal
          state={state}
          isAdmin={isAdminState(state)}
          online={online}
          initialTab={shopTab}
          onClose={() => setShowShopModal(false)}
          onNeedBind={() => {
            setShowShopModal(false);
            setBindPrompt("想使用黑市嗎？");
          }}
          onPurchased={(profile, msg) => {
            applyProfile(profile);
            if (msg) push({ t: "equip", text: `[MARKET] ${msg}` });
          }}
        />
      )}
      {bindPrompt && (
        <BindAccountModal
          reason={bindPrompt}
          onClose={() => setBindPrompt(null)}
          onBound={() => {
            setBindPrompt(null);
            window.dispatchEvent(new Event("cloud-rpg-auth-change"));
          }}
        />
      )}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3 flex-1 min-h-0 overflow-hidden">
        <section className="crpg-panel flex flex-col overflow-hidden min-h-0">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#0f3a26] text-[10px] uppercase tracking-widest">
            <span className="text-[#3a8c5e]">tty1 · {scene.location || state.sceneId}{state.battle ? "  ·  [INTERACTIVE ARCADE COMBAT]" : ""}</span>
            <span className="flex items-center gap-2">
              {typing && (
                <button onClick={skipText} className="px-2 py-0.5 border border-[#0f3a26] text-[#ffd60a] hover:border-[#ffd60a] normal-case tracking-normal">
                  跳過
                </button>
              )}
              {!online && (
                <button onClick={() => setBindPrompt("想把進度存到雲端嗎？")} className="px-2 py-0.5 border border-[#00ff88]/50 text-[#00ff88] normal-case tracking-normal">
                  訪客模式 · 綁定帳號
                </button>
              )}
              <span className="text-[#3a8c5e]">[●REC]</span>
            </span>
          </div>

          {state.battle && ENEMIES[state.battle.key] && (
            <StoryBattleArena
              state={state}
              enemyKey={state.battle.key}
              enemyCfg={ENEMIES[state.battle.key]}
              classCfg={cls}
              onUseHerb={(newHp) => {
                setState((s) => s ? ({ ...s, hp: newHp, inv: { ...s.inv, herb: Math.max(0, (s.inv.herb || 1) - 1) } }) : s);
                push({ t: "system", text: "[ITEM] 在格鬥中使用草藥，恢復 60 HP！" });
              }}
              onUseMana={(newMp) => {
                setState((s) => s ? ({ ...s, mp: newMp, inv: { ...s.inv, mana: Math.max(0, (s.inv.mana || 1) - 1) } }) : s);
                push({ t: "system", text: "[ITEM] 在格鬥中使用魔力藥水，恢復 60 MP 並充能 50% 必殺氣條！" });
              }}
              onUseTotem={(reviveHp) => {
                setState((s) => s ? ({ ...s, hp: reviveHp, inv: { ...s.inv, totem: Math.max(0, (s.inv.totem || 1) - 1) } }) : s);
                push({ t: "relic", text: "不死圖騰發出耀眼光芒！你從致命傷中復活並恢復 60% HP！" });
              }}
              onSyncHpMp={(newHp, newMp, newEnemyHp) => {
                setState((s) => {
                  if (!s || !s.battle) return s;
                  return {
                    ...s,
                    hp: newHp,
                    mp: newMp,
                    battle: { ...s.battle, hp: newEnemyHp },
                  };
                });
              }}
              onBattleEnd={(win, finalHp, finalMp, stats) => {
                endBattle(win, finalHp, finalMp, stats);
              }}
              tutorial={state.battle.key === "minions" && !state.flags?.tutorialDone}
              onFlee={() => {
                battleAction("flee");
              }}
              onLog={(line) => push(line)}
              onOpenShopModal={() => openShop("shop")}
              paused={showShopModal || !!bindPrompt}
            />
          )}

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
            <input ref={inputRef} autoFocus={!state.battle} value={input} onChange={(e)=>setInput(e.target.value)} onKeyDown={onKeyDown} spellCheck={false}
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
                <div className={`${cls.color} text-[11px]`}>{cls.name} · LV {state.level}</div>
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
                          <span className={cc.color}>{a.name} <span className="text-[#3a8c5e]">[AI]</span></span>
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
              <div className="text-[10px] tracking-widest text-[#3a8c5e] mb-1 border-b border-[#0f3a26] pb-1 flex justify-between">
                <span>▌ SKILLS (格鬥技能)</span>
                <Link to="/market" className="text-[#ffd60a] hover:underline">買技能書/轉職</Link>
              </div>
              <ul className="space-y-0.5 text-[11px]">
                <li className="flex justify-between">
                  <span className={cls.color}>1. [R/L] {cls.normal[0].name}</span>
                  <span className="text-[#00ff88]">已習得</span>
                </li>
                <li className="flex justify-between">
                  <span className={state.learnedSkill2 ? cls.color : "text-[#3a8c5e]"}>
                    2. [T/U] {state.learnedSkill2 ? cls.normal[1].name : "??? (技能書・卷一)"}
                  </span>
                  <span className="text-[#3a8c5e]">{state.learnedSkill2 ? "已習得" : "商店 600G"}</span>
                </li>
                <li className="flex justify-between">
                  <span className={state.learnedSkill3 ? cls.color : "text-[#3a8c5e]"}>
                    3. [Y/O] {state.learnedSkill3 ? cls.normal[2].name : "??? (技能書・卷二)"}
                  </span>
                  <span className="text-[#3a8c5e]">{state.learnedSkill3 ? "已習得" : "商店 1200G"}</span>
                </li>
                <li className="flex justify-between">
                  <span className={state.learnedUlt ? "text-[#ff4d6d] crpg-glow-red" : "text-[#3a8c5e]"}>
                    [Q/I] {state.learnedUlt ? cls.ultimate.name : "??? (終極奧義書)"}
                  </span>
                  <span className="text-[#3a8c5e]">{state.learnedUlt ? "已習得" : "商店 2000G"}</span>
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
                    <li key={i} className="text-[#00e5ff] crpg-glow-cyan">{eq}</li>
                  ))}
                  {(state.gear || []).filter((g) => Object.values(state.equippedGear || {}).includes(g.id)).map((g) => (
                    <li key={g.id} style={{ color: RARITY_COLOR[g.rarity] }} title={statText(g.stats)}>◈ {g.name}</li>
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
              <button onClick={() => openShop("shop")} className="flex-1 px-2 py-1 border border-[#3a2f0a] text-[#ffd60a] hover:border-[#ffd60a] hover:crpg-glow-yellow text-[11px]">[ 黑市 ]</button>
              <button onClick={() => openShop("gear")} className="flex-1 px-2 py-1 border border-[#1f1a4a] text-[#c084fc] hover:border-[#c084fc] text-[11px]">[ 裝備 ]</button>
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

          <ChatPanel channel="world" title="WORLD CHAT" className="flex-1" compact />
        </aside>
      </div>
    </Shell>
  );
}
