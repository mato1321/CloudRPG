// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell, Panel } from "../components/crpg/Shell";

export const Route = createFileRoute("/")({
  component: Lobby,
  head: () => ({
    meta: [
      { title: "Cloud RPG — Lobby" },
      { name: "description", content: "Cloud RPG lobby. Cyberpunk terminal-style multiplayer text adventure." },
    ],
  }),
});

const NEWS = [
  { tag: "PATCH",  text: "0.9.4 — balance pass on NetRunner skills, +20% mana regen." },
  { tag: "EVENT",  text: "Double-XP weekend in Dark Valley begins Friday 20:00 UTC." },
  { tag: "WORLD",  text: "Guild <NullPointer> claimed Tower 7. Siege opens in 3 days." },
  { tag: "DEVLOG", text: "New zone 'Sector 9 Underdeck' enters preview shard EU-3." },
];

const ONLINE_BY_SHARD = [
  { name: "EU-WEST-3 · Neo-Town",  online: 1287, ping: 28 },
  { name: "US-EAST-1 · Dark Valley", online: 942,  ping: 84 },
  { name: "AP-SOUTH-1 · Sector 9", online: 613,  ping: 142 },
];

function Lobby() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t+1), 4000); return () => clearInterval(id); }, []);
  return (
    <Shell>
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
          <h1 className="text-[#00e5ff] crpg-glow-cyan text-2xl tracking-widest mb-2">// MULTIPLAYER TEXT ADVENTURE</h1>
          <p className="text-[#7be0a8] max-w-xl leading-relaxed">
            Boot into a cyberpunk grid where every command is law. Trade, raid, hack and forge guilds across
            persistent shards. Your terminal is your sword.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/play" className="crpg-panel px-5 py-2 text-[#00ff88] crpg-glow border-[#00ff88]/60 hover:border-[#00ff88]">
              ▶ ENTER WORLD
            </Link>
            <Link to="/login" className="crpg-panel px-5 py-2 text-[#00e5ff] crpg-glow-cyan">
              ◇ LOGIN / REGISTER
            </Link>
            <Link to="/codex" className="crpg-panel px-5 py-2 text-[#ffd60a] crpg-glow-yellow">
              ✦ READ CODEX
            </Link>
          </div>
        </section>

        <Panel title="LIVE SHARDS">
          <ul className="space-y-2 text-xs">
            {ONLINE_BY_SHARD.map((s, i) => (
              <li key={i} className="flex items-center justify-between border border-[#0f3a26] px-2 py-1.5 hover:border-[#00ff88]/60 transition">
                <div>
                  <div className="text-[#00ff88]">{s.name}</div>
                  <div className="text-[#3a8c5e]">{s.online + ((tick*7)%17)} online · {s.ping}ms</div>
                </div>
                <Link to="/play" className="text-[#00e5ff] crpg-glow-cyan">[join]</Link>
              </li>
            ))}
          </ul>
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

        <Panel title="QUICK STATS">
          <ul className="text-xs space-y-1.5">
            <li className="flex justify-between"><span className="text-[#3a8c5e]">Operators online</span><span className="text-[#00ff88] crpg-glow">2,842</span></li>
            <li className="flex justify-between"><span className="text-[#3a8c5e]">Active guilds</span><span className="text-[#00e5ff] crpg-glow-cyan">317</span></li>
            <li className="flex justify-between"><span className="text-[#3a8c5e]">Open quests</span><span className="text-[#ffd60a] crpg-glow-yellow">1,408</span></li>
            <li className="flex justify-between"><span className="text-[#3a8c5e]">World tick</span><span className="text-[#7be0a8]">#{420000 + tick}</span></li>
          </ul>
        </Panel>
      </div>
    </Shell>
  );
}
