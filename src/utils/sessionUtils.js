// src/utils/sessionUtils.js
import { ANSWER_STEPS } from '../config/constants.js';
import userService from '../auth/services/userService.js';
import logger from './logger.js';

export const completeSession = async (tgId, ctx, message) => {
  try {
    await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
    logger.info(`✅ [sessionUtils] Сесію завершено для ${tgId}`);
    if (message && ctx) {
      await ctx.reply(message);
    }
  } catch (error) {
    logger.error('❌ [sessionUtils] Помилка завершення сесії:', {
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
};