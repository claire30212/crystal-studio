/* 月亮星座計算共用模組（純邏輯，無 DOM／Astronomy 相依）。
   同時被瀏覽器頁面（moon-sign-calculator.html）與 Node 單元測試（test/moon-sign-unit-tests.js）載入，
   確保線上實際使用的星座判斷邏輯，跟被測試驗證過的邏輯是同一份程式碼，不是各自維護一份容易失去同步。 */
(function (root) {
  'use strict';

  const SIGNS = [
    { name:'牡羊座', symbol:'♈︎' }, { name:'金牛座', symbol:'♉︎' }, { name:'雙子座', symbol:'♊︎' },
    { name:'巨蟹座', symbol:'♋︎' }, { name:'獅子座', symbol:'♌︎' }, { name:'處女座', symbol:'♍︎' },
    { name:'天秤座', symbol:'♎︎' }, { name:'天蠍座', symbol:'♏︎' }, { name:'射手座', symbol:'♐︎' },
    { name:'摩羯座', symbol:'♑︎' }, { name:'水瓶座', symbol:'♒︎' }, { name:'雙魚座', symbol:'♓︎' }
  ];

  /* 固定以台灣時間（UTC+8）換算，不採用歷史時區規則。
     1946-1961 年間部分期間、以及 1974、1975、1979 年，台灣曾實施日光節約時間，
     這幾個特定年份的出生時間換算可能受約一小時的歷史時差影響。 */
  function isDstCaveatYear(year) {
    return (year >= 1946 && year <= 1961) || year === 1974 || year === 1975 || year === 1979;
  }

  function taiwanLocalToUTC(year, month, day, hour, minute) {
    return new Date(Date.UTC(year, month - 1, day, hour - 8, minute));
  }

  /* 黃經轉星座：先正規化到 [0, 360) 區間再除以 30 取整數，
     避免 360° 沒有繞回 0°、負數輸入、或浮點數誤差造成的陣列索引偏移。 */
  function signIndexFromLongitude(longitude) {
    const normalized = ((longitude % 360) + 360) % 360;
    return Math.floor(normalized / 30);
  }

  const MoonSignCalc = { SIGNS, isDstCaveatYear, taiwanLocalToUTC, signIndexFromLongitude };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MoonSignCalc;
  } else {
    root.MoonSignCalc = MoonSignCalc;
  }
})(typeof window !== 'undefined' ? window : globalThis);
