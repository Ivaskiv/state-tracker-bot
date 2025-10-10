// src/services/dailySessions/morning.js
import * as db from './database.js';
import * as formatter from './formatter.js';
import * as keyboards from './keyboards.js';
import * as helpers from './helpers.js';
import * as sync from './sync.js';
import userService from '../userService.js';
import { ANSWER_STEPS, QUESTIONS } from '../../config/constants.js';
import logger from '../../utils/logger.js';

export const startMorningSession = async (ctx) => {
  const tgId = ctx.from.id;
  
  logger.info(`🌞 [dailySessions] Старт ранкової для ${tgId}`);
  
  try {
    const user = await userService.getUserByTgId(tgId);
    
    const todayRecord = await db.getTodayRecord(tgId);
    
    if (todayRecord?.fields?.Q_m_1) {
      await ctx.reply(
        formatter.formatRestartWarning('morning'),
        keyboards.buildRestartWarningKeyboard('morning')
      );
      return;
    }
    
    await db.ensureTodayRecord(tgId, user['User Name']);
    
    await userService.updateUserFields(tgId, {
      Answer_Step: ANSWER_STEPS.MORNING_1
    });
    
    await db.updateTodayRecord(tgId, {
      Current_Activity: ANSWER_STEPS.MORNING_1
    });
    
    const questionData = formatter.formatQuestionMessage('morning', 0);
    await ctx.reply(questionData.text, keyboards.buildExitKeyboard());
    
    logger.info(`✅ [dailySessions] Ранкова запущена для ${tgId}`);
    
  } catch (error) {
    logger.error('❌ [dailySessions] startMorningSession:', error);
    await ctx.reply('❌ Помилка запуску ранкової сесії. Спробуй /start');
    throw error;
  }
};

export const handleMorningAnswer = async (ctx, text, questionNumber) => {
  const tgId = ctx.from.id;
  
  logger.info(`🌞 [dailySessions] Відповідь Q_m_${questionNumber} від ${tgId}`);
  
  try {
    // Парсимо відповідь
    const parsedFields = helpers.parseMorningAnswer(questionNumber, text);
    
    // Зберігаємо
    await db.updateTodayRecord(tgId, {
      [`Q_m_${questionNumber}`]: text,
      ...parsedFields
    });
    
    const totalQuestions = QUESTIONS.morning.length;
    
    if (questionNumber >= totalQuestions) {
      // Завершено
      await db.updateTodayRecord(tgId, {
        Current_Activity: 'morning_completed'
      });
      
      await userService.updateUserFields(tgId, {
        Answer_Step: ANSWER_STEPS.COMPLETED
      });
      
      // Синхронізація
      await sync.syncMorningData(tgId);
      
      const kbds = (await import('../../utils/keyboards.js')).default;
      await ctx.reply(
        formatter.formatCompletionMessage('morning'),
        kbds.mainMenuKeyboard()
      );
      
      logger.info(`✅ [dailySessions] Ранкова завершена для ${tgId}`);
      return { completed: true };
    }
    
    // Наступне питання
    const nextQ = formatter.formatQuestionMessage('morning', questionNumber);
    
    await userService.updateUserFields(tgId, {
      Answer_Step: nextQ.field
    });
    
    await db.updateTodayRecord(tgId, {
      Current_Activity: nextQ.field
    });
    
    await ctx.reply(nextQ.text, keyboards.buildExitKeyboard());
    
    return { completed: false };
    
  } catch (error) {
    logger.error('❌ [dailySessions] handleMorningAnswer:', error);
    await ctx.reply('❌ Помилка збереження. Спробуй ще раз.');
    throw error;
  }
};

export const restartMorningSession = async (ctx) => {
  const tgId = ctx.from.id;
  
  logger.info(`🔄 [dailySessions] Перезапуск ранкової для ${tgId}`);
  
  try {
    await db.resetSession(tgId, 'morning');
    await startMorningSession(ctx);
  } catch (error) {
    logger.error('❌ [dailySessions] restartMorningSession:', error);
    await ctx.reply('❌ Помилка перезапуску. Спробуй /start');
  }
};

export const continueMorningSession = async (ctx) => {
  const tgId = ctx.from.id;
  
  logger.info(`▶️ [dailySessions] Продовження ранкової для ${tgId}`);
  
  try {
    const user = await userService.getUserByTgId(tgId);
    const currentStep = user?.Answer_Step;

    if (!currentStep || currentStep === ANSWER_STEPS.COMPLETED) {
      return startMorningSession(ctx);
    }

    const match = (currentStep || '').match(/Q_m_(\d+)/i);
    const questionNum = match ? parseInt(match[1], 10) : 1;
    const idx = Math.max(0, questionNum - 1);
    
    const questionData = formatter.formatQuestionMessage('morning', idx);
    
    if (!questionData) {
      return startMorningSession(ctx);
    }

    await ctx.reply(questionData.text, keyboards.buildExitKeyboard());
    logger.info(`✅ [dailySessions] Продовжено ранкову на питанні ${questionNum}`);
  } catch (error) {
    logger.error('❌ [dailySessions] continueMorningSession:', error);
    await ctx.reply(
      '❌ Помилка. Розпочнемо спочатку?',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌞 Почати спочатку', callback_data: 'start_morning' }],
            [{ text: '🏠 Головне меню', callback_data: 'main_menu' }]
          ]
        }
      }
    );
  }
};

export const exitMorningSession = async (ctx) => {
  const tgId = ctx.from.id;
  
  logger.info(`🚪 [dailySessions] Вихід з ранкової для ${tgId}`);
  
  try {
    await db.updateTodayRecord(tgId, {
      Current_Activity: 'morning_exited'
    });
    
    await userService.updateUserFields(tgId, {
      Answer_Step: ANSWER_STEPS.COMPLETED
    });
    
    const kbds = (await import('../../utils/keyboards.js')).default;
    await ctx.reply(
      '✅ Ранкову сесію завершено!',
      kbds.mainMenuKeyboard()
    );
    
    logger.info(`✅ [dailySessions] Вихід з ранкової для ${tgId}`);
  } catch (error) {
    logger.error('❌ [dailySessions] exitMorningSession:', error);
  }
};