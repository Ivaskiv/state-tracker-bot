// utils/dateHelpers.js
import moment from 'moment-timezone';

export const formatDate = (date, timezone = 'Europe/Kiev') => {
  return moment.tz(date, timezone).format('DD.MM.YYYY');
};

export const formatDateTime = (date, timezone = 'Europe/Kiev') => {
  return moment.tz(date, timezone).format('DD.MM.YYYY HH:mm');
};

export const formatTime = (date, timezone = 'Europe/Kiev') => {
  return moment.tz(date, timezone).format('HH:mm');
};

export const getToday = (timezone = 'Europe/Kiev') => {
  return moment.tz(timezone).format('YYYY-MM-DD');
};

export const getTodayDateTime = (timezone = 'Europe/Kiev') => {
  return moment.tz(timezone).toISOString();
};

export const addDays = (date, days) => {
  return moment(date).add(days, 'days').toISOString();
};

export const subtractDays = (date, days) => {
  return moment(date).subtract(days, 'days').toISOString();
};

export const isToday = (date, timezone = 'Europe/Kiev') => {
  const today = moment.tz(timezone).format('YYYY-MM-DD');
  const checkDate = moment.tz(date, timezone).format('YYYY-MM-DD');
  return today === checkDate;
};

export const isSameDay = (date1, date2, timezone = 'Europe/Kiev') => {
  const day1 = moment.tz(date1, timezone).format('YYYY-MM-DD');
  const day2 = moment.tz(date2, timezone).format('YYYY-MM-DD');
  return day1 === day2;
};

export const daysBetween = (date1, date2) => {
  return moment(date2).diff(moment(date1), 'days');
};

export const isWeekend = (date, timezone = 'Europe/Kiev') => {
  const day = moment.tz(date, timezone).day();
  return day === 0 || day === 6; // Sunday or Saturday
};

export const getWeekStart = (date, timezone = 'Europe/Kiev') => {
  return moment.tz(date, timezone).startOf('week').toISOString();
};

export const getWeekEnd = (date, timezone = 'Europe/Kiev') => {
  return moment.tz(date, timezone).endOf('week').toISOString();
};

export const getMonthStart = (date, timezone = 'Europe/Kiev') => {
  return moment.tz(date, timezone).startOf('month').toISOString();
};

export const getMonthEnd = (date, timezone = 'Europe/Kiev') => {
  return moment.tz(date, timezone).endOf('month').toISOString();
};

export const getWeekday = (date, timezone = 'Europe/Kiev', locale = 'uk') => {
  moment.locale(locale);
  return moment.tz(date, timezone).format('dddd');
};

export const getMonth = (date, timezone = 'Europe/Kiev', locale = 'uk') => {
  moment.locale(locale);
  return moment.tz(date, timezone).format('MMMM');
};

export const timeUntil = (date, timezone = 'Europe/Kiev') => {
  const now = moment.tz(timezone);
  const target = moment.tz(date, timezone);
  const duration = moment.duration(target.diff(now));
  
  if (duration.asHours() < 24) {
    return duration.humanize(true);
  } else {
    return duration.asDays() > 1 ? 
      `через ${Math.floor(duration.asDays())} днів` : 
      'завтра';
  }
};

export const createReminderKey = (userName, telegramId, date, questionType) => {
  const dateStr = moment(date).format('DDMMYYYY');
  return `${userName}_${telegramId}_${dateStr}_${questionType}`;
};

export const parseReminderKey = (key) => {
  const parts = key.split('_');
  if (parts.length < 4) return null;
  
  return {
    userName: parts[0],
    telegramId: parts[1],
    date: parts[2],
    questionType: parts[3]
  };
};

export const isValidDate = (date) => {
  return moment(date).isValid();
};

export const getTimezoneOffset = (timezone = 'Europe/Kiev') => {
  return moment.tz(timezone).utcOffset();
};

export const convertTimezone = (date, fromTz, toTz) => {
  return moment.tz(date, fromTz).tz(toTz).toISOString();
};

// Ukrainian locale setup
moment.updateLocale('uk', {
  months: [
    'січень', 'лютий', 'березень', 'квітень', 'травень', 'червень',
    'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'
  ],
  monthsShort: [
    'січ', 'лют', 'бер', 'квіт', 'трав', 'черв',
    'лип', 'серп', 'вер', 'жовт', 'лист', 'груд'
  ],
  weekdays: [
    'неділя', 'понеділок', 'вівторок', 'середа',
    'четвер', 'п\'ятниця', 'субота'
  ],
  weekdaysShort: ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'],
  weekdaysMin: ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
});