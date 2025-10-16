// src/utils/typing.js
// Легкий typing без штучних затримок і промісів

export const typing = async (ctx, _delay = 0) => {
  try {
    if (ctx?.sendChatAction) {
      await ctx.sendChatAction('typing');
    } else if (ctx?.telegram && ctx?.chat?.id) {
      await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
    }
  } catch (error) {
    // ігноруємо помилки typing, але логуємо для дебагу
    console.warn('⚠️ [typing] Не вдалося показати typing:', error?.message || error);
  }
};

// ===== MIDDLEWARE TYPING (для автоматичного виклику) =====
export const typingMiddleware = () => {
  return async (ctx, next) => {
    // пропускаємо callback_query, щоб не спамити action
    if (ctx.updateType === 'callback_query') return next();

    try {
      if (ctx?.sendChatAction) {
        await ctx.sendChatAction('typing');
      } else if (ctx?.telegram && ctx?.chat?.id) {
        await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
      }
    } catch (error) {
      // ігноруємо помилки typing, але пишемо в консоль
      console.warn('⚠️ [typingMiddleware] sendChatAction error:', error?.message || error);
    }

    return next();
  };
};

export default typing;
