// src/features/dailySessions/shared.js
// Спільна логіка для ранкових та вечірніх сесій

import * as db from './database.js';
import * as formatter from './formatter.js';
import * as sync from './sync.js';
import users from '../../services/users.js';
import { ANSWER_STEPS } from '../../config/constants.js';

// ✅ ІМПОРТИ ДЛЯ ГЕЙМІФІКАЦІЇ
import { rewardsService } from '../gamification/index.js';
import logger from '../../utils/logger.js';

/**
 * Перевірити та завершити сесію (якщо всі відповіді є)
 */
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
    await users.updateUserFields(tgId, { 
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
    
    // Показ завершення
    await showCompletionWithAnalysis(ctx, tgId, sessionType, fields);
    
    return true;
    
  } catch (error) {
    logger.error(`❌ [${sessionType}] checkAndCompleteSession:`, error);
    return false;
  }
};

/**
 * Показати завершення сесії з аналізом та нагородами
 */
export const showCompletionWithAnalysis = async (ctx, tgId, sessionType, fields = null) => {
  try {
    logger.info(`✅ [${sessionType}] Показ completion для ${tgId}`);

    // ═══════════════════════════════════════════════════════════════
    // 1️⃣ АФІРМАЦІЯ
    // ═══════════════════════════════════════════════════════════════
    
    if (sessionType === 'morning') {
      // Ранкова афірмація (з відповіді або стандартна)
      const affirmation = fields?.affirmation_m || fields?.Q_m_6 || '✨ Готова до дня! 💪';
      
      await ctx.reply(
        `💫 **ТВОЯ АФІРМАЦІЯ:**\n\n${affirmation}`,
        { parse_mode: 'Markdown' }
      );
      
      // Мікро-затримка для природності
      await new Promise(resolve => setTimeout(resolve, 1500));
      
    } else {
      // Вечірня афірмація
      const victory = fields?.Q_e_7 || 'Ти зробила крок вперед сьогодні';
      
      await ctx.reply(
        `🌟 **ПЕРЕМОГА ДНЯ:**\n\n${victory}\n\n✨ Дякую за чесність! Завтра буде ще краще! 💪`,
        { parse_mode: 'Markdown' }
      );
      
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // ═══════════════════════════════════════════════════════════════
    // 2️⃣ AI АНАЛІЗ (якщо доступний)
    // ═══════════════════════════════════════════════════════════════
    
    try {
      logger.info(`[${sessionType}] 🤖 Запуск AI аналізу...`);
      
      const aiService = (await import('../aiMentor/services/aiMentorService.js')).default;
      
      let analysis = null;
      
      if (sessionType === 'morning') {
        analysis = await aiService.analyzeMorningSession(tgId);
      } else {
        analysis = await aiService.analyzeDayComplete(tgId);
      }
      
      if (analysis && analysis.length > 10) {
        await ctx.reply(
          `📊 **АНАЛІЗ ${sessionType === 'morning' ? 'РАНКУ' : 'ДНЯ'}:**\n\n${analysis}`,
          { parse_mode: 'Markdown' }
        );
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (aiError) {
      logger.warn(`⚠️ [${sessionType}] AI аналіз недоступний:`, aiError.message);
      // Продовжуємо без AI аналізу
    }

    // ═══════════════════════════════════════════════════════════════
    // 3️⃣ НАГОРОДИ ТА БАЛИ
    // ═══════════════════════════════════════════════════════════════
    
    try {
      logger.info(`[${sessionType}] 🎁 Нагородження балами...`);
      
      const rewardResult = await rewardsService.rewardSession(
        tgId, 
        sessionType, 
        ctx.telegram
      );
      
      if (rewardResult && rewardResult.success) {
        const pointsMessage = 
          `💰 **+${rewardResult.points} балів**\n` +
          `📊 Всього: ${rewardResult.totalPoints}`;
        
        await ctx.reply(pointsMessage, { parse_mode: 'Markdown' });
        
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Якщо level up - повідомлення вже надіслано в rewardSession
      }
      
    } catch (rewardError) {
      logger.warn(`⚠️ [${sessionType}] Помилка нагородження:`, rewardError.message);
    }

    // ═══════════════════════════════════════════════════════════════
    // 4️⃣ STREAK (тільки для вечора)
    // ═══════════════════════════════════════════════════════════════
    
    if (sessionType === 'evening') {
      try {
        const user = await users.getUserByTgId(tgId);
        const currentStreak = user?.Current_Streak || 0;
        
        if (currentStreak > 0) {
          await ctx.reply(
            `🔥 **STREAK: ${currentStreak} ${getDaysWord(currentStreak)}**\n\nТримай темп!`,
            { parse_mode: 'Markdown' }
          );
          
          // Нагорода за streak milestone
          if ([7, 14, 30].includes(currentStreak)) {
            await rewardsService.rewardStreak(tgId, currentStreak, ctx.telegram);
          }
          
          await new Promise(resolve => setTimeout(resolve, 800));
        }
        
      } catch (streakError) {
        logger.warn(`⚠️ [${sessionType}] Помилка streak:`, streakError.message);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 5️⃣ ФІНАЛІЗАЦІЯ ДНЯ (тільки для вечора)
    // ═══════════════════════════════════════════════════════════════
    
    if (sessionType === 'evening') {
      try {
        logger.info(`[${sessionType}] 📅 Фіналізація дня...`);
        
        const activityTracker = (await import('../../services/activityTracker.js')).default;
        await activityTracker.finalizeDay(tgId);
        
      } catch (finalizeError) {
        logger.warn(`⚠️ [${sessionType}] Помилка фіналізації:`, finalizeError.message);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 6️⃣ COMPLETION MESSAGE З МЕНЮ
    // ═══════════════════════════════════════════════════════════════
    
    const kbds = (await import('../../utils/keyboards.js')).default;
    
    const completionText = formatter.formatCompletionMessage(sessionType);
    
    await ctx.reply(
      completionText,
      {
        ...kbds.mainMenuKeyboard(),
        parse_mode: 'Markdown'
      }
    );
    
    // ═══════════════════════════════════════════════════════════════
    // 7️⃣ ОНОВЛЕННЯ Last_Activity
    // ═══════════════════════════════════════════════════════════════
    
    try {
      const now = new Date();
      now.setSeconds(0, 0); // Без секунд
      const lastActivity = now.toISOString();
      const lastAnswerDate = new Date().toISOString().split('T')[0];
      
      await users.updateUserFields(tgId, {
        Last_Activity: lastActivity,
        Last_Answer_Date: lastAnswerDate
      });
      
    } catch (updateError) {
      logger.warn(`⚠️ [${sessionType}] Помилка оновлення Last_Activity:`, updateError.message);
    }

    logger.info(`✅ [${sessionType}] Completion показано для ${tgId}`);
    
  } catch (error) {
    logger.error(`❌ [${sessionType}] showCompletionWithAnalysis:`, error);
    
    // Fallback - мінімальне повідомлення
    try {
      const kbds = (await import('../../utils/keyboards.js')).default;
      await ctx.reply(
        `✅ ${sessionType === 'morning' ? 'Ранкову' : 'Вечірню'} сесію завершено!`,
        kbds.mainMenuKeyboard()
      );
    } catch (fallbackError) {
      logger.error(`❌ [${sessionType}] Fallback помилка:`, fallbackError.message);
    }
  }
};

/**
 * Перезапустити сесію
 */
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

/**
 * Вийти з сесії
 */
export const exitSession = async (ctx, tgId, sessionType) => {
  logger.info(`🚪 [${sessionType}] Вихід для ${tgId}`);
  
  try {
    await db.updateTodayRecord(tgId, {
      Current_Activity: `${sessionType}_exited`
    });
    
    await users.updateUserFields(tgId, {
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

/**
 * Helper: правильне відмінювання слова "день"
 */
const getDaysWord = (count) => {
  if (count === 1) return 'день';
  if (count >= 2 && count <= 4) return 'дні';
  return 'днів';
};

console.log('✅ [dailySessions/shared] Shared логіка завантажена');