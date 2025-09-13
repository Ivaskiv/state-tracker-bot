// src/utils/errorHandler.js - ВИПРАВЛЕНО
import keyboards from './keyboards.js';

export const handleError = async (ctx, error, defaultMessage = 'Виникла помилка. Спробуйте ще раз.') => {
  console.error('[ERROR]', error);
  await ctx.reply(defaultMessage, keyboards.mainMenuKeyboard());
};