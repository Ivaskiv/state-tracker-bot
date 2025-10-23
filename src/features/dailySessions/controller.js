// src/features/dailySessions/controller.js
import * as flow from './flow.js';
import keyboards from '../../utils/keyboards.js';
import logger from '../../utils/logger.js';
import { ANSWER_STEPS, CURRENT_ACTIVITY as CA } from '../../config/constantsStatuses.js';

const renderQuestionWithHint = (q) => `*${q.text}*\n\n_Підказка:_ ${q.hint}`;

// ════════════════════════════════════════════════════════════
// MORNING HANDLERS
// ════════════════════════════════════════════════════════════

export const handleStartMorning = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const userRec = await flow.getUserRecord(tgId);
    const state = await flow.getMorningState(tgId);

    if (state.status === 'not_created') {
      const fresh = await flow.createTodayResponse(tgId);
      if (!ctx.session.daily) ctx.session.daily = {};
      ctx.session.daily.awaiting = 'focus';

      await flow.setResponsesCurrentActivity(fresh.id, CA.DAILY_FOCUS);
      await flow.setUserAnswerStep(userRec, ANSWER_STEPS.DAILY_FOCUS);

      const q = flow.questionForField('Daily_Focus');
      await ctx.reply(`🌞 Починаємо ранкову рефлексію.\n\n${renderQuestionWithHint(q)}`, {
        parse_mode: 'Markdown',
        ...keyboards.buildExitKeyboard()
      });
      return true;
    }

    if (state.status === 'in_progress') {
      const q = flow.questionForField(state.nextField);
      await ctx.reply(
        `ℹ️ Схоже, *ранкова сесія вже почата*.\n\nПродовжити з питання:\n— ${q.text.split('\n')[0]}\n\nабо почати заново?`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '▶️ Продовжити', callback_data: 'continue_morning' }],
              [{ text: '🔄 Почати заново', callback_data: 'restart_morning' }],
              [{ text: '🏠 До меню', callback_data: 'main_menu' }]
            ]
          }
        }
      );
      return true;
    }

    if (state.status === 'completed') {
      await ctx.reply('✅ Ранок вже завершено сьогодні.', keyboards.mainMenuKeyboard());
      return true;
    }

    // not_started: рядок є, але ранок не розпочиналась
    if (!ctx.session.daily) ctx.session.daily = {};
    ctx.session.daily.awaiting = 'focus';
    await flow.setResponsesCurrentActivity(state.rec.id, CA.DAILY_FOCUS);
    await flow.setUserAnswerStep(userRec, ANSWER_STEPS.DAILY_FOCUS);

    const q = flow.questionForField('Daily_Focus');
    await ctx.reply(`🌞 Починаємо ранкову рефлексію.\n\n${renderQuestionWithHint(q)}`, {
      parse_mode: 'Markdown',
      ...keyboards.buildExitKeyboard()
    });
    return true;

  } catch (e) {
    logger.error('[daily/handleStartMorning] ❌', e);
    await ctx.reply('❌ Не вдалося стартувати ранкову сесію.', keyboards.mainMenuKeyboard());
    return false;
  }
};

export const handleRestartMorning = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const userRec = await flow.getUserRecord(tgId);
    const todayRec = await flow.getTodayResponseOrNull(tgId);

    if (!todayRec) {
      return await handleStartMorning(ctx);
    }

    await flow.clearMorningFields(todayRec.id);

    if (!ctx.session.daily) ctx.session.daily = {};
    ctx.session.daily.awaiting = 'focus';

    await flow.setResponsesCurrentActivity(todayRec.id, CA.DAILY_FOCUS);
    await flow.setUserAnswerStep(userRec, ANSWER_STEPS.DAILY_FOCUS);

    const q = flow.questionForField('Daily_Focus');
    await ctx.reply(`🔄 Починаємо ранок заново.\n\n${renderQuestionWithHint(q)}`, {
      parse_mode: 'Markdown',
      ...keyboards.buildExitKeyboard()
    });
    try { await ctx.answerCbQuery(); } catch {}
    return true;
  } catch (e) {
    logger.error('[daily/handleRestartMorning] ❌', e);
    return false;
  }
};

export const handleContinueMorning = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const userRec = await flow.getUserRecord(tgId);
    const todayRec = await flow.getOrCreateTodayResponse(tgId);

    const nextField = flow.getNextMorningField(todayRec.fields);
    if (!nextField) {
      await flow.setResponsesCurrentActivity(todayRec.id, 'morning_completed');
      await flow.setUserAnswerStep(userRec, ANSWER_STEPS.IDLE);
      await ctx.reply('✅ Ранок вже завершено. Обери наступну дію:', keyboards.mainMenuKeyboard());
      try { await ctx.answerCbQuery(); } catch {}
      return true;
    }

    if (!ctx.session.daily) ctx.session.daily = {};
    ctx.session.daily.awaiting = flow.fieldToAwaiting(nextField);

    const stepKey = nextField === 'Daily_Focus' ? 'DAILY_FOCUS' : `MORNING_${nextField.split('_')[2]}`;
    await flow.setResponsesCurrentActivity(todayRec.id, nextField);
    await flow.setUserAnswerStep(userRec, ANSWER_STEPS[stepKey]);

    const q = flow.questionForField(nextField);
    await ctx.reply(renderQuestionWithHint(q), { parse_mode: 'Markdown', ...keyboards.buildExitKeyboard() });
    try { await ctx.answerCbQuery(); } catch {}
    return true;
  } catch (e) {
    logger.error('[daily/handleContinueMorning] ❌', e);
    return false;
  }
};

