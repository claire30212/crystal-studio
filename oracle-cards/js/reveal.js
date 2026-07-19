// 閱讀畫面內容浮現 — 卡牌核心/金句淡入、逐段 IntersectionObserver 浮現、逐行文字動畫

import { starSpriteMarkup } from "./star-sprite.js";

const LINE_STAGGER_MS = 180;
const READING_STAR_COUNT = 6;

// 「今天，試試看」四種類型的極簡線條 icon（A行動/B感受/C書寫/D觀察），不需每張卡客製
const ACTION_ICONS = {
  A: '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>', // 行動：箭頭
  B: '<svg viewBox="0 0 24 24"><path d="M12 5a7 7 0 1 1-4.5 2"/></svg>', // 感受：留一個小缺口的圓環，避免完整新月造型太像 emoji 🌙
  C: '<svg viewBox="0 0 24 24"><path d="M12 2l3 6-3 14-3-14 3-6z"/><path d="M9.3 8h5.4"/></svg>', // 書寫：筆尖
  D: '<svg viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>' // 觀察：眼睛
};

/**
 * 卡牌圖片下方的氛圍星點，直接複用選卡畫面同一套 .star/.star--soft/.select-star
 * 元件與呼吸動畫，只是數量少很多、範圍窄很多，外層容器另外再壓一層 opacity
 */
function renderReadingCardStars() {
  const starsEl = document.getElementById("reading-card-stars");
  if (!starsEl) return;

  const stars = Array.from({ length: READING_STAR_COUNT }, () => {
    const sparkSize = 10 + Math.random() * 7;
    return {
      x: Math.random() * 100,
      y: 40 + Math.random() * 55, // 偏向落在卡面下緣之外的素色區域，避免被卡面插畫蓋過去
      sparkSize,
      glowSize: sparkSize + 8 + Math.random() * 5,
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
      className: "star--soft select-star",
      style: ` animation-duration:${s.duration}s; animation-delay:${s.delay}s;`
    }))
    .join("");
}

/**
 * 卡牌浮現 + 卡牌核心（整段淡入+上移8px, 500ms）+ 金句緊接淡入
 * @param {object} card 卡牌資料
 * @param {string} goldenLine 已依情境選好的金句（見 main.js buildContentForCard）
 */
export function revealCoreAndGolden(card, goldenLine) {
  document.getElementById("reading-card-image").src = card.imagePath;
  document.getElementById("reading-card-image").alt = card.name;
  document.getElementById("reading-card-name").textContent = card.name;
  document.getElementById("reading-card-subtitle").textContent = card.subtitle_en;
  document.getElementById("card-core").textContent = card.core;
  document.getElementById("card-golden-line").textContent = goldenLine;
  renderReadingCardStars();

  const cardWrap = document.querySelector(".reading-card-wrap");
  const coreEl = document.getElementById("card-core");
  const goldenEl = document.getElementById("card-golden-line");

  requestAnimationFrame(() => {
    cardWrap.classList.add("is-visible");
    coreEl.classList.add("is-visible");
    setTimeout(() => goldenEl.classList.add("is-visible"), 250);
  });
}

/**
 * 逐行淡入「此刻的你」文字，每行間隔約180ms + 上移4px
 * 回傳 skip 函式，可立即顯示全部行
 * 內容裡連續兩個 \n（也就是中間夾一個空行）代表「語意轉折處」，那一行會多套用
 * .today-line-break 疊加額外留白，不是縮排或對齊差異——單一 \n 仍是一般換行。
 */
function renderTodayLines(text) {
  const container = document.getElementById("today-lines");
  const skipBtn = document.getElementById("skip-today-lines");
  container.innerHTML = "";

  const rawLines = text.split("\n");
  const lines = [];
  let pendingBreak = false;
  rawLines.forEach(raw => {
    if (raw.length === 0) {
      pendingBreak = true;
      return;
    }
    lines.push({ text: raw, breakBefore: pendingBreak });
    pendingBreak = false;
  });

  const lineEls = lines.map(line => {
    const el = document.createElement("p");
    el.className = "today-line" + (line.breakBefore ? " today-line-break" : "");
    el.textContent = line.text;
    container.appendChild(el);
    return el;
  });

  const timers = [];
  let revealed = false;

  const revealAll = () => {
    if (revealed) return;
    revealed = true;
    timers.forEach(clearTimeout);
    lineEls.forEach(el => el.classList.add("is-visible"));
    skipBtn.hidden = true;
  };

  lineEls.forEach((el, i) => {
    const t = setTimeout(() => el.classList.add("is-visible"), i * LINE_STAGGER_MS);
    timers.push(t);
  });

  skipBtn.hidden = false;
  skipBtn.onclick = revealAll;

  // 全部行顯示完後隱藏跳過按鈕
  const totalTime = lineEls.length * LINE_STAGGER_MS + 300;
  timers.push(setTimeout(() => { skipBtn.hidden = true; }, totalTime));
}

