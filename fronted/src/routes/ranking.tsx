// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell, Panel } from "../components/crpg/Shell";
import { RankTable } from "../components/crpg/GameUI";
import { api } from "../lib/api";
import { readAuth } from "../lib/auth-utils";

export const Route = createFileRoute("/ranking")({
  ssr: false,
  component: RankingPage,
  head: () => ({ meta: [{ title: "Cloud RPG — 排行榜" }, { name: "description", content: "等級、故障之塔、PvP、每日挑戰、世界 Boss、公會排行榜。" }] }),
});

const BOARDS = [
  { key: "level", label: "等級", value: "等級", fmt: (v) => `Lv.${v}` },
  { key: "tower", label: "故障之塔", value: "最高樓層", fmt: (v) => `${v} F` },
  { key: "pvp", label: "PvP 積分", value: "積分", fmt: (v) => v },
  { key: "daily", label: "今日挑戰", value: "分數", fmt: (v) => v.toLocaleString() },
  { key: "worldboss", label: "世界 Boss", value: "傷害", fmt: (v) => v.toLocaleString() },
  { key: "guild", label: "公會（本週）", value: "公會 Boss 傷害", fmt: (v) => v.toLocaleString() },
];

function RankingPage() {
  const [tab, setTab] = useState("level");
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    setData(null);
    api(`/api/leaderboard/${tab}`)
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [tab]);
  const b = BOARDS.find((x) => x.key === tab);
  const rows = (data?.rows || []).map((r) => ({ username: r.username, value: r.value ?? r.score }));
  return (
    <Shell>
      <div className="flex-1 overflow-y-auto crpg-scroll space-y-3 pr-1">
        <h1 className="text-[#ffd60a] crpg-glow-yellow text-xl tracking-widest">▌ LEADERBOARD // 排行榜</h1>
        <div className="flex flex-wrap gap-2">
          {BOARDS.map((x) => (
            <button key={x.key} onClick={() => setTab(x.key)} className={`px-3 py-1 text-xs border ${tab === x.key ? "border-[#ffd60a] text-[#ffd60a] crpg-glow-yellow" : "border-[#0f3a26] text-[#7be0a8]"}`}>
              {x.label}
            </button>
          ))}
        </div>
        {err && <div className="text-xs text-[#ff4d6d]">[!!] {err}</div>}
        <Panel title={`${b.label}${data?.day ? ` · ${data.day}` : ""}${data?.week ? ` · ${data.week}` : ""}${data?.boss ? ` · ${data.boss}` : ""}`}>
          {!data ? <div className="text-xs text-[#3a8c5e]">讀取中…</div> : <RankTable rows={rows} valueLabel={b.value} format={b.fmt} highlight={readAuth()?.user} />}
        </Panel>
      </div>
    </Shell>
  );
}
