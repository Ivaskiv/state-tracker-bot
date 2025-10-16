// src/services/dailySessions/controller.js
import * as db from './repo.js';
import * as service from './service.js';
import keyboards from '../../utils/keyboards.js'; 
import * as sync from './sync.js';
import { ANSWER_STEPS, QUESTIONS } from '../../config/index.js';
import logger from '../../utils/logger.js';
import users from '../../services/users.js';

// ──────────────────────────────────────────────────────────────────────────────
// internal helpers
// ──────────────────────────────────────────────────────────────────────────────

const SESSION = Object.freeze({
  morning: {
    prefix: 'Q_m_',
    firstField: 'Q_m_1',
    completedFlag: 'morning_completed',
    firstAnswerStep: ANSWER_STEPS.MORNING_1,
    parse: (q, t, today) => service.parseMorningAnswer(q, t, today),
    sync: (tgId) => sync.syncMorningData(tgId),
  },
  evening: {
    prefix: 'Q_e_',
    firstField: 'Q_e_1',
    completedFlag: 'evening_completed',
    firstAnswerStep: ANSWER_STEPS.EVENING_1,
    parse: (q, t, today) => service.parseEveningAnswer(q, t, today),
    sync: (tgId) => sync.syncEveningData(tgId),
  },
});

// невеликий джиттер (1–3 хв) для background-completion
const completionDelayMs = () => (60 * 1000) * (1 + Math.floor(Math.random() * 3)); // 1..3 хв

const getUserName = (user) =>
  user?.fields?.['User Name'] || user?.['User Name'] || 'Користувач';

// ──────────────────────────────────────────────────────────────────────────────
// generic start
// ──────────────────────────────────────────────────────────────────────────────

