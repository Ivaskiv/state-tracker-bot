// src/services/dailySessions/service.js — ВИПРАВЛЕНО + ДОПИСАНО

import { QUESTIONS, QUESTION_PARSERS } from '../../config/index.js';
import logger from '../../utils/logger.js';
import keyboards from '../../utils/keyboards.js';
import * as db from './repo.js';

// ── formatter ─────────────────────────────────────────────────────────────────
export const formatQuestionMessage = (sessionType, questionIndex) => {
  const questions = sessionType === 'morning' ? QUESTIONS.morning : QUESTIONS.evening;
  const question = questions[questionIndex];
  if (!question) return null;

  const icon = sessionType === 'morning' ? '🌞' : '🌙';
  const title = sessionType === 'morning' ? 'РАНКОВА РЕФЛЕКСІЯ' : 'ВЕЧІРНЯ РЕФЛЕКСІЯ';
  const emojiNumbers = ['0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'];
  const currentEmoji = emojiNumbers[questionIndex + 1];

  const questionLines = question.text.split('\n');
  const questionTitle = questionLines[0];

  return {
    text:
      `${icon} ${title}\n\n` +
      `${currentEmoji}/${questions.length} ${questionTitle}\n` +
      (question.hint ? `💡 ${question.hint}` : ''),
    field: question.field,
    total: questions.length,
  };
};

export const formatCompletionMessage = (sessionType) => {
  const icon = sessionType === 'morning' ? '🌞' : '🌙';
  const title = sessionType === 'morning' ? 'Ранкову' : 'Вечірню';
  const message = sessionType === 'morning'
    ? 'Налаштування на день готове! 💪'
    : 'Дякую за чесність! 💪';
  return `${icon} ${title} рефлексію завершено!\n\n✅ Всі відповіді збережено.\n\n${message}`;
};

export const formatRestartWarning = (sessionType) => {
  const title = sessionType === 'morning' ? 'ранкову' : 'вечірню';
  return (
    `⚠️ Ти вже пройшла ${title} рефлексію сьогодні!\n\n` +
    `Якщо почнеш заново, попередні відповіді будуть перезаписані.\n\n` +
    `Що робимо?`
  );
};

export const formatEveningWithoutMorning = (userName) => (
  `🌙 Добрий вечір, ${userName}!\n\n` +
  `⚠️ Ти ще не пройшла ранкові питання сьогодні.\n\n` +
  `Що робимо?`
);

