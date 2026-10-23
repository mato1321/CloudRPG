// @ts-nocheck
/* 職業設定（故事模式、各遊戲模式、HUD 共用）。數值與後端 app/game/data.py 一致 */

export const CLASSES = {
  warrior: {
    id: "warrior", name: "戰士", en: "Warrior", icon: "⚔",
    color: "text-[#ff4d6d] crpg-glow-red",
    border: "border-[#3a0f1c] hover:border-[#ff4d6d]",
    desc: "鋼鐵之軀，近戰爆發。以血肉碾碎眼前的一切。",
    stats: { hp:220, hpMax:220, mp:60, mpMax:60, atk:25 },
    skillType: "battle",
    attacks: [
      { name:"普通斬擊", mul:1.0 },
      { name:"重劈",     mul:1.4 },
    ],
    normal: [
      { name:"裂地斬",  mp:15, mul:1.6 },
      { name:"狂戰衝擊", mp:18, mul:1.8 },
      { name:"鋼鐵粉碎", mp:20, mul:2.0 },
    ],
    ultimate:    { name:"滅世斷界斬", mp:40, mul:4.5 },
    weaponBasic: { id:"weapon_basic", name:"銀風鐵劍",     atk:15, price:500 },
    weaponAdv:   { id:"weapon_adv",   name:"日蝕殞落之劍", atk:35, price:3000 },
  },
  mage: {
    id: "mage", name: "法師", en: "Mage", icon: "✦",
    color: "text-[#a78bfa] crpg-glow-cyan",
    border: "border-[#1f1a4a] hover:border-[#a78bfa]",
    desc: "高魔詠唱者。以遠程法術撕裂時空與敵陣。",
    stats: { hp:120, hpMax:120, mp:220, mpMax:220, atk:15 },
    skillType: "magic",
    attacks: [
      { name:"杖擊",     mul:1.0 },
      { name:"奧術飛彈", mul:1.3 },
    ],
    normal: [
      { name:"雷霆脈衝", mp:18, mul:1.7, hint:"引發連鎖閃電" },
      { name:"虛空火球", mp:20, mul:1.9, hint:"魔力爆發" },
      { name:"極光崩解", mp:22, mul:2.1 },
    ],
    ultimate:    { name:"禁忌・星界崩壞", mp:50, mul:5.0 },
    weaponBasic: { id:"weapon_basic", name:"刻印法杖",     atk:15, price:500 },
    weaponAdv:   { id:"weapon_adv",   name:"全世操縱之杖", atk:35, price:3000 },
  },
  priest: {
    id: "priest", name: "牧師", en: "Priest", icon: "✚",
    color: "text-[#ffd60a] crpg-glow-yellow",
    border: "border-[#3a2f0a] hover:border-[#ffd60a]",
    desc: "神諭之手。在傷害與恢復之間取得神聖平衡。",
    stats: { hp:160, hpMax:160, mp:180, mpMax:180, atk:12 },
    skillType: "holy",
    attacks: [
      { name:"聖珠衝擊", mul:1.0 },
      { name:"懲戒之光", mul:1.3 },
    ],
    normal: [
      { name:"聖光制裁", mp:16, mul:1.6 },
      { name:"靈魂祈禱", mp:18, mul:1.4, heal:30 },
      { name:"神聖脈動", mp:20, mul:1.5, heal:40 },
    ],
    ultimate:    { name:"終焉聖域", mp:45, mul:4.2, heal:80 },
    weaponBasic: { id:"weapon_basic", name:"純潔寶珠", atk:15, price:500 },
    weaponAdv:   { id:"weapon_adv",   name:"虛空之眼", atk:35, price:3000 },
  },
};

const AI_NAMES = ["AI_BOT_α", "AI_BOT_β", "AI_BOT_γ"];

/** 另外兩個職業的 AI 隊友（格鬥中按 [E] 支援） */
export function defaultParty(klass) {
  return Object.keys(CLASSES)
    .filter((k) => k !== klass)
    .slice(0, 2)
    .map((kid, i) => {
      const cc = CLASSES[kid];
      return { id: `ai_${i}`, name: AI_NAMES[i], klass: kid, isAI: true, hp: cc.stats.hp, hpMax: cc.stats.hpMax, atk: cc.stats.atk, alive: true };
    });
}
