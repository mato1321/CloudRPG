// @ts-nocheck
/* 手機觸控操作：左下虛擬搖桿、右下招式按鍵。
 * 不改格鬥引擎，直接送出跟實體鍵盤一樣的 keydown / keyup（e.code），所以所有招式、蹲下掃堂腿等組合都通用。
 * 觸控裝置自動顯示；桌機可在網址加 ?touch=1 或 localStorage 設 crpg-touch=1 強制顯示 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const DIRS = { left: "KeyA", right: "KeyD", up: "KeyW", down: "KeyS" };

export const STORY_BUTTONS = [
  { code: "KeyF", label: "輕攻", tone: "#00ff88" },
  { code: "KeyG", label: "重攻", tone: "#00ff88" },
  { code: "KeyR", label: "技1", tone: "#00e5ff" },
  { code: "KeyT", label: "技2", tone: "#00e5ff" },
  { code: "KeyY", label: "技3", tone: "#a78bfa" },
  { code: "KeyQ", label: "奧義", tone: "#ff4d6d", big: true },
  { code: "KeyE", label: "隊友", tone: "#ffd60a" },
  { code: "KeyH", label: "草藥", tone: "#7dffb6" },
  { code: "KeyB", label: "魔力", tone: "#7de8ff" },
];

export const ARENA_BUTTONS = [
  { code: "KeyF", label: "輕攻", tone: "#00ff88" },
  { code: "KeyG", label: "重攻", tone: "#00ff88" },
  { code: "KeyR", label: "技1", tone: "#00e5ff" },
  { code: "KeyT", label: "技2", tone: "#00e5ff" },
  { code: "KeyY", label: "技3", tone: "#a78bfa" },
  { code: "KeyQ", label: "超必殺", tone: "#ff4d6d", big: true },
];

function send(type: "keydown" | "keyup", code: string) {
  window.dispatchEvent(new KeyboardEvent(type, { code, key: code.replace(/^Key/, "").toLowerCase(), bubbles: true }));
}

export function useTouchDevice() {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    let forced = false;
    try {
      forced = new URLSearchParams(location.search).get("touch") === "1" || localStorage.getItem("crpg-touch") === "1";
    } catch {}
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setTouch(forced || mq.matches || navigator.maxTouchPoints > 0);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return touch;
}

function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const held = useRef(new Set<string>());
  const pointer = useRef<number | null>(null);

  const apply = (want: Set<string>) => {
    for (const c of held.current) if (!want.has(c)) send("keyup", c);
    for (const c of want) if (!held.current.has(c)) send("keydown", c);
    held.current = want;
  };

  const move = (e) => {
    const r = base.current.getBoundingClientRect();
    const R = r.width / 2;
    let dx = e.clientX - (r.left + R);
    let dy = e.clientY - (r.top + R);
    const len = Math.hypot(dx, dy);
    if (len > R) {
      dx = (dx / len) * R;
      dy = (dy / len) * R;
    }
    setKnob({ x: dx, y: dy });
    const dead = R * 0.3;
    const want = new Set<string>();
    if (dx < -dead) want.add(DIRS.left);
    if (dx > dead) want.add(DIRS.right);
    if (dy < -R * 0.5) want.add(DIRS.up); // 往上推較多才算跳，避免走路時誤跳
    if (dy > R * 0.5) want.add(DIRS.down);
    apply(want);
  };

  const end = () => {
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    apply(new Set());
  };

  useEffect(() => end, []);

  return (
    <div
      ref={base}
      className="relative w-32 h-32 rounded-full border-2 border-[#00ff88]/50 bg-[#03130b]/60 select-none"
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        pointer.current = e.pointerId;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
        move(e);
      }}
      onPointerMove={(e) => pointer.current === e.pointerId && move(e)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div
        className="absolute left-1/2 top-1/2 w-14 h-14 -ml-7 -mt-7 rounded-full bg-[#00ff88]/40 border border-[#00ff88]"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
      <span className="absolute left-1/2 -translate-x-1/2 top-1 text-[10px] text-[#3a8c5e]">跳</span>
      <span className="absolute left-1/2 -translate-x-1/2 bottom-1 text-[10px] text-[#3a8c5e]">蹲</span>
    </div>
  );
}

function PadButton({ code, label, tone, big }) {
  const down = useRef(false);
  const press = (e) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    if (down.current) return;
    down.current = true;
    send("keydown", code);
  };
  const release = () => {
    if (!down.current) return;
    down.current = false;
    send("keyup", code);
  };
  useEffect(() => release, []);
  return (
    <button
      type="button"
      className={`${big ? "w-16 h-16 text-sm" : "w-12 h-12 text-xs"} rounded-full border-2 font-bold select-none active:scale-95`}
      style={{ touchAction: "none", borderColor: tone, color: tone, background: "rgba(3,19,11,0.65)" }}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

/** 觸控裝置上、而且 anchor（格鬥畫面）有出現在畫面上時才顯示；buttons 用 STORY_BUTTONS 或 ARENA_BUTTONS */
export function TouchControls({ buttons = STORY_BUTTONS, active = true, anchor = null }) {
  const touch = useTouchDevice();
  const [inView, setInView] = useState(!anchor);
  useEffect(() => {
    const el = anchor?.current;
    if (!el || typeof IntersectionObserver === "undefined") return setInView(true);
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [anchor]);
  if (!touch || !active || !inView || typeof document === "undefined") return null;
  // 用 portal 掛到 body：外層有 transform / filter 時 position: fixed 會失效
  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-[60] pointer-events-none flex items-end justify-between p-3 pb-4">
      <div className="pointer-events-auto">
        <Joystick />
      </div>
      <div className="pointer-events-auto grid grid-cols-3 gap-2 justify-items-center items-center">
        {buttons.map((b) => (
          <PadButton key={b.code} {...b} />
        ))}
      </div>
    </div>,
    document.body,
  );
}
