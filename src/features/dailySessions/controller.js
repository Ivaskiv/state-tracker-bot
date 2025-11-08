// src/features/dailySessions/controller.js
import { getBase, tables } from '../../config/database.js';
const base = getBase();

import * as QE from '../../services/questionEngine.js';
import * as flow from './flow.js';
import keyboards from '../../utils/keyboards.js';
import logger from '../../utils/logger.js';
import { ANSWER_STEPS } from '../../config/constants.js';
import { MORNING_CONFIG, EVENING_CONFIG } from './config.js';

const tgIdOf = (ctx) => String(ctx.from?.id);
const getConfig = (type) => type === 'morning' ? MORNING_CONFIG : EVENING_CONFIG;
const cfgWithRecord = (config, recordId) => ({ ...config, recordId });

const getStepKey = (field) => {
  if (field === 'Daily_Focus') return 'DAILY_FOCUS';
  const m = field.match(/Q_([me])_(\d+)/);
  if (!m) return 'IDLE';
  const [, type, num] = m;
  return type === 'm' ? `MORNING_${num}` : `EVENING_${num}`;
};

async function syncProgressState(userRec, todayRec, stepKey, activity) {
  await flow.setUserAnswerStep(userRec, ANSWER_STEPS[stepKey]);
  await flow.setResponsesCurrentActivity(todayRec.id, activity);
}

function getFieldIndex(config, field) {
  return Number(Object.entries(config.fieldMap).find(([, v]) => v === field)?.[0]);
}

async function showQuestion(ctx, userRec, todayRec, field, type) {
  try {
    const config = getConfig(type);

    // індекс поля
    const idx = Number(
      Object.entries(config.fieldMap).find(([, v]) => v === field)?.[0]
    );

    const q = QE.getQuestion(config, idx);
    if (!q) return false;

    if (!ctx.session.daily) ctx.session.daily = {};
    ctx.session.daily.awaiting = flow.fieldToAwaiting(field);

    const stepKey = getStepKey(field);
    await syncProgressState(userRec, todayRec, stepKey, field);

    // форматування тексту
    const isFirstMorning = type === 'morning' && field === 'Daily_Focus';
    const icon = q.emoji || (type === 'morning' ? '🌞' : '🌙');

    let text;
    if (isFirstMorning) {
      // потрібний формат для першого ранкового питання
      const qLine = `Скажи: ${q.text || 'Який фокус на сьогодні?'}`;
      const hint = q.hint ? `\n\nПідказка: ${q.hint}` : '';
      text = `${icon} Починаємо ранкову рефлексію.\n\n${qLine}${hint}`;
    } else {
      // звичайне відображення без жирного/курсиву
      const title = q.title ? `${q.title}\n\n` : '';
      const qLine = q.text ? `${q.text}` : '';
      const hint = q.hint ? `\n\nПідказка: ${q.hint}` : '';
      text = `${icon} ${title}${qLine}${hint}`;
    }

await ctx.reply(text, { ...keyboards.sessionExitInline() });
    return true;
  } catch (e) {
    logger.error('[showQuestion]', e);
    return false;
  }
}


async function getUserRecords(ctx, checkUser = true) {
  const tgId = tgIdOf(ctx);
  if (checkUser) {
    const userRec = await flow.getUserRecord(tgId);
    if (!userRec) {
      await ctx.reply('❌ Користувач не знайден', keyboards.mainMenuKeyboard());
      return null;
    }
  }
  const todayRec = await flow.getOrCreateTodayResponse(tgId);
  return { tgId, todayRec };
}

function getNextField(activity, type, fields) {
  const config = getConfig(type);
  if (!activity) return config.fieldMap[0];
  if (activity.match(/^(Daily_Focus|Q_[me]_\d+)$/)) return activity;
  return type === 'morning' ? flow.getNextMorningField(fields) : flow.getNextEveningField(fields);
}

async function handleSessionStart(ctx, type) {
  try {
    const records = await getUserRecords(ctx);
    if (!records) return false;

    const { tgId, todayRec } = records;
    const config = getConfig(type);
    const activity = todayRec.fields.Current_Activity || ''; 

    logger.info(`[${type}] Початок для ${tgId}, Current_Activity: ${activity}`);

    if (type === 'evening') {
      const nextMorning = flow.getNextMorningField(todayRec.fields);
      if (nextMorning && activity !== 'morning_completed') {
        await ctx.reply('⚠️ Спочатку закінчи ранок?', keyboards.morningEveningChoiceKeyboard());
        return true;
      }
    }

    const completed = type === 'morning' ? 'morning_completed' : 'evening_completed';
    if (activity === completed) {
      await ctx.reply(`✅ ${type === 'morning' ? 'Ранок' : 'Вечір'} вже завершено.`, keyboards.mainMenuKeyboard());
      return true;
    }

    const field = getNextField(activity, type, todayRec.fields);
    if (!field) {
      await ctx.reply(`✅ ${type === 'morning' ? 'Ранок' : 'Вечір'} завершено.`, keyboards.mainMenuKeyboard());
      return true;
    }

const pending = type === 'morning' ? 'morning_pending' : 'evening_pending';
if (activity === pending) {
  const kb = type === 'morning' ? keyboards.doneMorningKeyboard() : keyboards.doneEveningKeyboard();
  await ctx.reply(
    '⏸ Сесія на паузі. Продовжимо?',
    { parse_mode: 'Markdown', ...kb }
  );
  return true;
}

    const userRec = await flow.getUserRecord(tgId);
    await showQuestion(ctx, userRec, todayRec, field, type);
    return true;
  } catch (e) {
    logger.error(`[handleSessionStart/${type}]`, e);
    await ctx.reply('❌ Помилка', keyboards.mainMenuKeyboard());
    return false;
  }
}

