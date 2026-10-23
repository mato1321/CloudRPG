// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell, Panel } from "../components/crpg/Shell";
import { ModeBattle } from "../components/crpg/ModeBattle";
import { ModifierChips, NeedCharacter, NeedLogin, RankTable } from "../components/crpg/GameUI";
import { api, isLoggedIn } from "../lib/api";
import { readAuth } from "../lib/auth-utils";
import { useProfile } from "../lib/useProfile";

export const Route = createFileRoute("/daily")({
  ssr: false,
  component: DailyPage,
  head: () => ({ meta: [{ title: "Cloud RPG — 每日挑戰" }, { name: "description", content: "所有人打同一個隨機關卡，比分數上排行榜。" }] }),
});

function DailyPage() {
  const { profile, loading } = useProfile();
  const [info, setInfo] = useState(null);
  const [fighting, setFighting] = useState(false);
  const [err, setErr] = useState(null);
  const load = () => api("/api/daily").then(setInfo).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);

  if (fighting) {
    return (
      <Shell>
        <div className="flex-1 overflow-y-auto crpg-scroll">
          <ModeBattle
            start={{ mode: "daily" }}
            title={`每日挑戰 ${info?.day}`}
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
  const enemy = info?.enemy;
  return (
    <Shell>
      <div className="flex-1 overflow-y-auto crpg-scroll space-y-3 pr-1">
        <div>
          <h1 className="text-[#ffd60a] crpg-glow-yellow text-xl tracking-widest">▌ 每日挑戰 // DAILY RUN {info?.day}</h1>
          <p className="text-[12px] text-[#7be0a8]">
            全服今天都打同一個關卡（同一個隨機種子），每天台灣時間 0 點更新。分數 = 是否通關 + 剩餘血量 + 速度 + 最高連擊。每天第一次通關送 300G 和一件裝備。
          </p>
        </div>
        {err && <div className="crpg-panel px-3 py-2 text-xs text-[#ff4d6d] border border-[#ff4d6d]">[!!] {err}</div>}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-3">
          <Panel title="今日關卡">
            {!enemy ? (
              <div className="text-xs text-[#3a8c5e]">讀取中…</div>
            ) : (
              <div className="space-y-3">
                <div className="text-lg text-[#ff7a90] font-bold">
                  {enemy.name} <span className="text-[12px] text-[#7be0a8]">HP {enemy.hp} · 攻擊 ×{enemy.atkScale}</span>
                </div>
                <ModifierChips mods={enemy.modifiers} info={info.modifiers} />
                {info.mine && (
                  <div className="text-[12px] text-[#cfeedd]">
                    你的今日最佳：<span className="text-[#ffd60a]">{info.mine.score.toLocaleString()}</span> 分{info.mine.cleared ? " · 已通關" : ""}
                  </div>
                )}
                {!isLoggedIn() ? (
                  <NeedLogin what="每日挑戰" />
                ) : !loading && !profile ? (
                  <NeedCharacter />
                ) : (
                  <button onClick={() => setFighting(true)} className="crpg-panel px-6 py-2 text-[#ffd60a] crpg-glow-yellow border-[#ffd60a]/60 font-bold">
                    [ 挑戰今日關卡 ]
                  </button>
                )}
              </div>
            )}
          </Panel>
          <Panel title="今日排行榜">
            <RankTable rows={(info?.top || []).map((r) => ({ username: r.username, value: r.score }))} valueLabel="分數" highlight={me} />
          </Panel>
        </div>
      </div>
    </Shell>
  );
}
