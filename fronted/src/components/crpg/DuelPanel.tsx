// @ts-nocheck
/* 自由對戰頁的「線上即時對戰」面板：快速配對 / 建立房間 / 用房號加入。
 * 配對成功後把連線交給 arena 的格鬥引擎（netRef），房主模擬、對手送按鍵。 */
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { DuelClient } from "../../lib/duel";
import { isLoggedIn } from "../../lib/api";

export function DuelPanel({ fighter, stage, netRef, onStart, onStop }) {
  const [status, setStatus] = useState("選好上方 1P 的角色，再選擇配對方式");
  const [phase, setPhaseState] = useState("idle"); // idle | waiting | room | playing
  const phaseRef = useRef("idle"); // 給連線的訊息處理器讀最新值
  const setPhase = (v) => {
    phaseRef.current = v;
    setPhaseState(v);
  };
  const [code, setCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const client = useRef<DuelClient | null>(null);
  const logged = isLoggedIn();

  useEffect(() => () => leave(), []);

  async function ensure() {
    if (client.current?.ws?.readyState === WebSocket.OPEN) return client.current;
    const c = new DuelClient();
    c.on((m) => {
      if (m.t === "in") return netRef.current?.handleInput?.(m.c, !!m.d);
      if (m.t === "st") return netRef.current?.onSnapshot?.(m.s);
      if (m.t === "created") {
        setCode(m.code);
        setPhase("room");
        setStatus("房間已建立，把房號告訴朋友");
      } else if (m.t === "waiting") {
        setPhase("waiting");
        setStatus("配對中，等待另一位玩家……");
      } else if (m.t === "start") {
        setPhase("playing");
        setCode(m.code);
        const me = m.role === "host" ? m.host.name : m.guest.name;
        const opp = m.role === "host" ? m.guest.name : m.host.name;
        setStatus(`對戰開始：${me}（${m.role === "host" ? "左邊 1P，房主" : "右邊 2P"}） VS ${opp}`);
        onStart(m, c);
      } else if (m.t === "end") {
        setStatus(m.winner === "guest" ? "你贏了！等房主開下一局" : "你輸了，等房主開下一局");
      } else if (m.t === "rematch") {
        setStatus("房主開了新的一局！");
      } else if (m.t === "left" || m.t === "closed") {
        if (phaseRef.current !== "idle") setStatus(m.msg || "連線已中斷");
        setPhase("idle");
        setCode("");
        onStop();
      } else if (m.t === "error") {
        setStatus(m.msg);
      } else if (m.t === "idle") {
        setPhase("idle");
      }
    });
    await c.connect();
    client.current = c;
    return c;
  }

  async function act(msg) {
    try {
      const c = await ensure();
      c.send({ ...msg, fighter, stage });
    } catch (e) {
      setStatus(e.message);
    }
  }

  function leave() {
    client.current?.send({ t: "cancel" });
    client.current?.close();
    client.current = null;
    setPhase("idle");
    setCode("");
    onStop();
  }

  if (!logged) {
    return (
      <div className="crpg-panel p-3 text-xs text-[#cfeedd]">
        線上即時對戰需要帳號（用來顯示名字與紀錄戰績）。
        <Link to="/login" className="ml-2 text-[#00e5ff] underline">登入</Link>
        <Link to="/register" className="ml-2 text-[#00e5ff] underline">註冊</Link>
      </div>
    );
  }

  const btn = "px-3 py-1.5 border font-bold transition border-[#0f3a26] text-[#7be0a8] hover:border-[#00ff88] hover:text-[#00ff88]";
  return (
    <div className="crpg-panel p-3 text-xs space-y-2">
      <div className="text-[#ffd60a] font-bold">線上即時對戰 // ONLINE VERSUS</div>
      <div className="text-[#cfeedd]">{status}</div>
      {phase === "idle" && (
        <div className="flex flex-wrap items-center gap-2">
          <button className={btn} onClick={() => act({ t: "queue" })}>[ 快速配對 ]</button>
          <button className={btn} onClick={() => act({ t: "create" })}>[ 建立房間 ]</button>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
            placeholder="房號"
            className="w-20 bg-[#03130b] border border-[#0f3a26] px-2 py-1 text-[#00ff88] uppercase"
          />
          <button className={btn} disabled={joinCode.length !== 4} onClick={() => act({ t: "join", code: joinCode })}>[ 加入 ]</button>
        </div>
      )}
      {phase === "room" && (
        <div className="text-lg text-[#00ff88] crpg-glow tracking-[0.4em]">房號：{code}</div>
      )}
      {phase !== "idle" && (
        <button className={btn} onClick={leave}>[ 離開對戰 ]</button>
      )}
      <div className="text-[#3a8c5e]">
        房主（左邊）的畫面就是正式結果；對手（右邊）用自己的 WASD + F/G/R/T/Y/Q（或觸控按鍵）操作。
        兩邊都在台灣時延遲約 0.3–0.5 秒，屬友誼賽：不影響積分與金幣，但會記錄戰績。
      </div>
    </div>
  );
}
