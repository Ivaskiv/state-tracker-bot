// src/utils/timezoneUtils.js
import { TIMEZONE_CONFIG } from '../config/constants.js';

export const getUserTimezone = (tgId) => {
  // Повертаємо timezone користувача або дефолтний
  return TIMEZONE_CONFIG.USER_TIMEZONES[tgId] || TIMEZONE_CONFIG.DEFAULT;
};

export const getCurrentTimeForUser = (tgId) => {
  const timezone = getUserTimezone(tgId);
  return new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
};

export const formatDateForUser = (date, tgId, format = 'YYYY-MM-DD HH:mm:ss') => {
  const timezone = getUserTimezone(tgId);
  return new Date(date).toLocaleString('uk-UA', { timeZone: timezone });
};

export const getUserDateString = (tgId) => {
  const timezone = getUserTimezone(tgId);
  const date = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  console.log(`[timezoneUtils] getUserDateString для ${tgId}: ${dateStr} (timezone: ${timezone})`);
  return dateStr;
};

export const getUserDateTime = (tgId) => {
  const timezone = getUserTimezone(tgId);
  const date = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
  console.log(`[timezoneUtils] getUserDateTime для ${tgId}: ${date.toLocaleString('uk-UA')} (timezone: ${timezone})`);
  return date;
};

// Допоміжні функції для дебагу
export const logTimezoneInfo = (tgId) => {
  const timezone = getUserTimezone(tgId);
  const userTime = getUserDateTime(tgId);
  const dateStr = getUserDateString(tgId);
  
  console.log(`[timezoneUtils] 🕐 Інформація про час для користувача ${tgId}:`);
  console.log(`- Часова зона: ${timezone}`);
  console.log(`- Поточний час: ${userTime.toLocaleString('uk-UA')}`);
  console.log(`- Дата (YYYY-MM-DD): ${dateStr}`);
  console.log(`- Година: ${userTime.getHours()}:${userTime.getMinutes().toString().padStart(2, '0')}`);
};

// Перевірка чи поточний час в межах певного вікна
export const isTimeInWindow = (tgId, startHour, endHour) => {
  const userTime = getUserDateTime(tgId);
  const currentHour = userTime.getHours();
  
  if (startHour <= endHour) {
    // Звичайне вікно (наприклад 7-20)
    return currentHour >= startHour && currentHour < endHour;
  } else {
    // Вікно через опівночі (наприклад 20-7)
    return currentHour >= startHour || currentHour < endHour;
  }
};