export const handleLaterMorning = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const todayRec = await flow.getOrCreateTodayResponse(tgId);
    const nextField = flow.getNextMorningField(todayRec.fields);
    if (nextField) await flow.setResponsesCurrentActivity(todayRec.id, 'morning_pending');
    await ctx.reply('⏭ Добре, нагадаю пізніше. Повертаємось у меню.', keyboards.mainMenuKeyboard());
    try { await ctx.answerCbQuery(); } catch {}
    return true;
  } catch (e) {
    logger.error('[daily/handleLaterMorning] ❌', e);
    return false;
  }
};

// ════════════════════════════════════════════════════════════
// EVENING HANDLERS
// ════════════════════════════════════════════════════════════

export const handleStartEvening = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const userRec = await flow.getUserRecord(tgId);
    const state = await flow.getEveningState(tgId);

    if (state.status === 'in_progress') {
      const q = flow.questionForField(state.nextField);
      await ctx.reply(
        `ℹ️ *Вечірня сесія вже почата*.\n\nПродовжити з питання:\n— ${q.text.split('\n')[0]}\n\nабо почати заново?`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '▶️ Продовжити вечір', callback_data: 'continue_evening' }],
              [{ text: '🔄 Почати вечір заново', callback_data: 'restart_evening' }],
              [{ text: '🏠 До меню', callback_data: 'main_menu' }]
            ]
          }
        }
      );
      return true;
    }

    if (state.status === 'completed') {
      await ctx.reply('✅ Вечір вже завершено сьогодні.', keyboards.mainMenuKeyboard());
      return true;
    }

    // not_started: питаємо перше питання
    const first = 'Q_e_1';
    if (!ctx.session.daily) ctx.session.daily = {};
    ctx.session.daily.awaiting = flow.fieldToAwaiting(first);

    await flow.setResponsesCurrentActivity(state.rec.id, first);
    await flow.setUserAnswerStep(userRec, ANSWER_STEPS.EVENING_1);

    const q = flow.questionForField(first);
    await ctx.reply(
      `🌙 Починаємо вечірню рефлексію.\n\n${renderQuestionWithHint(q)}`,
      { parse_mode: 'Markdown', ...keyboards.buildExitKeyboard() }
    );
    return true;
  } catch (e) {
    logger.error('[daily/handleStartEvening] ❌', e);
    await ctx.reply('❌ Не вдалося стартувати вечірню сесію.', keyboards.mainMenuKeyboard());
    return false;
  }
};

export const handleRestartEvening = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const userRec = await flow.getUserRecord(tgId);
    const state = await flow.getEveningState(tgId);

    await flow.clearEveningFields(state.rec.id);

    if (!ctx.session.daily) ctx.session.daily = {};
    ctx.session.daily.awaiting = 'q_e_1';

    await flow.setResponsesCurrentActivity(state.rec.id, 'Q_e_1');
    await flow.setUserAnswerStep(userRec, ANSWER_STEPS.EVENING_1);

    const q = flow.questionForField('Q_e_1');
    await ctx.reply(`🔄 Починаємо вечір заново.\n\n${renderQuestionWithHint(q)}`, {
      parse_mode: 'Markdown',
      ...keyboards.buildExitKeyboard()
    });
    try { await ctx.answerCbQuery(); } catch {}
    return true;
  } catch (e) {
    logger.error('[daily/handleRestartEvening] ❌', e);
    return false;
  }
};

export const handleContinueEvening = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const userRec = await flow.getUserRecord(tgId);
    const todayRec = await flow.getOrCreateTodayResponse(tgId);

    const nextField = flow.getNextEveningField(todayRec.fields);
    if (!nextField) {
      await flow.setResponsesCurrentActivity(todayRec.id, 'evening_completed');
      await flow.setUserAnswerStep(userRec, ANSWER_STEPS.IDLE);
      await ctx.reply('✅ Вечір уже завершено. Обери наступну дію:', keyboards.mainMenuKeyboard());
      try { await ctx.answerCbQuery(); } catch {}
      return true;
    }

    if (!ctx.session.daily) ctx.session.daily = {};
    ctx.session.daily.awaiting = flow.fieldToAwaiting(nextField);

    const stepKey = `EVENING_${nextField.split('_')[2]}`;
    await flow.setResponsesCurrentActivity(todayRec.id, nextField);
    await flow.setUserAnswerStep(userRec, ANSWER_STEPS[stepKey]);

    const q = flow.questionForField(nextField);
    await ctx.reply(renderQuestionWithHint(q), {
      parse_mode: 'Markdown',
      ...keyboards.buildExitKeyboard()
    });

    try { await ctx.answerCbQuery(); } catch {}
    return true;
  } catch (e) {
    logger.error('[daily/handleContinueEvening] ❌', e);
    return false;
  }
};

