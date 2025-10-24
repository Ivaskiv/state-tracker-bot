// src/features/dailySessions/controller.js
// ✅ ПОВНИЙ РОБОЧИЙ КОД - Інтегрований з index.js та flow.js

import * as flow from './flow.js';
import keyboards from '../../utils/keyboards.js';
import logger from '../../utils/logger.js';

const renderQuestionWithHint = (q) => `*${q.text}*\n\n_Підказка:_ ${q.hint}`;

// ════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════

function determineNextQuestion(currentActivity, sessionType, fields) {
  if (!currentActivity) {
    return sessionType === 'morning' ? 'Daily_Focus' : 'Q_e_1';
  }
  if (currentActivity.match(/^(Daily_Focus|Q_m_\d+|Q_e_\d+)$/)) {
    return currentActivity;
  }
  return sessionType === 'morning'
    ? flow.getNextMorningField(fields)
    : flow.getNextEveningField(fields);
}

function getStepKey(field) {
  if (field === 'Daily_Focus') return 'DAILY_FOCUS';
  const match = field.match(/Q_([me])_(\d+)/);
  if (!match) return 'IDLE';
  const [, type, num] = match;
  return type === 'm' ? `MORNING_${num}` : `EVENING_${num}`;
}

async function showQuestion(ctx, recId, userRec, questionField, sessionType) {
  try {
    const q = flow.questionForField(questionField);
    
    if (!ctx.session.daily) ctx.session.daily = {};
    ctx.session.daily.awaiting = flow.fieldToAwaiting(questionField);

    const stepKey = getStepKey(questionField);
    await flow.setUserAnswerStep(userRec, ANSWER_STEPS[stepKey]);

    const icon = sessionType === 'morning' ? '🌞' : '🌙';
    await ctx.reply(
      `${icon} ${renderQuestionWithHint(q)}`,
      { parse_mode: 'Markdown', ...keyboards.buildExitKeyboard() }
    );

    logger.info(`[daily] Showed ${sessionType} - ${questionField}`);
  } catch (e) {
    logger.error('[showQuestion]', e);
  }
}

// ════════════════════════════════════════════════════════════
// 🌞 MORNING
// ════════════════════════════════════════════════════════════

export const handleStartMorning = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const userRec = await flow.getUserRecord(tgId);
    if (!userRec) {
      await ctx.reply('❌ Користувач не знайден', keyboards.mainMenuKeyboard());
      return false;
    }

    const todayRec = await flow.getOrCreateTodayResponse(tgId);
    const currentActivity = todayRec.fields.Current_Activity;

    logger.info(`[morning] handleStartMorning for ${tgId}, Current_Activity: ${currentActivity}`);

    // Determine which question to show
    const questionField = determineNextQuestion(currentActivity, 'morning', todayRec.fields);

    if (!questionField) {
      // All completed
      await ctx.reply('✅ Ранок вже завершено сьогодні.', keyboards.mainMenuKeyboard());
      return true;
    }

    if (currentActivity === 'morning_pending') {
      // Offer resume or restart
      const q = flow.questionForField(questionField);
      await ctx.reply(
        `ℹ️ Ранкова сесія паузована.\n\nПродовжити: *${q.text.split('\n')[0]}* ?`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '▶️ Продовжити', callback_data: 'continue_morning' }],
              [{ text: '🔄 Заново', callback_data: 'restart_morning' }],
              [{ text: '🏠 Меню', callback_data: 'main_menu' }]
            ]
          }
        }
      );
      return true;
    }

    // Show question
    await showQuestion(ctx, todayRec.id, userRec, questionField, 'morning');
    return true;

  } catch (e) {
    logger.error('[handleStartMorning]', e);
    await ctx.reply('❌ Помилка', keyboards.mainMenuKeyboard());
    return false;
  }
};

export const handleRestartMorning = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const userRec = await flow.getUserRecord(tgId);
    const todayRec = await flow.getOrCreateTodayResponse(tgId);

    await flow.clearMorningFields(todayRec.id);
    await flow.setResponsesCurrentActivity(todayRec.id, null);

    await handleStartMorning(ctx);
    return true;
  } catch (e) {
    logger.error('[handleRestartMorning]', e);
    return false;
  }
};

export const handleContinueMorning = async (ctx) => {
  try {
    await handleStartMorning(ctx);
    return true;
  } catch (e) {
    logger.error('[handleContinueMorning]', e);
    return false;
  }
};

export const handleLaterMorning = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const todayRec = await flow.getOrCreateTodayResponse(tgId);
    const nextField = flow.getNextMorningField(todayRec.fields);
    
    if (nextField) {
      await flow.setResponsesCurrentActivity(todayRec.id, 'morning_pending');
    }
    
    await ctx.reply('⏭ Добре, нагадаю пізніше.', keyboards.mainMenuKeyboard());
    return true;
  } catch (e) {
    logger.error('[handleLaterMorning]', e);
    return false;
  }
};

// ════════════════════════════════════════════════════════════
// 🌙 EVENING
// ════════════════════════════════════════════════════════════

