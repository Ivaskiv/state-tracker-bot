// src/utils/timezoneUtils.js
import moment from 'moment-timezone';
import { TIMEZONE_CONFIG } from '../config/constants.js';

export const getUserTimezone = (tgId) => {
  // Повертаємо timezone користувача або дефолтний
  return TIMEZONE_CONFIG.USER_TIMEZONES[tgId] || TIMEZONE_CONFIG.DEFAULT;
};

export const getCurrentTimeForUser = (tgId) => {
  const userTimezone = getUserTimezone(tgId);
  return moment.tz(userTimezone);
};

export const formatDateForUser = (date, tgId, format = 'YYYY-MM-DD HH:mm:ss') => {
  const userTimezone = getUserTimezone(tgId);
  return moment.tz(date, userTimezone).format(format);
};

export const getUserDateString = (tgId) => {
  const timezone = TIMEZONE_CONFIG.USER_TIMEZONES[tgId] || TIMEZONE_CONFIG.DEFAULT;
  return new Date().toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD
};

// export const getUserDateTime = (tgId) => {
//   const userTimezone = getUserTimezone(tgId);
//   return moment.tz(userTimezone).toISOString();
// };
export const getUserDateTime = (tgId) => {
  const timezone = TIMEZONE_CONFIG.USER_TIMEZONES[tgId] || TIMEZONE_CONFIG.DEFAULT;
  return new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
};