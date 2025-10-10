// src/services/dailySessions/evening.js
import * as db from './database.js';
import * as formatter from './formatter.js';
import * as keyboards from './keyboards.js';
import * as helpers from './helpers.js';
import * as sync from './sync.js';
import userService from '../userService.js';
import { ANSWER_STEPS, QUESTIONS } from '../../config/constants.js';
import logger from '../../utils/logger.js';

export const startEveningSession = async (ctx) => {
  const tgId = ctx.from.id;
  
  logger.info(`🌙 [dailySessions] Старт вечірньої для ${tgId}`);
  
  try {
    const user = await userService.getUserByTgId(tgId);
    
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
    await userService.updateUserFields(tgId, {
      Answer_Step: ANSWER_STEPS.EVENING_1
    });
    
    await db.updateTodayRecord(tgId, {
      Current_Activity: ANSWER_STEPS.EVENING_1
    });
    
    // Перше питання
    const questionData = formatter.formatQuestionMessage('evening', 0);
    await ctx.reply(questionData.text, keyboards.buildExitKeyboard());
    
    logger.info(`✅ [dailySessions] Вечірня запущена для ${tgId}`);
    
  } catch (error) {
    logger.error('❌ [dailySessions] startEveningSession:', error);
    await ctx.reply('❌ Помилка запуску вечірньої сесії. Спробуй /start');
    throw error;
  }
};

export const handleEveningAnswer = async (ctx, text, questionNumber) => {
  const tgId = ctx.from.id;
  
  logger.info(`🌙 [dailySessions] Відповідь Q_e_${questionNumber} від ${tgId}`);
  
  try {
    // Отримуємо дані за сьогодні для аналізу
    const todayRecord = await db.getTodayRecord(tgId);
    const todayData = todayRecord?.fields || {};
    
    // Парсимо відповідь
    const parsedFields = helpers.parseEveningAnswer(questionNumber, text, todayData);
    
    // Зберігаємо
    await db.updateTodayRecord(tgId, {
      [`Q_e_${questionNumber}`]: text,
      ...parsedFields
    });
    
    const totalQuestions = QUESTIONS.evening.length;
    
    if (questionNumber >= totalQuestions) {
      // Завершено
      await db.updateTodayRecord(tgId, {
        Current_Activity: 'evening_completed'
      });
      
      await userService.updateUserFields(tgId, {
        Answer_Step: ANSWER_STEPS.COMPLETED
      });
      
      // Синхронізація
      await sync.syncEveningData(tgId);
      
      // Фіналізація дня
      const activityTracker = (await import('../activityTracker.js')).default;
      await activityTracker.finalizeDay(tgId);
      
      const kbds = (await import('../../utils/keyboards.js')).default;
      await ctx.reply(
        formatter.formatCompletionMessage('evening'),
        kbds.mainMenuKeyboard()
      );
      
      logger.info(`✅ [dailySessions] Вечірня завершена для ${tgId}`);
      return { completed: true };
    }
    
    // Наступне питання
    const nextQ = formatter.formatQuestionMessage('evening', questionNumber);
    
    await userService.updateUserFields(tgId, {
      Answer_Step: nextQ.field
    });
    
    await db.updateTodayRecord(tgId, {
      Current_Activity: nextQ.field
    });
    
    await ctx.reply(nextQ.text, keyboards.buildExitKeyboard());
    
    return { completed: false };
    
  } catch (error) {
    logger.error('❌ [dailySessions] handleEveningAnswer:', error);
    await ctx.reply('❌ Помилка збереження. Спробуй ще раз.');
    throw error;
  }
};

export const restartEveningSession = async (ctx) => {
  const tgId = ctx.from.id;
  
  logger.info(`🔄 [dailySessions] Перезапуск вечірньої для ${tgId}`);
  
  try {
    await db.resetSession(tgId, 'evening');
    await startEveningSession(ctx);
  } catch (error) {
    logger.error('❌ [dailySessions] restartEveningSession:', error);
    await ctx.reply('❌ Помилка перезапуску. Спробуй /start');
  }
};

export const continueEveningSession = async (ctx) => {
  const tgId = ctx.from.id;
  
  logger.info(`▶️ [dailySessions] Продовження вечірньої для ${tgId}`);
  
  try {
    const user = await userService.getUserByTgId(tgId);
    const currentStep = user?.Answer_Step;

    if (!currentStep || currentStep === ANSWER_STEPS.COMPLETED) {
      return startEveningSession(ctx);
    }

    const match = (currentStep || '').match(/Q_e_(\d+)/i);
    const questionNum = match ? parseInt(match[1], 10) : 1;
    const idx = Math.max(0, questionNum - 1);
    
    const questionData = formatter.formatQuestionMessage('evening', idx);
    
    if (!questionData) {
      return startEveningSession(ctx);
    }

    await ctx.reply(questionData.text, keyboards.buildExitKeyboard());
    logger.info(`✅ [dailySessions] Продовжено вечірню на питанні ${questionNum}`);
  } catch (error) {
    logger.error('❌ [dailySessions] continueEveningSession:', error);
    await ctx.reply(
      '❌ Помилка. Розпочнемо спочатку?',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌙 Почати спочатку', callback_data: 'start_evening' }],
            [{ text: '🏠 Головне меню', callback_data: 'main_menu' }]
          ]
        }
      }
    );
  }
};

export const exitEveningSession = async (ctx) => {
  const tgId = ctx.from.id;
  
  logger.info(`🚪 [dailySessions] Вихід з вечірньої для ${tgId}`);
  
  try {
    await db.updateTodayRecord(tgId, {
      Current_Activity: 'evening_exited'
    });
    
    await userService.updateUserFields(tgId, {
      Answer_Step: ANSWER_STEPS.COMPLETED
    });
    
    const kbds = (await import('../../utils/keyboards.js')).default;
    await ctx.reply(
      '✅ Вечірню сесію завершено!',
      kbds.mainMenuKeyboard()
    );
    
    logger.info(`✅ [dailySessions] Вихід з вечірньої для ${tgId}`);
  } catch (error) {
    logger.error('❌ [dailySessions] exitEveningSession:', error);
  }
};