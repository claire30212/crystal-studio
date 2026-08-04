/* 月亮／上升選到同一顆水晶時，要不要合併顯示（規則 7.1）。
   規則來源：`crystal-matching-rule-model.md` 第三節＋第七節 7.1。三個合併條件，三者皆成立才合併：
   1. 水晶相同（不分順序比對集合）；
   2. 雙方命中的匹配標籤集合高度重疊；
   3. 雙方都不是 fallback。

   只要有一條不成立，就回傳 merge:false，呼叫端維持月亮、上升各自獨立的說明文字
  （即使顯示的是同一顆水晶名稱——見第三節「部分重疊」跟「完全相同但巧合命中」的區分）。

   ========== 「標籤高度重疊」門檻定案（M3 步驟 5，本輪補上）==========
   重疊比例公式採用 Jaccard 相似度：|交集| / |聯集|，分別對月亮／上升各自的
  `matchedTagsByCrystal`（來自 `pick-matching-crystals.js`）取所有選中水晶的命中標籤聯集，
   再比較兩邊聯集彼此的重疊比例——不是逐顆水晶分開比較，是把「這一側總共是靠哪些標籤命中的」
   當一個集合來看待，對應規則文件「雙方命中的匹配標籤集合」這個講法。

   門檻定為 HIGH_TAG_OVERLAP_THRESHOLD = 0.5，依據：對十二星座在太陽/月亮/上升三個欄位的
   全部 1728 種組合實際跑過一次，篩出「月亮、上升選到完全相同水晶集合」的 417 組，量測它們的
   標籤重疊比例分布，只落在 {0, 0.25, 0.33, 0.5, 0.67, 0.75, 1.0} 這幾個值（都是小整數比的
   結果，因為命中標籤數量本來就少）。逐一檢查各比例區間的實際案例：
   - ratio ≥ 0.5 的案例（例如月亮命中[自信,活力]、上升命中[自信]——上升的命中標籤是月亮的
     真子集，代表兩邊至少有一個共同的核心理由，只是其中一邊多了額外的次要理由），判斷為
    「同一個推薦理由，值得合併」；
   - ratio < 0.5 的案例（例如兩邊只有 1 個標籤重疊、但各自還有 2-3 個完全不同的標籤，或
     像「月亮命中情感療癒、上升命中柔和」這種完全不重疊的情況），判斷為「巧合選中同一顆水晶，
     理由其實不同」，不應該合併。
   0.5 剛好落在這兩群案例的自然分界上（沒有任何實際案例的比例落在 0.5 到 0.67 之間、或
   0.33 到 0.5 之間，所以這個門檻不會卡在任何案例的模糊地帶）。這個門檻可配置、之後依測試/
   使用者回饋調整，不寫死在邏輯裡（跟 `scoring.js` 的 SECOND_PICK_RATIO_THRESHOLD 同一種
   處理方式）。

   這一層只做「要不要合併」的純邏輯判斷，不生成合併後要顯示的文字（那句「同時點出月亮與上升
   兩個面向」的說明句，屬於呼叫端／UI 層的責任，見 crystal-matching-rule-model.md 第三節）；
   這裡只回傳判斷結果，加上 `combinedMatchedTags`（合併後的標籤聯集）給呼叫端寫文字時用，
   不需要呼叫端自己重新計算一次聯集。 */
