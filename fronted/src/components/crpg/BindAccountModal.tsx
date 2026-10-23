// @ts-nocheck
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { saveAuth } from "../../lib/auth-utils";

/**
 * 訪客綁定帳號：不用離開遊戲畫面就能註冊 / 登入。
 * 成功後 onBound() 由遊戲頁把訪客進度（第一章）匯入伺服器。
 */
export function BindAccountModal({ reason, onBound, onClose }) {
  const [tab, setTab] = useState("register");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e) {
    e.preventDefault();
    if (user.trim().length < 3) return setErr("帳號至少 3 個字");
    if (pass.length < 4) return setErr("密碼至少 4 個字元");
    setBusy(true);
    setErr(null);
    try {
      const r = await api(`/api/auth/${tab}`, { body: { username: user.trim(), password: pass }, auth: false });
      saveAuth(r.user.username, r.access_token);
      onBound?.(r);
    } catch (e2) {
      setErr(tab === "login" && e2.status === 401 ? "帳號或密碼錯誤" : e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="crpg-panel w-full max-w-md p-6 border border-[#00ff88]/60">
        <div className="text-[#3a8c5e] text-[10px] tracking-widest mb-1">▌ SAVE YOUR PROGRESS</div>
        <h2 className="text-[#00ff88] crpg-glow text-xl mb-2">💾 綁定帳號，保存冒險進度</h2>
        <p className="text-[12px] text-[#7be0a8] leading-relaxed mb-4">
          {reason || "你已經打倒第一個 Boss 了！"}綁定後進度會存在雲端，換電腦也能繼續，
          還能解鎖<span className="text-[#ffd60a]">黑市、故障之塔、世界 Boss、公會、PvP 與排行榜</span>。
        </p>
        <div className="flex gap-2 mb-3 text-xs">
          {[
            ["register", "建立新帳號（免費）"],
            ["login", "我已經有帳號"],
          ].map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`flex-1 px-2 py-1.5 border ${tab === k ? "border-[#00ff88] text-[#00ff88] crpg-glow" : "border-[#0f3a26] text-[#3a8c5e]"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <form method="post" onSubmit={submit} className="space-y-2 text-sm">
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="帳號（3～20 字，英數、中文、底線）"
            autoComplete="username"
            className="w-full bg-[#0a1410] border border-[#0f3a26] text-[#00ff88] px-3 py-2 outline-none focus:border-[#00ff88]"
          />
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="密碼（至少 4 字元）"
            autoComplete={tab === "login" ? "current-password" : "new-password"}
            className="w-full bg-[#0a1410] border border-[#0f3a26] text-[#00ff88] px-3 py-2 outline-none focus:border-[#00ff88]"
          />
          {err && <div className="text-[12px] text-[#ff4d6d]">[!!] {err}</div>}
          <div className="flex gap-2 pt-1">
            <button disabled={busy} className="flex-1 crpg-panel px-4 py-2 text-[#00ff88] crpg-glow disabled:opacity-50">
              {busy ? "[ 連線中… ]" : tab === "register" ? "[ 建立帳號並保存 ]" : "[ 登入並保存 ]"}
            </button>
            {onClose && (
              <button type="button" onClick={onClose} className="crpg-panel px-4 py-2 text-[#7be0a8]">
                [ 稍後 ]
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