async function handleSessionRestart(ctx, type) {
  try {
    const records = await getUserRecords(ctx, false);
    if (!records) return false;

    const { todayRec } = records;
    const userRec = await flow.getUserRecord(tgIdOf(ctx));
    const config = getConfig(type);

    type === 'morning' ? await flow.clearMorningFields(todayRec.id) : await flow.clearEveningFields(todayRec.id);
await flow.setUserAnswerStep(userRec, field);       
await flow.setResponsesCurrentActivity(todayRec.id, field);
    await handleSessionStart(ctx, type);
    return true;
  } catch (e) {
    logger.error(`[handleSessionRestart/${type}]`, e);
    return false;
  }
}

async function handleSessionLater(ctx, type) {
  try {
    const records = await getUserRecords(ctx, false);
    if (!records) return false;

    const { todayRec } = records;
    const userRec = await flow.getUserRecord(tgIdOf(ctx));
    const pending = type === 'morning' ? 'morning_pending' : 'evening_pending';

    await syncProgressState(userRec, todayRec, 'IDLE', pending);
    await ctx.reply('⏭ Добре, нагадаю пізніше.', keyboards.mainMenuKeyboard());
    return true;
  } catch (e) {
    logger.error(`[handleSessionLater/${type}]`, e);
    return false;
  }
}

export const handleStartMorning = (ctx) => handleSessionStart(ctx, 'morning');
export const handleRestartMorning = (ctx) => handleSessionRestart(ctx, 'morning');
export const handleContinueMorning = (ctx) => handleSessionStart(ctx, 'morning');
export const handleLaterMorning = (ctx) => handleSessionLater(ctx, 'morning');

export const handleStartEvening = (ctx) => handleSessionStart(ctx, 'evening');
export const handleRestartEvening = (ctx) => handleSessionRestart(ctx, 'evening');
export const handleContinueEvening = (ctx) => handleSessionStart(ctx, 'evening');
export const handleLaterEvening = (ctx) => handleSessionLater(ctx, 'evening');

export const handleSkipMorningDoEvening = async (ctx) => {
  try {
    const records = await getUserRecords(ctx, false);
    if (!records) return false;

    const { todayRec } = records;
    const userRec = await flow.getUserRecord(tgIdOf(ctx));

    await syncProgressState(userRec, todayRec, 'IDLE', 'morning_skipped');
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
    const tgId = tgIdOf(ctx);
    const userRec = await flow.getUserRecord(tgId);
    const todayRec = await flow.getOrCreateTodayResponse(tgId);
    
    if (userRec) await syncProgressState(userRec, todayRec, 'IDLE', null);
    
    ctx.session.daily = null;
    await ctx.reply('🚪 Сесія закрита.', keyboards.mainMenuKeyboard());
    return true;
  } catch (e) {
    logger.error('[handleExitSession]', e);
    return false;
  }
};

export const handleText = async (ctx) => {
  try {
    const text = (ctx.message?.text ?? '').trim();
    if (!text) return false;

    const tgId = String(ctx.from?.id);
    const userRec = await flow.getUserRecord(tgId);
    if (!userRec) return false;

    const todayRec = await flow.getOrCreateTodayResponse(tgId);

    // 1) визначаємо поле для відповіді
    let field = null;

    // пріоритет 1: session.awaiting
    const awaiting = ctx.session?.daily?.awaiting;
    field = flow.awaitingToField(awaiting);

    // пріоритет 2: Users.Answer_Step (ми тепер пишемо туди назву поля)
    if (!field) {
      const step = String(userRec.fields?.Answer_Step || '');
      if (/^(Daily_Focus|Q_m_\d+|Q_e_\d+)$/.test(step)) field = step;
    }

    // пріоритет 3: Responses.Current_Activity
    if (!field) {
      const current = String(todayRec.fields?.Current_Activity || '');
      if (/^(Daily_Focus|Q_m_\d+|Q_e_\d+)$/.test(current)) field = current;
    }

    if (!field) return false; // не наша подія

    const type = field.startsWith('Q_e_') ? 'evening' : 'morning';

    // 2) зберігаємо відповідь і отримаємо наступне поле
    let nextField;
    if (type === 'morning') {
      const result = await flow.saveMorningAnswer(tgId, field, text);
      nextField = result.nextField;
    } else {
      const result = await flow.saveEveningAnswer(tgId, field, text);
      nextField = result.nextField;
    }

    // 3) оновлюємо Current_Activity по факту відповіді на поточне поле
    await flow.setResponsesCurrentActivity(todayRec.id, field);

    // 4) якщо питань більше немає — завершуємо сесію
    if (!nextField) {
      const completed = type === 'morning' ? 'morning_completed' : 'evening_completed';
      await flow.setResponsesCurrentActivity(todayRec.id, completed);
      await flow.setUserAnswerStep(userRec, 'IDLE');
      await ctx.reply(
        type === 'morning'
          ? '✅ Ранок завершено. Гарного дня!'
          : '✅ Вечір завершено. Спи добре!',
        keyboards.mainMenuKeyboard()
      );
      ctx.session.daily = null;
      return true;
    }

    // 5) готуємо наступне питання
    if (!ctx.session.daily) ctx.session.daily = {};
    ctx.session.daily.awaiting = flow.fieldToAwaiting(nextField);

    // !!! важливо: в Answer_Step знову кладемо НАЗВУ поля
    await flow.setUserAnswerStep(userRec, nextField);
    await flow.setResponsesCurrentActivity(todayRec.id, nextField);

    await showQuestion(ctx, userRec, todayRec, nextField, type);
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