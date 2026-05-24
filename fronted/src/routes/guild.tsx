// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell, Panel } from "../components/crpg/Shell";

export const Route = createFileRoute("/guild")({
  component: Guild,
  head: () => ({ meta: [
    { title: "Cloud RPG — Guilds" },
    { name: "description", content: "Top guilds and recruitment boards across Cloud RPG shards." },
  ]}),
});

const GUILDS = [
  { tag: "NULL", name: "<NullPointer>",   members: 128, power: 98423, status: "Holds Tower 7",
    roster: ["N3o_M4ster (LV99)", "GhostByte (LV94)", "ZeroDay (LV91)", "byteWitch (LV88)", "kaiNova (LV85)"] },
  { tag: "0xDE", name: "<0xDEADBEEF>",    members: 96,  power: 81204, status: "Recruiting healers",
    roster: ["HexLord (LV92)", "SegFault (LV87)", "stack_overflow (LV82)", "nullByte (LV80)"] },
  { tag: "GHST", name: "<GhostProtocol>", members: 64,  power: 67710, status: "PvE focused",
    roster: ["Spectre77 (LV85)", "PhantomKey (LV82)", "Wraith.exe (LV78)"] },
  { tag: "RGX",  name: "<RegexRebels>",   members: 41,  power: 42088, status: "Open to all",
    roster: ["G_Rep (LV70)", "AnchorPoint (LV68)", "LookAhead (LV66)", "GreedyMatch (LV61)"] },
];

function Guild() {
  const [open, setOpen] = useState({});
  const [applied, setApplied] = useState({});
  const [toast, setToast] = useState(null);
  function apply(tag) {
    setApplied((a) => ({ ...a, [tag]: true }));
    setToast(`已送出 <${tag}> 公會申請，等待會長審核。`);
    setTimeout(() => setToast(null), 2500);
  }
  function toggle(tag) { setOpen((o) => ({ ...o, [tag]: !o[tag] })); }
  return (
    <Shell>
      <h1 className="text-[#00ff88] crpg-glow text-xl tracking-widest">▌ GUILD REGISTRY</h1>
      {toast && (
        <div className="crpg-panel px-3 py-2 text-xs text-[#00ff88] crpg-glow">[OK] {toast}</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {GUILDS.map((g, i) => (
          <Panel key={i} title={`${g.tag} · ${g.name}`}>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div><div className="text-[#3a8c5e]">MEMBERS</div><div className="text-[#00ff88] crpg-glow text-lg">{g.members}</div></div>
              <div><div className="text-[#3a8c5e]">POWER</div><div className="text-[#ffd60a] crpg-glow-yellow text-lg">{g.power.toLocaleString()}</div></div>
              <div><div className="text-[#3a8c5e]">STATUS</div><div className="text-[#00e5ff] crpg-glow-cyan">{g.status}</div></div>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => apply(g.tag)} disabled={!!applied[g.tag]}
                className={`crpg-panel px-3 py-1 text-xs transition ${applied[g.tag] ? "text-[#3a8c5e] cursor-not-allowed" : "text-[#00ff88] crpg-glow hover:border-[#00ff88]"}`}>
                {applied[g.tag] ? "[applied ✓]" : "[apply]"}
              </button>
              <button onClick={() => toggle(g.tag)}
                className="crpg-panel px-3 py-1 text-xs text-[#7be0a8] hover:text-[#00e5ff] hover:crpg-glow-cyan transition">
                {open[g.tag] ? "[hide roster]" : "[view roster]"}
              </button>
            </div>
            {open[g.tag] && (
              <div className="mt-3 border-t border-[#0f3a26] pt-2">
                <div className="text-[10px] tracking-widest text-[#3a8c5e] mb-1">▌ ROSTER (TOP)</div>
                <ul className="text-xs space-y-0.5">
                  {g.roster.map((r, idx) => (
                    <li key={idx} className="flex justify-between">
                      <span className="text-[#00ff88]">{r}</span>
                      <span className="text-[#3a8c5e]">#{idx + 1}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
        ))}
      </div>
    </Shell>
  );
}
