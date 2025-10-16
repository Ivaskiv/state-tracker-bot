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

/**
 * Додати дні до дати
 * @param {Date|string} date - початкова дата
 * @param {number} days - кількість днів для додання
 * @returns {Date} нова дата
 */
export const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

/**
 * Конвертувати дату у формат ISO (YYYY-MM-DD)
 * @param {Date|string} date - дата
 * @returns {string} ISO формат без часу
 */
export const toISODate = (date) => {
  if (typeof date === 'string') return date.split('T')[0];
  return new Date(date).toISOString().split('T')[0];
};

/**
 * Отримати DateTime без секунд (для Airtable)
 * @returns {string} ISO формат без секунд
 */
export const getDateTimeWithoutSeconds = () => {
  const now = new Date();
  now.setSeconds(0, 0);
  return now.toISOString();
};

console.log('✅ [utils/helpers] Завантажено хелпери');

console.log('✅ [utils/helpers] Завантажено хелпери');
