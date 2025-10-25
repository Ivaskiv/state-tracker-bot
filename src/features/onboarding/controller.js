// src/features/onboarding/controller.js
import * as QE from '../../services/questionEngine.js';
import keyboards from '../../utils/keyboards.js';
import { ONBOARDING_CONFIG } from './config.js';
import { MESSAGES, CALLBACKS } from './constants.js';
import { getUserByTgId, createUser } from '../../services/users.js';
import { getUserStats } from '../../services/stats.js';
import { formatDate, getDaysWord } from '../../utils/helpers.js';
import callbacks from '../../services/callbacks.js';

const tgIdOf = (ctx) => String(ctx.from?.id || ctx.chat?.id);
const cfgWithRecord = (recordId) => ({ ...ONBOARDING_CONFIG, recordId });

const buildWelcomeBackText = ({
userName,
  wheelCompleted,
  wheelCompletedDate,
  nextWheelDate,
  currentStreak,
  lastSessionDate,
  subscriptionLabel
}) => {
const wheelLine = wheelCompleted
    ? (
        wheelCompletedDate
          ? `✅ Заповнено ${formatDate(wheelCompletedDate)}${nextWheelDate ? `, наступне ${formatDate(nextWheelDate)}` : ''}`
          : '✅ Заповнено'
      )
    : '❌ Ще ні';
  
 const streakLine = currentStreak > 0
    ? `${currentStreak} ${getDaysWord(currentStreak)} поспіль`
    : '—';

  const lastStr = lastSessionDate ? formatDate(lastSessionDate) : 'немає даних';

  return (
    `👋 Рада вітати тебе знову, ${userName}!\n\n` +
    `Ось коротко про твої справи:\n\n` +
    `🎯 Колесо балансу — ${wheelLine}\n\n` +
    `🔥 Активність — ${streakLine}\n\n` +
    `📊 Остання сесія — ${lastStr}\n\n` +
    `💰 Підписка — ${subscriptionLabel}\n\n` +
    `🛞 Нагадую:\n` +
    `Я — твій AI-ментор. Допомагаю тримати фокус і рухатись до балансу.\n` +
    `Підтримувати твою мотивацію, баланс і регулярний прогрес у головних сферах життя.\n\n` +
    `Можеш обрати дію в меню нижче — або просто чекати на автоматичні нагадування.`
  );
};

const looksRegisteredByFields = (f = {}) => {
  const hasProfile = Boolean(f['User Name'] || f.Email || f.Phone || f.Time_Zone);
  const step = String(f.Answer_Step || '').trim();
  const isDoneStep = ['COMPLETED', 'ob_done', 'OB_DONE'].includes(step);
  const status = String(f.Status || '').toLowerCase();
  const regStatus = status.includes('registered') || status.includes('active');
  return Boolean(
    f.UserRegistered ||
      isDoneStep ||
      regStatus ||
      (hasProfile && step && !/^ob_/i.test(step))
  );
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
  const text = `${q.emoji || '❓'} *${q.title}*\n\n${q.question}${
    q.hint ? `\n\n💡 ${q.hint}` : ''
  }`;
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
    : v.value ?? rawAnswer;

  await QE.saveAnswer(tgId, cfgWithRecord(recordId), currentIndex, processed);

  const stepNext = QE.getNextStep(ONBOARDING_CONFIG, currentIndex);
  if (stepNext.isCompleted) {
    await ctx.reply(
      stepNext.completionMessage || '✅ Готово!',
      keyboards.afterRegistrationKeyboard()
    );
    return true;
  }

  const nextQ = stepNext.nextQuestion;
  const text = `${nextQ.emoji || '❓'} *${nextQ.title}*\n\n${nextQ.question}${
    nextQ.hint ? `\n\n💡 ${nextQ.hint}` : ''
  }`;
  const kb = QE.getKeyboardForQuestion(nextQ);
  await ctx.reply(text, { parse_mode: 'Markdown', ...kb });
  return true;
};

