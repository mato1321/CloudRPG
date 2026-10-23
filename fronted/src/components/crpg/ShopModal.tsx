// @ts-nocheck
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { buildShop, itemStatus, RARITY, CLASS_META, weaponLoadout } from "../../lib/shop";
import { GearPanel } from "./GearPanel";

/**
 * 故事模式內的「快速黑市」：在戰鬥畫面按「🛒 快速開啟黑市」、側欄按鈕或輸入 shop 開啟。
 * 開啟時戰鬥暫停。購買由伺服器計算（/api/shop/buy），買到的武器 / 技能書立刻反映在格鬥畫面。
 * 訪客沒有雲端帳號，黑市會提示先綁定帳號。
 */
export function ShopModal({ state, isAdmin, online, initialTab = "shop", onClose, onPurchased, onNeedBind }: any) {
  const [toast, setToast] = useState<any>(null);
  const [tab, setTab] = useState(initialTab);
  const [busy, setBusy] = useState(false);

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

  async function buy(it: any) {
    setBusy(true);
    try {
      const r = await api("/api/shop/buy", { body: { item_id: it.id } });
      setToast({ ok: true, msg: r.msg });
      onPurchased(r.profile, r.msg);
    } catch (e) {
      setToast({ ok: false, msg: e.message });
    } finally {
      setBusy(false);
    }
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
          <div className="flex items-center gap-2">
            {[
              ["shop", "黑市"],
              ["gear", "裝備背包"],
            ].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-3 py-1 text-xs border ${tab === k ? "border-[#ffd60a] text-[#ffd60a] crpg-glow-yellow" : "border-[#0f3a26] text-[#3a8c5e]"}`}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="text-[#3a8c5e]">
              GOLD <span className="text-[#ffd60a] crpg-glow-yellow">{isAdmin ? "∞" : (state.gold ?? 0).toLocaleString()}G</span>
            </span>
            <span className="text-[#3a8c5e]">
              裝備中{" "}
              <span className="text-[#00e5ff] crpg-glow-cyan">
                {weaponName}
                {lo.plus > 0 && lo.tier < 3 ? ` +${lo.plus}` : ""}
              </span>
            </span>
            <button onClick={onClose} className="px-2 py-0.5 border border-[#3a0f1c] text-[#ff4d6d] hover:border-[#ff4d6d]">
              [ ESC 關閉 ]
            </button>
          </div>
        </div>

        {!online ? (
          <div className="p-6 space-y-3 text-sm">
            <div className="text-[#ffd60a] crpg-glow-yellow text-lg">黑市需要帳號</div>
            <p className="text-[#7be0a8] text-[13px] leading-relaxed">
              金幣、物品與裝備都由雲端伺服器保管（防止修改存檔作弊），所以訪客還不能交易。綁定帳號後，目前的訪客進度會一起保存。
            </p>
            <button onClick={onNeedBind} className="crpg-panel px-5 py-2 text-[#00ff88] crpg-glow">
              [ 綁定帳號 ]
            </button>
          </div>
        ) : (
          <>
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
            {tab === "gear" ? (
              <div className="overflow-y-auto crpg-scroll p-3">
                <GearPanel profile={state} onProfile={(p) => onPurchased(p, null)} />
              </div>
            ) : (
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
                          disabled={!st.canBuy || busy}
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
            )}
          </>
        )}

        <div className="px-4 py-1.5 border-t border-[#0f3a26] text-[10px] text-[#3a8c5e]">
          {state.battle ? "戰鬥已暫停 · " : ""}購買後技能與武器外觀在戰鬥中立即生效 · 轉職請到 [MARKET] 頁面
        </div>
      </div>
    </div>
  );
}
