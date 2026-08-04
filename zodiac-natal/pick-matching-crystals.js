/* pickMatchingCrystals()：月亮/上升「從太陽主清單裡挑 1-2 顆」的入口函式（orchestrator）。
   規則來源：`crystal-matching-rule-model.md` 第二節（演算法規格）＋第七節（四項補充規則）；
   標籤資料來源：`crystal-trait-tags.js`；計分/排序/選 1-2 顆的實際邏輯在 `rule-engine/scoring.js`
  （M3 架構調整：把「計分」拆出去，這裡只做輸入驗證、資料查找、跟 skip/ineligible 的分類）。

   這個模組只負責「驗證輸入、把水晶名稱轉成候選分數、組裝回傳值」，不負責：
   - 計分/排序/選幾顆的實際演算法——那在 `rule-engine/scoring.js`，這裡只呼叫；
   - 決定 needTags 本身的內容（十二月亮/十二上升的完整需求標籤表，屬於呼叫端的責任，
     見 `moon-needs-writing-guideline.md`／`ascendant-needs-writing-guideline.md`）；
   - 判斷月亮/上升挑到同一顆水晶時要不要合併顯示（規則 7.1）——那在 `rule-engine/merge-display.js`
    （目前尚未實作，等「標籤高度重疊」門檻數字定案）；
   - fallback 文字的組裝——那是 fallbackMoon()/fallbackRising() 的責任，兩者刻意跟計分邏輯分開，
     讓「要不要 fallback」（這個模組決定）跟「fallback 要說什麼」（呼叫端決定要用哪個文字函式）互不耦合。

   ========== API 規格（沿用 zodiac-crystals.js／crystal-trait-tags.js 的輸入驗證慣例）==========
   輸入型別本身就不對 → 拋出 TypeError。
   型別對但內容有問題，分兩種：
   - needTags.tagSchemaVersion 跟這個模組認定的 TAG_SCHEMA_VERSION 不一致 → 拋出一般 Error
    （不是 TypeError，因為型別沒錯，是「用了不同版本的標籤詞彙表產生的需求資料」這種契約不符，
     必須讓它立刻爆出來，不能悄悄算出一個沒人知道基準是哪一版的結果）。
   - coreNeeds/secondaryNeeds 裡出現不在 TAG_VOCABULARY 裡的標籤字串，或同一個標籤同時出現在
     coreNeeds 跟 secondaryNeeds 裡 → 也拋出一般 Error（這是需求資料本身寫錯，不是「查無資料」
     這種正常情況，比照上面的版本不符，一樣要立刻爆出來，不要默默把它當成 0 分處理）。
   mainList 裡的水晶名稱如果不在 CRYSTAL_TRAIT_TAGS 字典裡（例如字典還沒補上新水晶），
   不算輸入型別錯誤，也不是需求資料寫錯，是「這顆水晶目前沒有可比對的標籤資料」——歸類為
   查無資料，不拋錯，直接跳過該水晶，並列在回傳值的 skippedCrystals 讓呼叫端能察覺，而不是
   默默漏掉。matchEligibility:false 的水晶同理，正常跳過，列在 ineligibleCrystals。 */
