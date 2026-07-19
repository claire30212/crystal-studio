// 共用星芒元件 — 白色系、十字長星芒、暈染沿十字方向延伸（非圓形）。
// 選卡畫面（#screen-select）與背景漂移的星現型效果（background-drift.js）共用同一套 markup／CSS，
// 只有「誰驅動 opacity/transform」不同：選卡畫面用 CSS 動畫，背景漂移用 rAF 逐幀控制。

/**
 * @param {{x:number, y:number, sparkSize:number, glowSize:number, className?:string, style?:string}} opts
 * @returns {string} 一顆星星的 HTML
 */
export function starSpriteMarkup({ x, y, sparkSize, glowSize, className = "", style = "" }) {
  const cls = className ? `star ${className}` : "star";
  return `<div class="${cls}" style="left:${x}%; top:${y}%; --spark-size:${sparkSize}px; --glow-size:${glowSize}px;${style}"><span class="star-glow"></span><span class="star-spark"></span></div>`;
}
