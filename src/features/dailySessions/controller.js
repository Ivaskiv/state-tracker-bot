import keyboards from '../../utils/keyboards.js';
import logger from '../../utils/logger.js';
import { getBase, tables } from '../../config/database.js';
import { todayISO } from '../../utils/helpers.js';
import { QUESTIONS } from '../../config/constantsQuestions.js';
import { ANSWER_STEPS, CURRENT_ACTIVITY as CA } from '../../config/constantsStatuses.js';

const base = getBase();

/* Порядок ранкових полів */
const MORNING_ORDER = ['Daily_Focus','Q_m_1','Q_m_2','Q_m_3','Q_m_4','Q_m_5','Q_m_6'];

const trim = (v, n) => String(v ?? '').slice(0, n);
const renderQuestionWithHint = (q) => `*${q.text}*\n\n_Підказка:_ ${q.hint}`;

/* DB helpers */
const getOrCreateTodayResponse = async (tgId) => {
  const iso = todayISO();
  const recs = await base(tables.RESPONSES)
    .select({ filterByFormula: `AND({TG_id}="${tgId}", {Date_Response}="${iso}")`, maxRecords: 1 })
    .firstPage();
  if (recs.length) return recs[0];
  const [created] = await base(tables.RESPONSES).create([
    { fields: { TG_id: String(tgId), Date_Response: iso } }
  ]);
  return created;
};
// ==== helpers (no-create / create) ====
const getTodayResponseOrNull = async (tgId) => {
  const iso = todayISO();
  const recs = await base(tables.RESPONSES)
    .select({ filterByFormula: `AND({TG_id}="${tgId}", {Date_Response}="${iso}")`, maxRecords: 1 })
    .firstPage();
  return recs[0] || null;
};

const createTodayResponse = async (tgId) => {
  const [created] = await base(tables.RESPONSES).create([
    { fields: { TG_id: String(tgId), Date_Response: todayISO() } }
  ]);
  return created;
};

// Є хоч якийсь прогрес ранку?
const morningStarted = (fields = {}) => {
  if (fields.Daily_Focus && String(fields.Daily_Focus).trim() !== '') return true;
  return ['Q_m_1','Q_m_2','Q_m_3','Q_m_4','Q_m_5','Q_m_6'].some(f => {
    const v = fields[f]; return v && String(v).trim() !== '';
  });
};

// Очистити тільки РАНОК у сьогоднішньому рядку
const clearMorningFields = async (respId) => {
  const patch = { Daily_Focus: null };
  ['Q_m_1','Q_m_2','Q_m_3','Q_m_4','Q_m_5','Q_m_6'].forEach(f => patch[f] = null);
  await base(tables.RESPONSES).update(respId, patch);
};

const getUserRecord = async (tgId) => {
  const recs = await base(tables.USERS)
    .select({ filterByFormula: `{TG_id}="${tgId}"`, maxRecords: 1 })
    .firstPage();
  return recs[0] || null;
};

const setResponsesCurrentActivity = async (respId, value) => {
  try {
    await base(tables.RESPONSES).update(respId, { Current_Activity: value });
  } catch (e) {
    logger.warn('[daily] setResponsesCurrentActivity:', e.message);
  }
};

const setUserAnswerStep = async (userRec, step) => {
  try {
    if (userRec) await base(tables.USERS).update(userRec.id, { Answer_Step: step ?? null });
  } catch (e) {
    logger.warn('[daily] setUserAnswerStep:', e.message);
  }
};

/* маппінг awaiting ⇄ поле */
const fieldToAwaiting = (field) => (field === 'Daily_Focus' ? 'focus' : field.toLowerCase());
const awaitingToField = (awaiting) => {
  if (awaiting === 'focus') return 'Daily_Focus';
  // ВАЖЛИВО: правильний регістр 'Q_m_' / 'Q_e_'
  return awaiting.replace(/^q_m_/, 'Q_m_').replace(/^q_e_/, 'Q_e_');
};

/* наступне незаповнене ранкове поле */
const getNextMorningField = (fields) => {
  for (const f of MORNING_ORDER) {
    const v = fields?.[f];
    if (v === undefined || v === null || String(v).trim() === '') return f;
  }
  return null;
};

/* питання за полем */
const questionForField = (field) => {
  if (field === 'Daily_Focus') {
    return {
      text: 'Скажи: *Який фокус на сьогодні?*',
      hint: 'Коротко одним-двома реченнями про головний намір дня.',
      field: 'Daily_Focus'
    };
  }
  const idx = Number(field.split('_')[2]) - 1; // Q_m_1 → 0
  return QUESTIONS.morning[idx];
};

