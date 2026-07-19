// 默念畫面 — 沿用呼吸畫面的互動模式：文字淡入後可跳過，或等待自動前進

const AUTO_ADVANCE_MS = 7000; // 默念文字較短，不需要像呼吸畫面等那麼久
const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * @param {() => void} onDone 默念畫面結束、進入下一步時呼叫
 * @returns {() => void} cleanup 函式
 */
export function runSilent(onDone) {
  const skipBtn = document.getElementById("silent-skip");
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
