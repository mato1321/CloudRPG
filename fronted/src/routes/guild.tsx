// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell, Panel } from "../components/crpg/Shell";
import { ModeBattle } from "../components/crpg/ModeBattle";
import { ChatPanel } from "../components/crpg/ChatPanel";
import { HpBar, NeedCharacter, NeedLogin } from "../components/crpg/GameUI";
import { api, isLoggedIn, subscribeLive } from "../lib/api";
import { CLASSES } from "../lib/classes";
import { RARITY_COLOR } from "../lib/gear";
import { useProfile } from "../lib/useProfile";

export const Route = createFileRoute("/guild")({
  ssr: false,
  component: GuildPage,
  head: () => ({ meta: [{ title: "Cloud RPG — 公會" }, { name: "description", content: "建立或加入公會，一起挑戰每週公會 Boss。" }] }),
});

function GuildPage() {
  const { profile, loading } = useProfile();
  const [mine, setMine] = useState(undefined);
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ tag: "", name: "", description: "" });
  const [fighting, setFighting] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = () => {
    api("/api/guilds/mine").then((d) => setMine(d.guild ? d : null)).catch((e) => setMsg({ ok: false, text: e.message }));
    api(`/api/guilds?q=${encodeURIComponent(q)}`).then((d) => setList(d.guilds)).catch(() => {});
  };
  useEffect(() => {
    if (isLoggedIn()) load();
  }, []);
  useEffect(() => {
    if (!mine?.guild) return;
    return subscribeLive((m) => {
      if (m.type === "raid" && m.boss?.scope?.startsWith("guild:")) setMine((d) => (d ? { ...d, boss: { ...d.boss, ...m.boss } } : d));
    });
  }, [mine?.guild?.id]);

  async function act(path, body, ok) {
    try {
      const r = await api(path, { body: body || {} });
      setMsg({ ok: true, text: ok(r) });
      load();
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    }
  }

  if (!isLoggedIn()) return <Shell><NeedLogin what="公會" /></Shell>;
  if (!loading && !profile) return <Shell><NeedCharacter /></Shell>;

  if (fighting) {
    return (
      <Shell>
        <div className="flex-1 overflow-y-auto crpg-scroll">
          <ModeBattle
            start={{ mode: "guildboss" }}
            title={`公會 Boss · ${mine?.boss?.name}（45 秒）`}
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

  return (
    <Shell>
      <div className="flex-1 overflow-y-auto crpg-scroll space-y-3 pr-1">
        <h1 className="text-[#00ff88] crpg-glow text-xl tracking-widest">▌ GUILD // 公會</h1>
        {msg && <div className={`crpg-panel px-3 py-2 text-xs border ${msg.ok ? "border-[#00ff88] text-[#00ff88]" : "border-[#ff4d6d] text-[#ff4d6d]"}`}>{msg.text}</div>}

        {mine === undefined && <div className="text-xs text-[#3a8c5e]">讀取中…</div>}

        {mine?.guild && (
          <>
            <div className="crpg-panel p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-2xl text-[#00ff88] crpg-glow">
                    &lt;{mine.guild.tag}&gt; {mine.guild.name}
                  </div>
                  <div className="text-[12px] text-[#7be0a8]">{mine.guild.description || "（沒有簡介）"}</div>
                </div>
                <div className="text-right text-[12px] text-[#cfeedd]">
                  <div>會長：{mine.guild.leader} · 你的身分：{mine.role === "leader" ? "會長" : "成員"}</div>
                  <div>成員 {mine.guild.members}/{mine.guild.maxMembers} · 本週傷害 {mine.guild.weeklyDamage.toLocaleString()}</div>
                  <button onClick={() => confirm("確定退出公會？") && act("/api/guilds/leave", {}, () => "已退出公會")} className="mt-1 px-2 py-0.5 border border-[#3a0f1c] text-[#ff4d6d]">
                    [ 退出公會 ]
                  </button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <Panel title="🐉 每週公會 Boss" className="lg:col-span-2">
                <div className="space-y-3">
                  <div className="text-lg text-[#ff7a90] font-bold">{mine.boss.name}</div>
                  <HpBar label="公會共享血量（每週一刷新）" value={mine.boss.hp} max={mine.boss.hpMax} color="#ff4d6d" />
                  <div className="flex flex-wrap gap-2 items-center">
                    {mine.boss.defeated ? (
                      <span className="text-[#00ff88]">✓ 本週已討伐成功！</span>
                    ) : (
                      <button onClick={() => setFighting(true)} className="crpg-panel px-5 py-2 text-[#ff4d6d] crpg-glow-red border-[#ff4d6d]/60 font-bold">
                        [ 出戰（45 秒） ]
                      </button>
                    )}
                    {mine.unclaimed > 0 && (
                      <button
                        onClick={() => act("/api/guilds/boss/claim", {}, (r) => `領取成功：+${r.gold}G、${r.gear.map((g) => g.name).join("、")}`)}
                        className="crpg-panel px-4 py-2 text-[#ffd60a] crpg-glow-yellow border-[#ffd60a]/60 animate-pulse"
                      >
                        [ 領取公會獎勵 ]
                      </button>
                    )}
                  </div>
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-[#3a8c5e] text-left">
                        <th className="py-1">成員</th>
                        <th>職業</th>
                        <th>等級</th>
                        <th className="text-right">本週傷害</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mine.members.map((m) => (
                        <tr key={m.username} className="border-t border-[#0f3a26] text-[#cfeedd]">
                          <td className="py-1">
                            {m.role === "leader" ? "👑 " : ""}
                            {m.username}
                          </td>
                          <td className={CLASSES[m.klass]?.color}>{CLASSES[m.klass]?.name || "-"}</td>
                          <td>{m.level}</td>
                          <td className="text-right">{m.weeklyDamage.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
              <ChatPanel channel="guild" title="GUILD CHAT" className="min-h-[320px]" />
            </div>
          </>
        )}

        {mine === null && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-3">
            <Panel title="尋找公會（依本週公會 Boss 傷害排序）">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  load();
                }}
                className="flex gap-2 mb-3"
              >
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋名稱或標籤" className="flex-1 bg-[#0a1410] border border-[#0f3a26] text-[#00ff88] px-2 py-1 text-xs outline-none" />
                <button className="px-3 py-1 border border-[#0f3a26] text-[#00ff88] text-xs">[ 搜尋 ]</button>
              </form>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {list.map((g) => (
                  <div key={g.id} className="border border-[#0f3a26] p-3 space-y-1 text-[12px]">
                    <div className="text-[#00ff88] font-bold text-sm">
                      &lt;{g.tag}&gt; {g.name}
                    </div>
                    <div className="text-[#7be0a8]">{g.description || "（沒有簡介）"}</div>
                    <div className="text-[#3a8c5e]">
                      會長 {g.leader} · 成員 {g.members}/{g.maxMembers} · 本週傷害 {g.weeklyDamage.toLocaleString()}
                    </div>
                    <button
                      disabled={g.members >= g.maxMembers}
                      onClick={() => act(`/api/guilds/${g.id}/join`, {}, () => `已加入 <${g.tag}> ${g.name}！`)}
                      className="px-3 py-1 border border-[#00ff88] text-[#00ff88] disabled:opacity-40"
                    >
                      [ 加入 ]
                    </button>
                  </div>
                ))}
                {!list.length && <div className="text-[12px] text-[#3a8c5e]">還沒有公會，建立第一個吧！</div>}
              </div>
            </Panel>
            <Panel title="建立公會（1,000G）">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  act("/api/guilds", form, () => "公會建立成功！");
                }}
                className="space-y-2 text-xs"
              >
                <input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} maxLength={5} placeholder="標籤（2～5 個英數，例如 AICLB）" className="w-full bg-[#0a1410] border border-[#0f3a26] text-[#00ff88] px-2 py-1.5 outline-none" />
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={24} placeholder="公會名稱" className="w-full bg-[#0a1410] border border-[#0f3a26] text-[#00ff88] px-2 py-1.5 outline-none" />
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={140} rows={3} placeholder="簡介（選填）" className="w-full bg-[#0a1410] border border-[#0f3a26] text-[#00ff88] px-2 py-1.5 outline-none" />
                <div className="text-[#3a8c5e]">你的金幣：{profile?.gold?.toLocaleString?.() ?? "-"}G</div>
                <button className="crpg-panel px-4 py-1.5 text-[#ffd60a] crpg-glow-yellow">[ 建立公會 ]</button>
              </form>
            </Panel>
          </div>
        )}
      </div>
    </Shell>
  );
}