/**
 * 設定四個區塊（此刻的你／再想一想／試試看／帶走一句話）依 IntersectionObserver 逐段浮現
 * @param {object} content { todayMessage, reflection, actionText, closingLine }
 * @param {() => void} onAllRevealed 最後一個區塊（帶走一句話）進入畫面時呼叫
 */
export function setupScrollReveals(content, onAllRevealed) {
  document.getElementById("reflection-text").textContent = content.reflection;
  document.getElementById("action-text").textContent = content.actionText;
  document.getElementById("closing-text").textContent = content.closingLine;
  document.getElementById("action-icon").innerHTML = ACTION_ICONS[content.actionType] || "";

  const blocks = Array.from(document.querySelectorAll("[data-reveal]"));
  let todayLinesStarted = false;
  let closingRevealed = false;

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");

        if (entry.target.id === "block-today" && !todayLinesStarted) {
          todayLinesStarted = true;
          renderTodayLines(content.todayMessage);
        }

        if (entry.target.id === "block-closing" && !closingRevealed) {
          closingRevealed = true;
          // 帶走一句話 → 通用收尾句 → 分享按鈕，依序淡入做出「最後一頁」的收尾節奏
          setTimeout(() => {
            document.getElementById("universal-closing").classList.add("is-visible");
          }, 900);
          setTimeout(onAllRevealed, 1800);
        }

        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.35 }
  );

  blocks.forEach(block => observer.observe(block));

  return () => observer.disconnect();
}

/**
 * 閱讀進度圓點 — 持續追蹤使用者目前捲動到哪個區塊（非一次性揭露），
 * 對應圓點在該區塊進入視窗時轉為實心/發亮，不顯示數字或百分比。
 * 同一個 observer 也順便驅動「滾動漸進背景」：把目前區塊在五個區塊裡的
 * 相對深度（0~1）寫成 --scroll-depth 這個 CSS 變數，讓 .reading-inner::after
 * 的紙紋/金粉顆粒透明度用 CSS calc() 跟著變化——所有卡牌共用同一套區塊索引邏輯，
 * 不是量測即時 scrollY 或依卡牌名稱客製，也不是每個 IntersectionObserver 觸發都
 * 重新計算樣式，只在區塊切換的當下寫一次 CSS 變數，實際過渡交給 CSS transition。
 */
export function setupProgressDots() {
  const sectionIds = ["block-core", "block-today", "block-reflection", "block-action", "block-closing"];
  const dots = new Map(
    Array.from(document.querySelectorAll(".progress-dots .dot")).map(dot => [dot.dataset.dot, dot])
  );
  const screenEl = document.getElementById("screen-reading");

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        const dot = dots.get(entry.target.id);
        if (dot) dot.classList.toggle("is-active", entry.isIntersecting);

        if (entry.isIntersecting) {
          const depth = sectionIds.indexOf(entry.target.id) / (sectionIds.length - 1);
          screenEl.style.setProperty("--scroll-depth", String(depth));
        }
      });
    },
    { threshold: 0.4 }
  );

  sectionIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });

  return () => observer.disconnect();
}

export function resetRevealState() {
  document.querySelectorAll("[data-reveal]").forEach(el => el.classList.remove("is-visible"));
  document.querySelector(".reading-card-wrap").classList.remove("is-visible");
  document.getElementById("card-core").classList.remove("is-visible");
  document.getElementById("card-golden-line").classList.remove("is-visible");
  document.getElementById("today-lines").innerHTML = "";
  document.getElementById("universal-closing").classList.remove("is-visible");
  document.getElementById("reading-footer").classList.remove("is-visible");
  document.querySelectorAll(".progress-dots .dot").forEach(dot => dot.classList.remove("is-active"));
  document.getElementById("screen-reading").style.removeProperty("--scroll-depth");
}
