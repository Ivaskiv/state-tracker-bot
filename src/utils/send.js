// src/utils/send.js
export const send = async (ctx, text, keyboard = null, options = {}) => {
  const isCallback = !!ctx.callbackQuery;
  const replyPayload = { ...(keyboard || {}) };
  if (options.parse_mode) replyPayload.parse_mode = options.parse_mode;

  try {
    if (isCallback) {
      // відповісти на callback (щоб зняти спінер)
      try { await ctx.answerCbQuery(); } catch (e) { /* ignore */ }

      // спробуємо редагувати існуюче повідомлення
      try {
        await ctx.editMessageText(text, replyPayload);
        return { method: 'edit' };
      } catch (err) {
        // якщо не вдалось — fallback у reply
        if (options.allow_edit_fallback) {
          await ctx.reply(text, replyPayload);
          return { method: 'reply_fallback' };
        }
        throw err;
      }
    } else {
      // звичайний текст — звичайний reply
      await ctx.reply(text, replyPayload);
      return { method: 'reply' };
    }
  } catch (error) {
    // останній варіант: просто reply без клавіатури
    try {
      await ctx.reply(text);
      return { method: 'reply_plain' };
    } catch (e) {
      console.error('[send] Fatal send error:', e);
      throw e;
    }
  }
};

export default { send };
