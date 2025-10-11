// src/bot/middleware.js
// Middleware для бота - логування, typing, антиспам, performance

import { typingMiddleware } from '../utils/typing.js';
import { isSpam } from '../utils/antiSpam.js';
import keyboards from '../utils/keyboards.js';

/**
 * Ініціалізація основного middleware
 * Включає: детальне логування, typing анімація, обробка помилок
 */
export const initMiddleware = () => {
  return async (ctx, next) => {
    const type = ctx.updateType;
    const from = ctx.from?.id;
    const username = ctx.from?.username || ctx.from?.first_name || 'Unknown';
    
    // Детальне логування
    if (type === 'callback_query') {
      const data = ctx.callbackQuery?.data;
      console.log(`➡️ [bot] ${type} від ${from} (@${username}) | data: "${data}"`);
    } else if (type === 'message') {
      const text = ctx.message?.text?.slice(0, 50) || '[не текст]';
      console.log(`➡️ [bot] ${type} від ${from} (@${username}) | text: "${text}"`);
    } else {
      console.log(`➡️ [bot] ${type} від ${from} (@${username})`);
    }
    
    try {
      // Typing анімація (тільки для текстових повідомлень)
      if (type === 'message' && ctx.message?.text) {
        await typingMiddleware()(ctx, () => {});
      }
      
      // Продовжуємо виконання
      await next();
      
    } catch (error) {
      console.error('💥 [middleware] Помилка:', {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n'),
        user: from,
        type: type,
        data: type === 'callback_query' ? ctx.callbackQuery?.data : ctx.message?.text?.slice(0, 50)
      });
      
      // Відправляємо повідомлення про помилку
      try {
        if (ctx.callbackQuery) {
          await ctx.answerCbQuery('❌ Виникла помилка');
        }
        
        await ctx.reply(
          '❌ Виникла помилка. Спробуй ще раз або натисни /start',
          keyboards.mainMenuKeyboard()
        );
      } catch (replyError) {
        console.error('💥 [middleware] Не вдалося відправити помилку користувачу:', replyError.message);
      }
    }
  };
};

/**
 * Middleware для логування часу виконання запитів
 * Використовуй для моніторингу performance
 */
export const performanceMiddleware = () => {
  return async (ctx, next) => {
    const start = Date.now();
    const type = ctx.updateType;
    const from = ctx.from?.id;
    
    try {
      await next();
      const duration = Date.now() - start;
      
      // Логуємо повільні запити (>2 секунди)
      if (duration > 2000) {
        console.warn(`⚠️ [performance] Повільний ${type} від ${from}: ${duration}ms`);
      }
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`❌ [performance] Помилка ${type} від ${from} після ${duration}ms:`, error.message);
      throw error;
    }
  };
};

/**
 * Middleware для блокування спаму callback кнопок
 * Використовує централізований src/utils/antiSpam.js
 */
export const antiSpamMiddleware = () => {
  return async (ctx, next) => {
    const userId = ctx.from?.id;
    const callbackData = ctx.callbackQuery?.data;

    // Перевіряємо тільки callback_query
    if (!userId || !callbackData) {
      return next();
    }

    // ✅ ВИКОРИСТОВУЄМО ЦЕНТРАЛІЗОВАНИЙ isSpam з utils/antiSpam.js
    if (isSpam(userId, callbackData)) {
      console.warn(`🚫 [antiSpam] Блокування спаму від ${userId} | callback: "${callbackData}"`);
      try {
        await ctx.answerCbQuery('⏳ Зачекай трохи');
      } catch {}
      return; // Не викликаємо next()
    }

    await next();
  };
};

console.log('✅ [bot/middleware] Middleware завантажено');