// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell, Panel } from "../components/crpg/Shell";
import { HpBar, RankTable } from "../components/crpg/GameUI";
import { api, subscribeLive } from "../lib/api";

export const Route = createFileRoute("/")({
  component: Lobby,
  head: () => ({
    meta: [
      { title: "Cloud RPG — Lobby" },
      { name: "description", content: "Cloud RPG：免註冊直接開玩的賽博龐克文字冒險 × 2D 街機格鬥。" },
    ],
  }),
});

const NEWS = [
  { tag: "NEW", text: "故障之塔開放：每層隨機敵人與詞綴，挑戰你的最高樓層！" },
  { tag: "RAID", text: "世界 Boss 上線：全伺服器共用一條血條，倒下後所有參與者都有獎勵。" },
  { tag: "DAILY", text: "每日挑戰：所有人打同一個關卡，台灣時間 0 點更新排行榜。" },
  { tag: "PVP", text: "非同步 PvP：挑戰其他玩家角色的 AI 分身，爭奪積分排名。" },
  { tag: "LOOT", text: "隨機掉寶：護甲與飾品帶稀有度與詞綴，神話級裝備會讓武器發出紅色光暈。" },
];

function Lobby() {
  const [boss, setBoss] = useState(null);
  const [daily, setDaily] = useState(null);
  const [top, setTop] = useState([]);

  useEffect(() => {
    api("/api/worldboss").then(setBoss).catch(() => {});
    api("/api/daily").then(setDaily).catch(() => {});
    api("/api/leaderboard/level").then((d) => setTop(d.rows.slice(0, 5))).catch(() => {});
    return subscribeLive((m) => {
      if (m.type === "raid" && m.boss?.scope === "world") setBoss((b) => (b && b.id === m.boss.id ? { ...b, ...m.boss } : b));
      if (m.online != null) setBoss((b) => (b ? { ...b, online: m.online } : b));
    });
  }, []);

  return (
    <Shell>
      <div className="flex-1 overflow-y-auto crpg-scroll space-y-3 pr-1">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <section className="crpg-panel lg:col-span-2 p-6 relative overflow-hidden">
            <pre className="text-[#00ff88] crpg-glow text-[10px] leading-[10px] mb-4 select-none">
{String.raw`
   ____ _                 _   ____  ____   ____
  / ___| | ___  _   _  __| | |  _ \|  _ \ / ___|
 | |   | |/ _ \| | | |/ _\` | | |_) | |_) | |  _
 | |___| | (_) | |_| | (_| | |  _ <|  __/| |_| |
  \____|_|\___/ \__,_|\__,_| |_| \_\_|    \____|
`}
            </pre>
            <h1 className="text-[#00e5ff] crpg-glow-cyan text-2xl tracking-widest mb-2">// 文字冒險 × 2D 街機格鬥</h1>
            <p className="text-[#7be0a8] max-w-xl leading-relaxed">
              上課發呆許了個願，整個教室被傳送到異世界。選擇職業、和 AI 隊友打倒三巨頭，然後和全伺服器的玩家一起挑戰世界 Boss。
              <span className="text-[#ffd60a]">免註冊，點下去就能玩。</span>
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/play" className="crpg-panel px-6 py-2.5 text-[#00ff88] crpg-glow border-[#00ff88] font-bold text-base">
                ▶ 立即開玩（免註冊）
              </Link>
              <Link to="/raid" className="crpg-panel px-5 py-2 text-[#ff4d6d] crpg-glow-red border-[#ff4d6d]/60 font-bold">
                世界 BOSS
              </Link>
              <Link to="/tower" className="crpg-panel px-5 py-2 text-[#c084fc] border-[#c084fc]/60">
                故障之塔
              </Link>
              <Link to="/arena" className="crpg-panel px-5 py-2 text-[#ffd60a] crpg-glow-yellow">
                自由對戰
              </Link>
            </div>
          </section>

          <Panel title={`LIVE · ● ${boss?.online ?? "-"} 人在線`}>
            {boss ? (
              <div className="space-y-2">
                <div className="text-[#ff7a90] text-sm font-bold">{boss.name}</div>
                <HpBar value={boss.hp} max={boss.hpMax} color="#ff4d6d" />
                <div className="text-[11px] text-[#7be0a8]">{boss.participants} 位玩家參戰中</div>
                <Link to="/raid" className="inline-block text-[#00e5ff] crpg-glow-cyan text-xs">[ 加入討伐 → ]</Link>
              </div>
            ) : (
              <div className="text-[11px] text-[#3a8c5e]">連線中…</div>
            )}
            {daily && (
              <div className="mt-4 border-t border-[#0f3a26] pt-3 space-y-1">
                <div className="text-[#ffd60a] text-sm">今日挑戰：{daily.enemy.name}</div>
                <div className="text-[11px] text-[#c084fc]">{Object.values(daily.modifiers).map((m) => m.name).join(" · ")}</div>
                <Link to="/daily" className="inline-block text-[#00e5ff] crpg-glow-cyan text-xs">[ 挑戰 → ]</Link>
              </div>
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Panel title="NEWS FEED" className="lg:col-span-2">
            <ul className="space-y-2 text-sm">
              {NEWS.map((n, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-[10px] mt-1 px-1.5 py-0.5 border border-[#0f3a26] text-[#ffd60a] crpg-glow-yellow whitespace-nowrap">{n.tag}</span>
                  <span className="text-[#cfeedd]">{n.text}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="TOP PLAYERS">
            <RankTable rows={top} valueLabel="等級" format={(v) => `Lv.${v}`} />
            <Link to="/ranking" className="inline-block mt-2 text-[#00e5ff] crpg-glow-cyan text-xs">[ 全部排行 → ]</Link>
          </Panel>
        </div>
      </div>
    </Shell>
  );
}
