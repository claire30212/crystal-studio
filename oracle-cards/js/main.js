// 主流程狀態機 — 開場（entryType 分流）→ [默念 → 方向選擇] → 呼吸 → 選卡 → 翻牌 → 閱讀（逐段浮現）→ 分享／重新開始

import { CARDS } from "./data/cards.js";
import { drawRandomCard, pickFromPool, selectByContext } from "./keyword-match.js";
import { runSilent } from "./silent.js";
import { runBreathing } from "./breathing.js";
import { runCardSelect } from "./select.js";
import { runFlip } from "./flip.js";
import { revealCoreAndGolden, setupScrollReveals, setupProgressDots, resetRevealState } from "./reveal.js";
import { startBackgroundDrift, stopBackgroundDrift, CARD_DRIFT_TYPE } from "./background-drift.js";
import { downloadGoldenCard, downloadFullCard } from "./share.js";
import { getRestartPromptCount, incrementRestartPromptCount } from "./storage.js";
import { primeAudio, getMuted, toggleMuted, startBackgroundMusic, startAmbientSound, stopAmbientSound } from "./audio.js";

const RESTART_PROMPT_LIMIT = 3;
const BREATHING_TEXT_DEFAULT = "給自己一點時間，安定下來";

// 方向顯示文字 → 情境鍵值。只有這裡列出的需要換名字，其餘方向直接沿用顯示文字本身。
// 「我也說不上來」對應原本「綜合」情境池，底層資料不需更動。
const DIRECTION_CONTEXT_MAP = {
  "我也說不上來": "綜合"
};

// 呼吸畫面文字依所選方向動態替換
const DIRECTION_BREATHING_TEXT = {
  "工作": "帶著工作的這個念頭，深呼吸一次。",
  "感情": "帶著心裡的這段關係，深呼吸一次。",
  "成長": "帶著這個還在整理的自己，深呼吸一次。",
  "財運": "帶著這個還沒放下的念頭，深呼吸一次。",
  "家庭": "帶著你牽掛的人，深呼吸一次。",
  "健康": "帶著身體正在告訴你的事，深呼吸一次。",
  "我也說不上來": "帶著這份說不清楚的感覺，深呼吸一次。"
};

let currentCard = null;
let lastCardId = null;
let currentContent = null;
let disposeScrollReveals = null;
let disposeProgressDots = null;

// entryType: 'concern'（我有一件放在心上的事）／'company'（我只是想陪陪今天的自己）
let entryType = null;
let selectedDirection = "";

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(el => el.classList.remove("is-active"));
  document.getElementById(id).classList.add("is-active");
  window.scrollTo(0, 0);
}

function buildContentForCard(card, context) {
  const action = selectByContext(card.actions, context);
  return {
    todayMessage: selectByContext(card.todayMessages, context),
    goldenLine: selectByContext(card.goldenLines, context),
    reflection: selectByContext(card.reflections, context),
    actionText: action.text,
    actionType: action.type,
    closingLine: pickFromPool(card.closingLines)
  };
}

/**
 * 使用者選的方向只用來決定「此刻的你」要顯示哪個情境版本，完全不影響抽卡結果。
 * 路徑B（company）沒有方向選擇，一律綜合版。
 */
function resolveContext() {
  if (entryType !== "concern" || !selectedDirection) return "綜合";
  return DIRECTION_CONTEXT_MAP[selectedDirection] || selectedDirection;
}

function drawAndProceed() {
  showScreen("screen-breathing");

  const breathingTextEl = document.getElementById("breathing-text");
  const honestyEl = document.getElementById("breathing-honesty");

  if (entryType === "concern" && selectedDirection) {
    breathingTextEl.textContent = DIRECTION_BREATHING_TEXT[selectedDirection] || BREATHING_TEXT_DEFAULT;
    honestyEl.hidden = false;
  } else {
    breathingTextEl.textContent = BREATHING_TEXT_DEFAULT;
    honestyEl.hidden = true;
  }

  runBreathing(() => {
    showScreen("screen-select");
    runCardSelect(() => {
      // 抽到哪張卡永遠是真隨機，跟使用者選的方向、選的卡背位置完全無關
      currentCard = drawRandomCard(CARDS, lastCardId);
      currentContent = buildContentForCard(currentCard, resolveContext());

      showScreen("screen-flip");
      runFlip(currentCard, () => {
        lastCardId = currentCard.id;
        enterReadingScreen();
      });
    });
  });
}

