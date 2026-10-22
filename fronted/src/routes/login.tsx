// @ts-nocheck
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "../components/crpg/Shell";

export const Route = createFileRoute("/login")({
  component: Login,
  head: () => ({ meta: [
    { title: "Cloud RPG — Login" },
    { name: "description", content: "Authenticate to the Cloud RPG grid." },
  ]}),
});

const API_URL = import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? (window.location.port === "" || window.location.port === "80" ? window.location.origin : `${window.location.protocol}//${window.location.hostname}:8000`) : "http://localhost:8000");

function Login() {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [out, setOut] = useState([]);
  // ✅ React 還沒水合完成前按送出會變成原生 GET 表單，帳密會出現在網址上 → 水合前先停用按鈕
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => setReady(true), []);

  async function submit(e) {
    e.preventDefault();
    if (!user.trim()) { setOut(["[!!] 操作員名稱不可為空"]); return; }
    
    try {
      setOut(["[ .. ] Connecting to auth.cloudrpg.net ..."]);
      
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.trim(), password: pass }),
      });
      
      if (!res.ok) {
        setOut(["[!!] 帳號或密碼錯誤"]);
        return;
      }
      
      const data = await res.json();
      
      setOut([
        "[ .. ] Negotiating handshake with auth.cloudrpg.net ...",
        "[ ok ] Token signed.",
        `[ ok ] Welcome, ${data.user.username}. Routing to nearest shard ...`,
      ]);
      
      try {
        const AUTH_KEY = "cloud-rpg-auth";
        localStorage.setItem(AUTH_KEY, JSON.stringify({ 
          user: data.user.username,
          token: data.access_token,
          ts: Date.now() 
        }));
        const rawSave = localStorage.getItem("cloud-rpg-save");
        if (rawSave) {
          const parsed = JSON.parse(rawSave);
          if (data.user.username.toLowerCase() === "admin" && parsed?.state) {
            parsed.state.name = data.user.username;
            parsed.state.gold = 999999999;
            localStorage.setItem("cloud-rpg-save", JSON.stringify(parsed));
          } else if (parsed?.state?.name && parsed.state.name !== data.user.username && parsed.state.name !== "WANDERER_77") {
            localStorage.removeItem("cloud-rpg-save");
          }
        }
        window.dispatchEvent(new Event("cloud-rpg-auth-change"));
      } catch {}
      
      setTimeout(() => navigate({ to: "/play" }), 1000);
      
    } catch (err) {
      setOut([`[!!] 連接失敗: ${err.message}`]);
    }
  }

  return (
    <Shell>
      <div className="flex justify-center items-start pt-6">
        <div className="crpg-panel w-full max-w-md p-6">
          <div className="text-[#3a8c5e] text-[10px] tracking-widest mb-2">▌ AUTH TERMINAL</div>
          <h1 className="text-[#00ff88] crpg-glow text-2xl mb-4">login --grid</h1>
          <form method="post" onSubmit={submit} className="space-y-3 text-sm">
            <Field 
              id="username_login"
              name="username"
              label="operator" 
              value={user} 
              onChange={setUser} 
              placeholder="WANDERER_77"
              autoComplete="username"
            />
            <Field 
              id="password_login"
              name="password"
              label="passkey"  
              value={pass} 
              onChange={setPass} 
              type="password" 
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <div className="flex gap-2 pt-2">
              <button 
                className="crpg-panel px-4 py-2 text-[#00ff88] crpg-glow flex-1 disabled:opacity-50" 
                type="submit"
                disabled={!ready}
              >
                {ready ? "[ jack in ]" : "[ loading… ]"}
              </button>
              <Link 
                to="/register" 
                className="crpg-panel px-4 py-2 text-[#00e5ff] crpg-glow-cyan text-center"
              >
                [ register ]
              </Link>
              <Link 
                to="/" 
                className="crpg-panel px-4 py-2 text-[#7be0a8] text-center"
              >
                [ cancel ]
              </Link>
            </div>
          </form>
          {out.length > 0 && (
            <pre className="mt-4 text-xs text-[#7be0a8] leading-5">{out.join("\n")}</pre>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Field({ id, name, label, value, onChange, type = "text", placeholder, autoComplete }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-widest text-[#3a8c5e] mb-1">{label}</div>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete || "off"}
        className="w-full bg-[#0a1410] border border-[#0f3a26] text-[#00ff88] crpg-glow px-3 py-1 text-sm outline-none focus:border-[#00ff88]"
      />
    </label>
  );
}