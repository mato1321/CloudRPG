// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { readAuth } from "../../lib/auth-utils";
import { CLASSES, defaultParty } from "../../lib/classes";
import { RARITY_COLOR, statText } from "../../lib/gear";
import { STORY_ENEMY_PROFILES, StoryBattleArena } from "./StoryBattleArena";

/**
 * 伺服器驗證的戰鬥流程（故障之塔 / 每日挑戰 / 世界 Boss / 公會 Boss / PvP 共用）
 *   1. POST /api/battle/start 領憑證與敵人設定
 *   2. 2D 格鬥（StoryBattleArena）
 *   3. POST /api/battle/finish 回報結果，顯示伺服器發的獎勵
 */
export function ModeBattle({ start, title, onDone, onExit }) {
  const [phase, setPhase] = useState("loading"); // loading | fighting | finishing | result | error
  const [battle, setBattle] = useState(null);
  const [bstate, setBstate] = useState(null);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const finished = useRef(false);

  useEffect(() => {
    let alive = true;
    api("/api/battle/start", { body: start })
      .then((b) => {
        if (!alive) return;
        const p = b.profile;
        setBstate({
          ...p,
          name: readAuth()?.user || "player",
          hp: Math.max(1, Math.round(p.hpMax * (b.player?.hpRatio ?? 1))),
          mp: p.mpMax,
          party: defaultParty(p.klass),
        });
        setBattle(b);
        setPhase("fighting");
      })
      .catch((e) => {
        if (!alive) return;
        setErr(e.message);
        setPhase("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  async function finish(win, hp, mp, stats) {
    if (finished.current) return;
    finished.current = true;
    setPhase("finishing");
    try {
      const r = await api("/api/battle/finish", {
        body: {
          battle_id: battle.battle_id,
          win,
          duration_ms: stats?.durationMs ?? 0,
          damage: stats?.damage ?? 0,
          hp_left: Math.max(0, hp ?? 0),
          max_combo: stats?.maxCombo ?? 0,
          items_used: stats?.itemsUsed ?? {},
        },
      });
      setResult(r);
      setPhase("result");
    } catch (e) {
      setErr(e.message);
      setPhase("error");
    }
  }

  if (phase === "loading") return <div className="crpg-panel p-6 text-[#7be0a8] text-sm">[ .. ] 連線戰鬥伺服器，領取戰鬥憑證中…</div>;
  if (phase === "error")
    return (
      <div className="crpg-panel p-6 space-y-3">
        <div className="text-[#ff4d6d] text-sm">[!!] {err}</div>
        <button onClick={onExit} className="crpg-panel px-4 py-1.5 text-xs text-[#00ff88]">[ 返回 ]</button>
      </div>
    );
  if (phase === "result" || phase === "finishing")
    return <BattleResult result={result} pending={phase === "finishing"} onContinue={() => onDone?.(result)} />;

  const enemy = battle.enemy;
  const cls = CLASSES[bstate.klass] || CLASSES.warrior;
  return (
    <div className="crpg-panel overflow-hidden">
      <StoryBattleArena
        key={battle.battle_id}
        state={bstate}
        enemyKey={STORY_ENEMY_PROFILES[enemy.key] ? enemy.key : "minions"}
        enemyCfg={{ name: enemy.name }}
        classCfg={cls}
        mode={start.mode === "worldboss" || start.mode === "guildboss" ? "raid" : start.mode}
        enemyOverride={{ ...enemy, title }}
        playerBoost={battle.player}
        onUseHerb={(hp) => setBstate((s) => ({ ...s, hp, inv: { ...s.inv, herb: Math.max(0, (s.inv.herb || 1) - 1) } }))}
        onUseMana={(mp) => setBstate((s) => ({ ...s, mp, inv: { ...s.inv, mana: Math.max(0, (s.inv.mana || 1) - 1) } }))}
        onUseTotem={(hp) => setBstate((s) => ({ ...s, hp, inv: { ...s.inv, totem: Math.max(0, (s.inv.totem || 1) - 1) } }))}
        onSyncHpMp={(hp, mp) => setBstate((s) => ({ ...s, hp, mp }))}
        onBattleEnd={(win, hp, mp, stats) => finish(win, hp, mp, stats)}
        onFlee={() => finish(false, bstate.hp, bstate.mp, { durationMs: 1000, damage: 0 })}
        onLog={() => {}}
      />
    </div>
  );
}

export function BattleResult({ result, pending, onContinue }) {
  if (pending || !result) return <div className="crpg-panel p-6 text-[#7be0a8] text-sm">[ .. ] 伺服器結算中…</div>;
  const r = result.rewards || {};
  const x = result.extra || {};
  return (
    <div className="crpg-panel p-6 space-y-3">
      <div className={`text-3xl font-bold tracking-widest ${result.win ? "text-[#ffd60a] crpg-glow-yellow" : "text-[#ff4d6d] crpg-glow-red"}`}>
        {x.raid ? "戰鬥結束" : result.win ? "VICTORY" : "DEFEATED"}
      </div>
      <div className="text-sm text-[#cfeedd] space-y-1">
        {x.raid && (
          <div>
            對 <span className="text-[#ff7a90]">{x.raid.name}</span> 造成{" "}
            <span className="text-[#ffd60a] font-bold">{x.raid.dealt.toLocaleString()}</span> 傷害
            {x.raid.capped && <span className="text-[#ff4d6d]">（超過理論上限，已校正）</span>}
            {x.raid.killed && <div className="text-[#00ff88] font-bold">你打出了最後一擊！Boss 倒下了！</div>}
            <div className="text-[#3a8c5e] text-xs">剩餘全服血量 {x.raid.hp.toLocaleString()} / {x.raid.hpMax.toLocaleString()}</div>
          </div>
        )}
        {x.tower && (
          <div>
            {result.win ? `通過！下一層：第 ${x.tower.floor} 層` : `攀登結束，止步於第 ${x.tower.floor} 層`} · 最佳紀錄 {x.tower.best} 層
          </div>
        )}
        {x.daily && (
          <div>
            本次分數 <span className="text-[#ffd60a] font-bold">{x.daily.score.toLocaleString()}</span>
            {x.daily.newBest && <span className="text-[#00ff88]"> 新紀錄！</span>} · 今日最佳 {x.daily.best.toLocaleString()}
          </div>
        )}
        {x.pvp && (
          <div>
            積分 {x.pvp.rating}（
            <span className={x.pvp.delta >= 0 ? "text-[#00ff88]" : "text-[#ff4d6d]"}>{x.pvp.delta >= 0 ? `+${x.pvp.delta}` : x.pvp.delta}</span>）· 戰績 {x.pvp.wins}W / {x.pvp.losses}L
          </div>
        )}
        <div>
          獎勵：<span className="text-[#ffd60a]">+{r.gold || 0}G</span> · <span className="text-[#00e5ff]">+{r.xp || 0} EXP</span>
          {result.levelUps > 0 && <span className="text-[#00ff88] font-bold"> ▲ LEVEL UP ×{result.levelUps}（Lv.{result.profile.level}）</span>}
        </div>
        {(r.gear || []).map((g) => (
          <div key={g.id} className="border px-2 py-1 text-xs" style={{ borderColor: RARITY_COLOR[g.rarity] }}>
            <span style={{ color: RARITY_COLOR[g.rarity] }} className="font-bold">{g.name}</span> <span className="text-[#cfeedd]">{statText(g.stats)}</span>
          </div>
        ))}
        {r.salvageGold > 0 && <div className="text-xs text-[#3a8c5e]">背包已滿，自動分解獲得 {r.salvageGold}G</div>}
      </div>
      <button onClick={onContinue} className="crpg-panel px-5 py-2 text-[#00ff88] crpg-glow border-[#00ff88]/60">
        [ 繼續 ]
      </button>
    </div>
  );
}
