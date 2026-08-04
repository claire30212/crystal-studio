/* 水晶情境需求特質標籤字典（純資料，無 DOM 相依）。
   來源：`crystal-tag-dictionary-scoring-draft.md` 審核通過版本，經以下 6 項決議調整後定案：
   1. 白水晶（及未來其他萬用石）matchEligibility:false，明確標記不參與月亮/上升情境匹配計分，
      但仍保留在太陽主清單（matchEligibility 只影響這個模組的匹配資格，不影響 zodiac-crystals.js）。
   2. 石榴石（Garnet）群組層級 verificationStatus 採 'partially_verified'。
   3. 虎眼石（Tiger Eye）群組層級維持 coreTags:[]、supportTags:['自信']、verificationStatus:'unverified'。
   4. 鈦晶不指派任何 coreTags/supportTags，verificationStatus:'unverified'，
      matchEligibility:false（跟白水晶用同一套機制標記不參與，而不是靠空標籤自然導致 0 分）。
      本檔案同時把「珍珠」也一併套用這條原則（珍珠效果描述本身尚待審核、沒有可靠依據可指派標籤，
      跟鈦晶的處境相同：與其讓空標籤陣列自然導致 0 分，不如用同一個欄位明確標記——這是這輪決議沒有
      逐字點名珍珠、但同一條原則自然適用而主動延伸套用的一處，如果你不同意這個延伸，請告知，改回
      「只是自然 0 分、不特別標記」也不影響任何計分結果，純粹是誠實標記意圖的差異。
   6. 新增 TAG_SCHEMA_VERSION，供 pick-matching-crystals.js 在執行時驗證呼叫端傳入的 needTags
      是用同一套標籤詞彙版本產生的，避免未來標籤字典改版（新增/重新命名標籤）後，
      舊版 needTags 資料混進新版邏輯裡計算出不知情的錯誤結果。

   本檔案不重複水晶的功效描述全文（那些在 crystal-lookup.html／crystal-scenario-review-draft.md），
   這裡只保留「情境需求標籤」這一種衍生資料，且每一組標籤在 crystal-tag-dictionary-scoring-draft.md
   都有逐句對照原始描述的依據說明，不是憑空新增的詮釋。

   ========== 資料不可變／驗證慣例（沿用 zodiac-crystals.js 的慣例，不重新發明一套）==========
   所有匯出資料結構用 Object.freeze 做淺層+巢狀凍結；輸入型別錯誤丟 TypeError，型別正確但查無資料
   回傳 undefined，不拋錯。 */
