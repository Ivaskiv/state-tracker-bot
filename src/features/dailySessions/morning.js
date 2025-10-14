// src/services/dailySessions/morning.js

import * as db from './database.js';
import * as formatter from './formatter.js';
import * as keyboards from './keyboards.js';
import * as helpers from './helpers.js';
import * as sync from './sync.js';
import * as shared from './shared.js';
import { ANSWER_STEPS, QUESTIONS } from '../../config/constants.js';
import logger from '../../utils/logger.js';
import users from '../../services/users.js';

export const startMorningSession = async (ctx) => {
  const tgId = ctx.from.id;
  logger.info(`🌞 [morning] Старт для ${tgId}`);
  
  try {
    const user = await users.getUserByTgId(tgId);
    
    // ✅ Перевірка відновлення
    const wasRecovered = await shared.checkAndCompleteSession(ctx, tgId, 'morning');
    if (wasRecovered) return;
    
    const todayRecord = await db.getTodayRecord(tgId);
    
    if (todayRecord?.fields?.Q_m_1) {
      await ctx.reply(
        formatter.formatRestartWarning('morning'),
        keyboards.buildRestartWarningKeyboard('morning')
      );
      return;
    }
    
    await db.ensureTodayRecord(tgId, user['User Name']);
    await users.updateUserFields(tgId, { Answer_Step: ANSWER_STEPS.MORNING_1 });
    await db.updateTodayRecord(tgId, { Current_Activity: ANSWER_STEPS.MORNING_1 });
    
    const questionData = formatter.formatQuestionMessage('morning', 0);
    await ctx.reply(questionData.text, keyboards.buildExitKeyboard());
    
    logger.info(`✅ [morning] Запущено для ${tgId}`);
    
  } catch (error) {
    logger.error('❌ [morning] startMorningSession:', error);
    await ctx.reply('❌ Помилка запуску. Спробуй /start');
    throw error;
  }
};

export const handleMorningAnswer = async (ctx, text, questionNumber) => {
  const tgId = ctx.from.id;
  logger.info(`🌞 [morning] Q${questionNumber} від ${tgId}`);
  
  try {
    const parsedFields = helpers.parseMorningAnswer(questionNumber, text);
    
    await db.updateTodayRecord(tgId, {
      [`Q_m_${questionNumber}`]: text,
      ...parsedFields
    });
    
    const totalQuestions = QUESTIONS.morning.length;
    
    if (questionNumber >= totalQuestions) {
      // ✅ ЗАВЕРШЕНО
      await db.updateTodayRecord(tgId, { Current_Activity: 'morning_completed' });
      await users.updateUserFields(tgId, { Answer_Step: ANSWER_STEPS.COMPLETED });
      
      try {
        await sync.syncMorningData(tgId);
      } catch (e) {
        logger.warn('⚠️ Sync:', e);
      }
      
      // ✅ Відкладений completion
      const delay = Math.floor(Math.random() * (3 - 1 + 1) + 1) * 60 * 1000;
      setTimeout(async () => {
        const record = await db.getTodayRecord(tgId);
        await shared.showCompletionWithAnalysis(ctx, tgId, 'morning', record?.fields);
      }, delay);
      
      logger.info(`✅ [morning] Завершено для ${tgId}`);
      return { completed: true };
    }
    
    // Наступне питання
    const nextQ = formatter.formatQuestionMessage('morning', questionNumber);
    await users.updateUserFields(tgId, { Answer_Step: nextQ.field });
    await db.updateTodayRecord(tgId, { Current_Activity: nextQ.field });
    await ctx.reply(nextQ.text, keyboards.buildExitKeyboard());
    
    return { completed: false };
    
  } catch (error) {
    logger.error('❌ [morning]:', error);
    throw error;
  }
};

export const restartMorningSession = async (ctx) => {
  await shared.restartSession(ctx, ctx.from.id, 'morning', startMorningSession);
};

export const exitMorningSession = async (ctx) => {
  await shared.exitSession(ctx, ctx.from.id, 'morning');
};

export const continueMorningSession = async (ctx) => {
  const tgId = ctx.from.id;
  logger.info(`▶️ [morning] Продовження для ${tgId}`);
  
  try {
    const user = await users.getUserByTgId(tgId);
    const currentStep = user?.Answer_Step;

    if (!currentStep || currentStep === ANSWER_STEPS.COMPLETED) {
      return startMorningSession(ctx);
    }

    const match = currentStep.match(/Q_m_(\d+)/i);
    const questionNum = match ? parseInt(match[1], 10) : 1;
    const questionData = formatter.formatQuestionMessage('morning', questionNum - 1);
    
    if (!questionData) return startMorningSession(ctx);

    await ctx.reply(questionData.text, keyboards.buildExitKeyboard());
    logger.info(`✅ [morning] Продовжено на Q${questionNum}`);
  } catch (error) {
    logger.error('❌ [morning] continue:', error);
    await ctx.reply('❌ Помилка. Почати заново?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌞 Так', callback_data: 'start_morning' }],
          [{ text: '🏠 Меню', callback_data: 'main_menu' }]
        ]
      }
    });
  }
};