export const getStepNumber = (field) => {
  const match = field?.match(/Q_[me]_(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
};

// ── helpers ───────────────────────────────────────────────────────────────────
export const parseMorningAnswer = (questionNumber, answer) => {
  try {
    switch (questionNumber) {
      case 3: return QUESTION_PARSERS?.parseGoals?.(answer) || {};
      case 4: return QUESTION_PARSERS?.parseDailyFocus?.(answer) || {};
      case 5: return QUESTION_PARSERS?.parseState?.(answer) || {};
      case 6: {
        const parsed = QUESTION_PARSERS?.parseActions?.(answer) || {};
        return parsed.affirmation ? { affirmation_m: parsed.affirmation } : parsed;
      }
      default: return {};
    }
  } catch (error) {
    logger.error(`❌ [dailySessions] parseMorningAnswer Q${questionNumber}:`, error);
    return {};
  }
};

export const parseEveningAnswer = (questionNumber, answer, todayData) => {
  try {
    if (questionNumber === 5) return analyzeActionCompletion(answer || '', todayData || {});
    if (questionNumber === 6) return analyzeGoalProgress(answer || '');
    return {};
  } catch (error) {
    logger.error(`❌ [dailySessions] parseEveningAnswer Q${questionNumber}:`, error);
    return {};
  }
};

export const analyzeActionCompletion = (answer, todayData) => {
  try {
    const lower = (answer || '').toLowerCase();
    const actions = [
      todayData?.Daily_Action_1,
      todayData?.Daily_Action_2,
      todayData?.Daily_Action_3,
    ].filter(Boolean);

    const completed = [];
    const skipped = [];
    const doneMarkers = ['✅','зроблено','виконано','так','+','done'];
    const skipMarkers = ['⏭','не зроблено','ні','-','пропустила','пропустив'];

    actions.forEach((act, i) => {
      const s = (act || '').toLowerCase().slice(0, 40);
      const head = s.slice(0, 10);
      const matchedDone = doneMarkers.some((m) => lower.includes(m) && lower.includes(head));
      const matchedSkip = skipMarkers.some((m) => lower.includes(m) && lower.includes(head));
      if (matchedDone) completed.push(i + 1);
      else if (matchedSkip) skipped.push(i + 1);
    });

    return {
      Actions_Completed_Count: completed.length || null,
      Actions_Completed_List: completed.length ? completed.join(',') : null,
      Actions_Skipped_List: skipped.length ? skipped.join(',') : null,
      Completion_Rate: actions.length
        ? Math.round((completed.length / actions.length) * 100)
        : null,
    };
  } catch (error) {
    logger.error('❌ [dailySessions] analyzeActionCompletion:', error);
    return {};
  }
};

export const analyzeGoalProgress = (answer) => {
  try {
    return { Goal_Progress: answer || null };
  } catch (error) {
    logger.error('❌ [dailySessions] analyzeGoalProgress:', error);
    return {};
  }
};

// ── utils ─────────────────────────────────────────────────────────────────────
export const todayStr = () => new Date().toISOString().split('T')[0];

export const normalize = (s) => String(s || '').trim();

export const chunk = (arr, size = 10) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export const getHoursSince = (timestampISO) => {
  try {
    const last = new Date(timestampISO);
    const now = new Date();
    return Math.floor((now - last) / (1000 * 60 * 60));
  } catch {
    return 0;
  }
};

export const getDaysDiff = (date1, date2) => {
  try {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
};

// ── ПЕРЕНЕСЕНІ З shared.js ────────────────────────────────────────────────────

/**
 * Перевірити чи можна автоматично завершити сесію (якщо всі відповіді є)
 */
export const checkAndCompleteSession = async (ctx, tgId, sessionType) => {
  try {
    const rec = await db.getTodayRecord(tgId);
    if (!rec) return false;

    const questions = sessionType === 'morning' ? QUESTIONS.morning : QUESTIONS.evening;
    const fields = rec.fields;

    // Перевіряємо чи всі питання заповнені
    const allAnswered = questions.every((q, i) => {
      const fieldName = `${sessionType === 'morning' ? 'Q_m_' : 'Q_e_'}${i + 1}`;
      return fields[fieldName];
    });

    if (allAnswered) {
      logger.info(`[dailySessions] ✅ Всі відповіді є для ${sessionType}`);
      return true;
    }

    return false;
  } catch (e) {
    logger.error('[dailySessions] checkAndCompleteSession:', e);
    return false;
  }
};

/**
 * Показати аналіз та нагороди після завершення
 */
export const showCompletionWithAnalysis = async (ctx, tgId, sessionType, fields) => {
  try {
    const msg = formatCompletionMessage(sessionType);
    await ctx.reply(msg, keyboards.mainMenuKeyboard());

    // Нагородження
    try {
      const rewardsService = (await import('../gamification/rewards.js')).default;
      await rewardsService.rewardSession(tgId, sessionType, ctx.telegram);
    } catch (e) {
      logger.warn('[dailySessions] Помилка нагородження:', e);
    }
  } catch (e) {
    logger.error('[dailySessions] showCompletionWithAnalysis:', e);
  }
};

/**
 * Перезапустити сесію
 */
export const restartSession = async (ctx, tgId, sessionType, startFn) => {
  try {
    await db.resetSession(tgId, sessionType);
    await startFn(ctx);
  } catch (e) {
    logger.error('[dailySessions] restartSession:', e);
    await ctx.reply('❌ Помилка перезавантаження сесії. Спробуй /start');
  }
};

/**
 * Вийти з сесії
 */
export const exitSession = async (ctx, tgId, sessionType) => {
  try {
    await db.resetSession(tgId, sessionType);
    await ctx.reply(
      `✅ Зрозуміла! Повертайся коли будеш готова. 💪`,
      keyboards.mainMenuKeyboard()
    );
  } catch (e) {
    logger.error('[dailySessions] exitSession:', e);
    await ctx.reply('❌ Помилка. Спробуй /start');
  }
};

console.log('✅ [dailySessions/service] Завантажено');