/* попередження про незакінчену сесію */
const replyUnfinishedMorning = async (ctx, nextField) => {
  const q = questionForField(nextField);
  await ctx.reply(
    `⚠️ У тебе вже є *незакінчена ранкова сесія*.\n\nГотова *продовжити* з питання:\n\n— ${q.text.split('\n')[0]}`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '▶️ Продовжити', callback_data: 'continue_morning' }],
          [{ text: '🏠 До меню', callback_data: 'main_menu' }],
        ]
      }
    }
  );
};

/* ───── РАНОК: старт ───── */
export const handleStartMorning = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const userRec = await getUserRecord(tgId);

    // НЕ створюємо рядок відразу
    const todayRec = await getTodayResponseOrNull(tgId);

    // Якщо сьогоднішнього рядка ще немає — створимо і питаємо фокус
    if (!todayRec) {
      const fresh = await createTodayResponse(tgId);
      if (!ctx.session.daily) ctx.session.daily = {};
      ctx.session.daily.awaiting = 'focus';

      await setResponsesCurrentActivity(fresh.id, CA.DAILY_FOCUS);
      await setUserAnswerStep(userRec, ANSWER_STEPS.DAILY_FOCUS);

      const q = { text: 'Скажи: *Який фокус на сьогодні?*', hint: 'Коротко одним-двома реченнями про головний намір дня.' };
      await ctx.reply(`🌞 Починаємо ранкову рефлексію.\n\n${renderQuestionWithHint(q)}`, {
        parse_mode: 'Markdown',
        ...keyboards.buildExitKeyboard()
      });
      return true;
    }

    // Рядок уже є: якщо ранок почато — запропонувати ПРОДОВЖИТИ або ПОЧАТИ СПОЧАТКУ
    if (morningStarted(todayRec.fields)) {
      const nextField = getNextMorningField(todayRec.fields) || 'Q_m_6';
      const q = questionForField(nextField);

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

    // Рядок є, але ранок ще не починався → питаємо фокус, НЕ створюючи новий рядок
    if (!ctx.session.daily) ctx.session.daily = {};
    ctx.session.daily.awaiting = 'focus';
    await setResponsesCurrentActivity(todayRec.id, CA.DAILY_FOCUS);
    await setUserAnswerStep(userRec, ANSWER_STEPS.DAILY_FOCUS);

    const q = { text: 'Скажи: *Який фокус на сьогодні?*', hint: 'Коротко одним-двома реченнями про головний намір дня.' };
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
    const userRec = await getUserRecord(tgId);
    const todayRec = await getTodayResponseOrNull(tgId);
    if (!todayRec) {
      // немає рядка — поводимось як старт
      return await handleStartMorning(ctx);
    }

    await clearMorningFields(todayRec.id);

    if (!ctx.session.daily) ctx.session.daily = {};
    ctx.session.daily.awaiting = 'focus';

    await setResponsesCurrentActivity(todayRec.id, CA.DAILY_FOCUS);
    await setUserAnswerStep(userRec, ANSWER_STEPS.DAILY_FOCUS);

    const q = { text: 'Скажи: *Який фокус на сьогодні?*', hint: 'Коротко одним-двома реченнями про головний намір дня.' };
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

/* ───── РАНОК: продовжити (callback: continue_morning) ───── */
export const handleContinueMorning = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const userRec = await getUserRecord(tgId);
    const todayRec = await getOrCreateTodayResponse(tgId);

    const nextField = getNextMorningField(todayRec.fields);
    if (!nextField) {
      await setResponsesCurrentActivity(todayRec.id, 'morning_completed');
      await setUserAnswerStep(userRec, ANSWER_STEPS.IDLE);
      await ctx.reply('✅ Ранок вже завершено. Обери наступну дію:', keyboards.mainMenuKeyboard());
      try { await ctx.answerCbQuery(); } catch {}
      return true;
    }

    if (!ctx.session.daily) ctx.session.daily = {};
    ctx.session.daily.awaiting = fieldToAwaiting(nextField);

    await setResponsesCurrentActivity(todayRec.id, nextField === 'Daily_Focus' ? CA.DAILY_FOCUS : nextField);
    if (nextField === 'Daily_Focus') {
      await setUserAnswerStep(userRec, ANSWER_STEPS.DAILY_FOCUS);
    } else {
      const n = Number(nextField.split('_')[2]);
      await setUserAnswerStep(userRec, ANSWER_STEPS[`MORNING_${n}`]);
    }

    const q = questionForField(nextField);
    await ctx.reply(renderQuestionWithHint(q), { parse_mode: 'Markdown', ...keyboards.buildExitKeyboard() });
    try { await ctx.answerCbQuery(); } catch {}
    return true;
  } catch (e) {
    logger.error('[daily/handleContinueMorning] ❌', e);
    return false;
  }
};

