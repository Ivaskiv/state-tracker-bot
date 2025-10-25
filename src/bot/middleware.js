import { typingMiddleware } from '../utils/typing.js';
import { isSpam } from '../utils/antiSpam.js';
import { logError } from '../utils/errorHandler.js';
import keyboards from '../utils/keyboards.js';
import logger from '../utils/logger.js';

const safeMainMenu = () => {
  try {
    return keyboards?.mainMenuKeyboard?.() || undefined;
  } catch (e) {
    logger.warn('[middleware] Помилка завантаження меню:', e.message);
    return undefined;
  }
};

const typingMw = typingMiddleware?.() || (async (_ctx, next) => next());

export const initMiddleware = () => {
  return async (ctx, next) => {
    const type = ctx.updateType;
    const userId = ctx.from?.id;
    const username = ctx.from?.username || ctx.from?.first_name || 'Unknown';
    const timestamp = new Date().toISOString();

    if (type === 'callback_query') {
      const data = ctx.callbackQuery?.data;
      logger.info(`[${type}] від ${userId} (@${username}) | callback: "${data}"`);
    } else if (type === 'message') {
      const text = ctx.message?.text?.slice(0, 100) || '[не текст]';
      logger.info(`[${type}] від ${userId} (@${username}) | text: "${text}"`);
    } else {
      logger.info(`[${type}] від ${userId} (@${username})`);
    }

    try {
      if (type === 'message' && ctx.message?.text) {
        try {
          await typingMw(ctx, async () => {});
        } catch (typingError) {
          logger.warn('[middleware] Помилка при показанні typing:', typingError.message);
        }
      }

      await next();
      logger.debug(`[${type}] успішно оброблено для ${userId}`);
    } catch (error) {
      const errorContext = {
        userId,
        updateType: type,
        username,
        timestamp,
        data: type === 'callback_query'
          ? ctx.callbackQuery?.data
          : ctx.message?.text?.slice(0, 100),
      };

      logError(error, errorContext);

      try {
        if (ctx.callbackQuery) {
          try {
            await ctx.answerCbQuery('❌ Сталася помилка');
          } catch (cbError) {
            logger.warn('[middleware] Помилка answerCbQuery:', cbError.message);
          }
        }

        if (ctx.chat?.id) {
          await ctx.reply(
            '❌ Виникла помилка. Спробуй ще раз або натисни /start',
            safeMainMenu()
          );
        }
      } catch (replyError) {
        logger.error('[middleware] Не вдалося відправити помилку користувачу', {
          userId,
          originalError: error.message,
          replyError: replyError.message,
        });
      }
    }
  };
};

export const performanceMiddleware = (thresholdMs = 2000) => {
  return async (ctx, next) => {
    const userId = ctx.from?.id;
    const type = ctx.updateType;
    const t0 = Date.now();

    try {
      await next();
    } finally {
      const executionTime = Date.now() - t0;

      if (executionTime > thresholdMs) {
        logger.warn(`[performance] Повільна операція`, {
          updateType: type,
          userId,
          executionTimeMs: executionTime,
          threshold: thresholdMs,
        });
      }
      if (executionTime > 500) {
        logger.debug(`[performance] ${type} для ${userId} займав ${executionTime}ms`);
      }
    }
  };
};

export const antiSpamMiddleware = () => {
  return async (ctx, next) => {
    const userId = ctx.from?.id;
    const data = ctx.callbackQuery?.data;
    const type = ctx.updateType;

    if (type !== 'callback_query' || !userId || !data) {
      return next();
    }

    if (isSpam(userId, data)) {
      logger.warn(`[antiSpam] Заблокована спама`, {
        userId,
        callback: data,
        timestamp: new Date().toISOString(),
      });

      try {
        await ctx.answerCbQuery('⏳ Зачекай трохи, не спішіш');
      } catch (cbError) {
        logger.warn('[antiSpam] Помилка answerCbQuery:', cbError.message);
      }
      return;
    }

    await next();
  };
};

export default {
  initMiddleware,
  performanceMiddleware,
  antiSpamMiddleware,
};
