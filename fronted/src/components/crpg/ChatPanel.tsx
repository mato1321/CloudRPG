// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { api, isLoggedIn, subscribeLive } from "../../lib/api";

/**
 * 真的聊天室（取代原本隨機產生的假訊息）
 * channel = "world"（世界）或 "guild"（自己的公會）。WebSocket 即時收訊息，斷線時每 15 秒補抓一次。
 */
export function ChatPanel({ channel = "world", title = "WORLD CHAT", className = "", compact = false }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState(null);
  const [online, setOnline] = useState(null);
  const boxRef = useRef(null);
  const lastId = useRef(0);
  const logged = isLoggedIn();

  function append(list) {
    if (!list?.length) return;
    setMsgs((cur) => {
      const seen = new Set(cur.map((m) => m.id));
      const next = [...cur, ...list.filter((m) => !seen.has(m.id))].slice(-80);
      lastId.current = Math.max(lastId.current, ...next.map((m) => m.id));
      return next;
    });
  }

  useEffect(() => {
    let alive = true;
    api(`/api/chat/${channel}`)
      .then((d) => {
        if (!alive) return;
        append(d.messages);
        setOnline(d.online);
      })
      .catch((e) => alive && setErr(e.message));
    const unsub = subscribeLive((m) => {
      if (m.type === "chat" && m.channel === channel) append([m.message]);
      if (m.online != null) setOnline(m.online);
      if (m.type === "system" && channel === "guild") append([{ id: Date.now(), user: "SYSTEM", text: m.text }]);
    });
    const poll = setInterval(() => {
      api(`/api/chat/${channel}?after=${lastId.current}`)
        .then((d) => append(d.messages))
        .catch(() => {});
    }, 15000);
    return () => {
      alive = false;
      unsub();
      clearInterval(poll);
    };
  }, [channel]);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [msgs]);

  async function send(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    try {
      const m = await api(`/api/chat/${channel}`, { body: { text: t } });
      append([m]);
      setText("");
      setErr(null);
    } catch (e2) {
      setErr(e2.message);
    }
  }

  return (
    <div className={`crpg-panel flex flex-col min-h-0 ${className}`}>
      <div className="px-3 py-1.5 border-b border-[#0f3a26] text-[10px] uppercase tracking-widest text-[#00e5ff] crpg-glow-cyan flex justify-between">
        <span>▌ {title}</span>
        <span className="text-[#3a8c5e]">{online != null ? `● ${online} 在線` : `#${channel}`}</span>
      </div>
      <div ref={boxRef} className={`crpg-scroll flex-1 overflow-y-auto p-2 space-y-0.5 text-[11px] leading-snug ${compact ? "min-h-[80px]" : "min-h-[140px]"}`}>
        {msgs.map((m) => (
          <div key={m.id}>
            <span className={m.user === "SYSTEM" ? "text-[#ffd60a]" : "text-[#00e5ff]"}>{m.user}</span>
            <span className="text-[#3a8c5e]">: </span>
            <span className="text-[#cfeedd] break-words">{m.text}</span>
          </div>
        ))}
        {!msgs.length && <div className="text-[#3a8c5e]">還沒有人說話，來打聲招呼吧！</div>}
      </div>
      {err && <div className="px-2 text-[10px] text-[#ff4d6d]">[!!] {err}</div>}
      {logged ? (
        <form onSubmit={send} className="border-t border-[#0f3a26] px-2 py-1.5 flex items-center gap-2 bg-black/40">
          <span className="text-[#00e5ff] crpg-glow-cyan text-[11px] whitespace-nowrap">#{channel}&gt;</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={140}
            placeholder="輸入訊息後按 Enter 送出…"
            className="flex-1 min-w-0 bg-transparent outline-none text-[#7be0a8] text-[11px] placeholder-[#1f5a3a]"
          />
          <button type="submit" className="text-[10px] px-2 py-0.5 border border-[#0f3a26] text-[#00ff88] hover:border-[#00ff88]">
            SEND
          </button>
        </form>
      ) : (
        <div className="border-t border-[#0f3a26] px-2 py-1.5 text-[10px] text-[#3a8c5e]">登入後即可在聊天室發言</div>
      )}
    </div>
  );
}
