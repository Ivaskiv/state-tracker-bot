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

// ВИПРАВИТИ експорт:
export default typing;