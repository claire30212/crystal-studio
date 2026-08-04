/* 星體解析區塊的通用渲染模組（純邏輯，只回傳 HTML 字串，無 DOM 相依）。
   太陽／月亮共用同一個 renderSection(config)，未來加上升星座時只需要多組一份 config 餵進來，
   不需要另外寫 renderSun()/renderMoon()/renderAscendant() 各自獨立的函式——
   這是「太陽/月亮水晶分開顯示」與「上升星座之後才擴充」兩項規則能同時成立的關鍵：
   區塊的顯示邏輯只認 config 描述的狀態，不認「這是太陽還是月亮」。

   config 型別（見 test/section-renderer-unit-tests.js 的邊界測試）：
   {
     icon: string,           例如 '☀' 或 '🌙' 或 '⬆'
     title: string,          例如 '太陽星座' 或 '月亮星座' 或 '上升星座'
     state: 'complete' | 'ambiguous' | 'unavailable' | 'error',
     statusLabel: string,    狀態標籤文字，例如「已完成」「等待補時間」「需要更多資料」「發生錯誤」
     reading: {              state === 'complete' 時必填
       sign: string, symbol: string,
       // 兩種寫法都支援，reading.blocks 優先：
       blocks: [{ label: string, paragraphs: string[] }, ...],   // 通用寫法：任意標籤／任意小節數，上升星座（第一印象/外在風格/處世模式）用這個
       personality: string[], emotional: string[], advice: string[]  // 舊寫法：沒有 blocks 時，自動組成「個性/情感/建議」三段固定標籤（太陽/月亮既有資料維持這個寫法，不用搬家）
       // crystals 欄位如果存在，這一版刻意不渲染（水晶區塊留給下一階段），
       // 避免「資料裡有水晶」跟「畫面上該不該顯示水晶」被誤會成同一件事。
     },
     ambiguous: {            state === 'ambiguous' 時必填
       candidates: [{sign, symbol}, {sign, symbol}],
       hint: string,
       actionLabel: string,     補充按鈕文字，例如「補上出生時間」
       actionOnClick: string    inline onclick 要呼叫的函式名稱，例如 'focusTimeField()'
     },
     unavailable: {          state === 'unavailable' 時必填。用在「目前缺資料，還沒辦法算」的情境（例如上升星座沒有出生時間/地點），
                            跟 ambiguous 不同的地方：ambiguous 是「已經有一組候選答案，只是有兩個」，unavailable 是「完全沒辦法開始算」
       message: string,
       actionLabel: string,    選填，補充按鈕文字
       actionOnClick: string   選填，inline onclick 要呼叫的函式名稱
     },
     error: {                state === 'error' 時必填。用在計算過程本身出錯（不是資料不足，是算的時候出問題）
       message: string
     },
     note: string,     選填，計算方式的補充說明（例如「這天全天月亮都在同一個星座」），
                       太陽／月亮都可能用到，不是月亮專屬欄位，所以不需要另外寫函式判斷型別
     caveat: string,   選填，需要提醒使用者注意、程度較強的警示文字，橘色警示樣式（目前沒有欄位在用，保留給真的需要警示的情境）
     info: string      選填，中性的資訊說明（例如「已套用歷史時區計算」），跟 caveat 的差別是語氣程度——
                       info 是「讓你知道」，caveat 是「提醒你注意」，樣式不同（藍灰 vs 橘），跟 state 無關，兩種狀態都可能出現
   }
*/
(function (root) {
  'use strict';

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderParagraphs(paragraphs) {
    return (paragraphs || []).map(p => `<p>${escapeHtml(p)}</p>`).join('');
  }

  /* reading.blocks 優先；沒有的話從舊的 personality/emotional/advice 組出固定三段標籤，
     確保太陽/月亮既有資料跟既有測試的輸出結果完全不變。 */
  function normalizeBlocks(reading) {
    if (reading.blocks) return reading.blocks;
    return [
      { label: '個性', paragraphs: reading.personality },
      { label: '情感', paragraphs: reading.emotional },
      { label: '建議', paragraphs: reading.advice }
    ];
  }

  function renderCompleteBody(reading) {
    const blocks = normalizeBlocks(reading);
    return `
      <div class="section-sign">${escapeHtml(reading.symbol)} ${escapeHtml(reading.sign)}</div>
      ${blocks.map(b => `
      <div class="section-block">
        <div class="section-block-label">${escapeHtml(b.label)}</div>
        ${renderParagraphs(b.paragraphs)}
      </div>`).join('')}
    `;
  }

  function renderAmbiguousBody(ambiguous) {
    const [c1, c2] = ambiguous.candidates;
    const action = ambiguous.actionLabel
      ? `<button class="btn-secondary" onclick="${escapeHtml(ambiguous.actionOnClick || '')}">${escapeHtml(ambiguous.actionLabel)}</button>`
      : '';
    return `
      <div class="ambiguous-row">
        <div class="ambiguous-sign">${escapeHtml(c1.symbol)} ${escapeHtml(c1.sign)}</div>
        <div class="ambiguous-sep">／</div>
        <div class="ambiguous-sign">${escapeHtml(c2.symbol)} ${escapeHtml(c2.sign)}</div>
      </div>
      <div class="hint-box">${escapeHtml(ambiguous.hint)}</div>
      ${action}
    `;
  }

  function renderUnavailableBody(unavailable) {
    const action = unavailable.actionLabel
      ? `<button class="btn-secondary" onclick="${escapeHtml(unavailable.actionOnClick || '')}">${escapeHtml(unavailable.actionLabel)}</button>`
      : '';
    return `
      <div class="hint-box">${escapeHtml(unavailable.message)}</div>
      ${action}
    `;
  }

  function renderErrorBody(error) {
    return `<div class="error-box">${escapeHtml(error.message)}</div>`;
  }

  function renderSection(config) {
    if (!config || !config.state) throw new Error('renderSection: config.state 為必填');

    let body;
    if (config.state === 'complete') {
      if (!config.reading) throw new Error('renderSection: state=complete 時 config.reading 為必填');
      body = renderCompleteBody(config.reading);
    } else if (config.state === 'ambiguous') {
      if (!config.ambiguous || !config.ambiguous.candidates || config.ambiguous.candidates.length !== 2) {
        throw new Error('renderSection: state=ambiguous 時 config.ambiguous.candidates 必須恰好是 2 個候選');
      }
      body = renderAmbiguousBody(config.ambiguous);
    } else if (config.state === 'unavailable') {
      if (!config.unavailable || !config.unavailable.message) {
        throw new Error('renderSection: state=unavailable 時 config.unavailable.message 為必填');
      }
      body = renderUnavailableBody(config.unavailable);
    } else if (config.state === 'error') {
      if (!config.error || !config.error.message) {
        throw new Error('renderSection: state=error 時 config.error.message 為必填');
      }
      body = renderErrorBody(config.error);
    } else {
      throw new Error(`renderSection: 不支援的 state「${config.state}」`);
    }

    const note = config.note ? `<div class="section-note">${escapeHtml(config.note)}</div>` : '';
    const caveat = config.caveat ? `<div class="caveat-box">⚠️ ${escapeHtml(config.caveat)}</div>` : '';
    const info = config.info ? `<div class="info-box">${escapeHtml(config.info)}</div>` : '';

    return `
      <div class="reading-section reading-section--${escapeHtml(config.state)}">
        <div class="section-header">
          <span class="section-icon">${escapeHtml(config.icon)}</span>
          <span class="section-title">${escapeHtml(config.title)}</span>
          <span class="section-status section-status--${escapeHtml(config.state)}">${escapeHtml(config.statusLabel)}</span>
        </div>
        ${note}
        <div class="section-body">${body}</div>
        ${caveat}
        ${info}
      </div>
    `;
  }

  const SectionRenderer = { renderSection };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SectionRenderer;
  } else {
    root.SectionRenderer = SectionRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