export const handleLaterEvening = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const todayRec = await flow.getOrCreateTodayResponse(tgId);
    await flow.setResponsesCurrentActivity(todayRec.id, 'evening_pending');
    await ctx.reply('⏭ Ок, закриваю на зараз. Повертаємось у меню.', keyboards.mainMenuKeyboard());
    try { await ctx.answerCbQuery(); } catch {}
    return true;
  } catch (e) {
    logger.error('[daily/handleLaterEvening] ❌', e);
    return false;
  }
};

// ════════════════════════════════════════════════════════════
// COMMON
// ════════════════════════════════════════════════════════════

export const handleExitSession = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const todayRec = await flow.getOrCreateTodayResponse(tgId);
    const nextField = flow.getNextMorningField(todayRec.fields);
    if (nextField) await flow.setResponsesCurrentActivity(todayRec.id, 'morning_pending');

    const userRec = await flow.getUserRecord(tgId);
    await flow.setUserAnswerStep(userRec, ANSWER_STEPS.IDLE);
    ctx.session.daily = null;
    await ctx.reply('🚪 Сесію завершено.', keyboards.mainMenuKeyboard());
    return true;
  } catch (e) {
    logger.error('[daily/handleExitSession] ❌', e);
    return false;
  }
};

export const handleSkipMorningDoEvening = async (ctx) => {
  try {
    await ctx.reply('⏭ Пропускаємо ранок. Запускаю вечірню сесію…');
    return await handleStartEvening(ctx);
  } catch (e) {
    logger.error('[daily/handleSkipMorningDoEvening] ❌', e);
    return false;
  }
};

// ════════════════════════════════════════════════════════════
// TEXT HANDLER
// ════════════════════════════════════════════════════════════

export const handleText = async (ctx, textRaw) => {
  const text = (textRaw ?? ctx.message?.text ?? '').trim();
  const lower = text.toLowerCase();

  try {
    // Прямі тригери
    if (lower.includes('ранков')) return await handleStartMorning(ctx);
    if (lower.includes('вечір')) return await handleStartEvening(ctx);

    // Немає очікування — не наш кейс
    const awaiting = ctx.session?.daily?.awaiting;
    if (!awaiting) return false;

    const tgId = ctx.from.id;
    const userRec = await flow.getUserRecord(tgId);
    const field = flow.awaitingToField(awaiting);

    const { nextField, rec } = await flow.saveMorningAnswer(tgId, field, text);

    // Оновити кроки
    if (field === 'Daily_Focus') {
      await flow.setResponsesCurrentActivity(rec.id, CA.DAILY_FOCUS);
      await flow.setUserAnswerStep(userRec, ANSWER_STEPS.DAILY_FOCUS);
    } else if (field.startsWith('Q_m_')) {
      const n = Number(field.split('_')[2]);
      await flow.setResponsesCurrentActivity(rec.id, field);
      await flow.setUserAnswerStep(userRec, ANSWER_STEPS[`MORNING_${n}`]);
    }

    if (!nextField) {
      ctx.session.daily.awaiting = null;
      await flow.setUserAnswerStep(userRec, ANSWER_STEPS.IDLE);
      await flow.setResponsesCurrentActivity(rec.id, 'morning_completed');

      const doneKb = typeof keyboards.doneMorningKeyboard === 'function'
        ? keyboards.doneMorningKeyboard()
        : keyboards.mainMenuKeyboard();

      await ctx.reply('✅ Ранковий блок завершено. Гарного дня!', doneKb);
      return true;
    }

    // Продовжуємо
    ctx.session.daily.awaiting = flow.fieldToAwaiting(nextField);
    const stepKey = nextField === 'Daily_Focus' ? 'DAILY_FOCUS' : `MORNING_${nextField.split('_')[2]}`;
    await flow.setResponsesCurrentActivity(rec.id, nextField);
    await flow.setUserAnswerStep(userRec, ANSWER_STEPS[stepKey]);

    const q = flow.questionForField(nextField);
    await ctx.reply(
      `✅ Відповідь збережено\n\n${renderQuestionWithHint(q)}`,
      { parse_mode: 'Markdown', ...keyboards.buildExitKeyboard() }
    );
    return true;
  } catch (e) {
    logger.error('[daily/handleText] ❌', e);
    return false;
  }
};

// ════════════════════════════════════════════════════════════
// STUBS
// ════════════════════════════════════════════════════════════

export const sendMorningReminders = async () => { logger.info('[daily] sendMorningReminders stub'); };
export const sendEveningReminders = async () => { logger.info('[daily] sendEveningReminders stub'); };

export default {
  handleStartMorning, handleRestartMorning, handleContinueMorning, handleLaterMorning,
  handleStartEvening, handleRestartEvening, handleContinueEvening, handleLaterEvening,
  handleExitSession, handleSkipMorningDoEvening,
  handleText, sendMorningReminders, sendEveningReminders
};