const sendWelcomeBack = async (ctx, user) => {
  let stats = {};
  try {
    stats = await getUserStats(String(ctx.from?.id || ctx.chat?.id));
  } catch {}

  const text = buildWelcomeBackText({
    userName: user.fields['User Name'] || ctx.from?.first_name,
    wheelCompleted: !!stats?.wheelCompleted,
    wheelCompletedDate: stats?.wheelCompletedDate || null,
    nextWheelDate: stats?.nextWheelDate || null,
    currentStreak: stats?.currentStreak ?? 0,
    lastSessionDate: stats?.lastSessionDate || null,
    subscriptionLabel: stats?.subscriptionLabel || '❌ Немає активної підписки'
  });

  await ctx.reply(text, keyboards.mainMenuKeyboard());

  if (!stats?.wheelCompleted) {
  const oneLiner = 'Колесо балансу допомагає швидко оцінити 8 сфер життя і вибрати 2–3 пріоритети на місяць.';
  await ctx.reply(`${oneLiner}\n\nГотова пройти зараз?`, keyboards.wheelCtaInline());
}
};


export const start = async (ctx) => {
  const tgId = tgIdOf(ctx);
  const firstName = ctx.from?.first_name || '';

  let user = await getUserByTgId(tgId);

  if (user && (await isRegistered(user, tgId))) {
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

callbacks.onPrefix(CALLBACKS.TZ_PREFIX, (ctx, data) => {
  const slug = data.slice(CALLBACKS.TZ_PREFIX.length);
  return writeAnswerAndMove(ctx, slug);
});

callbacks.on('use_telegram_name', (ctx) => {
  const name = ctx.from?.first_name || '';
  return writeAnswerAndMove(ctx, name);
});

callbacks.on('enter_custom_name', (ctx) => askCurrent(ctx));

callbacks.on(CALLBACKS.SKIP_EMAIL, (ctx) => writeAnswerAndMove(ctx, '/skip'));
callbacks.on(CALLBACKS.SKIP_PHONE, (ctx) => writeAnswerAndMove(ctx, '/skip'));

callbacks.on(CALLBACKS.TRIAL, (ctx) => writeAnswerAndMove(ctx, CALLBACKS.TRIAL));
callbacks.on(CALLBACKS.WEEK, (ctx) => writeAnswerAndMove(ctx, CALLBACKS.WEEK));
callbacks.on(CALLBACKS.MONTH, (ctx) => writeAnswerAndMove(ctx, CALLBACKS.MONTH));
callbacks.on(CALLBACKS.YEAR, (ctx) => writeAnswerAndMove(ctx, CALLBACKS.YEAR));
callbacks.on(CALLBACKS.NO_SUBSCRIPTION, (ctx) => writeAnswerAndMove(ctx, CALLBACKS.NO_SUBSCRIPTION));

callbacks.on(CALLBACKS.START_REGISTRATION, (ctx) => askCurrent(ctx));
callbacks.on(CALLBACKS.SKIP_REGISTRATION, (ctx) => askCurrent(ctx));

callbacks.on(CALLBACKS.CONFIRM_NAME, (ctx) => askCurrent(ctx));
callbacks.on(CALLBACKS.CHANGE_NAME, (ctx) => askCurrent(ctx));
callbacks.on(CALLBACKS.BACK_EMAIL, (ctx) => askCurrent(ctx));
callbacks.on(CALLBACKS.BACK_PHONE, (ctx) => askCurrent(ctx));
callbacks.on(CALLBACKS.SKIP_NAME, (ctx) => askCurrent(ctx));

callbacks.on('start_wheel_now', async (ctx) => {
  const { startWheelFromText } = (await import('../dashboard/index.js'));
  return startWheelFromText(ctx);
});
callbacks.on('wheel_later', async (ctx) => {
  await ctx.reply('Ок! Можеш пройти колесо з меню: «🎯 Колесо балансу».', keyboards.mainMenuKeyboard());
  return true;
});
callbacks.on('wheel_info', async (ctx) => {
  await ctx.reply('Колесо балансу — швидка оцінка 8 сфер життя, щоб вибрати 2–3 пріоритети на місяць.');
  return true;
});


export default { start, onText };
