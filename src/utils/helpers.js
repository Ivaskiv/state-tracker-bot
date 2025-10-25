// src/utils/helpers.js

// ===============================================================
// 🧮 HELPERS (загальні утиліти для форматів, дат і текстів)
// ===============================================================

/**
 * Отримати поточну дату в форматі ISO (YYYY-MM-DD)
 */
export const todayISO = () => new Date().toISOString().split('T')[0];

/**
 * Форматувати дату в український формат (DD.MM.YYYY)
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
 * Форматувати дату в український формат з назвою місяця
 * @param {Date|string} date - дата
 * @returns {string} формат: "15 липня 2025"
 */
export const formatDateLocale = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('uk-UA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Отримати правильне слово для днів (день, дні, днів)
 * ✅ Враховує числа 11-19
 * @param {number} days - кількість днів
 * @returns {string} відмінок слова
 */
export const getDaysWord = (days) => {
  const mod10 = days % 10;
  const mod100 = days % 100;
  
  // Особливі випадки: 11-19 завжди "днів"
  if (mod100 >= 11 && mod100 <= 19) return 'днів';
  
  // 1, 21, 31, 41... → "день"
  if (mod10 === 1) return 'день';
  
  // 2-4, 22-24, 32-34... → "дні"
  if (mod10 >= 2 && mod10 <= 4) return 'дні';
  
  // 0, 5-9, 20, 25-30... → "днів"
  return 'днів';
};

/**
 * Обчислити кількість днів між двома датами
 * @param {Date|string} date1 - перша дата
 * @param {Date|string} date2 - друга дата
 * @returns {number} кількість днів
 */
export const daysBetween = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Перевірити, чи дата була N днів тому
 * @param {Date|string} date - дата для перевірки
 * @param {number} days - кількість днів (за замовченням 30)
 * @returns {boolean} true якщо дата була більше N днів тому
 */
export const daysAgo = (date, days = 30) => {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  return diff >= days;
};

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

export const getNextWheelDate = (lastWheelDate) => {
  if (!lastWheelDate) return null;
  const date = new Date(lastWheelDate);
  date.setDate(date.getDate() + 30);
  return date.toISOString().split('T')[0];
};

console.log('✅ [utils/helpers] Завантажено хелпери');