// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";

const NAV = [
  { to: "/",      label: "LOBBY"  },
  { to: "/play",      label: "PLAY"   },
  { to: "/market",    label: "MARKET" },
  { to: "/guild",     label: "GUILD"  },
  { to: "/codex",     label: "CODEX"  },
];

const PUBLIC_PATHS = new Set(["/", "/login", "/register"]);
export const AUTH_KEY = "cloud-rpg-auth";
export function readAuth() {
  if (typeof window === "undefined") return null;
  try { const raw = localStorage.getItem(AUTH_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function clearAuth() {
  try { localStorage.removeItem(AUTH_KEY); } catch {}
}

function useNow() {
  const [n, setN] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setN(new Date()), 1000); return () => clearInterval(id); }, []);
  return n;
}
function usePing() {
  const [p, setP] = useState(28);
  useEffect(() => { const id = setInterval(() => setP(20 + Math.floor(Math.random()*40)), 2000); return () => clearInterval(id); }, []);
  return p;
}

export function TopBar({ extra = null }) {
  const now = useNow();
  const ping = usePing();
  const [auth, setAuth] = useState(() => readAuth());
  const navigate = useNavigate();
  useEffect(() => {
    const sync = () => setAuth(readAuth());
    window.addEventListener("storage", sync);
    window.addEventListener("cloud-rpg-auth-change", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("cloud-rpg-auth-change", sync);
    };
  }, []);
  function logout() {
    clearAuth();
    window.dispatchEvent(new Event("cloud-rpg-auth-change"));
    navigate({ to: "/login" });
  }
  return (
    <header className="crpg-panel relative z-10 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-xs">
      <Link to="/" className="flex items-center gap-2 mr-2">
        <span className="text-[#00ff88] crpg-glow text-lg leading-none font-bold tracking-widest">
          ▣ CLOUD<span className="text-[#00e5ff] crpg-glow-cyan">RPG</span>
        </span>
        <span className="text-[10px] text-[#3a8c5e] border border-[#0f3a26] px-1 py-[1px]">v0.9-beta</span>
      </Link>
      <nav className="flex items-center gap-1 ml-2">
        {NAV.map(n => (
          <Link
            key={n.to}
            to={n.to}
            className="px-2 py-1 text-[#3a8c5e] hover:text-[#00ff88] hover:crpg-glow border border-transparent hover:border-[#0f3a26] transition"
            activeProps={{ className: "px-2 py-1 text-[#00ff88] crpg-glow border border-[#0f3a26] bg-[#0a1410]" }}
            activeOptions={{ exact: n.to === "/" }}
          >
            [{n.label}]
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-4">
        {extra}
        <Stat label="PING" value={`${ping}ms`} color={ping < 40 ? "text-[#00ff88] crpg-glow" : "text-[#ffd60a] crpg-glow-yellow"} />
        {/* 加上 suppressHydrationWarning 防止伺服器與客戶端時間不一致報錯 */}
        <Stat label="TIME" value={now.toTimeString().slice(0,8)} suppressHydrationWarning={true} />
        {auth ? (
          <div className="flex items-center gap-2">
            <span className="text-[#3a8c5e]">USER</span>
            <span className="text-[#0f3a26]">:</span>
            <span className="text-[#00ff88] crpg-glow">{auth.user}</span>
            <button onClick={logout} className="px-2 py-1 border border-[#3a0f1c] text-[#ff4d6d] crpg-glow-red hover:border-[#ff4d6d] transition">[ LOGOUT ]</button>
          </div>
        ) : (
          <Link to="/login" className="px-2 py-1 border border-[#0f3a26] text-[#00e5ff] crpg-glow-cyan hover:border-[#00e5ff] transition">
            [ LOGIN ]
          </Link>
        )}
      </div>
    </header>
  );
}

export function Stat({ label, value, color = "text-[#00ff88] crpg-glow", suppressHydrationWarning = false }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[#3a8c5e]">{label}</span>
      <span className="text-[#0f3a26]">:</span>
      <span className={color} suppressHydrationWarning={suppressHydrationWarning}>{value}</span>
    </div>
  );
}

export function Particles({ count = 24 }) {
  // 🌟 加入 mounted 狀態防護罩
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const particles = useMemo(() => {
    // 如果還沒 mounted（伺服器端渲染中），先不產生亂數
    if (!mounted) return [];
    return Array.from({ length: count }, () => ({
      left: Math.random()*100, 
      delay: Math.random()*12,
      duration: 10+Math.random()*14, 
      size: 1+Math.random()*2,
    }));
  }, [count, mounted]);

  // 伺服器端先回傳空的容器，避免報錯
  if (!mounted) {
    return <div className="crpg-particles"></div>;
  }

  // 瀏覽器端接手後，正式渲染粒子
  return (
    <div className="crpg-particles">
      {particles.map((p, i) => (
        <span key={i} className="crpg-particle"
          suppressHydrationWarning={true}
          style={{ left: `${p.left}%`, bottom: `-10px`, width: p.size, height: p.size,
                  animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s` }} />
      ))}
    </div>
  );
}

export function Shell({ children, headerExtra = null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(() => !!readAuth());
  useEffect(() => {
    const sync = () => setAuthed(!!readAuth());
    window.addEventListener("storage", sync);
    window.addEventListener("cloud-rpg-auth-change", sync);
    sync();
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("cloud-rpg-auth-change", sync);
    };
  }, []);
  useEffect(() => {
    if (!authed && !PUBLIC_PATHS.has(location.pathname)) {
      navigate({ to: "/login" });
    }
  }, [authed, location.pathname, navigate]);
  return (
    <main className="crpg-root crpg-scanlines">
      <div className="crpg-grid-bg" />
      <Particles />
      <div className="relative z-10 flex flex-col gap-3 p-3 h-screen overflow-hidden">
        <TopBar extra={headerExtra} />
        {(!authed && !PUBLIC_PATHS.has(location.pathname)) ? (
          <div className="crpg-panel flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="text-[#ff4d6d] crpg-glow-red text-sm tracking-widest mb-3">[ ACCESS DENIED ]</div>
            <div className="text-[#7be0a8] text-sm mb-4">未登入終端機。請先取得通行金鑰以存取雲端網格。</div>
            <Link to="/login" className="crpg-panel px-5 py-2 text-[#00ff88] crpg-glow border-[#00ff88]/60 hover:border-[#00ff88]">▶ 前往 LOGIN</Link>
          </div>
        ) : children}
      </div>
    </main>
  );
}

export function Panel({ title, children, className = "" }) {
  return (
    <section className={`crpg-panel ${className}`}>
      {title && (
        <div className="px-3 py-1.5 border-b border-[#0f3a26] text-[10px] uppercase tracking-widest text-[#3a8c5e]">
          ▌ {title}
        </div>
      )}
      <div className="p-3 text-sm">{children}</div>
    </section>
  );
}