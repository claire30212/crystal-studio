// 翻牌鐘聲（約850ms處）：外部音檔（audio/singing-bowl.mp3），用 AudioBufferSourceNode 播放
// 卡面顯示瞬間的輕「叮」聲：仍是 Web Audio API 即時合成，不使用外部音檔
// 背景音樂架構：
//   - musicMaster：外部音檔（audio/background-music.mp3）loop 播放，透過
//     MediaElementSourceNode 接進 Web Audio 圖，從入口頁點擊按鈕的那個使用者手勢開始播放，
//     貫穿呼吸凝視／方向選擇／選卡／翻牌／閱讀全程不中斷，只有靜音或離開網站才停
//   - ambientMaster：風聲＋遠方鐘聲（仍是即時合成），維持原本只在閱讀畫面出現的「輕特效聲」，
//     疊加在 musicMaster 之上（兩者是各自獨立接到 destination 的並行 gain 樹，
//     混音在喇叭端自然疊加，不是誰取代誰）
//   - MUSIC_TARGET_GAIN／AMBIENT_TARGET_GAIN：兩層各自「非靜音時」的滿音量目標，
//     刻意都設得很低（背景音樂是實際錄製的音軌，本身音量感受跟合成音墊不同量級，
//     不能沿用舊版統一 ramp 到 1 的做法），數值是初始估計，還沒經過耳朵微調

import { isAudioMuted, setAudioMuted } from "./storage.js";

const AMBIENT_START_DELAY_MS = 900; // 等卡牌核心淡入完成後，再延遲一小段開始
const AMBIENT_FADE_IN_S = 3.2; // 「輕聲淡入」
const AMBIENT_FADE_OUT_S = 1.2; // 離開閱讀畫面時淡出
const MUTE_RAMP_S = 0.08; // 切靜音當下要立即停掉正在播放的聲音，不是只擋下一次觸發
const UNMUTE_RAMP_S = 0.4;
const DISTANT_BELL_MIN_MS = 15000;
const DISTANT_BELL_MAX_MS = 27000; // 間隔不規則：15~42 秒之間亂數

const MUSIC_FADE_IN_S = 3.5;
const BACKGROUND_MUSIC_SRC = "audio/background-music.mp3";
// 「幾乎注意不到，但抽掉會覺得少了什麼」的音量目標，經過一輪實聽回饋調整
const MUSIC_TARGET_GAIN = 0.08;
const AMBIENT_TARGET_GAIN = 0.6;

const BELL_SRC = "audio/singing-bowl.mp3";
const BELL_PEAK_GAIN = 0.14;
const BELL_FADE_IN_S = 0.07;
// 解碼後開頭約 30-40ms 是接近數位靜音，用這個 offset 跳過，讓淡入對準真正聲音出現的位置，不是對著空白淡入
const BELL_TRIM_S = 0.03;
// 音檔本身尾端已經自然衰減到接近無聲，不需要再疊加人工衰減曲線（會變成雙重衰減、提早悶掉尾音）；
// 這段極短淡出只是避免 buffer 播放到最後一個 sample 瞬間截斷的數位喀聲
const BELL_TAIL_FADE_S = 0.03;

let ctx = null;
let muted = isAudioMuted();

// 翻牌鐘聲音檔，decodeAudioData 後快取起來重複播放；primeAudio() 就先開始解碼，
// 讓翻牌當下（使用者手勢後還要再經過呼吸/選卡畫面）不會卡在還沒解碼完
let bellBuffer = null;
let bellBufferPromise = null;

// 背景音樂狀態，跟整個應用程式的生命週期綁在一起，不隨畫面切換重啟
let musicMaster = null;
let musicActive = false;

// 環境音（風聲＋遠方鐘聲）狀態，跟閱讀畫面的生命週期綁在一起
let ambientMaster = null;
let noiseSource = null;
let windFilter = null;
let filterLFO = null;
let ampLFO = null;
let windGain = null;
let ambientStartTimer = null;
let distantBellTimer = null;
let ambientActive = false;

function getContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ctx.state === "suspended") {
    ctx.resume();
  }
  return ctx;
}

