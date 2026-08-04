/* 十二星座主要水晶清單（純資料，無 DOM 相依）。M2-Content 審核結果：
   全部維持 crystal-lookup.html 既有的12星座水晶配對，這一輪沒有替換任何一顆水晶。

   決策脈絡（完整查證過程存檔備查，不是這次的修改依據）：
   - zodiac-crystal-review-draft.md：初版落差審核
   - zodiac-crystal-synonym-table.md：中英文水晶名稱同義詞查核
   - zodiac-crystal-source-matrix.md：誕生石傳統 vs 星座水晶傳統來源分類
   查證過程中發現部分配對可能源自「月份誕生石剛好跟星座日期重疊」而非獨立的星座水晶傳統
  （例如橄欖石同時落在獅子座跟處女座，很可能是同一個「8月」根源），
   但持續往上追溯每顆水晶的來源性質，工程量已經接近學術溯源研究，跟「審核既有配對」
   這件事本身的規模不成比例——十二星座水晶配對本來就沒有唯一標準答案，
   這裡要的是「沒有明顯錯誤或誤導」，不是可通過學術審查的溯源論文，因此決定維持現狀。

   本檔只保留「水晶名稱清單」，不重複 readings-data.js 已經寫好的使用情境句——
   那些句子才是實際顯示給使用者看的文字，這裡的清單只是給 pickMatchingCrystals()
   之類的匹配邏輯用的「合法水晶名單」（往後的月亮/上升水晶微調只能從這份名單裡挑，
   不會憑空配出清單外的水晶）。

   ========== API 規格（所有查詢函式統一遵守，不要讓呼叫端自己猜）==========

   輸入型別錯誤 vs 查無資料，是兩種不同的情況，處理方式不同：
   - 輸入型別本身就不對（不是字串／不是整數／null／undefined）→ 拋出 TypeError。
     這是呼叫端的程式錯誤（例如忘記從表單拿值），要讓它盡快爆出來，不要吞掉。
   - 輸入型別是對的，但內容查無資料（例如合法的字串，但不是任何一個正式星座/水晶名稱；
     合法的整數，但超出 0-11 範圍）→ 回傳 undefined，不拋錯。
     這是正常會發生的情況（呼叫端本來就可能拿不確定的資料來查），用 undefined 讓呼叫端自己判斷要不要處理。

   星座名稱正規化規則：**完全不做任何正規化**。只接受跟 SIGN_ORDER 裡完全一致的正式繁體中文星座名稱字串
  （例如 '牡羊座'）。不接受簡體、英文、省略「座」字的簡稱、前後有空白的版本——這些一律視為「查無資料」，
   回傳 undefined，不會拋錯（因為型別仍然是字串，只是內容剛好對不上），也不會自動幫你 trim 或轉換。
   呼叫端如果需要處理使用者輸入的各種寫法，正規化是呼叫端自己的責任，這個模組不做隱藏的魔法轉換。

   資料不可變：所有匯出的資料結構（ZODIAC_MAIN_CRYSTALS 極其內部物件、CRYSTAL_SYNONYM_INFO、
   CRYSTAL_VERIFICATION_STATUS）都用 Object.freeze 做淺層+一層巢狀凍結，直接修改會在嚴格模式下拋錯、
   非嚴格模式下靜默失敗；另外查詢函式回傳的陣列一律回傳複本（.slice()），雙重保險避免呼叫端不小心
   污染到模組內部的原始資料。 */
