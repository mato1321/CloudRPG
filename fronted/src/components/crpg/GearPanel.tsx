// @ts-nocheck
import { useState } from "react";
import { api } from "../../lib/api";
import { RARITY_COLOR, RARITY_NAME, SLOT_NAME, sortGear, statText } from "../../lib/gear";

/** 裝備背包：隨機掉寶的護甲 / 飾品，可以裝備、卸下、分解成金幣（全部經過伺服器） */
export function GearPanel({ profile, onProfile }) {
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const gear = sortGear(profile?.gear || []);
  const equipped = profile?.equippedGear || {};
  const equippedIds = new Set(Object.values(equipped));

  async function call(path, body, okText) {
    setBusy(true);
    try {
      const r = await api(path, { body });
      onProfile?.(r.profile);
      setMsg({ ok: true, text: okText(r) });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  }

  const gs = profile?.gearStats || {};
  return (
    <div className="space-y-2">
      <div className="text-[11px] text-[#7be0a8]">
        裝備加成：ATK +{gs.atk || 0} · HP +{gs.hp || 0} · MP +{gs.mp || 0} · 氣條 +{gs.energy || 0}% · 速度 +{gs.speed || 0}%
        <span className="text-[#3a8c5e]">　（背包 {gear.length}/40，滿了會自動分解）</span>
      </div>
      {msg && (
        <div className={`px-2 py-1 text-[11px] border ${msg.ok ? "border-[#00ff88] text-[#00ff88]" : "border-[#ff4d6d] text-[#ff4d6d]"}`}>{msg.text}</div>
      )}
      {!gear.length && <div className="text-[11px] text-[#3a8c5e]">還沒有裝備。打倒 Boss、爬故障之塔、每日挑戰、世界 Boss 都會掉寶！</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {gear.map((g) => {
          const on = equippedIds.has(g.id);
          const color = RARITY_COLOR[g.rarity];
          return (
            <div key={g.id} className="border p-2 text-[11px]" style={{ borderColor: on ? color : "#0f3a26", boxShadow: on ? `0 0 14px -6px ${color}` : "none" }}>
              <div className="flex justify-between gap-2">
                <span style={{ color }} className="font-bold">{g.name}</span>
                <span className="text-[#3a8c5e] whitespace-nowrap">{SLOT_NAME[g.slot]} · Lv.{g.level}</span>
              </div>
              <div className="text-[#cfeedd] mt-0.5">{statText(g.stats)}</div>
              <div className="flex gap-1.5 mt-1.5">
                <button
                  disabled={busy}
                  onClick={() => call("/api/gear/equip", on ? { item_id: null, slot: g.slot } : { item_id: g.id }, () => (on ? `已卸下 ${g.name}` : `已裝備 ${g.name}`))}
                  className={`px-2 py-0.5 border ${on ? "border-[#ffd60a] text-[#ffd60a]" : "border-[#00ff88] text-[#00ff88]"}`}
                >
                  [ {on ? "卸下" : "裝備"} ]
                </button>
                <button
                  disabled={busy}
                  onClick={() => call("/api/gear/salvage", { item_id: g.id }, (r) => `分解 ${g.name}，獲得 ${r.gold}G`)}
                  className="px-2 py-0.5 border border-[#3a0f1c] text-[#ff4d6d]"
                >
                  [ 分解 ]
                </button>
                {on && <span className="ml-auto text-[#00ff88]">裝備中（{RARITY_NAME[g.rarity]}光效）</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
