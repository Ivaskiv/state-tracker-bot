// ========================================
// src/utils/formatters.js
// ========================================
import logger from './logger.js';

export const formatPhoneDisplay = (phone) => {
  if (!phone) return 'невказано';
  const cleaned = String(phone).replace(/\D/g, '');
  return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 5)}) ${cleaned.slice(5, 8)}-${cleaned.slice(8)}`;
};

export const formatProgressBar = (percent, length = 10) => {
  const filled = Math.floor((percent / 100) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
};

export const formatTimeDuration = (milliseconds) => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}г ${minutes % 60}м`;
  if (minutes > 0) return `${minutes}м ${seconds % 60}с`;
  return `${seconds}с`;
};

export const truncateText = (text, maxLength = 100) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

export const formatCurrency = (amount, currency = '€') => {
  return `${amount.toFixed(2)}${currency}`;
};

export const highlightText = (text, highlight) => {
  if (!highlight) return text;
  const regex = new RegExp(`(${highlight})`, 'gi');
  return text.replace(regex, '**$1**');
};

console.log('✅ [utils/formatters] Завантажено');
