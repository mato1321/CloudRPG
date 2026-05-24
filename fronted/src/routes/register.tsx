// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Shell, Panel } from "../components/crpg/Shell";

export const Route = createFileRoute("/register")({
  component: Register,
  head: () => ({ meta: [
    { title: "Cloud RPG — Register" },
  ]}),
});

const API_URL = import.meta.env.VITE_API_URL || "http://44.205.216.47:8000";

function Register() {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [out, setOut] = useState([]);
  const [loading, setLoading] = useState(false);

  // Debug：頁面加載時
  useEffect(() => {
    console.log("✅ Register 組件已加載");
    return () => console.log("❌ Register 組件即將卸載");
  }, []);

  async function submit(e) {
    e.preventDefault();
    console.log("🔘 Submit 被點擊");
    
    const u = user.trim();
    if (!u) {
      console.log("❌ 帳號為空");
      setOut(["[!!] 帳號不可為空"]);
      return;
    }
    if (pass.length < 4) {
      console.log("❌ 密碼太短");
      setOut(["[!!] 密碼至少 4 個字元"]);
      return;
    }
    if (pass !== pass2) {
      console.log("❌ 密碼不匹配");
      setOut(["[!!] 兩次密碼不一致"]);
      return;
    }
    
    setLoading(true);
    setOut(["[ .. ] Creating operator profile ..."]);
    console.log("📡 發送請求到:", API_URL);
    
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: pass }),
      });
      
      console.log("📥 收到回應:", res.status);
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.log("❌ 失敗:", data);
        setOut([`[!!] ${data.detail || "Registration failed"}`]);
        setLoading(false);
        return;
      }
      
      const data = await res.json();
      console.log("✅ 成功:", data);
      
      setOut([
        "[ ok ] 操作員檔案已建立",
        `[ ok ] 帳號：${u}`,
        "[ .. ] 3 秒後跳轉登入頁面…",
      ]);
      
      // 延遲更久，確保頁面有時間顯示成功訊息
      setTimeout(() => {
        console.log("🔄 跳轉到登入頁面");
        window.location.href = "/login";
      }, 3000);
      
    } catch (err) {
      console.error("❌ 異常:", err);
      setOut([`[!!] 連接失敗: ${err.message}`]);
      setLoading(false);
    }
  }

  // 確保頁面能正常渲染
  return (
    <div>
      <Shell>
        <div className="flex justify-center items-start pt-6">
          <Panel title="NEW OPERATOR REGISTRATION" className="w-full max-w-md">
            <h1 className="text-[#00e5ff] crpg-glow-cyan text-xl mb-4">register --new</h1>
            
            <form onSubmit={submit} className="space-y-3 text-sm">
              <input
                type="text"
                placeholder="帳號"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="w-full bg-[#0a1410] border border-[#0f3a26] text-[#00ff88] px-3 py-2 text-sm outline-none focus:border-[#00ff88]"
                disabled={loading}
              />
              
              <input
                type="password"
                placeholder="密碼"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                className="w-full bg-[#0a1410] border border-[#0f3a26] text-[#00ff88] px-3 py-2 text-sm outline-none focus:border-[#00ff88]"
                disabled={loading}
              />
              
              <input
                type="password"
                placeholder="確認密碼"
                value={pass2}
                onChange={(e) => setPass2(e.target.value)}
                className="w-full bg-[#0a1410] border border-[#0f3a26] text-[#00ff88] px-3 py-2 text-sm outline-none focus:border-[#00ff88]"
                disabled={loading}
              />
              
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="crpg-panel px-4 py-2 text-[#00e5ff] crpg-glow-cyan flex-1 disabled:opacity-50"
                >
                  {loading ? "[ 創建中... ]" : "[ create account ]"}
                </button>
                <a
                  href="/login"
                  className="crpg-panel px-4 py-2 text-[#00ff88] crpg-glow text-center"
                >
                  [ back ]
                </a>
              </div>
            </form>
            
            {out.length > 0 && (
              <pre className="mt-4 text-xs text-[#7be0a8] leading-5">
                {out.join("\n")}
              </pre>
            )}
          </Panel>
        </div>
      </Shell>
    </div>
  );
}