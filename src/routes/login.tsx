// @ts-nocheck
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Shell, AUTH_KEY } from "../components/crpg/Shell";
import { createServerFn } from "@tanstack/react-start"; // ✅ 確保來自 react-start

// 🌟 【修正版後端魔法】
const loginServerFn = createServerFn(async (data: { user: string; pass: string }) => {
  const { prisma } = await import("../lib/db");
  const { user, pass } = data;
  
  const dbUser = await prisma.user.findUnique({ where: { username: user } });
  
  if (!dbUser) return { error: `帳號 '${user}' 未註冊，請先註冊。` };
  if (dbUser.password_hash !== pass) return { error: "密碼錯誤或存取被拒。" };

  await prisma.user.update({
    where: { id: dbUser.id },
    data: { lastLogin: new Date() }
  });

  return { success: true };
});

export const Route = createFileRoute("/login")({
  component: Login,
  head: () => ({ meta: [
    { title: "Cloud RPG — Login" },
    { name: "description", content: "Authenticate to the Cloud RPG grid." },
  ]}),
});

function Login() {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [out, setOut] = useState([]);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    if (!user.trim()) { setOut(["[!!] 操作員名稱不可為空"]); return; }
    
    const u = user.trim();
    setOut(["[ .. ] Negotiating handshake with AWS mainframes ..."]);

    try {
      // ✅ 直接將物件傳入後端函數
      const res = await loginServerFn({ user: u, pass });
      
      if (res.error) {
        return setOut([`[!!] ${res.error}`]);
      }

      setOut([
        "[ ok ] Database handshake complete.",
        "[ ok ] Token signed.",
        `[ ok ] Welcome back, ${u}. Routing to nearest shard ...`,
      ]);
      
      localStorage.setItem(AUTH_KEY, JSON.stringify({ user: u, ts: Date.now() }));
      window.dispatchEvent(new Event("cloud-rpg-auth-change"));
      
      setTimeout(() => navigate({ to: "/play" }), 1500);

    } catch (error) {
      setOut(["[!!] 無法連線至伺服器核心，請稍後再試"]);
    }
  }

  return (
    <Shell>
      <div className="flex justify-center items-start pt-6">
        <div className="crpg-panel w-full max-w-md p-6">
          <div className="text-[#3a8c5e] text-[10px] tracking-widest mb-2">▌ AUTH TERMINAL</div>
          <h1 className="text-[#00ff88] crpg-glow text-2xl mb-4">login --grid</h1>
          <form onSubmit={submit} className="space-y-3 text-sm">
            <Field label="operator" value={user} onChange={setUser} placeholder="WANDERER_77" />
            <Field label="passkey"  value={pass} onChange={setPass} type="password" placeholder="••••••••" />
            <div className="flex gap-2 pt-2">
              <button className="crpg-panel px-4 py-2 text-[#00ff88] crpg-glow flex-1" type="submit">[ jack in ]</button>
              <Link to="/register" className="crpg-panel px-4 py-2 text-[#00e5ff] crpg-glow-cyan">[ register ]</Link>
              <Link to="/" className="crpg-panel px-4 py-2 text-[#7be0a8]">[ cancel ]</Link>
            </div>
          </form>
          {out.length > 0 && (
            <pre className="mt-4 text-xs text-[#7be0a8] leading-5">{out.join("\n")}</pre>
          )}
          <div className="mt-6 text-[10px] text-[#3a8c5e]">
            By jacking in you agree to the EULA you didn't read. Side effects may include sudden guild wars.
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-widest text-[#3a8c5e] mb-1">{label}</div>
      <div className="flex items-center gap-2 border border-[#0f3a26] focus-within:border-[#00ff88] px-2 py-1.5 bg-black/40">
        <span className="text-[#00ff88] crpg-glow text-xs">$</span>
        <input type={type} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-[#00ff88] crpg-glow text-sm placeholder-[#1f5a3a]" />
      </div>
    </label>
  );
}