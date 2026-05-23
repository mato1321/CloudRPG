// @ts-nocheck
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "../components/crpg/Shell";

export const Route = createFileRoute("/register")({
  component: Register,
  head: () => ({ meta: [
    { title: "Cloud RPG — Register" },
    { name: "description", content: "Create a new Cloud RPG operator account." },
  ]}),
});

function Register() {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [out, setOut] = useState([]);
  const navigate = useNavigate();

  function submit(e) {
    e.preventDefault();
    const u = user.trim();
    if (!u) return setOut(["[!!] 帳號不可為空"]);
    if (pass.length < 4) return setOut(["[!!] 密碼至少 4 個字元"]);
    if (pass !== pass2) return setOut(["[!!] 兩次密碼不一致"]);
    let users = {};
    try { users = JSON.parse(localStorage.getItem("cloud-rpg-users") || "{}"); } catch {}
    if (users[u]) return setOut([`[!!] 帳號 '${u}' 已被註冊`]);
    users[u] = pass;
    try { localStorage.setItem("cloud-rpg-users", JSON.stringify(users)); } catch {}
    setOut([
      "[ ok ] 操作員檔案已建立",
      `[ ok ] 帳號：${u}`,
      "[ .. ] 1.5 秒後跳轉登入頁面…",
    ]);
    setTimeout(() => navigate({ to: "/login" }), 1500);
  }

  return (
    <Shell>
      <div className="flex justify-center items-start pt-6">
        <div className="crpg-panel w-full max-w-md p-6">
          <div className="text-[#3a8c5e] text-[10px] tracking-widest mb-2">▌ NEW OPERATOR REGISTRATION</div>
          <h1 className="text-[#00e5ff] crpg-glow-cyan text-2xl mb-4">register --new</h1>
          <form onSubmit={submit} className="space-y-3 text-sm">
            <Field label="username"         value={user}  onChange={setUser}  placeholder="WANDERER_77" />
            <Field label="password"         value={pass}  onChange={setPass}  type="password" placeholder="≥ 4 chars" />
            <Field label="confirm password" value={pass2} onChange={setPass2} type="password" placeholder="re-enter" />
            <div className="flex gap-2 pt-2">
              <button className="crpg-panel px-4 py-2 text-[#00e5ff] crpg-glow-cyan flex-1" type="submit">[ create account ]</button>
              <Link to="/login" className="crpg-panel px-4 py-2 text-[#00ff88] crpg-glow">[ back to login ]</Link>
            </div>
          </form>
          {out.length > 0 && (
            <pre className="mt-4 text-xs text-[#7be0a8] leading-5">{out.join("\n")}</pre>
          )}
          <div className="mt-6 text-[10px] text-[#3a8c5e]">
            帳號儲存於本機（localStorage · cloud-rpg-users）。註冊完成後請至登入頁面 jack in。
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
      <div className="flex items-center gap-2 border border-[#0f3a26] focus-within:border-[#00e5ff] px-2 py-1.5 bg-black/40">
        <span className="text-[#00e5ff] crpg-glow-cyan text-xs">$</span>
        <input type={type} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-[#00e5ff] crpg-glow-cyan text-sm placeholder-[#1f5a3a]" />
      </div>
    </label>
  );
}