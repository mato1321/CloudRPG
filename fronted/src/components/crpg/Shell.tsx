// @ts-nocheck
import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "@tanstack/react-router";

const NAV = [
  { to: "/",          label: "LOBBY"  },
  { to: "/play",      label: "PLAY"   },
  { to: "/market",    label: "MARKET" },
  { to: "/guild",     label: "GUILD"  },
  { to: "/codex",     label: "CODEX"  },
];

const PUBLIC_PATHS = new Set(["/", "/login", "/register"]);

// ✅ 導出函數
export function readAuth() {
  try {
    const data = localStorage.getItem("cloud-rpg-auth");
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function clearAuth() {
  try {
    localStorage.removeItem("cloud-rpg-auth");
  } catch {}
}

export function TopBar({ extra = null }) {
  const [time, setTime] = useState("--:--:--");
  const [ping, setPing] = useState(28);
  const [auth, setAuth] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setAuth(readAuth());
    
    const timeInterval = setInterval(() => {
      setTime(new Date().toTimeString().slice(0, 8));
    }, 1000);

    const pingInterval = setInterval(() => {
      setPing(20 + Math.floor(Math.random() * 40));
    }, 2000);

    const sync = () => setAuth(readAuth());
    window.addEventListener("storage", sync);
    window.addEventListener("cloud-rpg-auth-change", sync);

    return () => {
      clearInterval(timeInterval);
      clearInterval(pingInterval);
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
          >
            [{n.label}]
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-4">
        <Stat label="PING" value={`${ping}ms`} color={ping < 40 ? "text-[#00ff88] crpg-glow" : "text-[#ffd60a] crpg-glow-yellow"} />
        <Stat label="TIME" value={time} />
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

export function Stat({ label, value, color = "text-[#00ff88] crpg-glow" }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[#3a8c5e]">{label}</span>
      <span className="text-[#0f3a26]">:</span>
      <span className={color}>{value}</span>
    </div>
  );
}

export function Particles({ count = 24 }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    setParticles(
      Array.from({ length: count }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 12,
        duration: 10 + Math.random() * 14,
        size: 1 + Math.random() * 2,
      }))
    );
  }, [count]);

  return (
    <div className="crpg-particles">
      {particles.map((p, i) => (
        <span
          key={i}
          className="crpg-particle"
          style={{
            left: `${p.left}%`,
            bottom: `-10px`,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

export function Shell({ children, headerExtra = null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  // ✅ 只在組件初始化時檢查一次
  useEffect(() => {
    setMounted(true);
  }, []);

  // ✅ 當路由改變時，檢查認證 - 直接跳轉，不顯示任何面板
  useEffect(() => {
    if (!mounted) return;

    // 直接從 localStorage 讀取認證狀態（避免 state 延遲）
    const auth = readAuth();
    const isAuthenticated = !!auth;
    const isPublicPath = PUBLIC_PATHS.has(location.pathname);

    // 如果訪問受保護頁面但未登入，立即跳轉到 /login
    if (!isAuthenticated && !isPublicPath) {
      navigate({ to: "/login" });
    }
  }, [location.pathname, mounted, navigate]);

  return (
    <main className="crpg-root crpg-scanlines">
      <div className="crpg-grid-bg" />
      <Particles />
      <div className="relative z-10 flex flex-col gap-3 p-3 h-screen overflow-hidden">
        <TopBar extra={headerExtra} />
        {/* ✅ 簡化：直接渲染 children，不需要條件判斷和 ACCESS DENIED 面板 */}
        {children}
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