// 路徑A：我有一件放在心上的事 → 默念 → 方向選擇 → 呼吸…
function goToSilent() {
  entryType = "concern";
  showScreen("screen-silent");
  runSilent(() => {
    showScreen("screen-direction");
  });
}

// 路徑B：我只是想陪陪今天的自己 → 直接呼吸（固定文案，無方向）…
function goToCompanyBreathing() {
  entryType = "company";
  selectedDirection = "";
  drawAndProceed();
}

function enterReadingScreen() {
  showScreen("screen-reading");
  resetRevealState();
  revealCoreAndGolden(currentCard, currentContent.goldenLine);

  if (disposeScrollReveals) disposeScrollReveals();
  disposeScrollReveals = setupScrollReveals(currentContent, () => {
    document.getElementById("reading-footer").classList.add("is-visible");
  });

  if (disposeProgressDots) disposeProgressDots();
  disposeProgressDots = setupProgressDots();

  startBackgroundDrift(CARD_DRIFT_TYPE[currentCard.id] || "brighten");
  startAmbientSound();
}

function resetToEntry() {
  stopBackgroundDrift();
  stopAmbientSound();
  if (disposeScrollReveals) {
    disposeScrollReveals();
    disposeScrollReveals = null;
  }
  if (disposeProgressDots) {
    disposeProgressDots();
    disposeProgressDots = null;
  }
  entryType = null;
  selectedDirection = "";
  document.getElementById("breathing-honesty").hidden = true;
  showScreen("screen-entry");
}

function handleRestartRequest() {
  const count = getRestartPromptCount();
  if (count < RESTART_PROMPT_LIMIT) {
    document.getElementById("restart-modal").hidden = false;
  } else {
    resetToEntry();
  }
}

function initEntryScreen() {
  // 兩條路徑各自獨立判斷，不再共用同一張輸入畫面
  document.querySelectorAll(".entry-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      primeAudio();
      startBackgroundMusic();
      if (btn.dataset.entry === "concern") {
        goToSilent();
      } else {
        goToCompanyBreathing();
      }
    });
  });
}

function initDirectionScreen() {
  // 點選方向膠囊標籤即立刻前進到呼吸畫面，不需要額外的「繼續」按鈕
  document.querySelectorAll(".direction-tag").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedDirection = btn.dataset.direction;
      drawAndProceed();
    });
  });
}

function initReadingFooter() {
  document.getElementById("share-btn").addEventListener("click", () => {
    downloadGoldenCard(currentCard, currentContent.goldenLine);
  });
  document.getElementById("share-full-btn").addEventListener("click", () => {
    downloadFullCard(currentCard, currentContent.goldenLine);
  });
  document.getElementById("restart-btn").addEventListener("click", handleRestartRequest);
}

function initRestartModal() {
  document.getElementById("restart-cancel").addEventListener("click", () => {
    document.getElementById("restart-modal").hidden = true;
  });
  document.getElementById("restart-confirm").addEventListener("click", () => {
    incrementRestartPromptCount();
    document.getElementById("restart-modal").hidden = true;
    resetToEntry();
  });
}

function initMuteToggle() {
  const btn = document.getElementById("mute-toggle");
  const iconSound = btn.querySelector(".icon-sound");
  const iconMute = btn.querySelector(".icon-mute");

  const syncIcon = () => {
    const muted = getMuted();
    iconSound.hidden = muted;
    iconMute.hidden = !muted;
  };

  syncIcon();
  btn.addEventListener("click", () => {
    toggleMuted();
    syncIcon();
  });
}

function init() {
  initEntryScreen();
  initDirectionScreen();
  initReadingFooter();
  initRestartModal();
  initMuteToggle();
  showScreen("screen-entry");
}

init();