// 使用者第一次互動時就先建立/喚醒 AudioContext（瀏覽器政策要求），
// 順便先開始解碼翻牌鐘聲音檔，避免翻牌當下才臨時解碼
export function primeAudio() {
  const audioCtx = getContext();
  loadBellBuffer(audioCtx);
}

function loadBellBuffer(audioCtx) {
  if (bellBufferPromise) return bellBufferPromise;
  bellBufferPromise = fetch(BELL_SRC)
    .then(res => res.arrayBuffer())
    .then(data => audioCtx.decodeAudioData(data))
    .then(buffer => {
      bellBuffer = buffer;
      return buffer;
    });
  return bellBufferPromise;
}

/**
 * 背景音樂：外部音檔 loop 播放，透過 MediaElementSourceNode 接進 musicMaster gain node，
 * 用串流播放（邊下載邊播）而不是 decodeAudioData 整檔解碼，避免長音檔佔用大量記憶體，
 * 也不會拖慢頁面載入 —— 檔案要等這個函式第一次被呼叫（入口頁按鈕點擊）才開始下載。
 * 從入口頁的使用者手勢開始播放，之後貫穿全程，只有 toggleMuted() 或分頁關閉才停。
 * 呼叫多次是安全的（已經在播就直接略過），resetToEntry() 不會呼叫這裡的任何東西。
 */
export function startBackgroundMusic() {
  if (musicActive) return;
  musicActive = true;
  const audioCtx = getContext();
  const now = audioCtx.currentTime;

  const audioEl = new Audio(BACKGROUND_MUSIC_SRC);
  audioEl.loop = true;
  audioEl.preload = "auto";

  const source = audioCtx.createMediaElementSource(audioEl);

  musicMaster = audioCtx.createGain();
  musicMaster.gain.setValueAtTime(0.0001, now);
  if (!muted) {
    musicMaster.gain.linearRampToValueAtTime(MUSIC_TARGET_GAIN, now + MUSIC_FADE_IN_S);
  }
  source.connect(musicMaster);
  musicMaster.connect(audioCtx.destination);

  audioEl.play().catch(() => { /* 使用者手勢已觸發，理論上不會被自動播放政策擋下 */ });
}

export function getMuted() {
  return muted;
}

export function toggleMuted() {
  muted = !muted;
  setAudioMuted(muted);
  applyMuteToAudioLayers();
  return muted;
}

/**
 * 切靜音當下，讓正在播放的聲音（背景音樂／風聲持續層／遠方鐘聲的衰減尾音）立即停掉，
 * 不是只擋住下一次觸發。背景音樂跟環境音是兩棵各自獨立的 gain 樹，各自處理自己的 master，
 * 哪一棵當下存在就切哪一棵，兩者可能同時存在（閱讀畫面）也可能只有音樂存在（其他畫面）。
 * 兩層「非靜音時」的滿音量目標不同（MUSIC_TARGET_GAIN／AMBIENT_TARGET_GAIN），
 * 不是統一 ramp 到 1。
 */
function applyMuteToAudioLayers() {
  const audioCtx = getContext();
  const now = audioCtx.currentTime;
  const rampS = muted ? MUTE_RAMP_S : UNMUTE_RAMP_S;

  [[musicMaster, MUSIC_TARGET_GAIN], [ambientMaster, AMBIENT_TARGET_GAIN]].forEach(([master, unmutedTarget]) => {
    if (!master) return;
    const target = muted ? 0.0001 : unmutedTarget;
    const currentGain = master.gain.value;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(currentGain, now);
    master.gain.linearRampToValueAtTime(target, now + rampS);
  });
}

/**
 * 翻牌鐘聲：外部音檔（缽聲錄音），offset 跳過開頭的近似靜音讓淡入對準真正聲音出現的位置，
 * 音檔本身尾端已自然衰減到接近無聲，所以不疊加人工衰減曲線，只在真正結束前做極短淡出防喀聲。
 * 如果 decodeAudioData 還沒完成（理論上不會，primeAudio() 已經提早開始解碼），
 * 等解碼完成後重新呼叫一次自己，不會漏播。
 */
