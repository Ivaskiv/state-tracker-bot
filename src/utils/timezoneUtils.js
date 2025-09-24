// // src/utils/timezoneUtils.js
// import { TIMEZONE_CONFIG } from '../config/constants.js';

// // ✅ ФІКСОВАНИЙ ЧАС ДЛЯ ВСІХ (08:00 та 20:30)
// export const getUserTimezone = (tgId) => {
//   // Завжди повертаємо Europe/Kyiv для консистентності
//   return 'Europe/Kyiv';
// };

// export const getUserDateString = (tgId) => {
//   const now = new Date();
//   return now.toISOString().split('T')[0]; // YYYY-MM-DD
// };

// export const getUserDateTime = (tgId) => {
//   return new Date(); // Поточний час сервера
// };

// export const isTimeInWindow = (tgId, startHour, endHour) => {
//   const now = new Date();
//   const currentHour = now.getHours();
  
//   if (startHour <= endHour) {
//     return currentHour >= startHour && currentHour < endHour;
//   } else {
//     return currentHour >= startHour || currentHour < endHour;
//   }
// };

// export default {
//   getUserTimezone,
//   getUserDateString, 
//   getUserDateTime,
//   isTimeInWindow
// };