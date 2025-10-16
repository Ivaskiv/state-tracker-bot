// src/bot/middleware.js
// Middleware: логування, typing, антиспам, performance

import { typingMiddleware } from '../utils/typing.js';
import { isSpam } from '../utils/antiSpam.js';
import keyboards from '../utils/keyboards.js';

const safeMainMenu = () => {
  try { return keyboards?.mainMenuKeyboard?.() || undefined; }
  catch { return undefined; }
};

// ініціалізуємо один раз, а не на кожен апдейт
const typingMw = typingMiddleware?.() || (async (ctx, next) => next());

/**
 * Основний middleware: логи + typing + safe error
 */
export const initMiddleware = () => {
  return async (ctx, next) => {
    const type = ctx.updateType;
    const from = ctx.from?.id;
    const username = ctx.from?.username || ctx.from?.first_name || 'Unknown';

    // Логування
    if (type === 'callback_query') {
      console.log(`➡️ [bot] ${type} від ${from} (@${username}) | data: "${ctx.callbackQuery?.data}"`);
    } else if (type === 'message') {
      const text = ctx.message?.text?.slice(0, 80) || '[не текст]';
      console.log(`➡️ [bot] ${type} від ${from} (@${username}) | text: "${text}"`);
    } else {
      console.log(`➡️ [bot] ${type} від ${from} (@${username})`);
    }

    try {
      // Typing тільки для текстових повідомлень
      if (type === 'message' && ctx.message?.text) {
        await typingMw(ctx, async () => {});
      }
      await next();

    } catch (error) {
      console.error('💥 [middleware] Помилка:', {
        msg: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n'),
        user: from,
        type,
        data: type === 'callback_query'
          ? ctx.callbackQuery?.data
          : ctx.message?.text?.slice(0, 80)
      });

      // Відповідь користувачу (safe)
      try {
        if (ctx.callbackQuery) {
          try { await ctx.answerCbQuery('❌ Сталася помилка'); } catch {}
        }
        if (ctx.chat?.id) {
          await ctx.reply('❌ Виникла помилка. Спробуй ще раз або натисни /start', safeMainMenu());
        }
      } catch (replyError) {
        console.error('💥 [middleware] Не вдалося відправити помилку користувачу:', replyError.message);
      }
    }
  };
};

/**
 * Performance middleware: лог повільних апдейтів
 */
export const performanceMiddleware = (thresholdMs = 2000) => {
  return async (ctx, next) => {
    const t0 = Date.now();
    let err;
    try {
      await next();
    } catch (e) {
      err = e;
      throw e;
    } finally {
      const dt = Date.now() - t0;
      if (dt > thresholdMs) {
        console.warn(`⚠️ [perf] Повільний ${ctx.updateType} від ${ctx.from?.id}: ${dt}ms`);
      }
    }
  };
};

/**
 * Anti-spam тільки для callback_query
 */
export const antiSpamMiddleware = () => {
  return async (ctx, next) => {
    const userId = ctx.from?.id;
    const data = ctx.callbackQuery?.data;

    if (!userId || !data) return next();

    if (isSpam(userId, data)) {
      console.warn(`🚫 [antiSpam] Блок від ${userId} | "${data}"`);
      try { await ctx.answerCbQuery('⏳ Зачекай трохи'); } catch {}
      return;
    }
    await next();
  };
};

console.log('✅ [bot/middleware] Middleware завантажено');
