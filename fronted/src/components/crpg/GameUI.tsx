// @ts-nocheck
import { Link } from "@tanstack/react-router";

/* 各遊戲模式頁面共用的小元件 */

export function NeedLogin({ what = "這個模式" }) {
  return (
    <div className="crpg-panel p-6 space-y-3">
      <div className="text-[#ffd60a] crpg-glow-yellow text-lg">🔒 {what}需要帳號</div>
      <p className="text-[13px] text-[#7be0a8]">成績、獎勵和排名都存在雲端伺服器（防止作弊），登入後就能挑戰。</p>
      <div className="flex gap-2">
        <Link to="/login" className="crpg-panel px-4 py-1.5 text-[#00ff88] crpg-glow">[ 登入 ]</Link>
        <Link to="/register" className="crpg-panel px-4 py-1.5 text-[#00e5ff] crpg-glow-cyan">[ 註冊 ]</Link>
        <Link to="/play" className="crpg-panel px-4 py-1.5 text-[#7be0a8]">[ 先用訪客模式玩故事 ]</Link>
      </div>
    </div>
  );
}

export function NeedCharacter() {
  return (
    <div className="crpg-panel p-6 space-y-3">
      <div className="text-[#ffd60a] crpg-glow-yellow text-lg">尚未建立角色</div>
      <p className="text-[13px] text-[#7be0a8]">先到故事模式選擇你的職業（戰士 / 法師 / 牧師），就能挑戰其他模式。</p>
      <Link to="/play" className="crpg-panel px-4 py-1.5 text-[#00ff88] crpg-glow inline-block">[ ▶ 前往 PLAY 選職業 ]</Link>
    </div>
  );
}

export function HpBar({ value, max, color = "#ff4d6d", height = 14, label }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div>
      {label && (
        <div className="flex justify-between text-[11px] mb-1">
          <span style={{ color }}>{label}</span>
          <span className="text-[#7be0a8]">
            {Math.round(value).toLocaleString()} / {Math.round(max).toLocaleString()}（{pct.toFixed(1)}%）
          </span>
        </div>
      )}
      <div className="border border-[#0f3a26] bg-black/60" style={{ height }}>
        <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${color}, #ffd60a)`, boxShadow: `0 0 12px ${color}`, transition: "width .6s" }} />
      </div>
    </div>
  );
}

export function RankTable({ rows, valueLabel = "分數", format = (v) => v?.toLocaleString?.() ?? v, highlight }) {
  if (!rows?.length) return <div className="text-[12px] text-[#3a8c5e]">還沒有紀錄，成為第一個上榜的人吧！</div>;
  return (
    <table className="w-full text-[12px]">
      <thead>
        <tr className="text-[#3a8c5e] text-left">
          <th className="py-1 w-10">#</th>
          <th>玩家</th>
          <th className="text-right">{valueLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={`border-t border-[#0f3a26] ${highlight && r.username === highlight ? "text-[#ffd60a]" : "text-[#cfeedd]"}`}>
            <td className={`py-1 ${i < 3 ? "text-[#ffd60a] font-bold" : "text-[#3a8c5e]"}`}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
            <td>{r.username}</td>
            <td className="text-right">{format(r.value ?? r.score ?? r.damage)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const MOD_COLOR = "text-[#c084fc]";

export function ModifierChips({ mods = [], info = {} }) {
  if (!mods.length) return <span className="text-[11px] text-[#3a8c5e]">無詞綴</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {mods.map((m) => (
        <span key={m} title={info[m]?.desc} className="px-2 py-0.5 border border-[#c084fc]/50 text-[#c084fc] text-[11px]">
          ⚠ {info[m]?.name || m}
          {info[m]?.desc && <span className="text-[#7be0a8]">：{info[m].desc}</span>}
        </span>
      ))}
    </div>
  );
}