export function playBell() {
  if (muted) return;
  const audioCtx = getContext();
  if (!bellBuffer) {
    loadBellBuffer(audioCtx).then(() => playBell());
    return;
  }
  const now = audioCtx.currentTime;
  const playbackDuration = bellBuffer.duration - BELL_TRIM_S;

  const master = audioCtx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.linearRampToValueAtTime(BELL_PEAK_GAIN, now + BELL_FADE_IN_S);
  master.gain.setValueAtTime(BELL_PEAK_GAIN, now + playbackDuration - BELL_TAIL_FADE_S);
  master.gain.linearRampToValueAtTime(0.0001, now + playbackDuration);
  master.connect(audioCtx.destination);

  const source = audioCtx.createBufferSource();
  source.buffer = bellBuffer;
  source.connect(master);
  source.start(now, BELL_TRIM_S);
}

/**
 * 短促輕「叮」聲：單一高頻正弦波，快速衰減
 */
export function playChime() {
  if (muted) return;
  const audioCtx = getContext();
  const now = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1760, now);

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.18, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.4);
}

/**
 * 雜訊緩衝區，執行期用 AudioContext.createBuffer 填入白噪音，loop 播放當風聲素材
 */
function createNoiseBuffer(audioCtx) {
  const bufferSize = audioCtx.sampleRate * 4;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/**
 * 遠方鐘聲：沿用 playBell 的泛音疊加技巧，但用低通濾波器把音色悶住、衰減拖得更長、
 * 力度跟音長每次都有微幅隨機差異，聽起來才不像機械重複的同一聲。
 * 接在 ambientMaster 上，不直接接 destination，才能被靜音統一控制。
 */
function playDistantBellHit() {
  if (muted || !ambientMaster) return;
  const audioCtx = getContext();
  const now = audioCtx.currentTime;
  const fundamentals = [196, 294, 466]; // 比主鐘聲低、疏，聽起來更遠
  const peak = 0.09 + Math.random() * 0.04;
  const decay = 5.5 + Math.random() * 2.5; // 拖得比翻牌鐘聲（2.2s）長很多

  const hitGain = audioCtx.createGain();
  hitGain.gain.setValueAtTime(0.0001, now);
  hitGain.gain.linearRampToValueAtTime(peak, now + 0.05);
  hitGain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

  const muffle = audioCtx.createBiquadFilter();
  muffle.type = "lowpass";
  muffle.frequency.value = 900; // 濾掉高頻，音色更悶
  muffle.Q.value = 0.5;

  hitGain.connect(muffle);
  muffle.connect(ambientMaster);

  fundamentals.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);

    const partialGain = audioCtx.createGain();
    const level = i === 0 ? 1 : 0.3 / i;
    partialGain.gain.setValueAtTime(0.0001, now);
    partialGain.gain.linearRampToValueAtTime(level, now + 0.06);
    partialGain.gain.exponentialRampToValueAtTime(0.0001, now + decay - i * 0.3);

    osc.connect(partialGain);
    partialGain.connect(hitGain);
    osc.start(now);
    osc.stop(now + decay + 0.2);
  });
}

/**
 * 不規則亂數排程下一次遠方鐘聲，做出「偶爾傳來」而非固定節奏的距離感
 */
function scheduleDistantBell() {
  const delay = DISTANT_BELL_MIN_MS + Math.random() * (DISTANT_BELL_MAX_MS - DISTANT_BELL_MIN_MS);
  distantBellTimer = setTimeout(() => {
    if (!ambientActive) return;
    playDistantBellHit();
    scheduleDistantBell();
  }, delay);
}

/**
 * 風聲：白噪音 buffer 接低通濾波器，濾波器截止頻率被一個緩慢 LFO 調變，
 * 同時風的音量也被另一個（頻率錯開，避免同步顯得機械）緩慢 LFO 調變，
 * 兩層疊加做出時強時弱、緩慢起伏的風感
 */
