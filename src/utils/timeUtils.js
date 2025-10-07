// src/utils/timeUtils.js

/**
 * Форматує час в український формат HH:MM
 */
export function formatTime(date) {
  return date.toLocaleTimeString('uk-UA', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

/**
 * Генерує часовий слот для мікро-дії
 */
export function generateTimeSlot(baseTime, index, duration) {
  const startTime = new Date(baseTime);
  startTime.setMinutes(baseTime.getMinutes() + (index * 30) + 15);
  
  const endTime = new Date(startTime);
  endTime.setMinutes(startTime.getMinutes() + duration);
  
  return `${formatTime(startTime)}-${formatTime(endTime)}`;
}

/**
 * Отримує поточний час в українському форматі
 */
export function getCurrentTimeFormatted() {
  return new Date().toLocaleTimeString('uk-UA', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

/**
 * Отримує поточну дату в ISO форматі (YYYY-MM-DD)
 */
export function getTodayISO() {
  return new Date().toISOString().split('T')[0];
}