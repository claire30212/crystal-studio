// 分享圖片 — 原生 Canvas API 手動繪製，不使用 html2canvas 或任何 DOM 截圖
// 中文文字換行：measureText 逐字元累加寬度手動判斷斷行（Canvas 文字無法依賴 CSS 自動換行）

const CANVAS_W = 1080;
const WATERMARK_RESERVED_HEIGHT = 90; // 浮水印固定保留區，永遠在內文下方、不與文字重疊

const COLORS = {
  cream: "#F5F0EB",
  rose: "#D4B5A8",
  champagne: "#C9A876",
  coffee: "#6B5D52"
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * 依字元寬度手動換行（先依既有 \n 斷段，再依 maxWidth 逐字元累加寬度斷行）
 */
function wrapTextByChar(ctx, text, maxWidth) {
  const paragraphs = text.split("\n");
  const lines = [];

  paragraphs.forEach(paragraph => {
    if (paragraph.length === 0) {
      lines.push("");
      return;
    }
    let current = "";
    for (const ch of paragraph) {
      const test = current + ch;
      if (ctx.measureText(test).width > maxWidth && current.length > 0) {
        lines.push(current);
        current = ch;
      } else {
        current = test;
      }
    }
    if (current.length > 0) lines.push(current);
  });

  return lines;
}

function drawCenteredLines(ctx, lines, centerX, startY, lineHeight) {
  lines.forEach((line, i) => {
    ctx.fillText(line, centerX, startY + i * lineHeight);
  });
  return startY + lines.length * lineHeight;
}

/**
 * 浮水印固定畫在右下角，獨立於文字內容區之外，不會隨文字行數變化而被擠壓重疊
 */
function drawWatermark(ctx, canvasWidth, canvasHeight) {
  ctx.textAlign = "right";
  ctx.font = "300 20px 'Noto Serif TC', serif";
  ctx.fillStyle = "rgba(201, 168, 118, 0.55)";
  ctx.fillText("CélesteDestin", canvasWidth - 40, canvasHeight - 36);
}

/**
 * 繪製金句卡（主要分享圖：卡牌插畫 + 金句）
 * Canvas 高度依實際換行後的文字行數動態計算，避免固定高度導致內容溢出、
 * 讓底部浮水印疊到金句文字上
 */
async function drawGoldenCard(card, goldenLine) {
  const canvas = document.getElementById("share-canvas");
  canvas.width = CANVAS_W;
  canvas.height = 100; // 暫定高度，量測文字後會重新設定
  const ctx = canvas.getContext("2d");

  const img = await loadImage(card.imagePath);
  const imgW = 760;
  const imgH = imgW * (4.3 / 3);
  const imgX = (CANVAS_W - imgW) / 2;
  const imgTopMargin = 90;
  const imgToTextGap = 90;
  const goldenLineHeight = 66;
  const bottomMargin = 60;

  ctx.font = "400 42px 'Noto Serif TC', serif";
  const goldenLines = wrapTextByChar(ctx, goldenLine, imgW - 40);
  const textBlockHeight = goldenLines.length * goldenLineHeight;

  // 重新設定 canvas.height 會清空畫布與所有 context 狀態，之後要重新設定樣式
  canvas.height = imgTopMargin + imgH + imgToTextGap + textBlockHeight + bottomMargin + WATERMARK_RESERVED_HEIGHT;

  ctx.fillStyle = COLORS.cream;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  drawRoundedRect(ctx, imgX, imgTopMargin, imgW, imgH, 36);
  ctx.clip();
  ctx.drawImage(img, imgX, imgTopMargin, imgW, imgH);
  ctx.restore();

  ctx.strokeStyle = "rgba(201, 168, 118, 0.4)";
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, imgX, imgTopMargin, imgW, imgH, 36);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.font = "400 42px 'Noto Serif TC', serif";
  ctx.fillStyle = COLORS.coffee;
  drawCenteredLines(ctx, goldenLines, CANVAS_W / 2, imgTopMargin + imgH + imgToTextGap, goldenLineHeight);

  drawWatermark(ctx, canvas.width, canvas.height);

  return canvas;
}

