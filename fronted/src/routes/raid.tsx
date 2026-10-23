// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell, Panel } from "../components/crpg/Shell";
import { ModeBattle } from "../components/crpg/ModeBattle";
import { ChatPanel } from "../components/crpg/ChatPanel";
import { HpBar, NeedCharacter, NeedLogin, RankTable } from "../components/crpg/GameUI";
import { api, isLoggedIn, subscribeLive } from "../lib/api";
import { readAuth } from "../lib/auth-utils";
import { RARITY_COLOR } from "../lib/gear";
import { useProfile } from "../lib/useProfile";

export const Route = createFileRoute("/raid")({
  ssr: false,
  component: RaidPage,
  head: () => ({ meta: [{ title: "Cloud RPG — 世界 Boss" }, { name: "description", content: "全伺服器一起打同一隻 Boss 的血條。" }] }),
});

function RaidPage() {
  const { profile, loading } = useProfile();
  const [boss, setBoss] = useState(null);
  const [feed, setFeed] = useState([]);
  const [fighting, setFighting] = useState(false);
  const [claim, setClaim] = useState(null);
  const [err, setErr] = useState(null);

  const load = () => api("/api/worldboss").then(setBoss).catch((e) => setErr(e.message));

  useEffect(() => {
    load();
    const unsub = subscribeLive((m) => {
      if (m.online != null) setBoss((b) => (b ? { ...b, online: m.online } : b));
      if (m.type !== "raid" || m.boss?.scope !== "world") return;
      setBoss((b) => (b && b.id === m.boss.id ? { ...b, ...m.boss } : b));
      setFeed((f) => [{ by: m.by, dealt: m.dealt, killed: m.killed, at: Date.now() }, ...f].slice(0, 12));
      if (m.killed) setTimeout(load, 800); // 新的 Boss 出現
    });
    const t = setInterval(load, 20000); // 排行與參與人數
    return () => {
      unsub();
      clearInterval(t);
    };
  }, []);

  async function doClaim() {
    try {
      setClaim(await api("/api/worldboss/claim", { body: {} }));
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  if (fighting) {
    return (
      <Shell>
        <div className="flex-1 overflow-y-auto crpg-scroll">
          <ModeBattle
            start={{ mode: "worldboss" }}
            title={`世界 Boss · ${boss?.name || ""}（45 秒內盡量輸出）`}
            onExit={() => setFighting(false)}
            onDone={() => {
              setFighting(false);
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
            <h1 className="text-[#ff4d6d] crpg-glow-red text-xl tracking-widest">▌ 世界 BOSS // WORLD RAID</h1>
            <p className="text-[12px] text-[#7be0a8]">全伺服器共用同一條血條，每場 45 秒，打出的傷害直接扣在共享血量上。Boss 倒下後所有參與者都能領獎勵，下一隻會更強。</p>
          </div>
          <div className="text-[12px] text-[#00ff88]">● {boss?.online ?? "-"} 人在線 · {boss?.participants ?? 0} 人參戰</div>
        </div>
        {err && <div className="crpg-panel px-3 py-2 text-xs text-[#ff4d6d] border border-[#ff4d6d]">[!!] {err}</div>}

        <div className="crpg-panel p-4 space-y-3 border border-[#ff4d6d]/50">
          <div className="text-2xl text-[#ff7a90] crpg-glow-red font-bold">{boss?.name || "讀取中…"}</div>
          {boss && <HpBar label="全服共享血量" value={boss.hp} max={boss.hpMax} color="#ff4d6d" height={22} />}
          <div className="flex flex-wrap items-center gap-3">
            {!isLoggedIn() ? (
              <NeedLogin what="世界 Boss" />
            ) : !loading && !profile ? (
              <NeedCharacter />
            ) : (
              <button onClick={() => setFighting(true)} className="crpg-panel px-6 py-2 text-[#ff4d6d] crpg-glow-red border-[#ff4d6d]/60 font-bold">
                [ 參戰（45 秒） ]
              </button>
            )}
            {boss?.mine && <span className="text-[12px] text-[#cfeedd]">你的累積傷害：<span className="text-[#ffd60a]">{boss.mine.damage.toLocaleString()}</span>（{boss.mine.hits} 場）</span>}
            {boss?.unclaimed > 0 && (
              <button onClick={doClaim} className="crpg-panel px-4 py-2 text-[#ffd60a] crpg-glow-yellow border-[#ffd60a]/60 font-bold animate-pulse">
                [ 領取 {boss.unclaimed} 份討伐獎勵 ]
              </button>
            )}
          </div>
          {claim && (
            <div className="text-[12px] text-[#00ff88] space-y-1">
              <div>領取成功：+{claim.gold.toLocaleString()}G</div>
              {claim.gear.map((g) => (
                <div key={g.id} style={{ color: RARITY_COLOR[g.rarity] }}>{g.name}</div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Panel title="傷害排行（本隻 Boss）">
            <RankTable rows={(boss?.top || []).map((r) => ({ username: r.username, value: r.damage }))} valueLabel="傷害" highlight={me} />
          </Panel>
          <Panel title="即時戰報">
            <ul className="text-[12px] space-y-1">
              {feed.map((f) => (
                <li key={f.at} className={f.killed ? "text-[#ffd60a] font-bold" : "text-[#cfeedd]"}>
                  {f.by} 造成 {f.dealt.toLocaleString()} 傷害{f.killed ? " 最後一擊！" : ""}
                </li>
              ))}
              {!feed.length && <li className="text-[#3a8c5e]">等待其他玩家出手…（即時更新）</li>}
            </ul>
          </Panel>
          <ChatPanel channel="world" title="WORLD CHAT" className="min-h-[260px]" />
        </div>
      </div>
    </Shell>
  );
}
