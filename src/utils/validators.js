// src/utils/validators.js
export const isSkip = (s) => {
  const v = String(s || '').trim().toLowerCase();
  return v === '⏭️ пропустити' || v === 'пропустити' || v === 'skip' || v === '⏭️';
};
export const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
export const isValidUaPhone = (s) => /^\+380\d{9}$/.test(String(s || '').trim());