/**
 * 繪製完整卡面（次要分享：卡名 + 插畫 + 核心文字 + 金句）
 * 同樣依實際文字行數動態決定 canvas 高度，浮水印固定在右下角保留區
 */
async function drawFullCard(card, goldenLine) {
  const canvas = document.getElementById("share-canvas");
  canvas.width = CANVAS_W;
  canvas.height = 100; // 暫定高度，量測文字後會重新設定
  const ctx = canvas.getContext("2d");

  const img = await loadImage(card.imagePath);
  const imgW = 560;
  const imgH = imgW * (4.3 / 3);
  const imgX = (CANVAS_W - imgW) / 2;
  const imgY = 175;
  const coreLineHeight = 48;
  const goldenLineHeight = 50;
  const coreGap = 70;
  const goldenGap = 40;
  const bottomMargin = 60;

  ctx.font = "400 30px 'Noto Serif TC', serif";
  const coreLines = wrapTextByChar(ctx, card.core, CANVAS_W - 160);

  ctx.font = "400 32px 'Noto Serif TC', serif";
  const goldenLines = wrapTextByChar(ctx, goldenLine, CANVAS_W - 160);

  const coreBlockHeight = coreLines.length * coreLineHeight;
  const goldenBlockHeight = goldenLines.length * goldenLineHeight;

  canvas.height = imgY + imgH + coreGap + coreBlockHeight + goldenGap + goldenBlockHeight + bottomMargin + WATERMARK_RESERVED_HEIGHT;

  ctx.fillStyle = COLORS.cream;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.coffee;
  ctx.font = "400 52px 'Noto Serif TC', serif";
  ctx.fillText(card.name, CANVAS_W / 2, 100);

  ctx.fillStyle = COLORS.champagne;
  ctx.font = "300 22px 'Noto Serif TC', serif";
  ctx.fillText(card.subtitle_en.toUpperCase(), CANVAS_W / 2, 138);

  ctx.save();
  drawRoundedRect(ctx, imgX, imgY, imgW, imgH, 28);
  ctx.clip();
  ctx.drawImage(img, imgX, imgY, imgW, imgH);
  ctx.restore();

  ctx.strokeStyle = "rgba(201, 168, 118, 0.4)";
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, imgX, imgY, imgW, imgH, 28);
  ctx.stroke();

  ctx.font = "400 30px 'Noto Serif TC', serif";
  ctx.fillStyle = COLORS.coffee;
  const afterCoreY = drawCenteredLines(ctx, coreLines, CANVAS_W / 2, imgY + imgH + coreGap, coreLineHeight);

  ctx.font = "400 32px 'Noto Serif TC', serif";
  ctx.fillStyle = COLORS.champagne;
  drawCenteredLines(ctx, goldenLines, CANVAS_W / 2, afterCoreY + goldenGap, goldenLineHeight);

  drawWatermark(ctx, canvas.width, canvas.height);

  return canvas;
}

/**
 * 用 Blob + Object URL 觸發下載，不用 canvas.toDataURL() 產生的 data: URL。
 * data: URL 一旦太長，部分瀏覽器會不認 <a download> 指定的檔名，直接退回自己產生的
 * 亂碼／雜湊檔名——這裡的卡面圖片編碼成 data URL 後常常有這個長度，Blob URL 沒有這個問題。
 * <a> 元素要先接到 DOM 上再 click()，部分瀏覽器（如 Firefox）對未掛載的元素觸發下載不穩定。
 */
function downloadCanvas(canvas, filename) {
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, "image/png");
}

export async function downloadGoldenCard(card, goldenLine) {
  const canvas = await drawGoldenCard(card, goldenLine);
  downloadCanvas(canvas, `celestedestin-${card.id}-golden.png`);
}

export async function downloadFullCard(card, goldenLine) {
  const canvas = await drawFullCard(card, goldenLine);
  downloadCanvas(canvas, `celestedestin-${card.id}-full.png`);
}
