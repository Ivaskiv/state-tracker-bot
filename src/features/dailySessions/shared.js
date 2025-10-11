// src/services/dailySessions/shared.js

import * as db from './database.js';
import * as formatter from './formatter.js';
import * as sync from './sync.js';
import userService from '../../123/userService.js';
import { ANSWER_STEPS } from '../../config/constants.js';
import logger from '../../123/logger.js';

// ✅ СПІЛЬНА ЛОГІКА ВІДНОВЛЕННЯ
export const checkAndCompleteSession = async (ctx, tgId, sessionType) => {
  try {
    const todayRecord = await db.getTodayRecord(tgId);
    if (!todayRecord) return false;
    
    const fields = todayRecord.fields || {};
    const questionsCount = sessionType === 'morning' ? 6 : 7;
    const prefix = sessionType === 'morning' ? 'Q_m_' : 'Q_e_';
    
    // Перевіряємо всі відповіді
    const hasAllAnswers = Array.from({ length: questionsCount }, (_, i) => i + 1)
      .every(i => fields[`${prefix}${i}`]);
    
    if (!hasAllAnswers) return false;
    
    const isCompleted = fields.Current_Activity === `${sessionType}_completed`;
    
    if (isCompleted) {
      await ctx.reply(
        `✅ Ти вже завершила ${sessionType === 'morning' ? 'ранкову' : 'вечірню'} рефлексію!`,
        (await import('../../utils/keyboards.js')).default.mainMenuKeyboard()
      );
      return true;
    }
    
    logger.info(`🔄 [${sessionType}] Відновлення completion для ${tgId}`);
    
    await db.updateTodayRecord(tgId, { 
      Current_Activity: `${sessionType}_completed` 
    });
    await userService.updateUserFields(tgId, { 
      Answer_Step: ANSWER_STEPS.COMPLETED 
    });
    
    // Синхронізація
    try {
      if (sessionType === 'morning') {
        await sync.syncMorningData(tgId);
      } else {
        await sync.syncEveningData(tgId);
      }
    } catch (e) {
      logger.warn(`⚠️ [${sessionType}] Sync помилка:`, e);
    }
    
    // Афірмація + Аналіз
    await showCompletionWithAnalysis(ctx, tgId, sessionType, fields);
    
    return true;
    
  } catch (error) {
    logger.error(`❌ [${sessionType}] checkAndCompleteSession:`, error);
    return false;
  }
};

// ✅ ПОКАЗ АФІРМАЦІЇ + АНАЛІЗ
export const showCompletionWithAnalysis = async (ctx, tgId, sessionType, fields = null) => {
  try {
    // Афірмація
    if (sessionType === 'morning') {
      const affirmation = fields?.affirmation_m || '✨ Готова до дня! 💪';
      await ctx.reply(`✨ ${affirmation}`);
    } else {
      await ctx.reply('✨ Дякую за чесність! Завтра буде ще краще! 💪');
    }
    
    // Аналіз
    try {
      const aiService = (await import('../../aiMentor/services/aiMentorService.js')).default;
      const analysis = sessionType === 'morning'
        ? await aiService.analyzeMorningSession(tgId)
        : await aiService.analyzeDayComplete(tgId);
      
      await ctx.reply(
        `📊 Аналіз ${sessionType === 'morning' ? 'ранку' : 'дня'}:\n\n${analysis}`
      );
    } catch (e) {
      logger.error(`❌ [${sessionType}] Аналіз помилка:`, e);
    }
    
    // Фіналізація (тільки для вечора)
    if (sessionType === 'evening') {
      try {
        const activityTracker = (await import('../../123/activityTracker.js')).default;
        await activityTracker.finalizeDay(tgId);
      } catch (e) {
        logger.warn('⚠️ [evening] Finalize помилка:', e);
      }
    }
    
    // Completion message
    const kbds = (await import('../../utils/keyboards.js')).default;
    await ctx.reply(
      formatter.formatCompletionMessage(sessionType),
      kbds.mainMenuKeyboard()
    );
    
    logger.info(`✅ [${sessionType}] Completion показано для ${tgId}`);
    
  } catch (error) {
    logger.error(`❌ [${sessionType}] showCompletionWithAnalysis:`, error);
  }
};

// ✅ СПІЛЬНИЙ RESTART
export const restartSession = async (ctx, tgId, sessionType, startFunction) => {
  logger.info(`🔄 [${sessionType}] Перезапуск для ${tgId}`);
  
  try {
    await db.resetSession(tgId, sessionType);
    await startFunction(ctx);
  } catch (error) {
    logger.error(`❌ [${sessionType}] restartSession:`, error);
    await ctx.reply('❌ Помилка перезапуску. Спробуй /start');
  }
};

// ✅ СПІЛЬНИЙ EXIT
export const exitSession = async (ctx, tgId, sessionType) => {
  logger.info(`🚪 [${sessionType}] Вихід для ${tgId}`);
  
  try {
    await db.updateTodayRecord(tgId, {
      Current_Activity: `${sessionType}_exited`
    });
    
    await userService.updateUserFields(tgId, {
      Answer_Step: ANSWER_STEPS.COMPLETED
    });
    
    const kbds = (await import('../../utils/keyboards.js')).default;
    await ctx.reply(
      `✅ ${sessionType === 'morning' ? 'Ранкову' : 'Вечірню'} сесію завершено!`,
      kbds.mainMenuKeyboard()
    );
    
    logger.info(`✅ [${sessionType}] Вихід завершено для ${tgId}`);
  } catch (error) {
    logger.error(`❌ [${sessionType}] exitSession:`, error);
  }
};