// src/aiMentor/services/dailyService.js

import responseService from './responseService.js';
import userService from './userService.js';
import keyboards from '../utils/keyboards.js';
import logger from '../utils/logger.js';
import { QUESTIONS, ANSWER_STEPS } from '../config/constants.js';
import dataSyncService from './dataSyncService.js';


const handleText = async (ctx, text, userStep) => {
  try {
    const { tgId, sessionType, questionNumber } = userStep;

    if (sessionType === 'morning') {
      await responseService.saveMorningAnswer(tgId, questionNumber, text);
    } else if (sessionType === 'evening') {
      await responseService.saveEveningAnswer(tgId, questionNumber, text);
    }

    return true;
  } catch (error) {
    logger.error('[dailyService] ❌ handleText:', error);
    throw error;
  }
};

const handleCallback = async (ctx, data) => {
  try {
    // data може бути рядком або об'єктом — приведемо до string
    const raw = typeof data === 'string' ? data : (data?.data || '');
    if (!raw) return;

    // стандартні callback'и: "daily:choice"
    if (raw.startsWith('daily:')) {
      const choice = raw.split(':')[1];
      // choice: morning | skip_morning | evening | exit
      await handleEveningChoice(ctx, choice);
      try { await ctx.answerCbQuery(); } catch (e) { /* silent */ }
      return;
    }

    if (raw === 'exit_session') {
      const sessionType = (data?.sessionType) || 'morning';
      await exitSession(ctx, sessionType);
      try { await ctx.answerCbQuery(); } catch (e) { /* silent */ }
    }
  } catch (error) {
    logger.error('[dailyService] ❌ handleCallback:', error);
    try { await ctx.answerCbQuery('Помилка'); } catch (e) {}
  }
};

const _sendQuestion = async (ctx, type, index) => {
  const isMorning = type === 'morning';
  const questions = isMorning ? QUESTIONS.morning : QUESTIONS.evening;
  const q = questions[index];
  if (!q) throw new Error('Question not found');

  const total = questions.length;
  const emojiNumbers = ['0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'];
  const currentEmoji = emojiNumbers[index + 1] || `${index + 1}.`;

  const icon = isMorning ? '🌞' : '🌙';
  const title = isMorning ? 'РАНКОВА РЕФЛЕКСІЯ' : 'ВЕЧІРНЯ РЕФЛЕКСІЯ';
  const questionLines = q.text.split('\n');
  const questionTitle = questionLines[0];

  const message =
    `${icon} ${title}\n\n` +
    `${currentEmoji}/${total} ${questionTitle}\n` +
    (q.hint ? `💡 ${q.hint}` : '');

  const keyboard = (keyboards?.utils?.skipKeyboard && keyboards.utils.skipKeyboard('question'))
    ? keyboards.utils.skipKeyboard('question')
    : { reply_markup: { remove_keyboard: true } };

  await ctx.reply(message, keyboard);
};

const startSession = async (ctx, type) => {
  const tgId = ctx.from.id;
  logger.info(`[dailyService] 🚀 startSession type="${type}" tgId=${tgId}`);

  try {
    const isMorning = type === 'morning';

    if (!isMorning) {
      // Перевіряємо: чи пройдено ранкові сьогодні? Якщо ні — пропонуємо варіанти.
      const isMorningDone = await responseService.isMorningCompleted(tgId);
if (!isMorningDone) {
  await ctx.reply(
    '⚠️ Ти ще не пройшла ранкові питання сьогодні. Що бажаєш?',
    keyboards.eveningWithoutMorningKeyboard()
  );
  return;
}    }

    // отримуємо/створюємо сьогоднішній запис
    let todayRecord = await responseService._getTodayRecord(tgId);

    // якщо є відповіді — попереджаємо про перезапис
    if (todayRecord) {
      const fields = todayRecord.fields || {};
      const hasAnswers = isMorning
        ? !!(fields.Q_m_1 || fields.Q_m_2 || fields.Q_m_3 || fields.Q_m_4 || fields.Q_m_5 || fields.Q_m_6 || fields.affirmation_m)
        : !!(fields.Q_e_1 || fields.Q_e_2 || fields.Q_e_3 || fields.Q_e_4 || fields.Q_e_5 || fields.Q_e_6 || fields.Q_e_7 || fields.affirmation_e);

if (hasAnswers && !String(fields.Current_Activity || '').startsWith(isMorning ? 'Q_m' : 'Q_e')) {
  await ctx.reply(
    `⚠️ Ти вже пройшла ${isMorning ? 'ранкову' : 'вечірню'} рефлексію сьогодні!\n\nЯкщо почнеш заново, попередні відповіді будуть перезаписані.\n\nЩо робимо?`,
    keyboards.restartWarningKeyboard(type)
  );
  return;
}
    }

    // створюємо запис, якщо нема
    if (!todayRecord) {
      const today = new Date().toISOString().split('T')[0];
      const user = await userService.getUserByTgId(tgId);
      await responseService._createOrUpdateRecord(tgId, {
        Date_Response: today,
        'User Name': user?.['User Name'] || 'Користувач'
      });
      todayRecord = await responseService._getTodayRecord(tgId);
      logger.info('[dailyService] 📝 Створено новий запис у Responses');
    }

    // ставимо початковий крок
    const initialStep = isMorning ? ANSWER_STEPS.MORNING_1 : ANSWER_STEPS.EVENING_1;
    await userService.updateUserFields(tgId, { ANSWER_STEPS: initialStep });
    await responseService._createOrUpdateRecord(tgId, { Current_Activity: initialStep });

    logger.info(`[dailyService] ✅ ANSWER_STEPS та Current_Activity встановлено: ${initialStep}`);

    // відправляємо перше питання
    await _sendQuestion(ctx, type, 0);

  } catch (error) {
    logger.error('[dailyService] ❌ startSession error:', error);
    try { await ctx.reply('❌ Помилка запуску сесії. Спробуй /start', (keyboards && keyboards.mainMenuKeyboard) ? keyboards.mainMenuKeyboard() : {}); } catch (e) {}
    throw error;
  }
};

