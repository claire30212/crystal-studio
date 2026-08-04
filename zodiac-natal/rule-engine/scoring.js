/* 計分／排序／選 1-2 顆的純邏輯層（M3 架構調整：從 pick-matching-crystals.js 拆出）。
   規則來源：`crystal-matching-rule-model.md` 第二節、第七節 7.2／7.3。

   這一層只處理「給定一顆水晶的 traits 跟一組 needTags，算出分數／排序／決定選幾顆」，
   不做輸入型別驗證（假設呼叫端——目前是 ../pick-matching-crystals.js——已經在邊界驗證過
   mainList／needTags 的形狀，這裡是內部信任邊界，不重複驗證，避免同一件事驗兩次）。
   也不知道「這是月亮還是上升」，跟 fallback 文字、跟合併顯示（rule-engine/merge-display.js）
   都無關，維持單一職責。 */
(function (root) {
  'use strict';

  /* 規則 7.2：選 1-2 顆的門檻邏輯，可配置常數，之後依測試/使用者回饋調整，只需要改這一行。 */
  const SECOND_PICK_RATIO_THRESHOLD = 0.7;

  /* 規則 7.3 第 3 順位：verificationStatus 的排序權重，數字越大同分時排越前面。 */
  const VERIFICATION_STATUS_RANK = { verified: 3, partially_verified: 2, unverified: 1, deprecated: 0 };

  /* scoreCrystal(traits, needTags)
     traits — { coreTags: string[], supportTags: string[] }（已知合法，不重複驗證標籤是否在詞彙表裡）
     needTags — { coreNeeds: string[], secondaryNeeds: string[] }
     回傳：{ score, coreHits, supportHits, matchedTags }
     計分公式：coreTag×coreNeed=3、coreTag×secondaryNeed=2、supportTag×coreNeed=2、supportTag×secondaryNeed=1。 */
  function scoreCrystal(traits, needTags) {
    let score = 0, coreHits = 0, supportHits = 0;
    const matchedTags = new Set();
    traits.coreTags.forEach(tag => {
      if (needTags.coreNeeds.includes(tag)) { score += 3; coreHits++; matchedTags.add(tag); }
      if (needTags.secondaryNeeds.includes(tag)) { score += 2; coreHits++; matchedTags.add(tag); }
    });
    traits.supportTags.forEach(tag => {
      if (needTags.coreNeeds.includes(tag)) { score += 2; supportHits++; matchedTags.add(tag); }
      if (needTags.secondaryNeeds.includes(tag)) { score += 1; supportHits++; matchedTags.add(tag); }
    });
    return { score, coreHits, supportHits, matchedTags: Array.from(matchedTags) };
  }

  /* 規則 7.3 同分排序比較器：分數 desc → 核心標籤命中數 desc → 次要標籤命中數 desc →
     verificationStatus rank desc → 太陽清單原始順位 asc → 水晶名稱字串（code point）asc。
     全部依賴輸入資料本身，沒有 Math.random()，同樣輸入永遠得到同樣順序。
     期待輸入的每個 candidate 物件形狀：{ name, score, coreHits, supportHits, verificationStatus, mainListIndex } */
  function compareCandidates(a, b) {
    if (b.score !== a.score) return b.score - a.score;
    if (b.coreHits !== a.coreHits) return b.coreHits - a.coreHits;
    if (b.supportHits !== a.supportHits) return b.supportHits - a.supportHits;
    const rankDiff = VERIFICATION_STATUS_RANK[b.verificationStatus] - VERIFICATION_STATUS_RANK[a.verificationStatus];
    if (rankDiff !== 0) return rankDiff;
    if (a.mainListIndex !== b.mainListIndex) return a.mainListIndex - b.mainListIndex;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  }

  /* selectCandidates(candidates)
     candidates — 已經算好分數的候選陣列（score 皆 > 0，形狀同 compareCandidates 的期待輸入），
     不要求呼叫端先排序，這個函式自己排。
     回傳：排序＋門檻篩選後的候選陣列（1-2 筆），不含 fallback 判斷——candidates 為空陣列這件事
     由呼叫端（pick-matching-crystals.js）處理，因為「有沒有候選」是資料層的事，「選幾顆」才是
     這裡的職責，兩者混在一起會讓這個函式同時要處理「空陣列」跟「排序」兩種不相關的關注點。 */
  function selectCandidates(candidates) {
    const sorted = candidates.slice().sort(compareCandidates);
    const top = sorted[0];
    const second = sorted[1];
    if (second && second.score >= top.score * SECOND_PICK_RATIO_THRESHOLD) return [top, second];
    return [top];
  }

  const Scoring = {
    SECOND_PICK_RATIO_THRESHOLD,
    VERIFICATION_STATUS_RANK,
    scoreCrystal,
    compareCandidates,
    selectCandidates
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Scoring;
  } else {
    root.RuleEngineScoring = Scoring;
  }
})(typeof window !== 'undefined' ? window : globalThis);
