// 翻牌動畫 — 3D Y軸翻轉 850ms，搭配光暈擴散與合成音效
import { playBell, playChime } from "./audio.js";

const FLIP_DURATION_MS = 850;
const BELL_LEAD_MS = 100; // 鐘聲在翻正完成前一點點響起，聽起來像「接近850ms處」
const GLOW_HOLD_MS = 1800; // 翻牌完成後只顯示卡牌本身，停留1.8秒（UI優化補充規格：加強儀式感）後才淡入過渡文字

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * @param {object} card 卡牌資料
 * @param {() => void} onDone 整段翻牌流程（含過渡文字）結束後呼叫
 */
export function runFlip(card, onDone) {
  const flipEl = document.getElementById("card-flip");
  const glowEl = document.getElementById("flip-glow");
  const sparkleEl = document.getElementById("card-sparkle");
  const transitionTextEl = document.getElementById("flip-transition-text");
  const imageEl = document.getElementById("flip-card-image");

  // 重置狀態
  flipEl.classList.remove("is-flipped");
  glowEl.classList.remove("is-glowing", "is-settled");
  sparkleEl.classList.remove("is-sparkling");
  transitionTextEl.classList.remove("is-visible");
  imageEl.src = card.imagePath;
  imageEl.alt = card.name;

  const duration = prefersReducedMotion() ? 1 : FLIP_DURATION_MS;

  // 下一影格開始翻轉，光暈同步浮現
  // 這裡呼叫 runFlip 之前，main.js 才剛把 #screen-flip 從 display:none 切成可見——
  // 祖先元素「剛變可見」跟卡牌本身「加上 is-flipped 觸發 transition」如果落在同一個
  // 繪製影格，瀏覽器有時候來不及先畫出翻轉前的樣子，會直接跳到翻轉後的結果、
  // 完全沒有轉動的視覺過程（時好時壞的 race condition，不是每次都會發生）。
  // 用雙層 requestAnimationFrame：第一層等到「畫面已經以未翻轉狀態繪製過一次」，
  // 第二層才真的加上 is-flipped，確保 transition 一定有「起點」可以過渡。
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      flipEl.classList.add("is-flipped");
      glowEl.classList.add("is-glowing");
    });
  });

  setTimeout(() => {
    playBell();
  }, Math.max(0, duration - BELL_LEAD_MS));

  const onFlipEnd = () => {
    sparkleEl.classList.add("is-sparkling");
    playChime();
    glowEl.classList.add("is-settled");

    setTimeout(() => {
      transitionTextEl.classList.add("is-visible");
      setTimeout(onDone, 1300);
    }, GLOW_HOLD_MS);
  };

  // 不依賴 transitionend（3D transform 翻轉在部分瀏覽器/情境下不可靠觸發），
  // 改用與 CSS transition-duration 對齊的計時器，確保流程一定會往下走
  setTimeout(onFlipEnd, duration);
}
