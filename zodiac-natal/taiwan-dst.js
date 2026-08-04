/* 台灣歷史日光節約時間（夏令時間）日期區間表（純邏輯，無 DOM 相依）。M4-A 產出。
   給上升星座計算用：上升星座對時間極度敏感（每小時移動約13-15°），
   月亮星座用的「固定UTC+8＋溫和警示」做法對上升星座不夠precise——
   同一組年份的誤判機率高達67%（見 zodiac-natal/ascendant-spike-report.md），
   所以這裡改成正式查表，日光節約期間回傳 UTC+9，一般日期回傳 UTC+8。

   資料來源：台北市政府公告「我國實施夏令時間（日光節約時間）一覽表」，
   跟 humandesign.report 的獨立年表交叉核對，兩份來源逐年一致。

   已知跟現有月亮星座警示邏輯（moon-sign-calc.js 的 isDstCaveatYear，年份範圍 1946-1961/1974/1975/1979）
   不一致的地方：這份查證顯示台灣日光節約時間其實從 1945 年就開始（1945/5/1-9/30），
   不是從 1946 年開始。這裡刻意保留這個差異、不去動 moon-sign-calc.js，
   因為那是另一個已經定案的功能，要不要回頭修正是產品決策，不是這個模組該自作主張的事。 */
(function (root) {
  'use strict';

  const DST_PERIODS = [
    { year: 1945, start: [5, 1], end: [9, 30] },
    { year: 1946, start: [5, 1], end: [9, 30] },
    { year: 1947, start: [5, 1], end: [9, 30] },
    { year: 1948, start: [5, 1], end: [9, 30] },
    { year: 1949, start: [5, 1], end: [9, 30] },
    { year: 1950, start: [5, 1], end: [9, 30] },
    { year: 1951, start: [5, 1], end: [9, 30] },
    { year: 1952, start: [3, 1], end: [10, 31] },
    { year: 1953, start: [4, 1], end: [10, 31] },
    { year: 1954, start: [4, 1], end: [10, 31] },
    { year: 1955, start: [4, 1], end: [9, 30] },
    { year: 1956, start: [4, 1], end: [9, 30] },
    { year: 1957, start: [4, 1], end: [9, 30] },
    { year: 1958, start: [4, 1], end: [9, 30] },
    { year: 1959, start: [4, 1], end: [9, 30] },
    { year: 1960, start: [6, 1], end: [9, 30] },
    { year: 1961, start: [6, 1], end: [9, 30] },
    // 1962-1973：確認停止實施
    { year: 1974, start: [4, 1], end: [9, 30] },
    { year: 1975, start: [4, 1], end: [9, 30] },
    // 1976-1978：確認停止實施
    { year: 1979, start: [7, 1], end: [9, 30] }
    // 1980 之後：確認未再實施
  ];

  function monthDayCode(month, day) { return month * 100 + day; }

  /* 每一筆資料的 start/end 都在同一年內（沒有跨年的日光節約期間），
     用 month*100+day 編碼成單一數字比較即可，不需要處理跨年判斷。 */
  function isDstPeriod(year, month, day) {
    const period = DST_PERIODS.find(p => p.year === year);
    if (!period) return false;
    const code = monthDayCode(month, day);
    const startCode = monthDayCode(period.start[0], period.start[1]);
    const endCode = monthDayCode(period.end[0], period.end[1]);
    return code >= startCode && code <= endCode;
  }

  /* 介面預留 hour/minute 參數：目前資料表只做「日期級」判斷（一整天要嘛在DST期間、要嘛不在），
     還沒有實際切換時刻的資料（例如某一天實際是幾點幾分切換），
     所以 hour/minute 目前不影響回傳值，但先讓呼叫端可以傳完整時間進來，
     未來查到切換時刻的資料時，只需要改這個函式內部邏輯，不需要動任何呼叫端的介面。 */
  function getTaiwanUtcOffset(year, month, day, hour, minute) {
    return isDstPeriod(year, month, day) ? 9 : 8;
  }

  /* 用查表得到的實際 UTC 偏移量換算，取代月亮功能先前沿用的固定 UTC+8。 */
  function taiwanLocalToUTC(year, month, day, hour, minute) {
    const offset = getTaiwanUtcOffset(year, month, day, hour, minute);
    return new Date(Date.UTC(year, month - 1, day, hour - offset, minute));
  }

  const TaiwanDst = { DST_PERIODS, isDstPeriod, getTaiwanUtcOffset, taiwanLocalToUTC };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaiwanDst;
  } else {
    root.TaiwanDst = TaiwanDst;
  }
})(typeof window !== 'undefined' ? window : globalThis);
