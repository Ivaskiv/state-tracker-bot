// src/tilda/utils.js

import logger from '../utils/logger.js';

export const formatAccessLevel = (level) => {
  const map = {
    free: '🎁 Безкоштовний',
    trial: '🧪 Пробний',
    paid: '⭐ Повний',
    expired: '⏰ Закінчився'
  };
  return map[level] || level;
};

export const getAccessLevelEmoji = (level) => {
  const map = {
    free: '🎁',
    trial: '🧪',
    paid: '⭐',
    expired: '⏰'
  };
  return map[level] || '❓';
};

console.log('✅ [Tilda Utils] Завантажено');
