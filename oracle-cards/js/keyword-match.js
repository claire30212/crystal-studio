// 抽卡（永遠真隨機）與內容版本選擇（依情境）——兩件事完全分離
//
// 設計原則：抽到哪張卡是誠信原則，使用者的輸入/標籤選擇「完全不能」影響抽到哪張卡，
// 只能拿來決定已經抽到的那張卡，todayMessages/goldenLines/reflections/actions
// 要顯示哪個情境版本的文案。

/**
 * 純隨機抽卡（加權只用於降低連續抽到同一張卡的機率，不做任何關鍵字/輸入比對）
 * @param {Array} cards 卡牌資料陣列
 * @param {string|null} lastCardId 上一張卡 id，用於降低連續抽到同一張卡的機率
 */
export function drawRandomCard(cards, lastCardId = null) {
  if (cards.length === 1) return cards[0];

  const weights = cards.map(card => (card.id === lastCardId ? 0.3 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;

  for (let i = 0; i < cards.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return cards[i];
  }
  return cards[cards.length - 1];
}

/**
 * 從隨機池（陣列）中抽一個
 */
export function pickFromPool(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * 內容版本選擇——只依「已經抽到的卡」+「使用者的情境」挑版本，不影響抽卡結果。
 * todayMessages / goldenLines / reflections / actions 四個欄位共用這套規則：
 *
 * 資料若已改成 { 綜合: [...], 工作: [...], ... } 這種依情境分版的物件，
 * 就依 context 取對應的池（找不到則退回「綜合」）；資料若仍是單純陣列（尚未依情境分版的卡），
 * 就直接把整個陣列當作唯一的池使用。取到池之後，若池本身是陣列就隨機抽一個，
 * 若不是陣列（例如 goldenLines 每情境只存一句字串），就直接回傳。
 */
export function selectByContext(pool, context) {
  const resolved = Array.isArray(pool) ? pool : (pool[context] || pool["綜合"]);
  return Array.isArray(resolved) ? pickFromPool(resolved) : resolved;
}
