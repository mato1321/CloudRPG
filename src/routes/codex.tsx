// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { Shell, Panel } from "../components/crpg/Shell";

export const Route = createFileRoute("/codex")({
  component: Codex,
  head: () => ({ meta: [
    { title: "Cloud RPG — Codex" },
    { name: "description", content: "Lore, command reference and bestiary for Cloud RPG." },
  ]}),
});

const CMDS = [
  ["help",          "顯示指令清單"],
  ["look",          "重新描述目前場景"],
  ["stats",         "顯示角色屬性 (HP/MP/EXP/GOLD/ATK)"],
  ["skills",        "顯示目前職業技能與高級技能解鎖狀態"],
  ["party",         "顯示三人組隊狀態（含 AI 隊友）"],
  ["inv / inventory", "列出背包內所有物品"],
  ["clear",         "清空終端機輸出"],
  ["save",          "將目前進度寫入瀏覽器存檔"],
  ["load",          "讀取瀏覽器存檔"],
  ["restart",       "重新建立角色（清除存檔回到職業選擇）"],
  ["── COMBAT ──",  ""],
  ["attack",        "普通攻擊 (預設第 1 個攻擊)"],
  ["attack N",      "指定第 N 個攻擊招式 (例：attack 2)"],
  ["skill",         "隨機施放職業技能"],
  ["skill N",       "指定第 N 個技能 (例：skill 1 / skill 2)"],
  ["ult",           "施放高級技能 (需於商店購買技能書解鎖)"],
  ["item",          "使用草藥恢復 HP"],
  ["flee",          "嘗試逃離戰鬥"],
  ["── SCENE ──",   ""],
  ["walk / fight",  "場景內的劇情選項"],
  ["hub",           "回到無名村任務告示板"],
  ["goblin / duke / abyss / sky", "前往對應戰鬥 / BOSS"],
  ["castle / truth",            "集齊條件後挑戰最終戰"],
];

const LORE = [
  { h: "// 序章 · CLASSROOM",  p: "故事始於東吳高中一堂無聊的國文課。三名學生在許願後被紫光吞噬，意識下沉，被傳送至一個不存在於地球的世界。" },
  { h: "// 廢物三人組",        p: "宮廷魔法師『公平・公正・公開』的資質檢測判定他們為廢物，流放至王國邊境等死。但他們意外救下一座被魔王軍襲擊的村莊，從此以此為根據地。" },
  { h: "// 三巨頭與傳說之石",  p: "啟動異世界傳送大陣需要羅劫公爵、冥盡洞主、天光島嶼之主三人手中的傳說之石。集齊三石，才能挑戰最終魔王城。" },
  { h: "// THE ADMINISTRATOR", p: "魔王不過是 21 世紀程式語言寫出來的 boss。真正的敵人，是把全人類關進電子空間的最強人工智能：C:\\mato\\user\\Administrator。" },
  { h: "// 東吳 AI 應用社",     p: "三位主角的真實身份。他們早已將 AI 的開發與邏輯演算法摸透——AI 是人類的工具，而非主宰。" },
];

function Codex() {
  return (
    <Shell>
      <h1 className="text-[#00ff88] crpg-glow text-xl tracking-widest">▌ CODEX</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Panel title="COMMAND REFERENCE">
          <ul className="text-xs space-y-1.5 font-mono">
            {CMDS.map(([c, d], i) => (
              <li key={i} className="flex gap-3">
                <span className="text-[#00ff88] crpg-glow w-36 shrink-0">{c}</span>
                <span className="text-[#7be0a8]">{d}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="WORLD LORE">
          <div className="space-y-3 text-sm">
            {LORE.map((l, i) => (
              <div key={i}>
                <div className="text-[#00e5ff] crpg-glow-cyan text-xs mb-1">{l.h}</div>
                <p className="text-[#cfeedd] leading-relaxed">{l.p}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </Shell>
  );
}
