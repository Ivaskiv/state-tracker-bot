// Утиліти (дати, нормалізація, chunk) ✅
// src/services/dailySessions/utils.js

export const todayStr = () => new Date().toISOString().split('T')[0];

export const normalize = (s) => String(s || '').trim();

export const chunk = (arr, size = 10) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

export const getHoursSince = (timestampISO) => {
  try {
    const last = new Date(timestampISO);
    const now = new Date();
    return Math.floor((now - last) / (1000 * 60 * 60));
  } catch {
    return 0;
  }
};

export const getDaysDiff = (date1, date2) => {
  try {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
};