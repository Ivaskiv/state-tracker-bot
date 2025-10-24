// src/features/onboarding/controller.js
import * as QE from '../../services/questionEngine.js';
import keyboards from '../../utils/keyboards.js';
import { ONBOARDING_CONFIG } from './config.js';
import { MESSAGES, CALLBACKS, SCHEDULE_CONFIG } from './constants.js';
import { getUserByTgId, createUser } from '../../services/users.js';
import { getUserStats } from '../../services/stats.js';
import { formatDate } from '../../utils/helpers.js';

const tgIdOf = (ctx) => String(ctx.from?.id || ctx.chat?.id);
const cfgWithRecord = (recordId) => ({ ...ONBOARDING_CONFIG, recordId });

const buildWelcomeBackText = ({ userName, wheelCompleted, currentStreak, maxStreak, lastSessionDate, subscriptionLabel }) => {
  const wheelStatus = wheelCompleted ? '✅ Заповнено' : '❌ Ще ні';
  const streakLine = maxStreak && maxStreak > currentStreak
    ? `${currentStreak} днів поспіль (макс. ${maxStreak})`
    : `${currentStreak} днів поспіль`;
  const lastStr = lastSessionDate ? formatDate(lastSessionDate) : 'немає даних';
  return (
`👋 Рада вітати тебе знову, ${userName}!

Я — твій AI-ментор. Допомагаю тримати фокус і рухатись до балансу.

Ось коротко про твої справи:

🛞 Колесо балансу — ${wheelStatus}
🔥 Активність — ${streakLine}
📊 Остання сесія — ${lastStr}
💰 Підписка — ${subscriptionLabel}

🎯 Мета бота:
Підтримувати твою мотивацію, баланс і регулярний прогрес у головних сферах життя.

Можеш обрати дію в меню нижче — або просто чекати на автоматичні нагадування:
• 🌞 ${SCHEDULE_CONFIG.MORNING_TIME} — ранкові питання
• 🌙 ${SCHEDULE_CONFIG.EVENING_TIME} — вечірні питання
• 📈 щотижневі звіти та 🛞 колесо раз на місяць`
  );
};

const looksRegisteredByFields = (f = {}) => {
  const hasProfile = Boolean(f['User Name'] || f.Email || f.Phone || f.Time_Zone);
  const step = String(f.Answer_Step || '').trim();
  const isDoneStep = ['COMPLETED', 'ob_done', 'OB_DONE'].includes(step);
  const status = String(f.Status || '').toLowerCase();
  const regStatus = status.includes('registered') || status.includes('active');
  return Boolean(f.UserRegistered || isDoneStep || regStatus || (hasProfile && step && !/^ob_/i.test(step)));
};

const isRegistered = async (user, tgId) => {
  const f = user?.fields || {};
  if (looksRegisteredByFields(f)) return true;
  const state = await QE.getSessionState(tgId, ONBOARDING_CONFIG);
  return Boolean(state && state.isCompleted);
};

const askCurrent = async (ctx) => {
  const tgId = tgIdOf(ctx);
  let session = await QE.getSessionState(tgId, ONBOARDING_CONFIG);
  if (!session) session = await QE.initializeSession(tgId, ONBOARDING_CONFIG);
  const { currentIndex, isCompleted } = session;
  if (isCompleted) return true;
  const q = QE.getQuestion(ONBOARDING_CONFIG, currentIndex);
  const text = `${q.emoji || '❓'} *${q.title}*\n\n${q.question}${q.hint ? `\n\n💡 ${q.hint}` : ''}`;
  const kb = QE.getKeyboardForQuestion(q);
  await ctx.reply(text, { parse_mode: 'Markdown', ...kb });
  return true;
};