//+++++++++++++
const eveningStarted = (fields = {}) =>
  EVENING_ORDER.some(f => {
    const v = fields[f]; return v && String(v).trim() !== '';
  });

const getNextEveningField = (fields = {}) => {
  for (const f of EVENING_ORDER) {
    const v = fields[f];
    if (!v || String(v).trim() === '') return f;
  }
  return null;
};

const clearEveningFields = async (respId) => {
  const patch = {};
  EVENING_ORDER.forEach(f => patch[f] = null);
  await base(tables.RESPONSES).update(respId, patch);
};

export const handleStartEvening = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const userRec = await getUserRecord(tgId);

    const todayRec = await getTodayResponseOrNull(tgId);
    // якщо взагалі немає рядка сьогодні — створюємо (бо вечір без ранку можливий)
    const rec = todayRec || await createTodayResponse(tgId);

    if (eveningStarted(rec.fields)) {
      const nextField = getNextEveningField(rec.fields) || 'Q_e_7';
      const idx = Number(nextField.split('_')[2]) - 1;
      const q = QUESTIONS.evening[idx];

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

    // вечеря ще не почата — питаємо перше вечірнє
    const first = 'Q_e_1';
    if (!ctx.session.daily) ctx.session.daily = {};
    ctx.session.daily.awaiting = first.toLowerCase(); // q_e_1

    await setResponsesCurrentActivity(rec.id, first);
    await setUserAnswerStep(userRec, ANSWER_STEPS.EVENING_1);

    const q = QUESTIONS.evening[0];
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
    const userRec = await getUserRecord(tgId);
    const todayRec = await getTodayResponseOrNull(tgId);
    const rec = todayRec || await createTodayResponse(tgId);

    await clearEveningFields(rec.id);

    if (!ctx.session.daily) ctx.session.daily = {};
    ctx.session.daily.awaiting = 'q_e_1';

    await setResponsesCurrentActivity(rec.id, 'Q_e_1');
    await setUserAnswerStep(userRec, ANSWER_STEPS.EVENING_1);

    const q = QUESTIONS.evening[0];
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

//+++++++++++

export const handleContinueEvening = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const userRec = await getUserRecord(tgId);
    const todayRec = await getOrCreateTodayResponse(tgId);


    // знайти наступне незаповнене
    const getNextEveningField = (fields) => {
      for (const f of EVENING_ORDER) {
        const v = fields?.[f];
        if (!v || String(v).trim() === '') return f;
      }
      return null;
    };

    const nextField = getNextEveningField(todayRec.fields);
    if (!nextField) {
      await setResponsesCurrentActivity(todayRec.id, 'evening_completed');
      await setUserAnswerStep(userRec, ANSWER_STEPS.IDLE);
      await ctx.reply('✅ Вечір уже завершено. Обери наступну дію:', keyboards.mainMenuKeyboard());
      try { await ctx.answerCbQuery(); } catch {}
      return true;
    }

    // встановлюємо поточний стан
    if (!ctx.session.daily) ctx.session.daily = {};
    ctx.session.daily.awaiting = nextField.toLowerCase(); // q_e_1...

    await setResponsesCurrentActivity(todayRec.id, nextField);
    const n = Number(nextField.split('_')[2]);
    await setUserAnswerStep(userRec, ANSWER_STEPS[`EVENING_${n}`]);

    // отримати питання з QUESTIONS.evening
    const q = QUESTIONS.evening[n - 1];
    if (!q) {
      await ctx.reply('⚠️ Не знайдено наступне питання для вечора.', keyboards.mainMenuKeyboard());
      return false;
    }

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

export const handleLaterMorning = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const todayRec = await getOrCreateTodayResponse(tgId);
    const nextField = getNextMorningField(todayRec.fields);
    if (nextField) await setResponsesCurrentActivity(todayRec.id, 'morning_pending');
    await ctx.reply('⏭ Добре, нагадаю пізніше. Повертаємось у меню.', keyboards.mainMenuKeyboard());
    return true;
  } catch { return false; }
};