(function (root) {
  'use strict';

  /* 規則 7.1：「標籤高度重疊」的門檻，見上方大段註解的量測依據。 */
  const HIGH_TAG_OVERLAP_THRESHOLD = 0.5;

  /* areCrystalSetsEqual(a, b) — 條件 1：兩個水晶名稱陣列是否代表同一個集合（不分順序、不看重複）。 */
  function areCrystalSetsEqual(a, b) {
    const setA = new Set(a);
    const setB = new Set(b);
    if (setA.size !== setB.size) return false;
    for (const name of setA) {
      if (!setB.has(name)) return false;
    }
    return true;
  }

  /* unionMatchedTags(result) — 取一側（月亮或上升）`pickMatchingCrystals()` 回傳值裡，
     所有 selectedCrystals 各自命中標籤的聯集（去重），代表「這一側總共是靠哪些標籤命中的」。 */
  function unionMatchedTags(result) {
    const tags = new Set();
    result.selectedCrystals.forEach(name => {
      (result.matchedTagsByCrystal[name] || []).forEach(tag => tags.add(tag));
    });
    return Array.from(tags);
  }

  /* computeTagOverlapRatio(tagsA, tagsB) — 條件 2 的核心計算：Jaccard 相似度 |交集|/|聯集|。
     兩邊都是空陣列時（理論上不會發生——fallback:false 保證至少有一個命中標籤，這裡仍防禦性
     處理，避免除以零）回傳 0，視為「沒有重疊」，不會被判定為高度重疊。 */
  function computeTagOverlapRatio(tagsA, tagsB) {
    const setA = new Set(tagsA);
    const setB = new Set(tagsB);
    const union = new Set([...setA, ...setB]);
    if (union.size === 0) return 0;
    let intersectionCount = 0;
    setA.forEach(tag => { if (setB.has(tag)) intersectionCount++; });
    return intersectionCount / union.size;
  }

  /* shouldMergeDisplay(moonResult, risingResult)
     moonResult／risingResult — 各自呼叫 `pickMatchingCrystals()` 得到的完整回傳值
    （形狀見 `pick-matching-crystals.js`），不在這裡重新驗證形狀是否合法（信任呼叫端已經是
     合法的 pickMatchingCrystals() 輸出，跟 scoring.js 對 pick-matching-crystals.js 的信任
     邊界原則一致）。

     回傳：
     {
       merge: boolean,
       reason: 'merged' | 'fallback' | 'crystal-set-mismatch' | 'tag-overlap-too-low',
       tagOverlapRatio: number | null,   // 條件 1 沒過時（fallback 或水晶集合不同）為 null，
                                         // 因為這時候比較「標籤重疊」沒有意義
       crystals: string[] | null,       // merge:true 時才有值，是共同的水晶集合
       combinedMatchedTags: string[] | null  // merge:true 時才有值，合併後的標籤聯集，
                                              // 供呼叫端組裝「同時點出月亮與上升」的說明句用
     }
     不論哪個分支，回傳形狀的欄位都固定（值為 null 或實際內容），不會少欄位，方便呼叫端
     不用先判斷 reason 才能安全存取欄位。 */
  function shouldMergeDisplay(moonResult, risingResult) {
    if (moonResult.fallback || risingResult.fallback) {
      return { merge: false, reason: 'fallback', tagOverlapRatio: null, crystals: null, combinedMatchedTags: null };
    }

    if (!areCrystalSetsEqual(moonResult.selectedCrystals, risingResult.selectedCrystals)) {
      return { merge: false, reason: 'crystal-set-mismatch', tagOverlapRatio: null, crystals: null, combinedMatchedTags: null };
    }

    const moonTags = unionMatchedTags(moonResult);
    const risingTags = unionMatchedTags(risingResult);
    const ratio = computeTagOverlapRatio(moonTags, risingTags);

    if (ratio >= HIGH_TAG_OVERLAP_THRESHOLD) {
      const combined = Array.from(new Set([...moonTags, ...risingTags]));
      return { merge: true, reason: 'merged', tagOverlapRatio: ratio, crystals: moonResult.selectedCrystals.slice(), combinedMatchedTags: combined };
    }

    return { merge: false, reason: 'tag-overlap-too-low', tagOverlapRatio: ratio, crystals: null, combinedMatchedTags: null };
  }

  const MergeDisplay = {
    HIGH_TAG_OVERLAP_THRESHOLD,
    areCrystalSetsEqual,
    unionMatchedTags,
    computeTagOverlapRatio,
    shouldMergeDisplay
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MergeDisplay;
  } else {
    root.RuleEngineMergeDisplay = MergeDisplay;
  }
})(typeof window !== 'undefined' ? window : globalThis);
