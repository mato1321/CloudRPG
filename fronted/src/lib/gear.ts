// @ts-nocheck
/* 隨機掉寶裝備的顯示工具（稀有度顏色、屬性文字） */

export const RARITY_COLOR = {
  common: "#cbd5e1",
  rare: "#38bdf8",
  epic: "#c084fc",
  legend: "#f97316",
  myth: "#ff4d6d",
};

export const RARITY_NAME = { common: "普通", rare: "稀有", epic: "史詩", legend: "傳說", myth: "神話" };
export const RARITY_ORDER = ["common", "rare", "epic", "legend", "myth"];
export const SLOT_NAME = { armor: "護甲", charm: "飾品" };

const STAT_LABEL = { atk: "ATK", hp: "HP", mp: "MP", energy: "氣條獲得", speed: "移動速度" };

export function statText(stats = {}) {
  return Object.entries(stats)
    .map(([k, v]) => `${STAT_LABEL[k] || k} +${v}${k === "energy" || k === "speed" ? "%" : ""}`)
    .join(" · ");
}

export function sortGear(gear = []) {
  return [...gear].sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) || (b.level || 0) - (a.level || 0));
}