(function (root) {
  'use strict';

  const TAG_SCHEMA_VERSION = '1.0.0';

  /* 16 詞控制詞彙表：coreTags/supportTags（水晶特質）跟 coreNeeds/secondaryNeeds（月亮/上升需求）
     只能從這裡面選，不臨時新造詞。跟 crystal-lookup.html 既有大分類標籤（感情/招財/保護/專注/健康/
     淨化）是兩套不相通的系統，即使字面偶有重複（例如「專注」），服務的場景跟判定範圍不同。 */
  const TAG_VOCABULARY = {
    '沉澱': '放慢步調、讓紛亂情緒或思緒靜下來',
    '安全感': '對環境或關係感到穩定、不擔心失去',
    '界線': '區隔自己與他人、隔絕不想承接的能量或情緒',
    '表達': '把想法或感受清楚說出來、溝通順暢',
    '人際': '與他人的互動和諧、關係層面的和睦',
    '活力': '行動力、主動出擊的能量',
    '自信': '對自己能力或魅力的肯定感、敢於展現',
    '直覺': '內在覺察、傾聽第六感而非邏輯分析',
    '柔和': '溫柔、不強硬的待人待己方式',
    '專注': '心思集中、不被雜念打斷',
    '轉換適應': '面對階段轉換、新環境時的調適',
    '情緒安撫': '平息已經浮躁/起伏的情緒（偏「被動舒緩」，跟「沉澱」的「主動放慢」不同）',
    '保護感': '感覺被保護、隔絕外界干擾（感受層面，跟「界線」的行為層面不同）',
    '平衡': '整體性的、不特別針對單一情境的穩定感（萬用石常見標籤，診斷力較弱）',
    '接地務實': '回到現實感、腳踏實地',
    '情感療癒': '情感溫度、被愛與自我疼惜的療癒感（療癒過去情緒創傷，跟「柔和」的當下待人方式不同）'
  };

  /* verificationStatus 沿用 zodiac-crystals.js 的四值定義（維持單一定義來源，不重複宣告一份可能
     漂移的複本）。跟 zodiac-crystals.js 本身一樣，同時支援 CommonJS 與瀏覽器全域兩種載入方式。 */
  const VERIFICATION_STATUS_VALUES = (typeof module !== 'undefined' && module.exports)
    ? require('./zodiac-crystals.js').VERIFICATION_STATUS_VALUES
    : root.ZodiacCrystals.VERIFICATION_STATUS_VALUES;

  /* CRYSTAL_TRAIT_TAGS 涵蓋太陽主清單（ZODIAC_MAIN_CRYSTALS）目前用到的全部 19 個水晶名稱。
     欄位說明：
     - coreTags / supportTags：字串陣列，每個字串都必須是 TAG_VOCABULARY 的合法鍵值（模組載入時驗證）。
       同一顆水晶的 coreTags 跟 supportTags 不可以有重複的標籤（模組載入時驗證）。
     - matchEligibility：預設視為 true（不寫這個欄位＝參與匹配）；明確寫 false 代表「即使有標籤也
       不參與月亮/上升情境匹配計分」，只留在太陽主清單顯示。目前只有白水晶、鈦晶、珍珠三筆是 false。
     - verificationStatus：影響同分排序（見 pick-matching-crystals.js）。
     - canonicalGroup / databaseStatus / availableVariants：只有石榴石、虎眼石這類「群組層級參照」
       才有這三個欄位，代表這個名稱不直接等於資料庫裡任何一筆水晶，而是對應資料庫裡的一組品種。 */
  const CRYSTAL_TRAIT_TAGS = {
    '紅瑪瑙': { coreTags: ['接地務實'], supportTags: ['沉澱'], verificationStatus: 'verified' },
    '太陽石': { coreTags: ['自信', '活力'], supportTags: ['保護感'], verificationStatus: 'verified' },
    '黃水晶': { coreTags: ['自信'], supportTags: ['活力'], verificationStatus: 'verified' },
    '綠東陵石': { coreTags: ['情緒安撫'], supportTags: ['柔和'], verificationStatus: 'verified' },
    '粉水晶': { coreTags: ['情感療癒', '柔和'], supportTags: ['自信'], verificationStatus: 'verified' },
    '托帕石': { coreTags: ['自信'], supportTags: ['情緒安撫'], verificationStatus: 'verified' },
    '白水晶': {
      coreTags: ['平衡'], supportTags: ['專注'], verificationStatus: 'verified',
      matchEligibility: false,
      note: '萬用石，語意上刻意不指向任何特定情境，決議 1：不參與情境匹配計分，只留在太陽主清單。'
    },
    '藍晶石': { coreTags: ['表達'], supportTags: ['專注'], verificationStatus: 'verified' },
    '瑪瑙': { coreTags: ['保護感'], supportTags: ['沉澱'], verificationStatus: 'verified' },
    '海藍寶': { coreTags: ['表達'], supportTags: ['直覺'], verificationStatus: 'verified' },
    '月光石': { coreTags: ['轉換適應', '柔和'], supportTags: ['直覺'], verificationStatus: 'verified' },
    '珍珠': {
      coreTags: [], supportTags: [], verificationStatus: 'unverified',
      matchEligibility: false,
      note: '效果描述本身尚待審核（見 crystal-lookup.html），沒有可靠依據可指派標籤；比照決議 4' +
        '（鈦晶）的原則，用明確欄位標記不參與，而不是靠空標籤陣列自然導致 0 分——本檔案主動延伸套用，' +
        '未經逐字確認，如不同意可改回不特別標記。'
    },
    '橄欖石': { coreTags: ['人際'], supportTags: ['情緒安撫'], verificationStatus: 'verified' },
    '黑曜石': { coreTags: ['保護感', '界線'], supportTags: ['沉澱'], verificationStatus: 'verified' },
    '紫水晶': { coreTags: ['沉澱', '直覺'], supportTags: ['專注'], verificationStatus: 'verified' },
    '煙晶': { coreTags: ['接地務實'], supportTags: ['沉澱'], verificationStatus: 'verified' },
    '石榴石': {
      coreTags: ['情感療癒'], supportTags: [], verificationStatus: 'partially_verified',
      canonicalGroup: 'Garnet', databaseStatus: 'group-level-reference',
      availableVariants: ['紅石榴', '橙石榴'],
      note: '不等同紅石榴或橙石榴；coreTags 沿用兩品種共同的功效描述（情感溫度與療癒感），' +
        '不採用西方寶石傳統對 Garnet 整體的「活力/行動」詮釋（那不是這個資料庫的描述來源）。'
    },
    '虎眼石': {
      coreTags: [], supportTags: ['自信'], verificationStatus: 'unverified',
      canonicalGroup: 'Tiger Eye', databaseStatus: 'group-level-reference',
      availableVariants: ['黃虎眼', '藍虎眼'],
      note: '不等同黃虎眼或藍虎眼；兩品種語意分歧（黃=自信/意志力，藍=洞察/理性判斷），群組層級' +
        '只保留自信作為 supportTags（決議 3），不指派 coreTags，避免用其中一個品種的特質冒充群組共通特質。'
    },
    '鈦晶': {
      coreTags: [], supportTags: [], verificationStatus: 'unverified',
      matchEligibility: false,
      canonicalMineral: 'Rutilated Quartz（暫定，市場命名，非正式查證結果）',
      databaseStatus: 'not-in-database',
      note: '完全不在 crystal-lookup.html 70 筆資料裡（跟「鈦金」是不同的兩筆東西）；決議 4：' +
        '不指派任何標籤，用 matchEligibility:false 明確標記不參與，在查證完成前不參與月亮/上升匹配，' +
        '但保留於太陽主清單。'
    }
  };

  function assertIsString(value, paramName) {
    if (typeof value !== 'string') {
      throw new TypeError(`${paramName} 必須是字串，實際收到：${value === null ? 'null' : typeof value}`);
    }
  }

  /* 模組載入時的資料完整性自我檢查：不是「呼叫端輸入驗證」，是「這份資料本身有沒有寫錯」的把關，
     寫錯了應該讓模組直接載入失敗，不要帶著矛盾資料悄悄跑起來。 */
  function validateTraitTagData() {
    Object.entries(CRYSTAL_TRAIT_TAGS).forEach(([name, entry]) => {
      ['coreTags', 'supportTags'].forEach(field => {
        entry[field].forEach(tag => {
          if (!(tag in TAG_VOCABULARY)) {
            throw new Error(`資料錯誤：「${name}」的 ${field} 包含未定義在 TAG_VOCABULARY 裡的標籤「${tag}」`);
          }
        });
      });
      const overlap = entry.coreTags.filter(t => entry.supportTags.includes(t));
      if (overlap.length > 0) {
        throw new Error(`資料錯誤：「${name}」的 coreTags 跟 supportTags 有重複標籤：${overlap.join('、')}`);
      }
      if (!VERIFICATION_STATUS_VALUES.includes(entry.verificationStatus)) {
        throw new Error(`資料錯誤：「${name}」的 verificationStatus「${entry.verificationStatus}」不是合法值`);
      }
    });
  }
  validateTraitTagData();

  function deepFreeze(obj) {
    Object.values(obj).forEach(v => {
      if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
    });
    return Object.freeze(obj);
  }
  deepFreeze(TAG_VOCABULARY);
  deepFreeze(CRYSTAL_TRAIT_TAGS);
  Object.freeze(VERIFICATION_STATUS_VALUES);

  function getCrystalTraitTags(name) {
    assertIsString(name, 'name');
    const entry = CRYSTAL_TRAIT_TAGS[name];
    if (!entry) return undefined;
    /* 回傳複本，避免呼叫端不小心污染模組內部的原始資料（沿用 zodiac-crystals.js 的慣例）。 */
    return {
      ...entry,
      coreTags: entry.coreTags.slice(),
      supportTags: entry.supportTags.slice(),
      availableVariants: entry.availableVariants ? entry.availableVariants.slice() : undefined
    };
  }

  function isMatchEligible(name) {
    assertIsString(name, 'name');
    const entry = CRYSTAL_TRAIT_TAGS[name];
    if (!entry) return false;
    return entry.matchEligibility !== false;
  }

  const CrystalTraitTags = {
    TAG_SCHEMA_VERSION,
    TAG_VOCABULARY,
    CRYSTAL_TRAIT_TAGS,
    VERIFICATION_STATUS_VALUES,
    getCrystalTraitTags,
    isMatchEligible
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CrystalTraitTags;
  } else {
    root.CrystalTraitTags = CrystalTraitTags;
  }
})(typeof window !== 'undefined' ? window : globalThis);
