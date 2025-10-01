// src/utils/typing.js
export const typing = async (ctx, delay = 800) => {
  try {
    if (ctx && ctx.telegram && ctx.from) {
      await ctx.telegram.sendChatAction(ctx.from.id, 'typing');
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  } catch (error) {
    // Ігноруємо помилки typing анімації
  }
};

// ===== MIDDLEWARE TYPING (для автоматичного виклику) =====
export const typingMiddleware = () => {
  return async (ctx, next) => {
    // Пропускаємо для callback_query
    if (ctx.updateType === 'callback_query') {
      return next();
    }
    
    try {
      // Показуємо typing тільки для текстових повідомлень
      if (ctx.chat && ctx.chat.id) {
        await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
        
        // Коротка затримка для middleware (щоб не сповільнювати)
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    } catch (error) {
      // Ігноруємо помилки typing
    }
    
    return next();
  };
};

export default typing;