// utils/helpers.js
import moment from 'moment-timezone';

export function createInlineKeyboard(buttons) {
  return {
    inline_keyboard: buttons
  };
}

export function formatDate(date, format = 'DD.MM.YYYY') {
  return moment(date).format(format);
}

export function formatDateTime(date, format = 'DD.MM.YYYY HH:mm') {
  return moment(date).format(format);
}

export function addDays(date, days) {
  return moment(date).add(days, 'days').toDate();
}

export function isDateExpired(date) {
  return moment().isAfter(moment(date));
}

export function getDaysUntil(date) {
  const diff = moment(date).diff(moment(), 'days');
  return diff > 0 ? diff : 0;
}

export function getTimeZoneOffset(timezone = 'Europe/Kiev') {
  return moment().tz(timezone).format('Z');
}

export function validatePhoneNumber(phone) {
  // Видаляємо всі пробіли та спецсимволи крім +
  const cleanPhone = phone.replace(/[\s()-]/g, '');
  
  // Перевіряємо формат
  const phoneRegex = /^\+?[1-9]\d{8,14}$/;
  return phoneRegex.test(cleanPhone);
}

export function validateEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

export function validateName(name) {
  return name && name.length >= 2 && name.length <= 50 && /^[a-zA-Zа-яА-ЯіІїЇєЄ\s]+$/.test(name);
}

export function sanitizeString(str) {
  if (!str) return '';
  return str.trim().replace(/[<>]/g, '');
}

export function truncateString(str, maxLength = 100) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

export function generateReminderKey(userName, telegramId, date, questionType) {
  const dateStr = moment(date).format('DDMMYYYY');
  return `${userName}_${telegramId}_${dateStr}_${questionType}`;
}

export function parseSubscriptionPlan(planName) {
  const plans = {
    'Тиждень фокусу': { duration: 7, price: 7 },
    'Місяць дії': { duration: 30, price: 30 },
    'Рік трансформації': { duration: 365, price: 300 }
  };
  
  return plans[planName] || { duration: 0, price: 0 };
}

export function getWeekDay(date, locale = 'uk') {
  const weekDays = {
    uk: ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота']
  };
  
  const dayIndex = moment(date).day();
  return weekDays[locale][dayIndex] || moment(date).format('dddd');
}

export function createProgressBar(current, total, length = 10) {
  const progress = Math.round((current / total) * length);
  const bar = '█'.repeat(progress) + '░'.repeat(length - progress);
  const percentage = Math.round((current / total) * 100);
  
  return `${bar} ${percentage}%`;
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export function countWordFrequency(texts) {
  const frequency = {};
  
  texts.forEach(text => {
    if (text) {
      const words = text.toLowerCase().split(/\s+/);
      words.forEach(word => {
        // Ігноруємо короткі слова та стоп-слова
        if (word.length > 3 && !isStopWord(word)) {
          frequency[word] = (frequency[word] || 0) + 1;
        }
      });
    }
  });
  
  return frequency;
}

function isStopWord(word) {
  const stopWords = ['було', 'була', 'були', 'буду', 'будь', 'вона', 'воно', 'вони', 'його', 'іаніи', 'коли', 'куди', 'мене', 'мені', 'мною', 'може', 'можна', 'після', 'тому', 'тебе', 'тобі', 'того', 'цього', 'якщо', 'який', 'яких', 'якій'];
  return stopWords.includes(word.toLowerCase());
}

export function getMostFrequent(frequency, limit = 3) {
  return Object.entries(frequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, limit)
    .map(([word]) => word);
}

export function formatSubscriptionStatus(startDate, endDate) {
  const now = moment();
  const end = moment(endDate);
  
  if (end.isAfter(now)) {
    const daysLeft = end.diff(now, 'days');
    return `✅ Активна до ${end.format('DD.MM.YYYY')} (${daysLeft} днів)`;
  } else {
    return '❌ Підписка закінчилася';
  }
}

export function createKeyboard(buttons, options = {}) {
  return {
    reply_markup: {
      inline_keyboard: buttons,
      ...options
    }
  };
}

export function logError(error, context = '') {
  console.error(`[ERROR${context ? ' - ' + context : ''}]:`, error);
  
  // Тут можна додати відправку помилок в зовнішній сервіс
  // наприклад Sentry, LogRocket тощо
}

export function logInfo(message, data = null) {
  console.log(`[INFO]: ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

export function isValidTimeZone(timezone) {
  try {
    moment.tz.zone(timezone);
    return true;
  } catch (error) {
    return false;
  }
}