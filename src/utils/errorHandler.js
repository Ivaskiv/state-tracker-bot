// src/utils/errorHandler.js
export const handleError = async (ctx, error, defaultMessage = 'Виникла помилка. Спробуйте ще раз.') => {
  console.error('[ERROR]', error);
  await ctx.reply(defaultMessage, keyboards.mainMenuKeyboard());
};