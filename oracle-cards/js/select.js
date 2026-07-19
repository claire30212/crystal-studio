// 選卡畫面 — 使用者先選一張卡背，選定後才呼叫 onSelect 決定實際內容。
// 卡背排列位置跟抽到哪張卡完全無關，這裡只負責「選擇」這個動作本身的互動回饋。

import { starSpriteMarkup } from "./star-sprite.js";

const SELECT_PULSE_MS = 220;
const STAR_COUNT = 24;

/**
 * 背景星點裝飾，每次進入選卡畫面重新隨機排列一次，純 CSS 呼吸動畫，不用 rAF
 */
function renderStars() {
  const starsEl = document.getElementById("select-stars");
  if (!starsEl) return;

  const stars = Array.from({ length: STAR_COUNT }, () => {
    const sparkSize = 13 + Math.random() * 9;
    return {
      x: Math.random() * 100,
      y: Math.random() * 100,
      sparkSize,
      glowSize: sparkSize + 10 + Math.random() * 6,
      duration: 3.2 + Math.random() * 2.6,
      delay: -Math.random() * 6
    };
  });

  starsEl.innerHTML = stars
    .map(s => starSpriteMarkup({
      x: s.x,
      y: s.y,
      sparkSize: s.sparkSize,
      glowSize: s.glowSize,
      className: "select-star",
      style: ` animation-duration:${s.duration}s; animation-delay:${s.delay}s;`
    }))
    .join("");
}

/**
 * @param {() => void} onSelect 使用者選定卡背、短暫回饋播完後呼叫
 */
export function runCardSelect(onSelect) {
  renderStars();

  const cardsEl = document.getElementById("select-cards");
  const backs = Array.from(cardsEl.querySelectorAll(".select-back"));

  cardsEl.classList.remove("has-selection");
  backs.forEach(el => el.classList.remove("is-selected"));

  let chosen = false;

  backs.forEach(el => {
    el.onclick = () => {
      if (chosen) return;
      chosen = true;
      el.classList.add("is-selected");
      cardsEl.classList.add("has-selection");
      setTimeout(onSelect, SELECT_PULSE_MS);
    };
  });
}
