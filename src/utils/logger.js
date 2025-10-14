// src/utils/logger.js
// Простий logger для консолі

const logger = {
  info: (...args) => {
    console.log('[INFO]', ...args);
  },
  
  warn: (...args) => {
    console.warn('[WARN]', ...args);
  },
  
  error: (...args) => {
    console.error('[ERROR]', ...args);
  },
  
  debug: (...args) => {
    if (process.env.DEBUG === '1') {
      console.log('[DEBUG]', ...args);
    }
  }
};

export default logger;

console.log('✅ [utils/logger] Logger завантажено');