const startSession = async (ctx, sessionType) => {
  const cfg = SESSION[sessionType];
  const tgId = ctx.from.id;

  logger.info(`🚀 [${sessionType}] Старт для ${tgId}`);

  try {
    const user = await users.getUserByTgId(tgId);

    // 0) спроба автозавершення, якщо вже все є
    const wasRecovered = await shared.checkAndCompleteSession(ctx, tgId, sessionType);
    if (wasRecovered) return;

    // 1) вечір вимагає завершений ранок
    if (sessionType === 'evening') {
      const isMorningDone = await db.isMorningCompleted(tgId);
      if (!isMorningDone) {
        await ctx.reply(
          service.formatEveningWithoutMorning(getUserName(user)),
          keyboards.buildEveningWithoutMorningKeyboard()
        );
        return;
      }
    }

    // 2) якщо вже починали — запропонувати рестарт
    const todayRecord = await db.getTodayRecord(tgId);
    if (todayRecord?.fields?.[cfg.firstField]) {
      await ctx.reply(
        service.formatRestartWarning(sessionType),
        keyboards.buildRestartWarningKeyboard(sessionType)
      );
      return;
    }

    // 3) ensure record + кроки
    await db.ensureTodayRecord(tgId, getUserName(user));
    await users.updateUserFields(tgId, { Answer_Step: cfg.firstAnswerStep });
    await db.updateTodayRecord(tgId, { Current_Activity: cfg.firstAnswerStep });

    // 4) питання №1
    const firstMsg = service.formatQuestionMessage(sessionType, 0);
    await ctx.reply(firstMsg.text, keyboards.buildExitKeyboard());

    logger.info(`✅ [${sessionType}] Запущено для ${tgId}`);
  } catch (error) {
    logger.error(`❌ [${sessionType}] start:`, error);
    await ctx.reply('❌ Помилка запуску. Спробуй /start');
    throw error;
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// generic answer handler
// ──────────────────────────────────────────────────────────────────────────────

const handleAnswer = async (ctx, text, questionNumber, sessionType) => {
  const cfg = SESSION[sessionType];
  const tgId = ctx.from.id;

  logger.info(`📝 [${sessionType}] Q${questionNumber} від ${tgId}`);

  try {
    // 1) беремо today для парсингу (вечір потребує ранкові поля)
    const todayRecord = await db.getTodayRecord(tgId);
    const todayData = todayRecord?.fields || {};

    // 2) парсимо → отримуємо похідні поля
    const parsed = cfg.parse(questionNumber, text, todayData) || {};

    // 3) зберігаємо відповідь + похідні
    const questionField = `${cfg.prefix}${questionNumber}`;
    const saved = await db.updateTodayRecord(tgId, {
      [questionField]: text,
      ...parsed,
    });
    if (!saved) throw new Error('Не вдалося зберегти відповідь');

    // 4) завершення чи наступне питання
    const total = QUESTIONS[sessionType].length;
    if (questionNumber >= total) {
      // completed
      await db.updateTodayRecord(tgId, { Current_Activity: cfg.completedFlag });
      await users.updateUserFields(tgId, { Answer_Step: ANSWER_STEPS.COMPLETED });

      // sync (best-effort)
      try { await cfg.sync(tgId); } catch (e) { logger.warn(`⚠️ [${sessionType}] Sync:`, e); }

      // фоновий completion (щоб не блокувати відповідь)
      setTimeout(async () => {
        const record = await db.getTodayRecord(tgId);
        await shared.showCompletionWithAnalysis(ctx, tgId, sessionType, record?.fields);
      }, completionDelayMs());

      logger.info(`🏁 [${sessionType}] Завершено для ${tgId}`);
      return { completed: true };
    }

    // next
    const nextQ = service.formatQuestionMessage(sessionType, questionNumber);
    await users.updateUserFields(tgId, { Answer_Step: nextQ.field });
    await db.updateTodayRecord(tgId, { Current_Activity: nextQ.field });
    await ctx.reply(nextQ.text, keyboards.buildExitKeyboard());

    return { completed: false };
  } catch (error) {
    logger.error(`❌ [${sessionType}] handleAnswer:`, error);
    throw error;
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// generic continue
// ──────────────────────────────────────────────────────────────────────────────

const continueSession = async (ctx, sessionType) => {
  const cfg = SESSION[sessionType];
  const tgId = ctx.from.id;

  logger.info(`▶️ [${sessionType}] Продовження для ${tgId}`);

  try {
    const user = await users.getUserByTgId(tgId);
    const currentStep = user?.Answer_Step;

    if (!currentStep || currentStep === ANSWER_STEPS.COMPLETED) {
      return startSession(ctx, sessionType);
    }

    const re = sessionType === 'morning' ? /Q_m_(\d+)/i : /Q_e_(\d+)/i;
    const match = currentStep.match(re);
    const questionNum = match ? parseInt(match[1], 10) : 1;
    const questionData = service.formatQuestionMessage(sessionType, questionNum - 1);

    if (!questionData) return startSession(ctx, sessionType);

    await ctx.reply(questionData.text, keyboards.buildExitKeyboard());
    logger.info(`✅ [${sessionType}] Продовжено на Q${questionNum}`);
  } catch (error) {
    logger.error(`❌ [${sessionType}] continue:`, error);
    const yesCb = sessionType === 'morning' ? 'start_morning' : 'start_evening';
    await ctx.reply('❌ Помилка. Почати заново?', {
      reply_markup: { inline_keyboard: [[{ text: 'Так', callback_data: yesCb }], [{ text: '🏠 Меню', callback_data: 'main_menu' }]] }
    });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// PUBLIC API (імена НЕ міняємо)
// ──────────────────────────────────────────────────────────────────────────────

// morning
export const startMorningSession = (ctx) => startSession(ctx, 'morning');
export const handleMorningAnswer = (ctx, text, questionNumber) =>
  handleAnswer(ctx, text, questionNumber, 'morning');
export const restartMorningSession = async (ctx) =>
  shared.restartSession(ctx, ctx.from.id, 'morning', startMorningSession);
export const exitMorningSession = async (ctx) =>
  shared.exitSession(ctx, ctx.from.id, 'morning');
export const continueMorningSession = (ctx) => continueSession(ctx, 'morning');

// evening
export const startEveningSession = (ctx) => startSession(ctx, 'evening');
export const handleEveningAnswer = (ctx, text, questionNumber) =>
  handleAnswer(ctx, text, questionNumber, 'evening');
export const restartEveningSession = async (ctx) =>
  shared.restartSession(ctx, ctx.from.id, 'evening', startEveningSession);
export const exitEveningSession = async (ctx) =>
  shared.exitSession(ctx, ctx.from.id, 'evening');
export const continueEveningSession = (ctx) => continueSession(ctx, 'evening');

console.log('✅ [dailySessions/controller] Завантажено');
