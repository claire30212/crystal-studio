// localStorage 狀態管理 — 重新開始提醒計數、靜音偏好

const RESTART_COUNT_KEY = "restartPromptCount";
const MUTE_KEY = "audioMuted";

export function getRestartPromptCount() {
  const raw = localStorage.getItem(RESTART_COUNT_KEY);
  return raw ? parseInt(raw, 10) || 0 : 0;
}

export function incrementRestartPromptCount() {
  const next = getRestartPromptCount() + 1;
  localStorage.setItem(RESTART_COUNT_KEY, String(next));
  return next;
}

export function isAudioMuted() {
  return localStorage.getItem(MUTE_KEY) === "1";
}

export function setAudioMuted(muted) {
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}
