// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell, Panel } from "../components/crpg/Shell";
import { ModeBattle } from "../components/crpg/ModeBattle";
import { HpBar, ModifierChips, NeedCharacter, NeedLogin, RankTable } from "../components/crpg/GameUI";
import { api, isLoggedIn } from "../lib/api";
import { readAuth } from "../lib/auth-utils";
import { useProfile } from "../lib/useProfile";

export const Route = createFileRoute("/tower")({
  ssr: false,
  component: TowerPage,
  head: () => ({ meta: [{ title: "Cloud RPG — 故障之塔" }, { name: "description", content: "Roguelite 爬塔：每層隨機敵人與詞綴，越爬越難。" }] }),
});

const MOD_INFO = {
  berserk: { name: "狂暴", desc: "敵人攻擊與速度 +30%" },
  glass: { name: "玻璃大砲", desc: "雙方受到的傷害 ×2" },
  blackwater: { name: "全場黑水", desc: "場上會不斷出現黑水陷阱" },
  thunder: { name: "雷暴", desc: "天空隨機落雷" },
  clone: { name: "分身", desc: "敵人的分身會從畫面另一端突進" },
  regen: { name: "再生", desc: "敵人每秒回復生命" },
  fog: { name: "迷霧", desc: "視野變暗" },
  giant: { name: "巨大化", desc: "敵人血量 +60%、體型變大" },
};

function TowerPage() {
  const { profile, loading } = useProfile();
  const [run, setRun] = useState(null);
  const [board, setBoard] = useState([]);
  const [fighting, setFighting] = useState(false);
  const [err, setErr] = useState(null);

  const load = () => {
    api("/api/tower").then(setRun).catch((e) => setErr(e.message));
    api("/api/leaderboard/tower").then((d) => setBoard(d.rows.slice(0, 15))).catch(() => {});
  };
  useEffect(() => {
    if (isLoggedIn()) load();
  }, []);

  async function act(path, body) {
    setErr(null);
    try {
      setRun(await api(path, { body: body || {} }));
    } catch (e) {
      setErr(e.message);
    }
  }

  if (!isLoggedIn()) return <Shell><NeedLogin what="故障之塔" /></Shell>;
  if (!loading && !profile) return <Shell><NeedCharacter /></Shell>;

  if (fighting && run?.active) {
    return (
      <Shell>
        <div className="flex-1 overflow-y-auto crpg-scroll">
          <ModeBattle
            start={{ mode: "tower" }}
            title={`故障之塔 · 第 ${run.floor} 層${run.next?.boss ? "（BOSS 層）" : ""}`}
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
            <h1 className="text-[#c084fc] crpg-glow-cyan text-xl tracking-widest">▌ 故障之塔 // GLITCH TOWER</h1>
            <p className="text-[12px] text-[#7be0a8]">每層隨機敵人與詞綴，生命會延續到下一層；每過一層選一個祝福。每 5 層是 Boss 層，必掉稀有以上裝備。</p>
          </div>
          <div className="text-[12px] text-[#ffd60a]">個人最佳：第 {run?.best ?? 0} 層</div>
        </div>
        {err && <div className="crpg-panel px-3 py-2 text-xs text-[#ff4d6d] border border-[#ff4d6d]">[!!] {err}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
          <Panel title={run?.active ? `進行中 · 第 ${run.floor} 層` : "準備攀登"}>
            {!run && <div className="text-[#3a8c5e] text-xs">讀取中…</div>}
            {run && !run.active && (
              <div className="space-y-3">
                <p className="text-[13px] text-[#cfeedd]">
                  前 2 層沒有詞綴，第 3 層開始出現 1 個、第 7 層 2 個、第 15 層 3 個。敵人血量每層 +15%、攻擊 +7%。打輸就結束，紀錄你爬到幾層。
                </p>
                <button onClick={() => act("/api/tower/start")} className="crpg-panel px-6 py-2 text-[#c084fc] border-[#c084fc]/60 font-bold">
                  [ ▶ 開始攀登 ]
                </button>
              </div>
            )}
            {run?.active && run.pendingBlessing && (
              <div className="space-y-3">
                <div className="text-[#00ff88] crpg-glow">通過！選擇一個祝福後挑戰第 {run.floor} 層：</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {Object.entries(run.blessings || {}).map(([k, b]) => (
                    <button key={k} onClick={() => act("/api/tower/blessing", { blessing: k })} className="crpg-panel p-3 text-left border border-[#ffd60a]/50 hover:border-[#ffd60a]">
                      <div className="text-[#ffd60a] font-bold text-sm">{b.name}</div>
                      <div className="text-[12px] text-[#cfeedd]">{b.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {run?.active && !run.pendingBlessing && (
              <div className="space-y-3">
                <HpBar label="目前 HP（延續到下一層）" value={run.hpRatio * (profile?.hpMax || 100)} max={profile?.hpMax || 100} color="#00ff88" />
                <div className="border border-[#0f3a26] p-3 space-y-2">
                  <div className="text-[12px] text-[#3a8c5e]">下一個對手</div>
                  <div className="text-lg text-[#ff7a90] font-bold">
                    {run.next.boss && <span className="text-[#ffd60a]">[BOSS] </span>}
                    {run.next.name} <span className="text-[12px] text-[#7be0a8]">HP {run.next.hp} · 攻擊 ×{run.next.atkScale}</span>
                  </div>
                  <ModifierChips mods={run.next.modifiers} info={MOD_INFO} />
                </div>
                <div className="text-[12px] text-[#7be0a8]">
                  已獲得祝福：ATK +{12 * (run.buffs?.power || 0)}%（上限 +{12 * (run.powerMax || 3)}%）{run.buffs?.energy ? " · 開場氣條 +40%" : ""}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setFighting(true)} className="crpg-panel px-6 py-2 text-[#00ff88] crpg-glow border-[#00ff88]/60 font-bold">
                    [ 挑戰第 {run.floor} 層 ]
                  </button>
                  <button onClick={() => confirm("確定放棄這次攀登？") && act("/api/tower/abandon")} className="crpg-panel px-4 py-2 text-[#ff4d6d] text-xs">
                    [ 放棄 ]
                  </button>
                </div>
              </div>
            )}
          </Panel>
          <Panel title="攀登排行榜">
            <RankTable rows={board} valueLabel="最高樓層" format={(v) => `${v} F`} highlight={me} />
          </Panel>
        </div>
      </div>
    </Shell>
  );
}
