// src/features/dailySessions/shared.js — HELPER ФУНКЦІЇ

import * as db from './repo.js';
import * as service from './service.js';
import keyboards from '../../utils/keyboards.js';
import logger from '../../utils/logger.js';
import { ANSWER_STEPS } from '../../config/index.js';
import users from '../../services/users.js';

// ──────────────────────────────────────────────────────────────────────────────
// CHECK AND AUTO-COMPLETE
// ──────────────────────────────────────────────────────────────────────────────

export const checkAndCompleteSession = async (ctx, tgId, sessionType) => {
  try {
    const todayRecord = await db.getTodayRecord(tgId);
    if (!todayRecord?.fields) return false;

    const fields = todayRecord.fields;
    const prefix = sessionType === 'morning' ? 'Q_m_' : 'Q_e_';
    const total = sessionType === 'morning' ? 3 : 4;

    let allAnswered = true;
    for (let i = 1; i <= total; i++) {
      if (!fields[`${prefix}${i}`]) {
        allAnswered = false;
        break;
      }
    }

    if (allAnswered) {
      const completedFlag = sessionType === 'morning' ? 'morning_completed' : 'evening_completed';
      await db.updateTodayRecord(tgId, { Current_Activity: completedFlag });
      logger.info(`[dailySessions] ✅ Auto-completed ${sessionType} для ${tgId}`);
      return true;
    }

    return false;
  } catch (error) {
    logger.warn(`[dailySessions] ⚠️ checkAndCompleteSession: ${error.message}`);
    return false;
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// RESTART SESSION
// ──────────────────────────────────────────────────────────────────────────────

export const restartSession = async (ctx, tgId, sessionType, startFn) => {
  try {
    const prefix = sessionType === 'morning' ? 'Q_m_' : 'Q_e_';
    const fields = {};

    for (let i = 1; i <= 5; i++) {
      fields[`${prefix}${i}`] = null;
    }

    fields.Current_Activity = null;
    await db.updateTodayRecord(tgId, fields);

    logger.info(`[dailySessions] 🔄 Перезавантажено ${sessionType} для ${tgId}`);
    await startFn(ctx);
  } catch (error) {
    logger.error(`[dailySessions] ❌ restartSession: ${error.message}`);
    await ctx.reply('❌ Помилка при перезавантаженні', keyboards.mainMenuKeyboard());
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// EXIT SESSION
// ──────────────────────────────────────────────────────────────────────────────

export const exitSession = async (ctx, tgId, sessionType) => {
  try {
    const message = sessionType === 'morning'
      ? '👋 Ранкова рефлексія скасована. Гарного дня!'
      : '👋 Вечірня рефлексія скасована. Доброї ночі!';

    await ctx.reply(message, keyboards.mainMenuKeyboard());
    logger.info(`[dailySessions] 🚪 Вихід з ${sessionType} для ${tgId}`);
  } catch (error) {
    logger.error(`[dailySessions] ❌ exitSession: ${error.message}`);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// SHOW COMPLETION WITH ANALYSIS
// ──────────────────────────────────────────────────────────────────────────────

export const showCompletionWithAnalysis = async (ctx, tgId, sessionType, todayFields) => {
  try {
    if (!todayFields) {
      const todayRecord = await db.getTodayRecord(tgId);
      todayFields = todayRecord?.fields || {};
    }

    const completedFlag = sessionType === 'morning' ? 'morning_completed' : 'evening_completed';
    
    const prefix = sessionType === 'morning' ? 'Q_m_' : 'Q_e_';
    const answers = [];
    for (let i = 1; i <= 5; i++) {
      const ans = todayFields[`${prefix}${i}`];
      if (ans) answers.push(ans);
    }

    let message = sessionType === 'morning'
      ? '🌞 **Ранкова рефлексія завершена!**\n\n'
      : '🌙 **Вечірня рефлексія завершена!**\n\n';

    message += `✅ Пройшов всі питання\n`;
    message += `📝 Відповідей: ${answers.length}\n\n`;

    message += sessionType === 'morning'
      ? '💪 Добрий день! Ти готовий до дій.'
      : '🌙 Гарної ночі! Ти проробив хорошу роботу сьогодні.';

    await ctx.reply(message, keyboards.mainMenuKeyboard());
    
    logger.info(`[dailySessions] ✅ Завершення показано для ${tgId}`);
  } catch (error) {
    logger.error(`[dailySessions] ❌ showCompletionWithAnalysis: ${error.message}`);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// CHECK IF AWAITING TEXT INPUT
// ──────────────────────────────────────────────────────────────────────────────

export const isAwaitingTextInput = async (tgId) => {
  try {
    const user = await users.getUserByTgId(tgId);
    const step = user?.fields?.Answer_Step;

    if (!step) return null;

    const morningMatch = step.match(/Q_m_(\d+)/);
    const eveningMatch = step.match(/Q_e_(\d+)/);

    if (morningMatch) {
      const questionNum = parseInt(morningMatch[1], 10);
      return { sessionType: 'morning', questionNumber: questionNum, step };
    }

    if (eveningMatch) {
      const questionNum = parseInt(eveningMatch[1], 10);
      return { sessionType: 'evening', questionNumber: questionNum, step };
    }

    return null;
  } catch (error) {
    logger.warn(`[dailySessions] ⚠️ isAwaitingTextInput: ${error.message}`);
    return null;
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// HANDLE SESSION TEXT
// ──────────────────────────────────────────────────────────────────────────────

export const handleSessionText = async (ctx, text, sessionState) => {
  try {
    if (!sessionState) return;

    const { sessionType, questionNumber } = sessionState;

    if (sessionType === 'morning') {
      const morningController = await import('./controller.js');
      return await morningController.handleMorningAnswer(ctx, text, questionNumber);
    } else if (sessionType === 'evening') {
      const eveningController = await import('./controller.js');
      return await eveningController.handleEveningAnswer(ctx, text, questionNumber);
    }
  } catch (error) {
    logger.error(`[dailySessions] ❌ handleSessionText: ${error.message}`);
    await ctx.reply('❌ Помилка обробки відповіді', keyboards.mainMenuKeyboard());
  }
};

export default {
  checkAndCompleteSession,
  restartSession,
  exitSession,
  showCompletionWithAnalysis,
  isAwaitingTextInput,
  handleSessionText
};

console.log('✅ [dailySessions/shared] Загальні функції завантажено');