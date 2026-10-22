// @ts-nocheck
/* ───────────── 黑市商品 / 武器升階 / 購買邏輯 ─────────────
 * /market 頁面與故事模式內的「快速黑市」共用同一份規則，避免兩邊算法不一致。
 *
 * 武器規則：
 *   - 初級 / 高級武器第一次購買 = 裝備（ATK +15 / +35），之後可「升階強化」+1 ～ +3（每階 ATK +6 / +14）
 *   - 已有高級武器時不再販售初級武器（避免浪費金幣）
 *   - ???終端機 只能購買一次
 *   - 格鬥畫面中的武器外觀與光效依「目前最高等級武器 + 強化等級」即時變化
 */

export const CLASS_TRANSFER_PRICE = 6000;
export const INFINITE_GOLD = 999999999;
export const MAX_PLUS = 3;

const WEAPON_ATK = {
  weapon_basic: { base: 15, per: 6 },
  weapon_adv: { base: 35, per: 14 },
};

export const CLASS_META: Record<string, any> = {
  warrior: {
    id: "warrior",
    name: "戰士",
    en: "Warrior",
    icon: "⚔",
    color: "text-[#ff4d6d] crpg-glow-red",
    border: "border-[#ff4d6d]",
    stats: { hp: 220, mp: 60, atk: 25 },
    skill1: "裂地斬",
    skill2: "狂戰衝擊",
    skill3: "鋼鐵粉碎",
    ult: "滅世斷界斬",
    wBasic: "銀風鐵劍",
    wAdv: "日蝕殞落之劍",
    wBasicFx: "劍身纏繞銀色疾風",
    wAdvFx: "黑金劍身燃起日蝕烈焰",
    desc: "鋼鐵之軀，近戰爆發。擁有最高生命值與狂暴斬擊。",
  },
  mage: {
    id: "mage",
    name: "法師",
    en: "Mage",
    icon: "✦",
    color: "text-[#a78bfa] crpg-glow-cyan",
    border: "border-[#a78bfa]",
    stats: { hp: 120, mp: 220, atk: 15 },
    skill1: "雷霆脈衝",
    skill2: "虛空火球",
    skill3: "極光崩解",
    ult: "禁忌・星界崩壞",
    wBasic: "刻印法杖",
    wAdv: "全世操縱之杖",
    wBasicFx: "法珠周圍環繞藍色符文",
    wAdvFx: "黃金法杖迸發雷電與水晶",
    desc: "高魔詠唱者。雙發貫穿極光波與超高倍率星界崩壞。",
  },
  priest: {
    id: "priest",
    name: "牧師",
    en: "Priest",
    icon: "✚",
    color: "text-[#ffd60a] crpg-glow-yellow",
    border: "border-[#ffd60a]",
    stats: { hp: 160, mp: 180, atk: 12 },
    skill1: "聖光制裁",
    skill2: "靈魂祈禱 (含回血)",
    skill3: "神聖脈動 (含回血)",
    ult: "終焉聖域 (大回血)",
    wBasic: "純潔寶珠",
    wAdv: "虛空之眼",
    wBasicFx: "寶珠灑落聖光星芒",
    wAdvFx: "紫色虛空之眼吞噬光芒",
    desc: "神諭之手。進階技能與奧義皆可在格鬥中邊打邊恢復生命。",
  },
};

export const RARITY: Record<string, string> = {
  common: "text-[#7be0a8]",
  rare: "text-[#00e5ff] crpg-glow-cyan",
  epic: "text-[#ffd60a] crpg-glow-yellow",
  legend: "text-[#ff4d6d] crpg-glow-red",
  myth: "text-[#a78bfa] crpg-glow-cyan",
};

