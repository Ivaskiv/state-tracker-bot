// src/middleware/typingMiddleware.js
import typing from '../utils/typing.js';

/**
 * Глобальний middleware для автоматичного typing
 */
export const globalTypingMiddleware = () => {
  return async (ctx, next) => {
    // Показуємо typing тільки для текстових повідомлень та callback query
    if (ctx.message?.text || ctx.callbackQuery) {
      try {
        await typing(ctx);
      } catch (error) {
        console.error('[globalTypingMiddleware] Помилка typing:', error);
      }
    }
    
    // Продовжуємо обробку
    await next();
  };
};

/**
 * Wrapper функція для автоматичного typing перед виконанням handler'а
 */
export const withTyping = (handler) => {
  return async (ctx, ...args) => {
    try {
      await typing(ctx);
    } catch (error) {
      console.error('[withTyping] Помилка typing:', error);
    }
    
    return await handler(ctx, ...args);
  };
};

/**
 * Автоматичний typing wrapper для всіх методів об'єкта
 */
export const wrapWithTyping = (obj) => {
  const wrapped = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'function') {
      wrapped[key] = withTyping(value);
    } else {
      wrapped[key] = value;
    }
  }
  
  return wrapped;
};