export const handleStartEvening = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const userRec = await flow.getUserRecord(tgId);
    if (!userRec) {
      await ctx.reply('❌ Користувач не знайден', keyboards.mainMenuKeyboard());
      return false;
    }

    const todayRec = await flow.getOrCreateTodayResponse(tgId);
    const currentActivity = todayRec.fields.Current_Activity;

    logger.info(`[evening] handleStartEvening for ${tgId}, Current_Activity: ${currentActivity}`);

    // Check if morning is done
    const nextMorningField = flow.getNextMorningField(todayRec.fields);
    if (nextMorningField && currentActivity !== 'morning_completed') {
      await ctx.reply(
        `⚠️ Спочатку закінчи ранок?`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🌞 Так', callback_data: 'start_morning' }],
              [{ text: '🌙 Нi', callback_data: 'force_evening' }]
            ]
          }
        }
      );
      return true;
    }

    if (currentActivity === 'evening_completed') {
      await ctx.reply('✅ Вечір уже завершено.', keyboards.mainMenuKeyboard());
      return true;
    }

    const questionField = determineNextQuestion(currentActivity, 'evening', todayRec.fields);

    if (!questionField) {
      await ctx.reply('✅ Вечір завершено.', keyboards.mainMenuKeyboard());
      return true;
    }

    if (currentActivity === 'evening_pending') {
      const q = flow.questionForField(questionField);
      await ctx.reply(
        `ℹ️ Вечірня сесія паузована.\n\nПродовжити: *${q.text.split('\n')[0]}* ?`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '▶️ Продовжити', callback_data: 'continue_evening' }],
              [{ text: '🔄 Заново', callback_data: 'restart_evening' }],
              [{ text: '🏠 Меню', callback_data: 'main_menu' }]
            ]
          }
        }
      );
      return true;
    }

    await showQuestion(ctx, todayRec.id, userRec, questionField, 'evening');
    return true;

  } catch (e) {
    logger.error('[handleStartEvening]', e);
    await ctx.reply('❌ Помилка', keyboards.mainMenuKeyboard());
    return false;
  }
};

export const handleRestartEvening = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const userRec = await flow.getUserRecord(tgId);
    const todayRec = await flow.getOrCreateTodayResponse(tgId);

    await flow.clearEveningFields(todayRec.id);
    await flow.setResponsesCurrentActivity(todayRec.id, null);

    await handleStartEvening(ctx);
    return true;
  } catch (e) {
    logger.error('[handleRestartEvening]', e);
    return false;
  }
};

export const handleContinueEvening = async (ctx) => {
  try {
    await handleStartEvening(ctx);
    return true;
  } catch (e) {
    logger.error('[handleContinueEvening]', e);
    return false;
  }
};

export const handleLaterEvening = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const todayRec = await flow.getOrCreateTodayResponse(tgId);
    await flow.setResponsesCurrentActivity(todayRec.id, 'evening_pending');
    await ctx.reply('⏭ Ок, закриваю.', keyboards.mainMenuKeyboard());
    return true;
  } catch (e) {
    logger.error('[handleLaterEvening]', e);
    return false;
  }
};

export const handleSkipMorningDoEvening = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const todayRec = await flow.getOrCreateTodayResponse(tgId);
    await flow.setResponsesCurrentActivity(todayRec.id, 'morning_skipped');
    await ctx.reply('⏭ Пропускаємо ранок. Запускаю вечір…');
    await handleStartEvening(ctx);
    return true;
  } catch (e) {
    logger.error('[handleSkipMorningDoEvening]', e);
    return false;
  }
};

export const handleExitSession = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const userRec = await flow.getUserRecord(tgId);
    await flow.setUserAnswerStep(userRec, ANSWER_STEPS.IDLE);
    ctx.session.daily = null;
    await ctx.reply('🚪 Сесія закрита.', keyboards.mainMenuKeyboard());
    return true;
  } catch (e) {
    logger.error('[handleExitSession]', e);
    return false;
  }
};

// ════════════════════════════════════════════════════════════
// 📝 TEXT HANDLER — Універсальний для утра и вечера
// ════════════════════════════════════════════════════════════

export const handleText = async (ctx) => {
  try {
    const text = (ctx.message?.text ?? '').trim();
    if (!text) return false;

    const tgId = ctx.from.id;
    const awaiting = ctx.session?.daily?.awaiting;

    // If no awaiting — not our case
    if (!awaiting) return false;

    logger.info(`[text] Processing for ${tgId}, awaiting: ${awaiting}`);

    const userRec = await flow.getUserRecord(tgId);
    if (!userRec) return false;

    const todayRec = await flow.getOrCreateTodayResponse(tgId);
    const field = flow.awaitingToField(awaiting);
    const sessionType = field.startsWith('Q_e_') ? 'evening' : 'morning';

    logger.info(`[text] ${sessionType} - ${field}`);

    // Save answer
    let nextField;
    if (sessionType === 'morning') {
      const result = await flow.saveMorningAnswer(tgId, field, text);
      nextField = result.nextField;
    } else {
      const result = await flow.saveEveningAnswer(tgId, field, text);
      nextField = result.nextField;
    }

    // Set current activity
    await flow.setResponsesCurrentActivity(todayRec.id, field);

    if (!nextField) {
      // Session complete
      const completedStatus = sessionType === 'morning' ? 'morning_completed' : 'evening_completed';
      await flow.setResponsesCurrentActivity(todayRec.id, completedStatus);
      await flow.setUserAnswerStep(userRec, ANSWER_STEPS.IDLE);
      
      const msg = sessionType === 'morning'
        ? '✅ Ранок завершено. Гарного дня!'
        : '✅ Вечір завершено. Спи добре!';
      
      await ctx.reply(msg, keyboards.mainMenuKeyboard());
      ctx.session.daily = null;
      return true;
    }

    // Show next question
    await showQuestion(ctx, todayRec.id, userRec, nextField, sessionType);
    return true;

  } catch (e) {
    logger.error('[handleText]', e);
    return false;
  }
};

export default {
  handleStartMorning, handleRestartMorning, handleContinueMorning, handleLaterMorning,
  handleStartEvening, handleRestartEvening, handleContinueEvening, handleLaterEvening,
  handleSkipMorningDoEvening, handleExitSession, handleText
};