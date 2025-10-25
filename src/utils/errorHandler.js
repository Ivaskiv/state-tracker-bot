import logger from './logger.js';
import keyboards from './keyboards.js';

export const ERROR_TYPES = {
  VALIDATION: 'VALIDATION_ERROR',
  DATABASE: 'DATABASE_ERROR',
  API: 'API_ERROR',
  TELEGRAM: 'TELEGRAM_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR',
  TIMEOUT: 'TIMEOUT_ERROR',
  PERMISSION: 'PERMISSION_ERROR',
};

const classifyError = (error) => {
  const msg = (error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();

  if (msg.includes('validation') || msg.includes('invalid')) return ERROR_TYPES.VALIDATION;
  if (msg.includes('database') || msg.includes('airtable') || code === 'enotfound') return ERROR_TYPES.DATABASE;
  if (msg.includes('timeout') || code === 'etimedout') return ERROR_TYPES.TIMEOUT;
  if (msg.includes('telegram') || msg.includes('429')) return ERROR_TYPES.TELEGRAM;
  if (msg.includes('permission') || msg.includes('forbidden')) return ERROR_TYPES.PERMISSION;
  if (msg.includes('api') || code === 'api_error') return ERROR_TYPES.API;
  return ERROR_TYPES.UNKNOWN;
};

export const formatError = (error, context = {}) => {
  const type = classifyError(error);
  return {
    type,
    timestamp: new Date().toISOString(),
    message: error?.message || 'Unknown error',
    stack: error?.stack?.split('\n')[0],
    context: {
      userId: context.userId,
      action: context.action,
      data: context.data,
      ...context,
    },
  };
};

export const logError = (error, context = {}) => {
  const formatted = formatError(error, context);
  logger.error(`[${formatted.type}] ${formatted.message}`, {
    action: formatted.context.action,
    userId: formatted.context.userId,
    stack: formatted.stack,
  });
  return formatted;
};

export const getUserMessage = (error) => {
  const type = classifyError(error);
  const messages = {
    [ERROR_TYPES.VALIDATION]: '❌ Невірні дані. Спробуй ще раз.',
    [ERROR_TYPES.DATABASE]: '⚠️ Помилка бази даних. Спробуй пізніше.',
    [ERROR_TYPES.API]: '⚠️ Помилка сервісу. Спробуй пізніше.',
    [ERROR_TYPES.TELEGRAM]: '⚠️ Помилка Telegram. Спробуй пізніше.',
    [ERROR_TYPES.TIMEOUT]: '⏱️ Запит займає надто довго. Спробуй ще раз.',
    [ERROR_TYPES.PERMISSION]: '🚫 У тебе немає доступу.',
    [ERROR_TYPES.UNKNOWN]: '❌ Сталася помилка. Спробуй ще раз.',
  };
  return messages[type] || messages[ERROR_TYPES.UNKNOWN];
};

export const sendErrorToUser = async (ctx, error, context = {}) => {
  try {
    logError(error, { ...context, userId: ctx.from?.id });
    const userMessage = getUserMessage(error);

    if (ctx.reply) {
      await ctx.reply(userMessage, keyboards.mainMenuKeyboard());
    } else if (ctx.telegram?.sendMessage) {
      await ctx.telegram.sendMessage(ctx.chat?.id, userMessage, keyboards.mainMenuKeyboard());
    }

    if (ctx.answerCbQuery) {
      await ctx.answerCbQuery('❌ Помилка');
    }
  } catch (replyError) {
    logger.error('[errorHandler] Не вдалося відправити помилку користувачу:', {
      originalError: error?.message,
      replyError: replyError?.message,
    });
  }
};

export const retryAsync = async (fn, options = {}) => {
  const { maxAttempts = 3, delayMs = 1000, backoff = 2 } = options;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        const delay = delayMs * Math.pow(backoff, attempt - 1);
        logger.warn(`[retry] Спроба ${attempt}/${maxAttempts} не вдалась. Чекаємо ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
};

export default {
  ERROR_TYPES,
  formatError,
  logError,
  getUserMessage,
  sendErrorToUser,
  retryAsync,
};