const writeAnswerAndMove = async (ctx, rawAnswer) => {
  const tgId = tgIdOf(ctx);
  let session = await QE.getSessionState(tgId, ONBOARDING_CONFIG);
  if (!session) session = await QE.initializeSession(tgId, ONBOARDING_CONFIG);
  const { currentIndex, recordId } = session;

  const q = QE.getQuestion(ONBOARDING_CONFIG, currentIndex);
  if (!q) return false;

  const v = QE.validateAnswer(rawAnswer, q, ONBOARDING_CONFIG);
  if (!v.valid) {
    const err = v.error || '❌ Дані не відповідають формату. Спробуй ще раз.';
    await ctx.reply(err, QE.getKeyboardForQuestion(q));
    return true;
  }

  const processed = ONBOARDING_CONFIG.processAnswer
    ? ONBOARDING_CONFIG.processAnswer(v.value ?? rawAnswer, currentIndex)
    : (v.value ?? rawAnswer);

  await QE.saveAnswer(tgId, cfgWithRecord(recordId), currentIndex, processed);

  const stepNext = QE.getNextStep(ONBOARDING_CONFIG, currentIndex);
  if (stepNext.isCompleted) {
    await ctx.reply(stepNext.completionMessage || '✅ Готово!', keyboards.afterRegistrationKeyboard());
    return true;
  }

  const nextQ = stepNext.nextQuestion;
  const text = `${nextQ.emoji || '❓'} *${nextQ.title}*\n\n${nextQ.question}${nextQ.hint ? `\n\n💡 ${nextQ.hint}` : ''}`;
  const kb = QE.getKeyboardForQuestion(nextQ);
  await ctx.reply(text, { parse_mode: 'Markdown', ...kb });
  return true;
};

const sendWelcomeBack = async (ctx, user) => {
  let stats = {};
  try { stats = await getUserStats(String(ctx.from?.id || ctx.chat?.id)); } catch {}

  const text = buildWelcomeBackText({
    userName: user.fields['User Name'] || ctx.from?.first_name || 'Друже',
    wheelLastCompleted: stats?.wheelLastCompleted || null,
    streak: stats?.currentStreak ?? 0,
    lastSessionDate: stats?.lastSessionDate || null,
    subscriptionStatusText: stats?.subscriptionStatusText || '❌ Немає даних'
  });

  await ctx.reply(text, keyboards.mainMenuKeyboard());
};

export const start = async (ctx) => {
  const tgId = tgIdOf(ctx);
  const firstName = ctx.from?.first_name || 'Друже';

  let user = await getUserByTgId(tgId);

  if (user && await isRegistered(user, tgId)) {
    return sendWelcomeBack(ctx, user);
  }

  if (user) {
    await ctx.reply(MESSAGES.WELCOME(firstName), keyboards.nameChoiceInline());
    return askCurrent(ctx);
  }

  user = await createUser(tgId, firstName);
  await ctx.reply(MESSAGES.WELCOME(firstName), keyboards.nameChoiceInline());
  return askCurrent(ctx);
};

export const onText = async (ctx) => {
  const tgId = tgIdOf(ctx);
  const text = String(ctx.message?.text || '').trim();
  if (!text) return false;

  const user = await getUserByTgId(tgId);
  const state = await QE.getSessionState(tgId, ONBOARDING_CONFIG);

  if (user && state && !state.isCompleted) {
    return writeAnswerAndMove(ctx, text);
  }
  return false;
};

export const onCallback = async (ctx) => {
  const data = String(ctx.update?.callback_query?.data || '');

  if (data.startsWith(CALLBACKS.TZ_PREFIX)) {
    const slug = data.slice(CALLBACKS.TZ_PREFIX.length);
    return writeAnswerAndMove(ctx, slug);
  }

  if (data === 'use_telegram_name') {
    const name = ctx.from?.first_name || 'Друг';
    return writeAnswerAndMove(ctx, name);
  }

  if (data === 'enter_custom_name') {
    return askCurrent(ctx);
  }

  if (data === CALLBACKS.SKIP_EMAIL || data === CALLBACKS.SKIP_PHONE) {
    return writeAnswerAndMove(ctx, '/skip');
  }

  if ([CALLBACKS.TRIAL, CALLBACKS.WEEK, CALLBACKS.MONTH, CALLBACKS.YEAR, CALLBACKS.NO_SUBSCRIPTION].includes(data)) {
    return writeAnswerAndMove(ctx, data);
  }

  if (data === CALLBACKS.START_REGISTRATION || data === CALLBACKS.SKIP_REGISTRATION) {
    return askCurrent(ctx);
  }

  if ([CALLBACKS.CONFIRM_NAME, CALLBACKS.CHANGE_NAME, CALLBACKS.BACK_EMAIL, CALLBACKS.BACK_PHONE, CALLBACKS.SKIP_NAME].includes(data)) {
    return askCurrent(ctx);
  }

  return askCurrent(ctx);
};

export default { start, onText, onCallback };
