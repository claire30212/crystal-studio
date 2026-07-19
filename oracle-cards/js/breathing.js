// 呼吸凝視畫面 — 4秒吸氣/4秒吐氣節奏由 CSS animation 驅動
// 這裡只負責：跳過按鈕、自動進行到下一步（約兩個完整呼吸週期後）

const AUTO_ADVANCE_MS = 16000; // 約兩個呼吸週期（8s * 2）
const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * @param {() => void} onDone 呼吸畫面結束、進入下一步時呼叫
 * @returns {() => void} cleanup 函式
 */
export function runBreathing(onDone) {
  const skipBtn = document.getElementById("breathing-skip");
  let done = false;

  const advance = () => {
    if (done) return;
    done = true;
    cleanup();
    onDone();
  };

  skipBtn.addEventListener("click", advance);

  const timer = setTimeout(advance, prefersReducedMotion() ? 800 : AUTO_ADVANCE_MS);

  function cleanup() {
    clearTimeout(timer);
    skipBtn.removeEventListener("click", advance);
  }

  return cleanup;
}