(function (root) {
  'use strict';

  const CrystalTraitTags = (typeof module !== 'undefined' && module.exports)
    ? require('./crystal-trait-tags.js')
    : root.CrystalTraitTags;
  const { TAG_SCHEMA_VERSION, TAG_VOCABULARY, CRYSTAL_TRAIT_TAGS } = CrystalTraitTags;

  const Scoring = (typeof module !== 'undefined' && module.exports)
    ? require('./rule-engine/scoring.js')
    : root.RuleEngineScoring;
  const { SECOND_PICK_RATIO_THRESHOLD, scoreCrystal, selectCandidates } = Scoring;

  function assertIsArrayOfNonEmptyStrings(value, paramName) {
    if (!Array.isArray(value)) {
      throw new TypeError(`${paramName} 必須是陣列，實際收到：${value === null ? 'null' : typeof value}`);
    }
    value.forEach((item, i) => {
      if (typeof item !== 'string' || item.length === 0) {
        throw new TypeError(`${paramName}[${i}] 必須是非空字串，實際收到：${item === null ? 'null' : typeof item}`);
      }
    });
  }

  function assertIsPlainObject(value, paramName) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new TypeError(`${paramName} 必須是物件，實際收到：${value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value}`);
    }
  }

  function assertValidNeedTags(needTags) {
    assertIsPlainObject(needTags, 'needTags');
    assertIsArrayOfNonEmptyStrings(needTags.coreNeeds, 'needTags.coreNeeds');
    assertIsArrayOfNonEmptyStrings(needTags.secondaryNeeds, 'needTags.secondaryNeeds');
    if (typeof needTags.tagSchemaVersion !== 'string') {
      throw new TypeError(`needTags.tagSchemaVersion 必須是字串，實際收到：${needTags.tagSchemaVersion === null ? 'null' : typeof needTags.tagSchemaVersion}`);
    }
    if (needTags.tagSchemaVersion !== TAG_SCHEMA_VERSION) {
      throw new Error(
        `needTags.tagSchemaVersion 不符：needTags 是用 schema ${needTags.tagSchemaVersion} 產生的，` +
        `但這個模組目前使用的標籤字典是 schema ${TAG_SCHEMA_VERSION}。請確認 needTags 是否用最新版` +
        `TAG_VOCABULARY 重新產生，避免新舊標籤定義混用。`
      );
    }
    [...needTags.coreNeeds, ...needTags.secondaryNeeds].forEach(tag => {
      if (!(tag in TAG_VOCABULARY)) {
        throw new Error(`needTags 包含未定義在 TAG_VOCABULARY 裡的標籤「${tag}」`);
      }
    });
    const overlap = needTags.coreNeeds.filter(t => needTags.secondaryNeeds.includes(t));
    if (overlap.length > 0) {
      throw new Error(`needTags.coreNeeds 跟 needTags.secondaryNeeds 不應該有重複標籤：${overlap.join('、')}`);
    }
  }

  /* pickMatchingCrystals(mainList, needTags)
     mainList — 太陽主清單的水晶名稱陣列（例如 ZodiacCrystals.getMainCrystalsByName('天蠍座')）
     needTags — { coreNeeds: string[], secondaryNeeds: string[], tagSchemaVersion: string }

     回傳：
     {
       selectedCrystals: string[],       // 0-2 顆，mainList 的子集合
       fallback: boolean,                // true 時 selectedCrystals 必為空陣列
       tagSchemaVersion: string,         // 這次計算採用的標籤字典版本，方便呼叫端核對
       matchedTagsByCrystal: {[name]: string[]}, // 只包含 selectedCrystals 裡的水晶，各自命中了哪些標籤
       skippedCrystals: string[],        // mainList 裡「不在 CRYSTAL_TRAIT_TAGS 字典裡」而被跳過的水晶
       ineligibleCrystals: string[]      // mainList 裡「matchEligibility:false」而被跳過的水晶（如白水晶）
     } */
  function pickMatchingCrystals(mainList, needTags) {
    assertIsArrayOfNonEmptyStrings(mainList, 'mainList');
    assertValidNeedTags(needTags);

    const skippedCrystals = [];
    const ineligibleCrystals = [];
    const candidates = [];

    mainList.forEach((name, index) => {
      const traits = CRYSTAL_TRAIT_TAGS[name];
      if (!traits) { skippedCrystals.push(name); return; }
      if (traits.matchEligibility === false) { ineligibleCrystals.push(name); return; }
      const { score, coreHits, supportHits, matchedTags } = scoreCrystal(traits, needTags);
      if (score > 0) {
        candidates.push({ name, score, coreHits, supportHits, matchedTags, verificationStatus: traits.verificationStatus, mainListIndex: index });
      }
    });

    if (candidates.length === 0) {
      return { selectedCrystals: [], fallback: true, tagSchemaVersion: TAG_SCHEMA_VERSION, matchedTagsByCrystal: {}, skippedCrystals, ineligibleCrystals };
    }

    const selected = selectCandidates(candidates);
    const matchedTagsByCrystal = {};
    selected.forEach(c => { matchedTagsByCrystal[c.name] = c.matchedTags; });

    return {
      selectedCrystals: selected.map(c => c.name),
      fallback: false,
      tagSchemaVersion: TAG_SCHEMA_VERSION,
      matchedTagsByCrystal,
      skippedCrystals,
      ineligibleCrystals
    };
  }

  /* fallbackMoon()／fallbackRising()：規則 7.4 定案的兩個獨立函式，故意不共用同一句文字——
     月亮對應「情緒需求」的語境，上升對應「面對外在世界的方式」的語境。純文字函式，不做任何計算，
     呼叫端在 pickMatchingCrystals() 回傳 fallback:true 時，依「這次是月亮還是上升」自行決定呼叫哪一個。 */
  function fallbackMoon() {
    return '這次沒有從主清單中找到特別偏向你月亮星座情緒需求的水晶，因此不額外指定。你的太陽星座主水晶仍可依當下喜好選擇。';
  }

  function fallbackRising() {
    return '這次沒有從主清單中找到特別偏向你上升星座面對外在世界方式的水晶，因此不額外指定。你的太陽星座主水晶仍可依當下喜好選擇。';
  }

  const PickMatchingCrystals = {
    SECOND_PICK_RATIO_THRESHOLD,
    pickMatchingCrystals,
    fallbackMoon,
    fallbackRising
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PickMatchingCrystals;
  } else {
    root.PickMatchingCrystals = PickMatchingCrystals;
  }
})(typeof window !== 'undefined' ? window : globalThis);
