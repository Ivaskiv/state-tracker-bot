// src/utils/helpers.js

// ===============================================================
// 🧮 HELPERS (загальні утиліти для форматів, дат і текстів)
// ===============================================================

/**
 * Форматує дату у форматі DD.MM.YYYY
 * @param {string|Date} dateStr - вхідна дата або рядок
 * @returns {string} форматована дата або 'невідомо'
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return 'невідомо';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'невідомо';
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

/**
 * Повертає правильну форму слова "день/дні/днів"
 * @param {number} count - кількість днів
 * @returns {string} відмінок слова
 */
export const getDaysWord = (count) => {
  if (count === 1) return 'день';
  if (count >= 2 && count <= 4) return 'дні';
  return 'днів';
};

/**
 * Отримати сьогоднішню дату у форматі ISO (YYYY-MM-DD)
 */
export const todayISO = () => new Date().toISOString().split('T')[0];

console.log('✅ [utils/helpers] Завантажено хелпери');
