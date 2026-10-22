// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell, Panel, Stat } from "../components/crpg/Shell";

export const Route = createFileRoute("/market")({
  component: Market,
  head: () => ({ meta: [
    { title: "Cloud RPG — Black Market" },
    { name: "description", content: "Trade chrome, scripts and relics on the Cloud RPG black market." },
  ]}),
});

const SAVE_KEY = "cloud-rpg-save";

const CLASS_META = {
  warrior: { name:"戰士", ult:"滅世斷界斬",   wBasic:"銀風鐵劍",   wAdv:"日蝕殞落之劍" },
  mage:    { name:"法師", ult:"禁忌・星界崩壞", wBasic:"刻印法杖",   wAdv:"全世操縱之杖" },
  priest:  { name:"牧師", ult:"終焉聖域",     wBasic:"純潔寶珠",   wAdv:"虛空之眼"     },
};

const RARITY = {
  common: "text-[#7be0a8]",
  rare:   "text-[#00e5ff] crpg-glow-cyan",
  epic:   "text-[#ffd60a] crpg-glow-yellow",
  legend: "text-[#ff4d6d] crpg-glow-red",
  myth:   "text-[#a78bfa] crpg-glow-cyan",
};

function readSave() {
  if (typeof window === "undefined") return null;
  try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function writeSave(save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...save, ts: Date.now() })); } catch {}
}

function buildShop(klass) {
  const meta = klass ? CLASS_META[klass] : null;
  return [
    { id:"herb",      name:"草藥",       desc:"常見的草藥，能迅速恢復體力。", effect:"恢復 50 HP", price:100,   rarity:"common" },
    { id:"mana",      name:"魔力藥水",   desc:"蘊含魔力的藥水，能恢復魔力。", effect:"恢復 50 MP", price:100,   rarity:"common" },
    { id:"skillbook", name:"高級技能書", desc:"封印著職業最強奧義的禁忌書頁。",
      effect: meta ? `習得「${meta.ult}」` : "依職業習得高級技能", price:1000,  rarity:"epic" },
    { id:"totem",     name:"不死圖騰",   desc:"當 HP 歸 0 時自動復活並恢復 1 HP，使用後消耗。",
      effect:"自動復活 ×1", price:3000,  rarity:"rare" },
    { id:"weapon_basic", name: meta ? meta.wBasic : "初級職業武器",
      desc:"鐫刻著職業印記的入門裝備。", effect:"+15 ATK", price:500,   rarity:"rare",
      classOnly:true, atk:15 },
    { id:"weapon_adv",   name: meta ? meta.wAdv : "高級職業武器",
      desc:"高位職業專屬神器，戰場上的決勝關鍵。", effect:"+35 ATK", price:3000,  rarity:"legend",
      classOnly:true, atk:35 },
    { id:"terminus", name:"???終端機",
      desc:"也許是這個世界的底層邏輯。",
      effect:"ATK +9999 · HP +9999 · MP +9999", price:100000, rarity:"myth", hidden:true },
  ];
}