(function (root) {
  'use strict';

  const SIGN_ORDER = ['牡羊座','金牛座','雙子座','巨蟹座','獅子座','處女座','天秤座','天蠍座','射手座','摩羯座','水瓶座','雙魚座'];

  /* crystalNames 逐字沿用 crystal-lookup.html 的 ZODIAC_SIGNS[].crystals（已用腳本逐筆比對確認一致），
     順序不影響邏輯，但維持跟原始資料庫一致，方便追溯。 */
  const ZODIAC_MAIN_CRYSTALS = [
    { sign: '牡羊座', crystalNames: ['石榴石', '紅瑪瑙', '太陽石', '黃水晶'] },
    { sign: '金牛座', crystalNames: ['綠東陵石', '粉水晶', '托帕石', '白水晶'] },
    { sign: '雙子座', crystalNames: ['藍晶石', '瑪瑙', '白水晶', '海藍寶', '黃水晶'] },
    { sign: '巨蟹座', crystalNames: ['月光石', '粉水晶', '瑪瑙', '珍珠'] },
    { sign: '獅子座', crystalNames: ['黃水晶', '太陽石', '石榴石', '橄欖石'] },
    { sign: '處女座', crystalNames: ['黃水晶', '黑曜石', '紫水晶', '虎眼石'] },
    { sign: '天秤座', crystalNames: ['粉水晶', '綠東陵石', '海藍寶', '黑曜石'] },
    { sign: '天蠍座', crystalNames: ['黑曜石', '石榴石', '海藍寶', '鈦晶'] },
    { sign: '射手座', crystalNames: ['紫水晶', '海藍寶', '白水晶', '太陽石'] },
    /* 摩羯座確認為黑曜石（Obsidian，火山玻璃），不是黑瑪瑙（Onyx，玉髓家族礦物）——
       這兩者外觀類似但材質不同，查證後以黑曜石為準。 */
    { sign: '摩羯座', crystalNames: ['石榴石', '黑曜石', '煙晶', '白水晶'] },
    { sign: '水瓶座', crystalNames: ['紫水晶', '海藍寶', '白水晶', '黑曜石'] },
    { sign: '雙魚座', crystalNames: ['海藍寶', '粉水晶', '月光石'] }
  ];

  /* 雙層同義詞結構：紅瑪瑙／紅玉髓不是同一種水晶（分別是瑪瑙／玉髓家族的不同亞種：
     紅瑪瑙帶紋路、紅玉髓質地均勻無紋路），但市場上容易被混用。
     strictlyEquivalent:false 明確標示「不是同一顆」，commerciallyOverlapping:true 標示
     「市場慣用語有重疊」，避免未來有人看到兩個名稱相似就誤判成同義詞直接合併。
     這個結構本身是這輪查證的產出，即使這次沒有改動任何水晶配對，也值得保留在資料庫裡。 */
  const CRYSTAL_SYNONYM_INFO = {
    '紅瑪瑙': {
      displayName: '紅瑪瑙',
      canonicalMineral: 'Red Agate（玉髓家族，帶紋路瑪瑙品種）',
      marketAliases: [],
      relatedTo: '紅玉髓',
      strictlyEquivalent: false,
      commerciallyOverlapping: true
    },
    '紅玉髓': {
      displayName: '紅玉髓',
      canonicalMineral: 'Carnelian（玉髓家族，質地均勻無紋路品種）',
      marketAliases: ['光玉髓', '肉紅玉髓'],
      relatedTo: '紅瑪瑙',
      strictlyEquivalent: false,
      commerciallyOverlapping: true
    }
  };

  /* verificationStatus 只能是這四個值之一，不接受隨意字串——
     verified：已多方查證確認；partially_verified：部分查證（例如查到中文對應但英文原詞未定案）；
     unverified：尚未查證；deprecated：曾經用過，現已不建議採用但保留紀錄。 */
  const VERIFICATION_STATUS_VALUES = ['verified', 'partially_verified', 'unverified', 'deprecated'];

  /* 鈦晶對應的英文原詞尚未確認一致（可能是 Rutilated Quartz 或鍍鈦處理石英），
     這不是資料錯誤，是誠實標記「這一項還沒查證確定」，等有需要時再回頭查證。 */
  const CRYSTAL_VERIFICATION_STATUS = {
    '鈦晶': {
      verificationStatus: 'unverified',
      note: '市場商業名稱，非正式礦物學名稱，對應的英文原詞尚待確認一致'
    }
  };

  function deepFreeze(obj) {
    Object.values(obj).forEach(v => {
      if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
    });
    return Object.freeze(obj);
  }
  deepFreeze(ZODIAC_MAIN_CRYSTALS);
  deepFreeze(CRYSTAL_SYNONYM_INFO);
  deepFreeze(CRYSTAL_VERIFICATION_STATUS);
  Object.freeze(SIGN_ORDER);
  Object.freeze(VERIFICATION_STATUS_VALUES);

  function assertIsInteger(value, paramName) {
    if (!Number.isInteger(value)) {
      throw new TypeError(`${paramName} 必須是整數，實際收到：${typeof value === 'number' ? value : typeof value}`);
    }
  }
  function assertIsString(value, paramName) {
    if (typeof value !== 'string') {
      throw new TypeError(`${paramName} 必須是字串，實際收到：${value === null ? 'null' : typeof value}`);
    }
  }

  function getMainCrystals(signIndex) {
    assertIsInteger(signIndex, 'signIndex');
    const entry = ZODIAC_MAIN_CRYSTALS[signIndex];
    return entry ? entry.crystalNames.slice() : undefined;
  }
  function getMainCrystalsByName(signName) {
    assertIsString(signName, 'signName');
    const entry = ZODIAC_MAIN_CRYSTALS.find(z => z.sign === signName);
    return entry ? entry.crystalNames.slice() : undefined;
  }
  function getSynonymInfo(name) {
    assertIsString(name, 'name');
    return CRYSTAL_SYNONYM_INFO[name];
  }
  function getVerificationStatus(name) {
    assertIsString(name, 'name');
    return CRYSTAL_VERIFICATION_STATUS[name];
  }

  const ZodiacCrystals = {
    SIGN_ORDER,
    ZODIAC_MAIN_CRYSTALS,
    CRYSTAL_SYNONYM_INFO,
    CRYSTAL_VERIFICATION_STATUS,
    VERIFICATION_STATUS_VALUES,
    getMainCrystals,
    getMainCrystalsByName,
    getSynonymInfo,
    getVerificationStatus
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ZodiacCrystals;
  } else {
    root.ZodiacCrystals = ZodiacCrystals;
  }
})(typeof window !== 'undefined' ? window : globalThis);