export function buildShop(klass: string) {
  const meta = klass ? CLASS_META[klass] : null;
  return [
    {
      id: "herb",
      name: "草藥",
      desc: "常見的草藥，街機戰鬥中按 [H] 可即時恢復體力。",
      effect: "恢復 60 HP",
      price: 100,
      rarity: "common",
    },
    {
      id: "mana",
      name: "魔力藥水",
      desc: "蘊含魔力的藥水，街機戰鬥中按 [B] 可恢復 MP 並充能 50% 氣條。",
      effect: "恢復 60 MP + 50% 氣條",
      price: 100,
      rarity: "common",
    },
    {
      id: "skillbook_1",
      name: "進階技能書・卷一",
      desc: "記載著職業進階對空與爆發招式的秘傳卷軸（解鎖鍵盤 [T / U] 技能 2）。",
      effect: meta ? `習得技能2「${meta.skill2}」` : "依職業解鎖第 2 技能 [T/U]",
      price: 600,
      rarity: "rare",
      isSkillBook: true,
    },
    {
      id: "skillbook_2",
      name: "進階技能書・卷二",
      desc: "記載著職業高階霸體突進與極光連擊的古卷（解鎖鍵盤 [Y / O] 技能 3）。",
      effect: meta ? `習得技能3「${meta.skill3}」` : "依職業解鎖第 3 技能 [Y/O]",
      price: 1200,
      rarity: "epic",
      isSkillBook: true,
    },
    {
      id: "skillbook",
      name: "終極奧義技能書",
      desc: "封印著職業最強毀滅奧義的禁忌書頁（解鎖鍵盤 [Q / I] 100% 氣條超必殺技）。",
      effect: meta ? `習得奧義「★ ${meta.ult}」` : "依職業解鎖終極超必殺技 [Q/I]",
      price: 2000,
      rarity: "legend",
      isSkillBook: true,
    },
    {
      id: "totem",
      name: "不死圖騰",
      desc: "當格鬥中 HP 歸 0 時自動發動，原地復活並恢復 60% HP 繼續作戰，使用後消耗。",
      effect: "致命傷自動復活 ×1",
      price: 3000,
      rarity: "rare",
    },
    {
      id: "weapon_basic",
      name: meta ? meta.wBasic : "初級職業武器",
      desc: `鐫刻著職業印記的入門裝備。${meta ? `格鬥外觀：${meta.wBasicFx}。` : ""}`,
      effect: `ATK +${WEAPON_ATK.weapon_basic.base}（升階每級 +${WEAPON_ATK.weapon_basic.per}）`,
      price: 500,
      rarity: "rare",
      classOnly: true,
    },
    {
      id: "weapon_adv",
      name: meta ? meta.wAdv : "高級職業武器",
      desc: `高位職業專屬神器，戰場上的決勝關鍵。${meta ? `格鬥外觀：${meta.wAdvFx}。` : ""}`,
      effect: `ATK +${WEAPON_ATK.weapon_adv.base}（升階每級 +${WEAPON_ATK.weapon_adv.per}）`,
      price: 3000,
      rarity: "legend",
      classOnly: true,
    },
    {
      id: "terminus",
      name: "???終端機",
      desc: "也許是這個世界的底層邏輯。格鬥外觀：武器化為流動的綠色程式碼。",
      effect: "ATK +9999 · HP +9999 · MP +9999",
      price: 100000,
      rarity: "myth",
      hidden: true,
    },
  ];
}

/** 目前格鬥中顯示的武器：tier 0 無 / 1 初級 / 2 高級 / 3 終端機，plus = 強化等級 */
export function weaponLoadout(inv: any = {}) {
  const basic = inv?.weapon_basic || 0;
  const adv = inv?.weapon_adv || 0;
  if ((inv?.terminus || 0) > 0) return { tier: 3, plus: MAX_PLUS, key: "terminus" };
  if (adv > 0) return { tier: 2, plus: Math.min(MAX_PLUS, adv - 1), key: "weapon_adv" };
  if (basic > 0) return { tier: 1, plus: Math.min(MAX_PLUS, basic - 1), key: "weapon_basic" };
  return { tier: 0, plus: 0, key: null };
}

/** 角色面板「EQUIPPED」顯示用：只列出實際裝備中的武器（不再重複堆疊名稱） */
export function equippedList(klass: string, inv: any = {}) {
  const meta = CLASS_META[klass];
  const out: string[] = [];
  const { tier, plus } = weaponLoadout({ ...inv, terminus: 0 });
  const tag = plus > 0 ? ` +${plus}` : "";
  if (meta && tier === 2) out.push(`${meta.wAdv}${tag}`);
  else if (meta && tier === 1) out.push(`${meta.wBasic}${tag}`);
  if ((inv?.terminus || 0) > 0) out.push("???終端機");
  return out;
}

/** 武器提供的 ATK 加成（轉職時重新計算用） */
export function weaponAtkBonus(inv: any = {}) {
  const b = Math.min(inv?.weapon_basic || 0, 1 + MAX_PLUS);
  const a = Math.min(inv?.weapon_adv || 0, 1 + MAX_PLUS);
  const t = (inv?.terminus || 0) > 0 ? 9999 : 0;
  return (
    (b ? WEAPON_ATK.weapon_basic.base + WEAPON_ATK.weapon_basic.per * (b - 1) : 0) +
    (a ? WEAPON_ATK.weapon_adv.base + WEAPON_ATK.weapon_adv.per * (a - 1) : 0) +
    t
  );
}

export function upgradeCost(it: any, nextPlus: number) {
  return Math.round(it.price * (0.5 + 0.25 * nextPlus));
}

