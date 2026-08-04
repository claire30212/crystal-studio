/* 太陽星座計算共用模組（純邏輯，無 DOM 相依）。
   日期區間跟 crystal-lookup.html 的 ZODIAC_SIGNS 保持一致，避免同一個網站對同一個人算出兩個不同的太陽星座。
   同時被瀏覽器頁面與 Node 單元測試（test/sun-sign-unit-tests.js）載入。 */
(function (root) {
  'use strict';

  const SIGNS = [
    { name:'牡羊座', symbol:'♈︎', from:[3,21], to:[4,19] },
    { name:'金牛座', symbol:'♉︎', from:[4,20], to:[5,20] },
    { name:'雙子座', symbol:'♊︎', from:[5,21], to:[6,20] },
    { name:'巨蟹座', symbol:'♋︎', from:[6,21], to:[7,22] },
    { name:'獅子座', symbol:'♌︎', from:[7,23], to:[8,22] },
    { name:'處女座', symbol:'♍︎', from:[8,23], to:[9,22] },
    { name:'天秤座', symbol:'♎︎', from:[9,23], to:[10,22] },
    { name:'天蠍座', symbol:'♏︎', from:[10,23], to:[11,21] },
    { name:'射手座', symbol:'♐︎', from:[11,22], to:[12,21] },
    { name:'摩羯座', symbol:'♑︎', from:[12,22], to:[1,19] },
    { name:'水瓶座', symbol:'♒︎', from:[1,20], to:[2,18] },
    { name:'雙魚座', symbol:'♓︎', from:[2,19], to:[3,20] }
  ];

  /* 每個星座的 from/to 月份不同即代表跨年（摩羯座 12/22–1/19），
     用「月份等於 from 月且日期 >= from 日」或「月份等於 to 月且日期 <= to 日」兩段各自比對，
     不用單一數值區間比較，避免跨年或跨月的邊界判斷出錯。 */
  function getSunSignIndex(month, day) {
    const idx = SIGNS.findIndex(s => (month === s.from[0] && day >= s.from[1]) || (month === s.to[0] && day <= s.to[1]));
    return idx; // 理論上必為 0-11，找不到代表輸入的月/日不合法
  }

  const SunSignCalc = { SIGNS, getSunSignIndex };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SunSignCalc;
  } else {
    root.SunSignCalc = SunSignCalc;
  }
})(typeof window !== 'undefined' ? window : globalThis);
