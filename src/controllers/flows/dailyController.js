// src/controllers/flows/dailyController.js

import dailySessions from '../../services/dailySessions/index.js';
import userService from '../../services/userService.js';
// import keyboards from '../../utils/keyboards.js';
import logger from '../../utils/logger.js';

// ✅ RETRY HELPER
const withRetry = async (fn, maxAttempts = 3, delayMs = 1000) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      logger.warn(`⚠️ Спроба ${attempt}/${maxAttempts} не вдалася, retry...`);
      await new Promise(r => setTimeout(r, delayMs * attempt));
    }
  }
};

// ✅ ОБРОБКА ТЕКСТОВИХ ВІДПОВІДЕЙ
export const handleText = async (ctx, rawText, userStep) => {
  const { tgId, sessionType, questionNumber } = userStep;
  
  logger.info(`📝 [dailyController] Текст від ${tgId}: ${sessionType} Q${questionNumber}`);
  
  try {
    // ✅ RETRY ДЛЯ ЗБЕРЕЖЕННЯ
    const result = await withRetry(async () => {
      if (sessionType === 'morning') {
        return await dailySessions.handleMorningAnswer(ctx, rawText, questionNumber);
      } else if (sessionType === 'evening') {
        return await dailySessions.handleEveningAnswer(ctx, rawText, questionNumber);
      }
      throw new Error('Unknown session type');
    }, 3, 1500);
    
    logger.info(`✅ [dailyController] Відповідь збережено`);
    return result;
    
  } catch (error) {
    logger.error(`❌ [dailyController] Критична помилка після 3 спроб:`, error);
    
    // ✅ FALLBACK - дозволяємо продовжити
    await ctx.reply(
      `❌ Помилка збереження відповіді.\n\n` +
      `Твоя відповідь: "${rawText.substring(0, 50)}..."\n\n` +
      `Що робимо?`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Спробувати ще раз', callback_data: `retry_${sessionType}_${questionNumber}` }],
            [{ text: '⏭️ Пропустити питання', callback_data: `skip_${sessionType}_${questionNumber}` }],
            [{ text: '🚪 Вийти з сесії', callback_data: 'exit_session' }]
          ]
        }
      }
    );
    
    return { error: true };
  }
};

// ✅ СТАРТ СЕСІЙ
export const startMorningSession = async (ctx) => {
  try {
    await dailySessions.startMorningSession(ctx);
  } catch (error) {
    logger.error('❌ [dailyController] startMorning:', error);
    await ctx.reply('❌ Помилка запуску. Спробуй /start', keyboards.mainMenuKeyboard());
  }
};

export const startEveningSession = async (ctx) => {
  try {
    await dailySessions.startEveningSession(ctx);
  } catch (error) {
    logger.error('❌ [dailyController] startEvening:', error);
    await ctx.reply('❌ Помилка запуску. Спробуй /start', keyboards.mainMenuKeyboard());
  }
};

// ✅ ОБРОБКА CALLBACK
export const handleCallback = async (ctx, data) => {
  const tgId = ctx.from.id;
  
  // Retry
  if (data.startsWith('retry_')) {
    const [, sessionType, questionNumber] = data.split('_');
    await ctx.reply(
      `🔄 Спробуємо ще раз.\n\nНапиши відповідь на питання ${questionNumber}:`,
      keyboards.buildExitKeyboard()
    );
    return;
  }
  
  // Skip
  if (data.startsWith('skip_')) {
    const [, sessionType, questionNumber] = data.split('_');
    const nextQ = parseInt(questionNumber) + 1;
    
    await ctx.reply(`⏭️ Питання пропущено. Переходимо далі...`);
    
    // Наступне питання
    const formatter = dailySessions.formatQuestionMessage;
    const nextQuestion = formatter(sessionType, nextQ - 1);
    
    if (nextQuestion) {
      await userService.updateUserFields(tgId, { Answer_Step: nextQuestion.field });
      await ctx.reply(nextQuestion.text, keyboards.buildExitKeyboard());
    }
    return;
  }
  
  // Exit
  if (data === 'exit_session') {
    await userService.updateUserFields(tgId, { Answer_Step: 'completed' });
    await ctx.reply('🚪 Сесію завершено.', keyboards.mainMenuKeyboard());
    return;
  }
};

export default {
  handleText,
  startMorningSession,
  startEveningSession,
  handleCallback
};