/* Вечір — базове (без змін логіки) */

export const handleLaterEvening = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const todayRec = await getOrCreateTodayResponse(tgId);
    await setResponsesCurrentActivity(todayRec.id, 'evening_pending');
    await ctx.reply('⏭ Ок, закриваю на зараз. Повертаємось у меню.', keyboards.mainMenuKeyboard());
    return true;
  } catch { return false; }
};

export const handleExitSession = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const todayRec = await getOrCreateTodayResponse(tgId);
    const nextField = getNextMorningField(todayRec.fields);
    if (nextField) await setResponsesCurrentActivity(todayRec.id, 'morning_pending');
    const userRec = await getUserRecord(tgId);
    await setUserAnswerStep(userRec, ANSWER_STEPS.IDLE);
    ctx.session.daily = null;
    await ctx.reply('🚪 Сесію завершено.', keyboards.mainMenuKeyboard());
    return true;
  } catch { return false; }
};

export const handleSkipMorningDoEvening = async (ctx) => {
  try {
    await ctx.reply('⏭ Пропускаємо ранок. Запускаю вечірню сесію…');
    return await handleStartEvening(ctx);
  } catch { return false; }
};

/* Текстовий роутер — збереження відповіді + перехід далі */
export const handleText = async (ctx, textRaw) => {
  const text = (textRaw ?? ctx.message?.text ?? '').trim();
  const lower = text.toLowerCase();

  try {
    // прямі тригери
    if (lower.includes('ранков')) return await handleStartMorning(ctx);
    if (lower.includes('вечір'))  return await handleStartEvening(ctx);

    // немає очікування — не наш кейс
    const awaiting = ctx.session?.daily?.awaiting;
    if (!awaiting) return false;

    const tgId = ctx.from.id;
    const userRec = await getUserRecord(tgId);
    const todayRec = await getOrCreateTodayResponse(tgId);

    // яке поле зберігаємо
    const field = awaitingToField(awaiting);
    const value =
      field === 'Daily_Focus' ? trim(text, 500) :
      field.startsWith('Q_m_') ? trim(text, 2000) : trim(text, 1000);

    await base(tables.RESPONSES).update(todayRec.id, { [field]: value });

    // оновити індикатори/крок
    if (field === 'Daily_Focus') {
      await setResponsesCurrentActivity(todayRec.id, CA.DAILY_FOCUS);
      await setUserAnswerStep(userRec, ANSWER_STEPS.DAILY_FOCUS);
    }

    // перевірити наступне поле
    const fresh = await base(tables.RESPONSES).find(todayRec.id);
    const nextField = getNextMorningField(fresh.fields);

    if (!nextField) {
      ctx.session.daily.awaiting = null;
      await setUserAnswerStep(userRec, ANSWER_STEPS.IDLE);
      await setResponsesCurrentActivity(todayRec.id, 'morning_completed');

      const doneKb = typeof keyboards.doneMorningKeyboard === 'function'
        ? keyboards.doneMorningKeyboard()
        : keyboards.mainMenuKeyboard();

      await ctx.reply('✅ Ранковий блок завершено. Гарного дня!', doneKb);
      return true;
    }

    // продовжуємо
    ctx.session.daily.awaiting = fieldToAwaiting(nextField);
    await setResponsesCurrentActivity(todayRec.id, nextField === 'Daily_Focus' ? CA.DAILY_FOCUS : nextField);

    if (nextField === 'Daily_Focus') {
      await setUserAnswerStep(userRec, ANSWER_STEPS.DAILY_FOCUS);
    } else {
      const n = Number(nextField.split('_')[2]); // 1..6
      await setUserAnswerStep(userRec, ANSWER_STEPS[`MORNING_${n}`]);
    }

    const q = questionForField(nextField);
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

/* стаби планувальника */
export const sendMorningReminders = async () => { logger.info('[daily] sendMorningReminders stub'); };
export const sendEveningReminders = async () => { logger.info('[daily] sendEveningReminders stub'); };

export default {
  handleStartMorning,
  handleContinueMorning,
  handleContinueEvening,
  handleLaterMorning,
  handleStartEvening,
  handleLaterEvening,
  handleExitSession,
  handleSkipMorningDoEvening,
  handleText,
  sendMorningReminders,
  sendEveningReminders,
};
