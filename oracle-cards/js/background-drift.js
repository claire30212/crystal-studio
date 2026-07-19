// 背景漂移系統 — 5 種可複用效果類型
// 只用 transform / opacity / 顏色插值，不使用持續性的 filter/blur
// 必須遵守：Page Visibility API 暫停、prefers-reduced-motion 顯示靜態終態

import { starSpriteMarkup } from "./star-sprite.js";

const CYCLE_MS = 75000; // 單一循環 75 秒，落在規格建議的 60-120 秒區間

let rafId = null;
let startTime = null;
let pausedAt = null;
let currentType = null;
let container = null;

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function ensureContainer() {
  if (!container) container = document.getElementById("bg-drift");
  return container;
}

function clearContainer() {
  const el = ensureContainer();
  el.innerHTML = "";
  el.className = "bg-drift";
}

/** t 在 0~1~0 之間緩慢震盪（sine easing），代表一次循環的進度 */
function cycleProgress(elapsed) {
  const phase = (elapsed % CYCLE_MS) / CYCLE_MS; // 0 -> 1
  return (Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 1) / 2; // 0 -> 1 -> 0
}

function lerpColor(c1, c2, t) {
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

// ===== 各效果類型的畫面建構與逐幀更新 =====

// 四種效果的透明度這輪整體往下調（原本 brighten/fog 尖峰接近 90%+、dim 到 68%，
// 確實會搶走閱讀時的注意力）。新的尖峰都落在 30-38% 之間，但保留各效果原本的
// 「相對形狀」：brighten/fog 原本谷值接近 0，這次也維持接近 0 的谷值；flow 原本
// 谷值就明顯高於 0（一直有存在感、不會完全消失），這次也保留這個特徵只是整體
// 往下收；dim 原本谷值是 0（從完全不暗開始才慢慢暗下去），也維持。
const effects = {
  // 漸亮型：暖色光暈緩緩浮現、亮度緩慢上升。原本 3%→97%，改成 1%→35%
  brighten(el) {
    el.innerHTML = `<div class="drift-layer drift-glow-warm"></div>`;
    const glow = el.querySelector(".drift-glow-warm");
    return t => {
      glow.style.opacity = String(0.01 + t * 0.34);
      glow.style.transform = `scale(${1 + t * 0.75})`;
    };
  },

  // 起霧型：透明度緩慢增加，邊緣漸趨模糊（以柔邊漸層取代 blur filter）。原本 4%→92%，改成 2%→35%
  fog(el) {
    el.innerHTML = `<div class="drift-layer drift-fog"></div>`;
    const fog = el.querySelector(".drift-fog");
    return t => {
      fog.style.opacity = String(0.02 + t * 0.33);
      fog.style.transform = `scale(${1 + t * 0.3})`;
    };
  },

  // 流動型：背景色相緩慢漂移（用實際顏色插值取代 hue-rotate filter）。原本 18%→93%，改成 8%→35%
  flow(el) {
    el.innerHTML = `<div class="drift-layer drift-flow"></div>`;
    const flow = el.querySelector(".drift-flow");
    const colorA = [212, 181, 168]; // 霧玫瑰
    const colorB = [155, 174, 190]; // 煙藍
    return t => {
      flow.style.background = `radial-gradient(ellipse at 50% 40%, ${lerpColor(colorA, colorB, t)} 0%, transparent 75%)`;
      flow.style.opacity = String(0.08 + t * 0.27);
      flow.style.transform = `scale(${1 + t * 0.35}) translateX(${(t - 0.5) * 60}px)`;
    };
  },

  // 星現型：星點一顆一顆不規則地浮現，造型沿用選卡畫面（#screen-select）已修好的
  // 共用星芒元件（白色系、十字長星芒、暈染沿十字方向延伸），不維護第二套星星寫法。
  // 尺寸跟選卡畫面同一個量級、數量少而疏落、色調用 .star--soft 壓掉金黃感，
  // 走「精緻低調」而不是「大、亮、搶眼」。
  starEmerge(el) {
    const STAR_COUNT = 15;
    const stars = Array.from({ length: STAR_COUNT }, () => {
      const sparkSize = 12 + Math.random() * 9; // 12~21px，跟選卡畫面同一個尺寸區間
      return {
        x: Math.random() * 100,
        y: Math.random() * 100,
        offset: Math.random(),
        sparkSize,
        glowSize: sparkSize + 9 + Math.random() * 5
      };
    });
    el.innerHTML = stars
      .map(s => starSpriteMarkup({ x: s.x, y: s.y, sparkSize: s.sparkSize, glowSize: s.glowSize, className: "star--soft" }))
      .join("");
    const starEls = Array.from(el.querySelectorAll(".star"));
    return t => {
      starEls.forEach((starEl, i) => {
        const local = (t + stars[i].offset) % 1;
        const twinkle = Math.max(0, Math.sin(local * Math.PI));
        starEl.style.opacity = String(twinkle);
        starEl.style.transform = `translate(-50%, -50%) scale(${0.75 + twinkle * 0.4})`;
      });
    };
  },

  // 漸暗型：亮度緩慢降低，凸顯安靜感。原本 0%→68%，改成 0%→34%
  dim(el) {
    el.innerHTML = `<div class="drift-layer drift-dim"></div>`;
    const dim = el.querySelector(".drift-dim");
    return t => {
      dim.style.opacity = String(t * 0.34);
    };
  }
};

function applyStaticState(type) {
  const el = ensureContainer();
  clearContainer();
  const build = effects[type];
  if (!build) return;
  const update = build(el);
  update(0.6); // 顯示一個中間、穩定的終態畫面
}

function loop(type) {
  const update = effects[type](ensureContainer());

  function frame(now) {
    if (startTime === null) startTime = now;
    const elapsed = now - startTime;
    update(cycleProgress(elapsed));
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);
}

function handleVisibilityChange() {
  if (!currentType || prefersReducedMotion()) return;
  if (document.hidden) {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
      pausedAt = performance.now();
    }
  } else {
    if (rafId === null && startTime !== null && pausedAt !== null) {
      const pauseDuration = performance.now() - pausedAt;
      startTime += pauseDuration;
    }
    if (rafId === null) loop(currentType);
  }
}

