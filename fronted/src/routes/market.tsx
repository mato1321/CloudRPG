// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell, Panel, Stat } from "../components/crpg/Shell";
import { CLASS_META, RARITY, CLASS_TRANSFER_PRICE, INFINITE_GOLD, buildShop, itemStatus } from "../lib/shop";
import { api } from "../lib/api";
import { GearPanel } from "../components/crpg/GearPanel";

export const Route = createFileRoute("/market")({
  component: Market,
  head: () => ({
    meta: [
      { title: "Cloud RPG — Black Market & Class Transfer" },
      { name: "description", content: "Buy skillbooks, weapons, relics, and high-tier Class Transfer Codex on the Cloud RPG black market." },
    ],
  }),
});

// 黑市交易全部由伺服器計算（/api/shop/buy、/api/shop/transfer），改 localStorage 也買不到東西
function Market() {
  const [state, setState] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false); // 由後端 ADMIN_USERNAMES 決定
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/api/profile")
      .then((d) => {
        setState(d.profile);
        setIsAdmin(!!d.isAdmin);
      })
      .catch((e) => setToast({ ok: false, msg: e.message }))
      .finally(() => setLoaded(true));
  }, []);

  const gold = isAdmin ? INFINITE_GOLD : (state?.gold ?? 0);
  const klass = state?.klass;
  const hasSave = !!state;
  const items = buildShop(klass);

  async function call(path: string, body: any) {
    setBusy(true);
    try {
      const r = await api(path, { body });
      setState(r.profile);
      setToast({ ok: true, msg: r.msg });
    } catch (e) {
      setToast({ ok: false, msg: e.message });
    } finally {
      setBusy(false);
    }
  }

  const buy = (it: any) => call("/api/shop/buy", { item_id: it.id });

  function transferClass(targetKlass: string) {
    if (!isAdmin && gold < CLASS_TRANSFER_PRICE) {
      setToast({
        ok: false,
        msg: `轉職需要 ${CLASS_TRANSFER_PRICE.toLocaleString()}G（目前持有 ${gold.toLocaleString()}G，可去哥布林洞、故障之塔或世界 Boss 賺取金幣）`,
      });
      return;
    }
    call("/api/shop/transfer", { klass: targetKlass });
  }

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const headerExtra = (
    <>
      {klass && CLASS_META[klass] && (
        <Stat label="CLASS" value={`${CLASS_META[klass].icon} ${CLASS_META[klass].name}`} color="text-[#00e5ff] crpg-glow-cyan" />
      )}
      <Stat label="GOLD" value={gold.toLocaleString()} color="text-[#ffd60a] crpg-glow-yellow" />
    </>
  );

  return (
    <Shell headerExtra={headerExtra}>
      <div className="flex-1 overflow-y-auto pr-1 space-y-3 crpg-scroll">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-[#00ff88] crpg-glow text-xl tracking-widest">
            ▌ BLACK MARKET // 黑市技能書與轉職聖殿
          </h1>
          <Link
            to="/play"
            className="crpg-panel px-4 py-1.5 text-xs text-[#00ff88] border-[#00ff88] hover:bg-[#0f3a26]/50 font-bold"
          >
            ◀ 返回故事戰鬥 [PLAY]
          </Link>
        </div>

        {loaded && !hasSave && (
          <div className="crpg-panel px-3 py-2 text-xs text-[#ffd60a] crpg-glow-yellow">
            尚未發現存檔。請先到 <Link to="/play" className="underline">[PLAY]</Link> 建立角色後再回來消費或轉職。
          </div>
        )}

        {toast && (
          <div
            className={`crpg-panel px-4 py-2.5 text-xs font-bold border ${
              toast.ok
                ? "border-[#00ff88] text-[#00ff88] crpg-glow bg-[#0f3a26]/40"
                : "border-[#ff4d6d] text-[#ff4d6d] crpg-glow-red bg-[#3a0f1c]/40"
            }`}
          >
            {toast.ok ? "[OK] " : "[!!] "}
            {toast.msg}
          </div>
        )}

        {/* ⭐ 新增：高價轉職聖殿專區 */}
        <Panel
          title={`⚡ 轉職聖殿 // CLASS TRANSFER CODEX · 轉職費用：${CLASS_TRANSFER_PRICE.toLocaleString()}G（保留等級、已學技能書進度與武器加成）`}
        >
          <div className="text-xs text-[#cfeedd] mb-3">
            故事模式初始選定職業後即鎖定無法更改。唯有在此購買高價<span className="text-[#ffd60a] font-bold">「轉職聖典（{CLASS_TRANSFER_PRICE.toLocaleString()}G）」</span>，方可重塑靈魂轉換為其他職業！
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Object.values(CLASS_META).map((c: any) => {
              const isCurrent = klass === c.id;
              const canTransfer = hasSave && !isCurrent && gold >= CLASS_TRANSFER_PRICE;
              return (
                <div
                  key={c.id}
                  className={`crpg-panel p-3.5 flex flex-col gap-2 border ${
                    isCurrent ? "border-[#00ff88] bg-[#0f3a26]/30" : "border-[#0f3a26]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-base font-bold ${c.color}`}>
                      {c.icon} {c.name} ({c.en})
                    </span>
                    <span className="text-xs text-[#ffd60a] crpg-glow-yellow font-bold">
                      {isCurrent ? "[ 當前鎖定職業 ]" : `${CLASS_TRANSFER_PRICE.toLocaleString()}G`}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#cfeedd]">{c.desc}</div>
                  <div className="text-[11px] text-[#7be0a8] space-y-0.5 bg-black/40 p-2 border border-[#0f3a26]">
                    <div>· 技能 1 [R/L]：{c.skill1}</div>
                    <div>· 技能 2 [T/U]：{c.skill2}</div>
                    <div>· 技能 3 [Y/O]：{c.skill3}</div>
                    <div className="text-[#ffd60a]">★ 奧義 [Q/I]：{c.ult}</div>
                  </div>
                  <div className="mt-auto pt-1 flex items-center justify-between">
                    <span className="text-[10px] text-[#3a8c5e]">
                      基礎 HP {c.stats.hp} · MP {c.stats.mp} · ATK {c.stats.atk}
                    </span>
                    <button
                      onClick={() => transferClass(c.id)}
                      disabled={!canTransfer}
                      className={`text-xs px-3 py-1.5 border font-bold transition ${
                        isCurrent
                          ? "border-[#00ff88] text-[#00ff88] cursor-default"
                          : canTransfer
                          ? "border-[#ffd60a] text-[#ffd60a] hover:bg-[#ffd60a]/15 crpg-glow-yellow"
                          : "border-[#0f3a26] text-[#3a8c5e] cursor-not-allowed"
                      }`}
                    >
                      {isCurrent ? "[ 目前職業 ]" : `[ 轉職為${c.name} (${CLASS_TRANSFER_PRICE.toLocaleString()}G) ]`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* 技能書、武器與道具商店 */}
        <Panel
          title={`SHOP · ${
            klass && CLASS_META[klass] ? CLASS_META[klass].name + "專屬 · " : ""
          }你的金幣 ${gold.toLocaleString()}G`}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((it) => {
              const st = itemStatus(it, state, isAdmin);
              const can = hasSave && st.canBuy && !busy;
              const myth = it.id === "terminus";
              const equipped = st.owned > 0 && (it.classOnly || myth) && !st.blocked?.includes("不再需要");
              const cardBorder = equipped
                ? "border border-[#00ff88]/70 bg-[#0f3a26]/25"
                : myth
                ? "border border-[#a78bfa]/40 shadow-[0_0_24px_-6px_rgba(167,139,250,0.7)]"
                : it.isSkillBook
                ? "border border-[#ffd60a]/50"
                : "border border-[#0f3a26]";
              return (
                <div key={it.id} className={`crpg-panel p-3 flex flex-col gap-2 ${cardBorder}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-bold ${RARITY[it.rarity]}`}>
                      {it.isSkillBook ? "📘 " : it.classOnly ? "⚔ " : ""}
                      {it.name}
                    </span>
                    <span
                      className={
                        myth
                          ? "text-[#a78bfa] crpg-glow-cyan text-xs"
                          : "text-[#ffd60a] crpg-glow-yellow text-xs font-bold"
                      }
                    >
                      {st.price.toLocaleString()}G
                    </span>
                  </div>
                  <div className={`text-[11px] font-bold ${myth ? "text-[#a78bfa]" : "text-[#00ff88]"}`}>
                    {it.effect}
                  </div>
                  <div className="text-[11px] text-[#3a8c5e] leading-snug">{it.desc}</div>
                  {it.classOnly && klass && CLASS_META[klass] && (
                    <div className="text-[10px] text-[#00e5ff] crpg-glow-cyan">
                      [ {CLASS_META[klass].name}專屬 ]
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-auto pt-1 gap-2">
                    <span className={`text-[10px] ${equipped ? "text-[#00ff88]" : "text-[#3a8c5e]"}`}>{st.badge}</span>
                    <button
                      onClick={() => buy(it)}
                      disabled={!can}
                      title={st.blocked || (!st.canAfford ? "金幣不足" : "")}
                      className={`text-xs px-3 py-1 border transition whitespace-nowrap ${
                        !can
                          ? "border-[#0f3a26] text-[#3a8c5e] cursor-not-allowed"
                          : myth
                          ? "border-[#a78bfa] text-[#a78bfa] hover:crpg-glow-cyan"
                          : "border-[#00ff88] text-[#00ff88] hover:crpg-glow"
                      }`}
                    >
                      [ {st.label} ]
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {hasSave && (
          <Panel title="🎒 裝備背包 // 隨機掉寶（護甲 / 飾品）">
            <GearPanel profile={state} onProfile={setState} />
          </Panel>
        )}
      </div>
    </Shell>
  );
}