function startWind(audioCtx, now) {
  noiseSource = audioCtx.createBufferSource();
  noiseSource.buffer = createNoiseBuffer(audioCtx);
  noiseSource.loop = true;

  const windHighpass = audioCtx.createBiquadFilter();
  windHighpass.type = "highpass";
  windHighpass.frequency.value = 100;

  windFilter = audioCtx.createBiquadFilter();
  windFilter.type = "lowpass";
  windFilter.frequency.value = 500;
  windFilter.Q.value = 0.8;

  filterLFO = audioCtx.createOscillator();
  filterLFO.type = "sine";
  filterLFO.frequency.value = 0.06; // 約 16.7 秒一個週期
  const filterLFODepth = audioCtx.createGain();
  filterLFODepth.gain.value = 320;
  filterLFO.connect(filterLFODepth);
  filterLFODepth.connect(windFilter.frequency);

  windGain = audioCtx.createGain();
  windGain.gain.value = 0.035; // 原本 0.1 太大聲，壓低成背景陪襯的量級

  ampLFO = audioCtx.createOscillator();
  ampLFO.type = "sine";
  ampLFO.frequency.value = 0.045; // 跟濾波器 LFO 週期錯開
  const ampLFODepth = audioCtx.createGain();
  ampLFODepth.gain.value = 0.02; // 調變幅度跟著基準值等比例縮小，維持同樣的相對起伏感
  ampLFO.connect(ampLFODepth);
  ampLFODepth.connect(windGain.gain);

  noiseSource.connect(windHighpass);
  windHighpass.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(ambientMaster);

  noiseSource.start(now);
  filterLFO.start(now);
  ampLFO.start(now);
}

function beginAmbientAudio() {
  const audioCtx = getContext();
  const now = audioCtx.currentTime;

  ambientMaster = audioCtx.createGain();
  ambientMaster.gain.setValueAtTime(0.0001, now);
  if (!muted) {
    ambientMaster.gain.linearRampToValueAtTime(AMBIENT_TARGET_GAIN, now + AMBIENT_FADE_IN_S);
  }
  ambientMaster.connect(audioCtx.destination);

  startWind(audioCtx, now);
  scheduleDistantBell();
}

/**
 * 閱讀畫面背景世界化 Phase 2 進場：跟背景漂移（startBackgroundDrift）共用同一個
 * 呼叫時機（enterReadingScreen），但內部延遲卡牌核心淡入完成後再輕聲淡入開始播放
 */
export function startAmbientSound() {
  stopAmbientSound();
  ambientActive = true;
  ambientStartTimer = setTimeout(() => {
    if (!ambientActive) return;
    beginAmbientAudio();
  }, AMBIENT_START_DELAY_MS);
}

/**
 * 跟背景漂移共用同一個呼叫時機（resetToEntry）。淡出後才真正停止／釋放節點，
 * 避免離開閱讀畫面瞬間的喀聲
 */
export function stopAmbientSound() {
  ambientActive = false;
  if (ambientStartTimer) {
    clearTimeout(ambientStartTimer);
    ambientStartTimer = null;
  }
  if (distantBellTimer) {
    clearTimeout(distantBellTimer);
    distantBellTimer = null;
  }
  if (!ambientMaster) return;

  const audioCtx = getContext();
  const now = audioCtx.currentTime;
  const currentGain = ambientMaster.gain.value;
  ambientMaster.gain.cancelScheduledValues(now);
  ambientMaster.gain.setValueAtTime(currentGain, now);
  ambientMaster.gain.linearRampToValueAtTime(0.0001, now + AMBIENT_FADE_OUT_S);

  const nodesToStop = [noiseSource, filterLFO, ampLFO];
  const masterToDisconnect = ambientMaster;
  setTimeout(() => {
    nodesToStop.forEach(node => {
      try { node.stop(); } catch (e) { /* 已經停止過就略過 */ }
    });
    masterToDisconnect.disconnect();
  }, AMBIENT_FADE_OUT_S * 1000 + 50);

  ambientMaster = null;
  noiseSource = null;
  windFilter = null;
  filterLFO = null;
  ampLFO = null;
  windGain = null;
}
