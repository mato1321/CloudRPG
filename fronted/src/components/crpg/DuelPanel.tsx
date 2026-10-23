// @ts-nocheck
/* 即時連線面板（自由對戰頁）：
 *   kind="duel"  線上即時對戰：快速配對 / 建立房間 / 房號加入 → 大廳選角色、房主選場地 → 房主按開始
 *   kind="coop"  組隊共鬥世界 Boss（2–4 人）：建立隊伍 / 房號加入 → 用自己的 RPG 職業出戰 → 房主按開始
 * 開打後把連線交給 arena 的格鬥引擎（netRef）：房主模擬，其他人送按鍵。 */
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { DuelClient } from "../../lib/duel";
import { api, isLoggedIn } from "../../lib/api";

export function DuelPanel({ kind = "duel", fighters, stages, fighter, stage, netRef, onStart, onStop, onCoopEnd }) {
  const coop = kind === "coop";
  const [status, setStatus] = useState(coop ? "組隊打世界 Boss：建立隊伍後把房號給隊友（最多 4 人）" : "選擇配對方式");
  const [phase, setPhaseState] = useState("idle"); // idle | waiting | lobby | playing
  const phaseRef = useRef("idle");
  const setPhase = (v) => {
    phaseRef.current = v;
    setPhaseState(v);
  };
  const [lobby, setLobby] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [myFighter, setMyFighter] = useState(fighter);
  const [result, setResult] = useState(null);
  const client = useRef<DuelClient | null>(null);
  const logged = isLoggedIn();

  // 組隊共鬥用自己的 RPG 職業
  useEffect(() => {
    if (!coop || !logged) return;
    api("/api/profile")
      .then((d) => d.profile?.klass && setMyFighter(`${d.profile.klass}_rpg`))
      .catch(() => {});
  }, [coop, logged]);

  useEffect(() => () => leave(), []);

  async function ensure() {
    if (client.current?.ws?.readyState === WebSocket.OPEN) return client.current;
    const c = new DuelClient();
    c.on(async (m) => {
      if (m.t === "in") return netRef.current?.handleInput?.(m.s, m.c, !!m.d, m.h);
      if (m.t === "st") return netRef.current?.onSnapshot?.(m.s);
      if (m.t === "waiting") {
        setPhase("waiting");
        setStatus("配對中，等待另一位玩家……");
      } else if (m.t === "lobby") {
        setLobby(m);
        setPhase("lobby"); // 建立 / 加入後，或一局結束後回到大廳
        setStatus(m.players.length < 2 ? "等待隊友加入……" : m.you === 0 ? "人到齊了，按「開始」" : "等待房主開始");
      } else if (m.t === "start") {
        setPhase("playing");
        setResult(null);
        setStatus(coop ? "討伐開始！45 秒內打出最多傷害" : `對戰開始：${m.players.map((p) => p.name).join(" VS ")}`);
        try {
          await onStart(m, c);
          if (netRef.current && m.you === 0) {
            netRef.current.onCoopEnd = async (r) => setResult(await onCoopEnd(r));
          }
        } catch (e) {
          setStatus(`無法開始：${e.message}`);
        }
      } else if (m.t === "end") {
        if (coop) setResult(await onCoopEnd(m.result));
        else setStatus(m.result?.winner === "guest" ? "你贏了！" : "你輸了……");
      } else if (m.t === "dropped") {
        netRef.current?.onDropped?.(m.slot);
        setStatus(`${m.name} 斷線了`);
      } else if (m.t === "left" || m.t === "closed") {
        if (phaseRef.current !== "idle") setStatus(m.msg || "連線已中斷");
        setPhase("idle");
        setLobby(null);
        onStop();
      } else if (m.t === "info" || m.t === "error") {
        setStatus(m.msg);
      } else if (m.t === "idle") {
        setPhase("idle");
        setLobby(null);
      }
    });
    await c.connect();
    client.current = c;
    return c;
  }

  async function act(msg) {
    try {
      const c = await ensure();
      c.send({ fighter: myFighter, stage, kind, ...msg });
    } catch (e) {
      setStatus(e.message);
    }
  }

  function leave() {
    client.current?.send({ t: "cancel" });
    client.current?.close();
    client.current = null;
    setPhase("idle");
    setLobby(null);
    onStop();
  }

  if (!logged) {
    return (
      <div className="crpg-panel p-3 text-xs text-[#cfeedd]">
        {coop ? "組隊討伐" : "線上即時對戰"}需要帳號。
        <Link to="/login" className="ml-2 text-[#00e5ff] underline">登入</Link>
        <Link to="/register" className="ml-2 text-[#00e5ff] underline">註冊</Link>
      </div>
    );
  }

  const btn = "px-3 py-1.5 border font-bold transition border-[#0f3a26] text-[#7be0a8] hover:border-[#00ff88] hover:text-[#00ff88] disabled:opacity-40";
  const isHost = lobby?.you === 0;
  const fighterName = (id) => fighters.find((f) => f.id === id)?.name || id;

  return (
    <div className="crpg-panel p-3 text-xs space-y-2">
      <div className="text-[#ffd60a] font-bold">{coop ? "組隊討伐世界 BOSS // CO-OP RAID（2–4 人）" : "線上即時對戰 // ONLINE VERSUS"}</div>
      <div className="text-[#cfeedd]">{status}</div>

      {phase === "idle" && (
        <div className="flex flex-wrap items-center gap-2">
          {!coop && <button className={btn} onClick={() => act({ t: "queue" })}>[ 快速配對 ]</button>}
          <button className={btn} onClick={() => act({ t: "create" })}>[ {coop ? "建立隊伍" : "建立房間"} ]</button>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
            placeholder="房號"
            className="w-20 bg-[#03130b] border border-[#0f3a26] px-2 py-1 text-[#00ff88] uppercase"
          />
          <button className={btn} disabled={joinCode.length !== 4} onClick={() => act({ t: "join", code: joinCode })}>[ 加入 ]</button>
        </div>
      )}

      {lobby && phase !== "idle" && (
        <div className="space-y-2">
          <div className="text-base text-[#00ff88] crpg-glow tracking-[0.3em]">房號：{lobby.code}</div>
          <div className="space-y-0.5">
            {lobby.players.map((p, i) => (
              <div key={i} className={i === lobby.you ? "text-[#ffd60a]" : "text-[#cfeedd]"}>
                {i === 0 ? "[房主] " : `[${i + 1}P] `}
                {p.name} · {fighterName(p.fighter)}
                {i === lobby.you ? "（你）" : ""}
              </div>
            ))}
            {Array.from({ length: lobby.capacity - lobby.players.length }).map((_, i) => (
              <div key={`e${i}`} className="text-[#3a8c5e]">（空位）</div>
            ))}
          </div>
          {phase === "lobby" && (
            <div className="flex flex-wrap items-center gap-2">
              {!coop && (
                <label className="flex items-center gap-1">
                  你的角色
                  <select
                    value={lobby.players[lobby.you]?.fighter}
                    onChange={(e) => {
                      setMyFighter(e.target.value);
                      client.current?.send({ t: "pick", fighter: e.target.value });
                    }}
                    className="bg-[#03130b] border border-[#0f3a26] px-1 py-1 text-[#00ff88]"
                  >
                    {fighters.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </label>
              )}
              {!coop && isHost && (
                <label className="flex items-center gap-1">
                  場地
                  <select
                    value={lobby.stage}
                    onChange={(e) => client.current?.send({ t: "pick", stage: Number(e.target.value) })}
                    className="bg-[#03130b] border border-[#0f3a26] px-1 py-1 text-[#00ff88]"
                  >
                    {stages.map((s, i) => (
                      <option key={s.id} value={i}>{s.name}</option>
                    ))}
                  </select>
                </label>
              )}
              {isHost && (
                <button className={btn} disabled={lobby.players.length < 2} onClick={() => client.current?.send({ t: "go" })}>
                  [ 開始 ]
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="text-[#ffd60a]">
          {result.killed ? "BOSS 被打倒了！ " : ""}
          你的傷害 {result.dealt?.toLocaleString?.() ?? result.mine}
          {result.error ? ` · 結算失敗：${result.error}` : ` · 獲得 ${result.gold}G / ${result.xp} EXP${result.killed ? "（到世界 Boss 頁領討伐獎勵）" : ""}`}
        </div>
      )}

      {phase !== "idle" && <button className={btn} onClick={leave}>[ 離開 ]</button>}
      <div className="text-[#3a8c5e]">
        {coop
          ? "每個人用自己的 RPG 職業出戰，Boss 會追最近的隊員；傷害照常計入全服世界 Boss，各自結算獎勵。"
          : "房主（左邊）的畫面就是正式結果；其他人用自己的 WASD + F/G/R/T/Y/Q（或觸控按鍵）操作。友誼賽：不影響積分與金幣，但會記錄戰績。"}
        {" "}兩邊都在台灣時延遲約 0.3–0.5 秒。
      </div>
    </div>
  );
}
