// src/utils/errorHandler.js - ВИПРАВЛЕНО
import keyboards from './keyboards.js';

export const handleError = async (ctx, error, defaultMessage = 'Виникла помилка. Спробуйте ще раз.') => {
  console.error('[ERROR]', error);
  
  try {
    await ctx.reply(defaultMessage, keyboards.mainMenuKeyboard());
  } catch (replyError) {
    console.error('[ERROR] Не вдалося надіслати повідомлення про помилку:', replyError);
  }
};