const restartSession = async (ctx, type) => {
  const tgId = ctx.from.id;
  logger.info(`[dailyService] 🔄 restartSession type="${type}" tgId=${tgId}`);

  try {
    // Використаємо responseService.resetSession якщо доступний, інакше зробимо ручне скидання
    if (typeof responseService.resetSession === 'function') {
      await responseService.resetSession(tgId, type);
      logger.info('[dailyService] 🧹 resetSession via responseService.resetSession');
    } else {
      // fallback: ручне скидання полів
      const fieldsToReset = {};
      if (type === 'morning') {
        for (let i = 1; i <= 6; i++) fieldsToReset[`Q_m_${i}`] = null;
        fieldsToReset.affirmation_m = null;
        fieldsToReset.Current_Activity = null;
      } else {
        for (let i = 1; i <= 7; i++) fieldsToReset[`Q_e_${i}`] = null;
        fieldsToReset.affirmation_e = null;
        fieldsToReset.Actions_Completed_Count = null;
        fieldsToReset.Actions_Completed_List = null;
        fieldsToReset.Actions_Skipped_List = null;
        fieldsToReset.Completion_Rate = null;
        fieldsToReset.Current_Activity = null;
      }
      await responseService._createOrUpdateRecord(ctx.from.id, fieldsToReset);
    }

    const initialStep = type === 'morning' ? ANSWER_STEPS.MORNING_1 : ANSWER_STEPS.EVENING_1;
    await userService.updateUserFields(ctx.from.id, { ANSWER_STEPS: initialStep });

    return startSession(ctx, type);
  } catch (error) {
    logger.error('[dailyService] ❌ restartSession error:', error);
    try { await ctx.reply('❌ Помилка перезапуску сесії. Спробуй ще раз.'); } catch (e) {}
    throw error;
  }
};

const continueEveningSession = async (ctx) => {
  const tgId = ctx.from.id;
  logger.info(`[dailyService] ▶️ continueEveningSession tgId=${tgId}`);

  try {
    const user = await userService.getUserByTgId(tgId);
    const currentStep = user?.ANSWER_STEPS;

    if (!currentStep || currentStep === 'completed') {
      return startSession(ctx, 'evening');
    }

    const match = (currentStep || '').match(/Q_e_(\d+)/i);
    const questionNum = match ? parseInt(match[1], 10) : 1;
    const idx = Math.max(0, questionNum - 1);
    const questions = QUESTIONS.evening || [];
    const question = questions[idx];

    if (!question) return startSession(ctx, 'evening');

    await _sendQuestion(ctx, 'evening', idx);
    logger.info(`[dailyService] ✅ Продовжено вечірню на питанні ${questionNum}`);
  } catch (error) {
    logger.error('[dailyService] ❌ continueEveningSession error:', error);
    try {
      await ctx.reply('❌ Помилка. Розпочнемо спочатку?', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🌙 Почати спочатку', callback_data: 'daily:evening' }],
            [{ text: '🏠 Головне меню', callback_data: 'main_menu' }]
          ]
        }
      });
    } catch (e) {}
  }
};

const exitSession = async (ctx, type) => {
  const tgId = ctx.from.id;
  logger.info(`[dailyService] 🚪 exitSession type="${type}" tgId=${tgId}`);

  try {
    // Завершуємо сесію: якщо користувач вийшов без афірмації — ставимо completed і синхронізуємо.
    const activityField = type === 'morning' ? 'morning_completed' : 'evening_completed';
    await responseService._createOrUpdateRecord(tgId, { Current_Activity: activityField });
    await userService.updateUserFields(tgId, { ANSWER_STEPS: 'completed' });

    try {
      await ctx.reply(`✅ Сесію ${type === 'morning' ? 'ранкову' : 'вечірню'} завершено!`, (keyboards && keyboards.mainMenuKeyboard) ? keyboards.mainMenuKeyboard() : {});
    } catch (e) {}

    // синхронізація
    if (type === 'morning') {
      try { await dataSyncService.syncMorningData(tgId); } catch (e) { logger.error(e); }
    } else {
      try { await dataSyncService.syncEveningData(tgId); } catch (e) { logger.error(e); }
    }

    logger.info(`[dailyService] ✅ Сесія ${type} завершена для ${tgId}`);
  } catch (error) {
    logger.error('[dailyService] ❌ exitSession error:', error);
    try { await ctx.reply('❌ Помилка завершення сесії'); } catch (e) {}
  }
};

const handleEveningChoice = async (ctx, choice) => {
  try {
    switch (choice) {
      case 'morning':
        await startSession(ctx, 'morning');
        break;
      case 'skip_morning':
        // пропускаємо перевірку ранку і запускаємо вечірні
        await startSession(ctx, 'evening');
        break;
      case 'evening':
        await startSession(ctx, 'evening');
        break;
      case 'exit':
        await exitSession(ctx, 'evening');
        break;
      default:
        logger.info('[dailyService] handleEveningChoice: unknown choice', choice);
    }
  } catch (error) {
    logger.error('[dailyService] ❌ handleEveningChoice error:', error);
    try { await ctx.reply('❌ Помилка обробки вибору'); } catch (e) {}
  }
};

const dailyService = {
  handleText,
  handleCallback,
  startSession,
  restartSession,
  continueEveningSession,
  exitSession,
  handleEveningChoice
};

export default dailyService;

