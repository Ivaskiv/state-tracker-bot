// src/services/dailySessions/evening.js

import * as db from './database.js';
import * as formatter from './formatter.js';
import * as keyboards from './keyboards.js';
import * as helpers from './helpers.js';
import * as sync from './sync.js';
import * as shared from './shared.js';
import users from '../../services/users.js';
import logger from '../../utils/logger.js';
import { ANSWER_STEPS, QUESTIONS } from '../../config/constants.js';

export const startEveningSession = async (ctx) => {
  const tgId = ctx.from.id;
  logger.info(`🌙 [evening] Старт для ${tgId}`);
  
  try {
    const user = await users.getUserByTgId(tgId);
    
    // ✅ Перевірка відновлення
    const wasRecovered = await shared.checkAndCompleteSession(ctx, tgId, 'evening');
    if (wasRecovered) return;
    
    // Перевірка ранкових
    const isMorningDone = await db.isMorningCompleted(tgId);
    
    if (!isMorningDone) {
      await ctx.reply(
        formatter.formatEveningWithoutMorning(user['User Name']),
        keyboards.buildEveningWithoutMorningKeyboard()
      );
      return;
    }
    
    // Перевіряємо чи вже є відповіді
    const todayRecord = await db.getTodayRecord(tgId);
    
    if (todayRecord?.fields?.Q_e_1) {
      await ctx.reply(
        formatter.formatRestartWarning('evening'),
        keyboards.buildRestartWarningKeyboard('evening')
      );
      return;
    }
    
    // Створюємо/отримуємо запис
    await db.ensureTodayRecord(tgId, user['User Name']);
    
    // Встановлюємо крок
    await users.updateUserFields(tgId, {
      Answer_Step: ANSWER_STEPS.EVENING_1
    });
    
    await db.updateTodayRecord(tgId, {
      Current_Activity: ANSWER_STEPS.EVENING_1
    });
    
    // Перше питання
    const questionData = formatter.formatQuestionMessage('evening', 0);
    await ctx.reply(questionData.text, keyboards.buildExitKeyboard());
    
    logger.info(`✅ [evening] Запущено для ${tgId}`);
    
  } catch (error) {
    logger.error('❌ [evening] startEveningSession:', error);
    await ctx.reply('❌ Помилка запуску вечірньої сесії. Спробуй /start');
    throw error;
  }
};

export const handleEveningAnswer = async (ctx, text, questionNumber) => {
  const tgId = ctx.from.id;
  logger.info(`🌙 [evening] Q${questionNumber} від ${tgId}, довжина: ${text.length} символів`);
  
  try {
    // Отримуємо дані за сьогодні для аналізу
    const todayRecord = await db.getTodayRecord(tgId);
    
    if (!todayRecord) {
      logger.error(`❌ [evening] Запис не знайдено для ${tgId}`);
      throw new Error('Запис за сьогодні не знайдено');
    }
    
    const todayData = todayRecord?.fields || {};
    
    // Парсимо відповідь
    const parsedFields = helpers.parseEveningAnswer(questionNumber, text, todayData);
    
    // ✅ ЛОГУВАННЯ ПЕРЕД ЗБЕРЕЖЕННЯМ
    logger.info(`💾 [evening] Зберігаємо:`, {
      tgId,
      questionField: `Q_e_${questionNumber}`,
      textLength: text.length,
      parsedFieldsCount: Object.keys(parsedFields).length
    });
    
    // ✅ ЗБЕРЕЖЕННЯ
    const saved = await db.updateTodayRecord(tgId, {
      [`Q_e_${questionNumber}`]: text,
      ...parsedFields
    });
    
    if (!saved) {
      throw new Error('Не вдалося зберегти відповідь');
    }
    
    logger.info(`✅ [evening] Відповідь збережено успішно`);
    
    const totalQuestions = QUESTIONS.evening.length;
    
    if (questionNumber >= totalQuestions) {
      // ЗАВЕРШЕНО
      await db.updateTodayRecord(tgId, { Current_Activity: 'evening_completed' });
      await users.updateUserFields(tgId, { Answer_Step: ANSWER_STEPS.COMPLETED });
      
      // Синхронізація
      try {
        await sync.syncEveningData(tgId);
      } catch (e) {
        logger.warn('⚠️ [evening] Sync:', e);
      }
      
      // Відкладений completion (1-3 хв)
      const delay = Math.floor(Math.random() * (3 - 1 + 1) + 1) * 60 * 1000;
      setTimeout(async () => {
        const record = await db.getTodayRecord(tgId);
        await shared.showCompletionWithAnalysis(ctx, tgId, 'evening', record?.fields);
      }, delay);
      
      logger.info(`✅ [evening] Завершено для ${tgId}`);
      return { completed: true };
    }
    
    // НАСТУПНЕ ПИТАННЯ
    const nextQ = formatter.formatQuestionMessage('evening', questionNumber);
    
    await users.updateUserFields(tgId, {
      Answer_Step: nextQ.field
    });
    
    await db.updateTodayRecord(tgId, {
      Current_Activity: nextQ.field
    });
    
    await ctx.reply(nextQ.text, keyboards.buildExitKeyboard());
    
    return { completed: false };
    
  } catch (error) {
    logger.error('❌ [evening] handleEveningAnswer КРИТИЧНА ПОМИЛКА:', error);
    
    // ✅ ДЕТАЛЬНЕ ЛОГУВАННЯ
    logger.error('   TG_id:', tgId);
    logger.error('   Question:', questionNumber);
    logger.error('   Text length:', text?.length || 0);
    logger.error('   Error name:', error?.name);
    logger.error('   Error message:', error?.message);
    
    throw error; 
  }
};

export const restartEveningSession = async (ctx) => {
  await shared.restartSession(ctx, ctx.from.id, 'evening', startEveningSession);
};

export const exitEveningSession = async (ctx) => {
  await shared.exitSession(ctx, ctx.from.id, 'evening');
};

export const continueEveningSession = async (ctx) => {
  const tgId = ctx.from.id;
  logger.info(`▶️ [evening] Продовження для ${tgId}`);
  
  try {
    const user = await users.getUserByTgId(tgId);
    const currentStep = user?.Answer_Step;

    if (!currentStep || currentStep === ANSWER_STEPS.COMPLETED) {
      return startEveningSession(ctx);
    }

    const match = currentStep.match(/Q_e_(\d+)/i);
    const questionNum = match ? parseInt(match[1], 10) : 1;
    const questionData = formatter.formatQuestionMessage('evening', questionNum - 1);
    
    if (!questionData) return startEveningSession(ctx);

    await ctx.reply(questionData.text, keyboards.buildExitKeyboard());
    logger.info(`✅ [evening] Продовжено на Q${questionNum}`);
  } catch (error) {
    logger.error('❌ [evening] continue:', error);
    await ctx.reply('❌ Помилка. Почати заново?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌙 Так', callback_data: 'start_evening' }],
          [{ text: '🏠 Меню', callback_data: 'main_menu' }]
        ]
      }
    });
  }
};