/**
 * 依卡牌所屬類型啟動背景漂移
 * @param {"brighten"|"fog"|"flow"|"starEmerge"|"dim"} type
 */
export function startBackgroundDrift(type) {
  stopBackgroundDrift();
  currentType = type;
  clearContainer();

  if (prefersReducedMotion()) {
    applyStaticState(type);
    return;
  }

  startTime = null;
  pausedAt = null;
  loop(type);
  document.addEventListener("visibilitychange", handleVisibilityChange);
}

export function stopBackgroundDrift() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  startTime = null;
  pausedAt = null;
  currentType = null;
}

// 各卡牌對應的漂移效果類型（規格書五、背景漂移系統）
export const CARD_DRIFT_TYPE = {
  "01": "brighten",   // 起心
  "02": "dim",        // 內視 — 向內傾聽、安靜自省
  "03": "brighten",   // 豐盈 — 暖意湧入的接納
  "04": "dim",        // 安定 — 搖晃中安靜地找到根
  "05": "brighten",   // 信念
  "06": "flow",       // 抉擇
  "07": "flow",       // 啟程 — 往前走的移動感
  "08": "dim",        // 韌性 — 不張揚地撐住、安靜的堅強
  "09": "dim",        // 靜心
  "10": "flow",       // 流轉
  "11": "flow",       // 平衡 — 天秤輕晃、慢慢找回中心
  "12": "fog",        // 靜觀
  "13": "fog",        // 蛻變 — 繭中模糊未明的轉化過程
  "14": "flow",       // 調和
  "15": "dim",        // 覺察
  "16": "brighten",   // 破曉
  "17": "starEmerge", // 星光
  "18": "fog",        // 迷霧
  "19": "brighten",   // 綻放 — 朝光生長
  "20": "brighten",   // 覺醒
  "21": "dim",        // 圓滿 — 安然收下、不再追更多的靜定感
  "22": "starEmerge"  // 信任
};
