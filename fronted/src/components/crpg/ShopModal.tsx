// @ts-nocheck
import { useEffect, useState } from "react";
import { buildShop, itemStatus, applyPurchase, RARITY, CLASS_META, weaponLoadout } from "../../lib/shop";

/**
 * 故事模式內的「快速黑市」：在戰鬥畫面按「🛒 快速開啟黑市」、側欄按鈕或輸入 shop 開啟。
 * 開啟時戰鬥暫停；買到的武器 / 技能書會立刻反映在格鬥畫面（武器外觀即時進化）。
 */
export function ShopModal({ state, isAdmin, onClose, onPurchased }: any) {
  const [toast, setToast] = useState<any>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  const meta = CLASS_META[state.klass];
  const lo = weaponLoadout(state.inv);
  const weaponName =
    lo.tier === 3 ? "???終端機" : lo.tier === 2 ? meta?.wAdv : lo.tier === 1 ? meta?.wBasic : "很廢的武器（初始）";
  const items = buildShop(state.klass);

  function buy(it: any) {
    const r = applyPurchase(state, it, isAdmin);
    setToast(r);
    if (r.ok) onPurchased(r.state, r.msg);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="crpg-panel w-full max-w-4xl max-h-[88vh] flex flex-col border border-[#ffd60a]/60">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-[#0f3a26]">
          <div className="text-[#ffd60a] crpg-glow-yellow font-bold tracking-widest text-sm">🛒 BLACK MARKET // 快速黑市</div>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="text-[#3a8c5e]">
              GOLD <span className="text-[#ffd60a] crpg-glow-yellow">{isAdmin ? "∞" : (state.gold ?? 0).toLocaleString()}G</span>
            </span>
            <span className="text-[#3a8c5e]">
              裝備中{" "}
              <span className="text-[#00e5ff] crpg-glow-cyan">
                ⚔ {weaponName}
                {lo.plus > 0 && lo.tier < 3 ? ` +${lo.plus}` : ""}
              </span>
            </span>
            <button onClick={onClose} className="px-2 py-0.5 border border-[#3a0f1c] text-[#ff4d6d] hover:border-[#ff4d6d]">
              [ ESC 關閉 ]
            </button>
          </div>
        </div>

        {toast && (
          <div
            className={`mx-3 mt-2 px-3 py-2 text-xs font-bold border ${
              toast.ok ? "border-[#00ff88] text-[#00ff88] bg-[#0f3a26]/40" : "border-[#ff4d6d] text-[#ff4d6d] bg-[#3a0f1c]/40"
            }`}
          >
            {toast.ok ? "[OK] " : "[!!] "}
            {toast.msg}
          </div>
        )}

        <div className="overflow-y-auto crpg-scroll p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {items.map((it) => {
            const st = itemStatus(it, state, isAdmin);
            const myth = it.id === "terminus";
            const equipped = st.owned > 0 && (it.classOnly || myth) && !st.blocked?.includes("不再需要");
            return (
              <div
                key={it.id}
                className={`crpg-panel p-2.5 flex flex-col gap-1.5 border ${
                  equipped ? "border-[#00ff88]/70 bg-[#0f3a26]/25" : myth ? "border-[#a78bfa]/50" : it.isSkillBook ? "border-[#ffd60a]/40" : "border-[#0f3a26]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[13px] font-bold ${RARITY[it.rarity]}`}>
                    {it.isSkillBook ? "📘 " : it.classOnly ? "⚔ " : ""}
                    {it.name}
                  </span>
                  <span className="text-[#ffd60a] crpg-glow-yellow text-xs font-bold">{st.price.toLocaleString()}G</span>
                </div>
                <div className={`text-[11px] font-bold ${myth ? "text-[#a78bfa]" : "text-[#00ff88]"}`}>{it.effect}</div>
                <div className="text-[10px] text-[#3a8c5e] leading-snug">{it.desc}</div>
                <div className="flex items-center justify-between mt-auto pt-1 gap-2">
                  <span className={`text-[10px] ${equipped ? "text-[#00ff88]" : "text-[#3a8c5e]"}`}>{st.badge}</span>
                  <button
                    onClick={() => buy(it)}
                    disabled={!st.canBuy}
                    title={st.blocked || (!st.canAfford ? "金幣不足" : "")}
                    className={`text-[11px] px-2.5 py-1 border transition whitespace-nowrap ${
                      st.canBuy ? "border-[#00ff88] text-[#00ff88] hover:crpg-glow" : "border-[#0f3a26] text-[#3a8c5e] cursor-not-allowed"
                    }`}
                  >
                    [ {st.label} ]
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-1.5 border-t border-[#0f3a26] text-[10px] text-[#3a8c5e]">
          {state.battle ? "⏸ 戰鬥已暫停 · " : ""}購買後技能與武器外觀在戰鬥中立即生效 · 轉職請到 [MARKET] 頁面
        </div>
      </div>
    </div>
  );
}
