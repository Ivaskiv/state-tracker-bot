// src/utils/antiSpam.js

import { CONFIG } from '../config/constants.js';

const callbackCache = new Map();

export const isSpam = (userId, callbackData) => {
  const key = `${userId}:${callbackData}`;
  const now = Date.now();
  
  if (callbackCache.has(key)) {
    const lastCall = callbackCache.get(key);
    if (now - lastCall < CONFIG.ANTI_SPAM_TTL_MS) {
      return true;
    }
  }
  
  callbackCache.set(key, now);
  
  // Очищення старих записів
  setTimeout(() => {
    callbackCache.delete(key);
  }, CONFIG.ANTI_SPAM_TTL_MS);
  
  return false;
};

export default { isSpam };