function Market() {
  const [save, setSave] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => { setSave(readSave()); }, []);

  const state = save?.state;
  const gold = state?.gold ?? 0;
  const klass = state?.klass;
  const hasSave = !!state;
  const items = buildShop(klass);

  function buy(it) {
    if (!hasSave) { setToast({ ok:false, msg:"找不到存檔，請先進入 PLAY 建立角色。" }); return; }
    if (gold < it.price) { setToast({ ok:false, msg:`金幣不足（需要 ${it.price.toLocaleString()}G）` }); return; }

    const s = { ...state };
    s.inv = { ...(s.inv || {}) };
    s.equipped = [...(s.equipped || [])];
    s.gold = s.gold - it.price;

    let okMsg = `已購買 ${it.name}`;

    if (it.id === "skillbook") {
      if (s.learnedUlt) { setToast({ ok:false, msg:"你已習得高級技能。" }); return; }
      s.learnedUlt = true;
      okMsg = `已習得高級技能：${CLASS_META[klass].ult}`;
    } else if (it.id === "weapon_basic" || it.id === "weapon_adv") {
      s.inv[it.id] = (s.inv[it.id] || 0) + 1;
      s.atk = (s.atk || 0) + it.atk;
      s.equipped.push(it.name);
      okMsg = `已裝備「${it.name}」  ATK +${it.atk}`;
    } else if (it.id === "terminus") {
      s.inv.terminus = (s.inv.terminus || 0) + 1;
      s.atk = (s.atk || 0) + 9999;
      s.hpMax = (s.hpMax || 0) + 9999;
      s.mpMax = (s.mpMax || 0) + 9999;
      s.hp = s.hpMax; s.mp = s.mpMax;
      s.equipped.push("???終端機");
      okMsg = "[ERROR] 未知權限已解鎖……";
    } else {
      s.inv[it.id] = (s.inv[it.id] || 0) + 1;
    }

    const next = { ...save, state: s };
    writeSave(next); setSave(next);
    setToast({ ok:true, msg: okMsg });
  }

  useEffect(() => { if (!toast) return; const id = setTimeout(()=>setToast(null), 2400); return ()=>clearTimeout(id); }, [toast]);

  const headerExtra = (
    <>
      {klass && <Stat label="CLASS" value={CLASS_META[klass].name} color="text-[#00e5ff] crpg-glow-cyan" />}
      <Stat label="GOLD" value={gold.toLocaleString()} color="text-[#ffd60a] crpg-glow-yellow" />
    </>
  );

  const visible = items.filter((it) => {
    if (it.hidden) return true; // always show terminus but with glitch style
    return true;
  });

  return (
    <Shell headerExtra={headerExtra}>
      <h1 className="text-[#00ff88] crpg-glow text-xl tracking-widest">▌ BLACK MARKET // SECTOR 9</h1>

      {!hasSave && (
        <div className="crpg-panel px-3 py-2 text-xs text-[#ffd60a] crpg-glow-yellow">
          尚未發現存檔。請先到 <Link to="/play" className="underline">[PLAY]</Link> 建立角色後再回來消費。
        </div>
      )}

      <Panel title={`SHOP · ${klass ? CLASS_META[klass].name + " · " : ""}你的金幣 ${gold.toLocaleString()}G`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((it) => {
            const owned  = save?.state?.inv?.[it.id] || 0;
            const learned = it.id === "skillbook" && save?.state?.learnedUlt;
            const can = hasSave && gold >= it.price && !learned;
            const myth = it.id === "terminus";
            const cardBorder = myth
              ? "border border-[#a78bfa]/40 shadow-[0_0_24px_-6px_rgba(167,139,250,0.7)]"
              : "border border-[#0f3a26]";
            return (
              <div key={it.id} className={`crpg-panel p-3 flex flex-col gap-2 ${cardBorder}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${RARITY[it.rarity]}`}>{it.name}</span>
                  <span className={myth ? "text-[#a78bfa] crpg-glow-cyan text-xs" : "text-[#ffd60a] crpg-glow-yellow text-xs"}>
                    {it.price.toLocaleString()}G
                  </span>
                </div>
                <div className={`text-[11px] ${myth ? "text-[#a78bfa]" : "text-[#7be0a8]"}`}>{it.effect}</div>
                <div className="text-[11px] text-[#3a8c5e] leading-snug">{it.desc}</div>
                {it.classOnly && klass && (
                  <div className="text-[10px] text-[#00e5ff] crpg-glow-cyan">[ {CLASS_META[klass].name}專屬 ]</div>
                )}
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-[10px] text-[#3a8c5e]">
                    {it.id === "skillbook" ? (learned ? "已習得" : "未習得") : `持有 ×${owned}`}
                  </span>
                  <button
                    onClick={()=>buy(it)} disabled={!can}
                    className={`text-xs px-3 py-1 border transition ${
                      !can ? "border-[#0f3a26] text-[#3a8c5e] cursor-not-allowed" :
                      myth ? "border-[#a78bfa] text-[#a78bfa] hover:crpg-glow-cyan" :
                      "border-[#00ff88] text-[#00ff88] hover:crpg-glow"
                    }`}>
                    [ {learned ? "OWNED" : "BUY"} ]
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {toast && (
          <div className={`mt-3 text-xs ${toast.ok ? "text-[#00ff88] crpg-glow" : "text-[#ff4d6d] crpg-glow-red"}`}>
            {toast.ok ? "[OK] " : "[!!] "}{toast.msg}
          </div>
        )}
      </Panel>
    </Shell>
  );
}
