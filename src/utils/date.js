// src/utils/date.js

/**
 * Отримати поточну дату в форматі ISO (YYYY-MM-DD)
 */
export const todayISO = () => new Date().toISOString().split('T')[0];

/**
 * Форматувати дату в український формат
 */
export const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('uk-UA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Отримати правильне слово для днів (день, дні, днів)
 */
export const getDaysWord = (days) => {
  if (days % 10 === 1 && days % 100 !== 11) return 'день';
  if (days % 10 >= 2 && days % 10 <= 4 && (days % 100 < 10 || days % 100 >= 20)) return 'дні';
  return 'днів';
};

/**
 * Обчислити кількість днів між двома датами
 */
export const daysBetween = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Перевірити, чи дата була N днів тому
 */
export const daysAgo = (date, days = 30) => {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  return diff >= days;
};

console.log('✅ [utils/date] Утиліти завантажені');