/** 商品當下的狀態：實際價格（升階價）、按鈕文字、徽章、能否購買 */
export function itemStatus(it: any, state: any, isAdmin = false) {
  const inv = state?.inv || {};
  const owned = inv[it.id] || 0;
  let price = it.price;
  let label = "BUY";
  let blocked: string | null = null;
  let badge = `持有 ×${owned}`;

  if (it.isSkillBook) {
    const learned =
      (it.id === "skillbook_1" && state?.learnedSkill2) ||
      (it.id === "skillbook_2" && state?.learnedSkill3) ||
      (it.id === "skillbook" && state?.learnedUlt);
    badge = learned ? "✅ 已習得" : "🔒 未習得";
    if (learned) {
      blocked = "你已經習得這個技能了。";
      label = "LEARNED ✓";
    }
  } else if (it.id === "weapon_basic" || it.id === "weapon_adv") {
    const plus = owned - 1;
    if (it.id === "weapon_basic" && (inv.weapon_adv || 0) > 0) {
      blocked = "已裝備高級武器，初級武器不再需要。";
      label = "已被高級武器取代";
      badge = owned > 0 ? "📦 已收藏（高級武器裝備中）" : "高級武器裝備中";
    } else if (owned >= 1 + MAX_PLUS) {
      blocked = `已強化至 +${MAX_PLUS} 上限。`;
      label = `MAX +${MAX_PLUS}`;
      badge = `✅ 已裝備 +${MAX_PLUS}（最高強化）`;
    } else if (owned > 0) {
      price = upgradeCost(it, plus + 1);
      label = `升階強化 → +${plus + 1}`;
      badge = `✅ 已裝備${plus > 0 ? ` +${plus}` : ""}`;
    } else {
      badge = "尚未裝備";
    }
  } else if (it.id === "terminus") {
    badge = owned > 0 ? "✅ 已裝備（未知權限已解鎖）" : "？？？";
    if (owned > 0) {
      blocked = "已經裝備了。";
      label = "已裝備 ✓";
    }
  }

  const gold = isAdmin ? INFINITE_GOLD : state?.gold ?? 0;
  const canAfford = gold >= price;
  return { price, label, blocked, badge, owned, canAfford, canBuy: !!state && !blocked && canAfford };
}

/** 套用一次購買：回傳 { ok, msg, state }（不會修改傳入的 state） */
export function applyPurchase(state: any, it: any, isAdmin = false) {
  if (!state) return { ok: false, msg: "找不到存檔，請先進入 PLAY 建立角色。" };
  const st = itemStatus(it, state, isAdmin);
  if (st.blocked) return { ok: false, msg: st.blocked };
  if (!st.canAfford) return { ok: false, msg: `金幣不足（需要 ${st.price.toLocaleString()}G）` };

  const klass = state.klass;
  const meta = CLASS_META[klass] || CLASS_META.warrior;
  const s = { ...state, inv: { ...(state.inv || {}) } };
  let msg = `已購買 ${it.name}`;

  if (it.id === "skillbook_1") {
    s.learnedSkill2 = true;
    s.inv.skillbook_1 = 1;
    msg = `✨ 已習得第 2 技能 [T/U]：${meta.skill2}！`;
  } else if (it.id === "skillbook_2") {
    s.learnedSkill3 = true;
    s.inv.skillbook_2 = 1;
    msg = `✨ 已習得第 3 技能 [Y/O]：${meta.skill3}！`;
  } else if (it.id === "skillbook") {
    s.learnedUlt = true;
    s.inv.skillbook = 1;
    msg = `★ 已習得終極奧義 [Q/I]：${meta.ult}！`;
  } else if (it.id === "weapon_basic" || it.id === "weapon_adv") {
    const owned = s.inv[it.id] || 0;
    const gain = owned === 0 ? WEAPON_ATK[it.id].base : WEAPON_ATK[it.id].per;
    s.inv[it.id] = owned + 1;
    s.atk = (s.atk || 0) + gain;
    msg =
      owned === 0
        ? `⚔ 已裝備「${it.name}」ATK +${gain}！格鬥中的武器外觀已進化。`
        : `⚔「${it.name}」升階強化至 +${owned}，ATK +${gain}，武器光效增強！`;
  } else if (it.id === "terminus") {
    s.inv.terminus = 1;
    s.atk = (s.atk || 0) + 9999;
    s.hpMax = (s.hpMax || 0) + 9999;
    s.mpMax = (s.mpMax || 0) + 9999;
    s.hp = s.hpMax;
    s.mp = s.mpMax;
    msg = "[ERROR] 未知權限已解鎖……武器化為流動的程式碼。";
  } else {
    s.inv[it.id] = (s.inv[it.id] || 0) + 1;
  }

  s.equipped = equippedList(klass, s.inv);
  s.gold = isAdmin ? INFINITE_GOLD : (s.gold || 0) - st.price;
  return { ok: true, msg, state: s };
}
