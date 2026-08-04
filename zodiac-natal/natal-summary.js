/* 太陽+月亮+上升整體特質摘要（純邏輯，無 DOM 相依）。M4-C1 產出。

   設計原則（對應這次的規劃）：
   - 職責只到「產出結構化摘要資料」為止：{ mode, headline, sections:[{title, body}] }。
     頁面只負責把這個結構渲染成畫面，不應該在頁面層再做任何文案判斷。
   - 不是人工窮舉 12×12×12 種組合，也不是丟給生成式模型自由發揮：
     用「星座特質標籤（SIGN_TAGS）＋關係判斷（computeRelations）＋固定句型模板」三層組成，
     句型模板只有十幾種分支，實際輸出的變化來自於把不同星座的標籤字串代入模板。
   - mode 只在每個 buildXxxSection 函式內部判斷一次（sun_moon_rising / sun_moon），
     不會在文案組合邏輯裡到處寫「if (ascendant) ...」。

   六類規則涵蓋位置：
   - 太陽月亮相同 → relations.sunMoonSame，headline／核心與內在段落
   - 太陽上升相同 → relations.sunAscSame，headline／別人看到的你段落
   - 月亮上升相同 → relations.moonAscSame，headline／別人看到的你段落
   - 三者同元素 → relations.allSameElement，headline
   - 內外元素反差 → relations.innerOuterElementContrast，headline／別人看到的你段落
   - 三種模式組合（開創/穩定/彈性，用生活語言表達，不出現「基本宮/固定宮/變動宮」這類術語）→ relations.modalityPattern，這組星座給你的提醒段落
*/
(function (root) {
  'use strict';

  /* modality 只是內部分類鍵，畫面跟句子模板一律用 MODALITY_PHRASE 的生活化說法，不會出現這個字本身。 */
  const SIGN_TAGS = [
    { name: '牡羊座', symbol: '♈︎', element: '火', modality: 'cardinal',
      coreTrait: '行動力強、想到就去做', emotionalNeed: '情緒需要當下被允許表達，不喜歡被要求隱忍',
      outerStyle: '俐落直接、有衝勁' },
    { name: '金牛座', symbol: '♉︎', element: '土', modality: 'fixed',
      coreTrait: '穩紮穩打、重視實際成果', emotionalNeed: '需要穩定和看得到的付出才有安全感',
      outerStyle: '沉穩可靠、不慌不忙' },
    { name: '雙子座', symbol: '♊︎', element: '風', modality: 'mutable',
      coreTrait: '思路靈活、興趣廣泛', emotionalNeed: '需要能自由表達、被認真傾聽',
      outerStyle: '反應快、話題多' },
    { name: '巨蟹座', symbol: '♋︎', element: '水', modality: 'cardinal',
      coreTrait: '重視情感連結、樂於照顧身邊的人', emotionalNeed: '需要感覺被放在心上、被記得',
      outerStyle: '帶點觀察距離、熟悉了才放鬆' },
    { name: '獅子座', symbol: '♌︎', element: '火', modality: 'fixed',
      coreTrait: '自信大方、樂於展現自己', emotionalNeed: '需要被欣賞、被看見付出',
      outerStyle: '自信、有存在感' },
    { name: '處女座', symbol: '♍︎', element: '土', modality: 'mutable',
      coreTrait: '細心謹慎、講求條理', emotionalNeed: '需要事情在掌控之中才安心',
      outerStyle: '細心謹慎、做事可靠' },
    { name: '天秤座', symbol: '♎︎', element: '風', modality: 'cardinal',
      coreTrait: '重視公平與和諧、擅長協調', emotionalNeed: '需要關係裡的和諧感才安心',
      outerStyle: '好相處、有禮貌' },
    { name: '天蠍座', symbol: '♏︎', element: '水', modality: 'fixed',
      coreTrait: '觀察深入、投入程度高', emotionalNeed: '需要確認對方經得起考驗才願意交心',
      outerStyle: '深沉、不容易一眼看穿' },
    { name: '射手座', symbol: '♐︎', element: '火', modality: 'mutable',
      coreTrait: '樂觀直率、喜歡探索與自由', emotionalNeed: '需要有喘息空間，不喜歡被追問情緒',
      outerStyle: '開朗隨性、好聊' },
    { name: '摩羯座', symbol: '♑︎', element: '土', modality: 'cardinal',
      coreTrait: '務實堅韌、對目標有耐心', emotionalNeed: '需要感覺事情在自己掌控之中才安心',
      outerStyle: '成熟穩重、值得信賴' },
    { name: '水瓶座', symbol: '♒︎', element: '風', modality: 'fixed',
      coreTrait: '獨立不落俗套、想法多元', emotionalNeed: '需要保有個人空間，不喜歡隨時交代感受',
      outerStyle: '獨特、友善卻帶點距離感' },
    { name: '雙魚座', symbol: '♓︎', element: '水', modality: 'mutable',
      coreTrait: '直覺敏銳、富有同理心', emotionalNeed: '需要有能安心卸下防備的空間',
      outerStyle: '柔軟、容易親近' }
  ];

  const MODALITY_PHRASE = {
    cardinal: '習慣主動開啟新局面、不喜歡拖著等',
    fixed: '一旦決定了就會穩定地走下去、不輕易半途而廢',
    mutable: '擅長依情況調整步調、保持彈性'
  };
  const MODALITY_CAUTION = {
    cardinal: '可能比較不容易把一件事穩穩地走到底',
    fixed: '可能比較不容易在情況變化時及時調整',
    mutable: '可能比較不容易維持長時間一致的節奏'
  };

  function computeRelations(sun, moon, asc) {
    const hasAsc = !!asc;
    const sunMoonSame = sun.name === moon.name;
    const sunAscSame = hasAsc && sun.name === asc.name;
    const moonAscSame = hasAsc && moon.name === asc.name;
    const allSame = sunMoonSame && sunAscSame;

    const innerElements = new Set([sun.element, moon.element]);
    const allSameElement = hasAsc
      ? (sun.element === moon.element && moon.element === asc.element)
      : (sun.element === moon.element);
    const innerOuterElementContrast = hasAsc && !allSameElement && !innerElements.has(asc.element);

    const modalities = hasAsc ? [sun.modality, moon.modality, asc.modality] : [sun.modality, moon.modality];
    const uniqueModalities = Array.from(new Set(modalities));
    let modalityPattern;
    if (uniqueModalities.length === 1) modalityPattern = 'all-same';
    else if (hasAsc && uniqueModalities.length === 3) modalityPattern = 'all-different';
    else modalityPattern = 'mixed';

    return { hasAsc, sunMoonSame, sunAscSame, moonAscSame, allSame, allSameElement, innerOuterElementContrast, modalityPattern, uniqueModalities };
  }

  function buildHeadline(sun, moon, asc, rel) {
    /* 主摘要標題文字內容不變，只在語意自然的停頓點插入 \n（渲染端轉成 <br>），
       把長句拆成兩個視覺層級——第一層通常是「太陽／月亮／上升」的組合鋪陳，
       第二層收在總結句，呼應整體人格區降字級後仍要維持的可讀節奏。 */
    if (rel.allSame) {
      return `你的太陽、月亮、上升都落在${sun.symbol} ${sun.name}，\n${sun.coreTrait}這件事，從內到外幾乎是同一套邏輯在運作。`;
    }
    if (rel.sunMoonSame) {
      return `太陽和月亮都在${sun.symbol} ${sun.name}，\n讓「${sun.coreTrait}」不只是你表現出來的樣子，也是你真正在意的重點。`;
    }
    if (rel.sunAscSame) {
      return `太陽和上升都落在${sun.symbol} ${sun.name}，\n你給人的第一印象，跟你自己認同的樣子相當接近。`;
    }
    if (rel.moonAscSame) {
      return `月亮和上升都在${moon.symbol} ${moon.name}，\n你私下的情緒模式，剛好也是別人容易從你身上感覺到的部分。`;
    }
    if (rel.allSameElement) {
      return `太陽、月亮、上升都落在${sun.element}象星座，\n「${sun.element === '火' ? '主動積極' : sun.element === '土' ? '務實穩定' : sun.element === '風' ? '重視交流' : '重視感受'}」的傾向，在你身上有好幾個角度同時呼應。`;
    }
    if (rel.innerOuterElementContrast) {
      return `你給人的第一印象（${asc.outerStyle}），跟你內在真正在意的事，可能有不小的落差\n——認識你比較久的人，通常會慢慢看見這兩面。`;
    }
    if (!rel.hasAsc) {
      return `太陽讓你${sun.coreTrait}，月亮則讓你私底下${moon.emotionalNeed}，\n這組太陽月亮組合，是你目前可以先確認的兩個核心角度。`;
    }
    return `太陽讓你${sun.coreTrait}，月亮讓你私底下${moon.emotionalNeed}，\n上升則讓你給人${asc.outerStyle}的第一印象，三者合起來是你目前的樣子。`;
  }

  function buildCoreSection(sun, moon, rel) {
    const title = '你的核心與內在';
    if (rel.sunMoonSame) {
      return { title, body: `太陽和月亮都在${sun.name}：你${sun.coreTrait}，同時${moon.emotionalNeed}——這兩件事對你來說不太需要切換，你想要的和你表現出來的，通常是同一回事，不用花額外力氣去協調。` };
    }
    return { title, body: `太陽讓你${sun.coreTrait}；月亮則是另一回事——${moon.emotionalNeed}。這兩者不一定同步，你可能表現出一種樣子，心裡在意的卻是另一件事，這不是矛盾，只是核心自我跟情緒需求本來就是兩個不同的角度。` };
  }

  function buildOuterSection(sun, moon, asc, rel, mode) {
    const title = '別人看到的你';
    if (mode === 'sun_moon') {
      return { title, body: '這個版本先呈現你的太陽與月亮組合——你的核心特質，加上私底下的情緒需求。上升星座則是另一個角度：別人對你的第一印象。' };
    }
    if (rel.sunAscSame) {
      return { title, body: `上升和太陽都落在${sun.name}：別人對你的第一印象，通常跟你想讓人看到的樣子很接近，不太有落差；不過月亮代表的內在情緒需求（${moon.emotionalNeed}），還是只有比較熟的人才看得到。` };
    }
    if (rel.moonAscSame) {
      return { title, body: `上升和月亮都在${moon.name}：你私底下的情緒模式，其實也是別人在你身上容易感覺到的部分，跟你的內心不太算是分開的兩件事。` };
    }
    if (rel.innerOuterElementContrast) {
      return { title, body: `上升給人的第一印象是${asc.outerStyle}，但這跟太陽、月亮代表的內在（${sun.coreTrait}、${moon.emotionalNeed}）比起來，可能有不小的落差，剛認識你的人，通常要花一點時間才會看到你比較內在的那一面。` };
    }
    return { title, body: `上升讓你給人${asc.outerStyle}的第一印象，這跟太陽、月亮代表的內在放在一起看，比較像是你在不同情境下會切換出來的幾種樣子，不是互相衝突。` };
  }

  function modalityLabel(tags, key) {
    return tags.map(t => MODALITY_PHRASE[t[key]]).join('／');
  }

  function buildAdviceSection(sun, moon, asc, rel, mode) {
    const title = '這組星座給你的提醒';
    const bodies = mode === 'sun_moon' ? [sun, moon] : [sun, moon, asc];
    const bodyLabels = mode === 'sun_moon' ? ['太陽', '月亮'] : ['太陽', '月亮', '上升'];

    if (rel.modalityPattern === 'all-same') {
      const phrase = MODALITY_PHRASE[bodies[0].modality];
      const caution = MODALITY_CAUTION[bodies[0].modality];
      return { title, body: `${bodyLabels.join('、')}在行動節奏上傾向一致：你${phrase}，這通常是你做事讓人放心的地方；提醒自己的是，${caution}，可以練習偶爾切換一下步調，不用每件事都用同一種方式應對。` };
    }
    if (rel.modalityPattern === 'all-different') {
      return { title, body: `太陽、月亮、上升分別代表三種不同的行動節奏——有時候想主動開頭、有時候想穩定地走到底、有時候又想保持彈性，這三種傾向如果沒有覺察，可能會讓你自己都搞不清楚現在該用哪一種方式面對眼前的事，練習先辨認「這件事現在需要的是哪一種節奏」，會比逼自己選一種固定風格更有幫助。` };
    }
    // mixed：找出跟其他人不同的那一個
    const modalityCounts = {};
    bodies.forEach(b => { modalityCounts[b.modality] = (modalityCounts[b.modality] || 0) + 1; });
    const majorityModality = Object.keys(modalityCounts).find(k => modalityCounts[k] >= 2);
    const oddIndex = bodies.findIndex(b => b.modality !== majorityModality);
    const majorityLabels = bodyLabels.filter((_, i) => i !== oddIndex);
    const oddLabel = bodyLabels[oddIndex];
    return {
      title,
      body: `${majorityLabels.join('和')}${majorityLabels.length > 1 ? '都' : ''}${MODALITY_PHRASE[majorityModality]}，${oddLabel}卻${MODALITY_PHRASE[bodies[oddIndex].modality]}——這兩種節奏在你身上同時存在，通常代表你在大部分情境裡有慣用的方式，但某一個角度（${oddLabel}代表的部分）會忽然切換成另一種步調，留意這個落差，會比勉強自己維持單一風格更容易理解自己。`
    };
  }

  /* 輸入：sunIndex/moonIndex 為必填的星座索引（0-11），ascendantIndex 為選填（null/undefined 代表沒有上升資料，
     不論是因為使用者沒填出生時間/地點，還是上升計算過程本身出錯，兩種情況在這裡都一視同仁地走 sun_moon 降級版本，
     呼叫端不需要，也不應該在這裡分辨「是真的沒資料」還是「算錯了」，那是呼叫端自己記錄／回報的事）。 */
  function buildSummary({ sunIndex, moonIndex, ascendantIndex }) {
    if (sunIndex === null || sunIndex === undefined || moonIndex === null || moonIndex === undefined) {
      throw new Error('buildSummary: sunIndex 與 moonIndex 為必填');
    }
    const sun = SIGN_TAGS[sunIndex];
    const moon = SIGN_TAGS[moonIndex];
    const hasAsc = ascendantIndex !== null && ascendantIndex !== undefined;
    const asc = hasAsc ? SIGN_TAGS[ascendantIndex] : null;
    const mode = hasAsc ? 'sun_moon_rising' : 'sun_moon';

    const rel = computeRelations(sun, moon, asc);

    return {
      mode,
      headline: buildHeadline(sun, moon, asc, rel),
      sections: [
        buildCoreSection(sun, moon, rel),
        buildOuterSection(sun, moon, asc, rel, mode),
        buildAdviceSection(sun, moon, asc, rel, mode)
      ],
      // 只有降級版本才有這個欄位：獨立於三段結構之外的一行提示，頁面收到這個欄位就顯示提示＋動作按鈕，不用另外判斷 mode
      upgradeHint: mode === 'sun_moon' ? '補上出生時間與出生地，就能加入上升星座的外在風格分析。' : null
    };
  }

  const NatalSummary = { SIGN_TAGS, MODALITY_PHRASE, computeRelations, buildSummary };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = NatalSummary;
  } else {
    root.NatalSummary = NatalSummary;
  }
})(typeof window !== 'undefined' ? window : globalThis);
