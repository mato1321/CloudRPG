// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell, Panel } from "../components/crpg/Shell";
import { ModeBattle } from "../components/crpg/ModeBattle";
import { NeedCharacter, NeedLogin, RankTable } from "../components/crpg/GameUI";
import { api, isLoggedIn } from "../lib/api";
import { readAuth } from "../lib/auth-utils";
import { CLASSES } from "../lib/classes";
import { useProfile } from "../lib/useProfile";

export const Route = createFileRoute("/pvp")({
  ssr: false,
  component: PvpPage,
  head: () => ({ meta: [{ title: "Cloud RPG — 非同步 PvP" }, { name: "description", content: "挑戰其他玩家角色的 AI 分身，爭奪積分排名。" }] }),
});

function PvpPage() {
  const { profile, loading } = useProfile();
  const [data, setData] = useState(null);
  const [board, setBoard] = useState([]);
  const [target, setTarget] = useState(null);
  const [err, setErr] = useState(null);

  const load = () => {
    api("/api/pvp/opponents").then(setData).catch((e) => setErr(e.message));
    api("/api/leaderboard/pvp").then((d) => setBoard(d.rows.slice(0, 15))).catch(() => {});
  };
  useEffect(() => {
    if (isLoggedIn()) load();
  }, []);

  if (!isLoggedIn()) return <Shell><NeedLogin what="PvP" /></Shell>;
  if (!loading && !profile) return <Shell><NeedCharacter /></Shell>;

  if (target) {
    return (
      <Shell>
        <div className="flex-1 overflow-y-auto crpg-scroll">
          <ModeBattle
            start={{ mode: "pvp", ref: target.ref }}
            title={`PvP · VS ${target.name}`}
            onExit={() => setTarget(null)}
            onDone={() => {
              setTarget(null);
              load();
            }}
          />
        </div>
      </Shell>
    );
  }

  const me = readAuth()?.user;
  return (
    <Shell>
      <div className="flex-1 overflow-y-auto crpg-scroll space-y-3 pr-1">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-[#00e5ff] crpg-glow-cyan text-xl tracking-widest">▌ 非同步 PvP // GHOST ARENA</h1>
            <p className="text-[12px] text-[#7be0a8]">對手是其他玩家角色的 AI 分身（用他們的職業、等級、武器），不用同時在線也能對戰。贏了加積分與 80G，對手的積分也會變動。</p>
          </div>
          {data && (
            <div className="text-right text-[12px]">
              <div className="text-[#00e5ff] text-lg crpg-glow-cyan">積分 {data.rating}</div>
              <div className="text-[#7be0a8]">{data.wins} 勝 / {data.losses} 敗</div>
            </div>
          )}
        </div>
        {err && <div className="crpg-panel px-3 py-2 text-xs text-[#ff4d6d] border border-[#ff4d6d]">[!!] {err}</div>}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
          <Panel title="選擇對手">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {(data?.opponents || []).map((o) => {
                const c = CLASSES[o.klass];
                return (
                  <div key={o.ref} className="border border-[#0f3a26] p-3 space-y-1 hover:border-[#00e5ff]/60">
                    <div className="flex justify-between">
                      <span className="text-[#cfeedd] font-bold">
                        {o.bot ? "🤖 " : "👤 "}
                        {o.name}
                      </span>
                      <span className="text-[#00e5ff]">{o.rating}</span>
                    </div>
                    <div className={`text-[12px] ${c?.color || ""}`}>
                      {c?.icon} {c?.name} · Lv.{o.level} · ATK {o.atk} · HP {o.hpMax}
                    </div>
                    <button onClick={() => setTarget(o)} className="mt-1 px-3 py-1 border border-[#00e5ff] text-[#00e5ff] text-xs hover:crpg-glow-cyan">
                      [ ⚔ 挑戰 ]
                    </button>
                  </div>
                );
              })}
            </div>
            <button onClick={load} className="mt-3 text-xs px-3 py-1 border border-[#0f3a26] text-[#7be0a8]">
              [ ↻ 換一批對手 ]
            </button>
          </Panel>
          <Panel title="🏆 積分排行">
            <RankTable rows={board} valueLabel="積分" highlight={me} />
          </Panel>
        </div>
      </div>
    </Shell>
  );
}
