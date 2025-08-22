// src/utils/dateHelpers.js
import moment from 'moment-timezone';
export const formatDate = (date, tz = 'Europe/Kiev') => moment.tz(date, tz).format('DD.MM.YYYY');
export const todayISO = (tz = 'Europe/Kiev') => moment.tz(tz).format('YYYY-MM-DD');
export const nowTz = (tz = 'Europe/Kiev') => moment.tz(tz);
