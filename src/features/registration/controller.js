// src/features/registration/controller.js
import * as QE from '../../services/questionEngine.js';
import keyboards from '../../utils/keyboards.js';
import { ONBOARDING_CONFIG } from './config.js';
import { MESSAGES, CALLBACKS, PITCH_TILDA, shouldShowPitch } from './constants.js';
import { getUserStats } from '../../services/stats.js';
import { formatDate, getDaysWord, parseStartPayload } from '../../utils/helpers.js';
import callbacks from '../../services/callbacks.js';
import { createUser, getUserByTgId, updateUserFields, hasActiveAccess } from '../../services/users.js'; 

import { getRegistrationData } from './service.js'; 
import * as gamification from '../../core/gamification/rewards.js'; 
import logger from '../../utils/logger.js';

const tgIdOf = (ctx) => String(ctx.from?.id || ctx.chat?.id);
const cfgWithRecord = (recordId) => ({ ...ONBOARDING_CONFIG, recordId });

const buildWelcomeBackText = ({
  userName,
  wheelCompleted,
  wheelCompletedDate,
  nextWheelDate,
  currentStreak,
  lastSessionDate,
  subscriptionLabel,
}) => {
  const wheelLine = wheelCompleted
    ? (wheelCompletedDate
        ? `✅ Заповнено ${formatDate(wheelCompletedDate)}${nextWheelDate ? `, наступне ${formatDate(nextWheelDate)}` : ''}`
        : '✅ Заповнено')
    : '❌ Ще ні';

  const streakLine = currentStreak > 0 ? `${currentStreak} ${getDaysWord(currentStreak)} поспіль` : '—';
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

const askCurrent = async (ctx) => {
  const tgId = tgIdOf(ctx);
  let session = await QE.getSessionState(tgId, ONBOARDING_CONFIG);
  if (!session) session = await QE.initializeSession(tgId, ONBOARDING_CONFIG);

  if (session.isCompleted) return true;

  const q = QE.getQuestion(ONBOARDING_CONFIG, session.currentIndex);
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
  const text = `${nextQ.emoji || '❓'} *${nextQ.title}*\n\n${nextQ.question}${nextQ.hint ? `\n\n💡 ${q.hint}` : ''}`;
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
    subscriptionLabel: stats?.subscriptionLabel || '❌ Немає активної підписки',
  });

  await ctx.reply(text, keyboards.mainMenuKeyboard());

  if (!stats?.wheelCompleted) {
    const oneLiner =
      'Колесо балансу допомагає швидко оцінити 8 сфер життя і вибрати 2–3 пріоритети на місяць.';
    await ctx.reply(`${oneLiner}\n\nГотова пройти зараз?`, keyboards.wheelCtaInline());
  }
  return true;
};
export const start = async (ctx) => {
  try {
    const tgId = tgIdOf(ctx);
    const firstName = (ctx.from.first_name || '').trim();
    const rawPayload = 
      ctx.startPayload || 
      ctx.state?.rawPayload || 
      ctx.message?.text?.split(' ')[1] || 
      '';
    const payload = parseStartPayload(rawPayload);
    console.log('[start] 🎯 Payload:', { raw: rawPayload, parsed: payload });

    // 1) Перевірка користувача з service.js
    const userData = await getRegistrationData(tgId);
    
if (!userData) {
  console.log('[start] 📝 Новий користувач → створюємо профіль');
  // const nowIso = new Date().toISOString();

  // const newUserFields = {
  //   'User Name': firstName,
  //   Status: 'New User',
  //   UserRegistered: false,
  //   'Subscription Status': 'New',
  //   Answer_Step: 'Registration',
  //   Last_Activity: nowIso,
  // };

  await createUser(tgId, firstName);

  // 🎮 Гейміфікація
  await gamification.rewardRegistration(tgId);

  // 📊 Attribution (але треба імпорт і nowIso)
  if (payload.source) {
    await upsertAttribution(tgId, {
      source: payload.source,
      segment: payload.segment,
      utm: payload.utm,
      timestamp: nowIso,
    });
  }

  if (shouldShowPitch(payload, { fields: {} })) {
    await ctx.reply(PITCH_TILDA);
  }

  await ctx.reply(MESSAGES.WELCOME(firstName), keyboards.nameChoiceInline());
  return askCurrent(ctx);
}

    // 2) Користувач існує — продовжити з поточного кроку
    const step = userData.Answer_Step || 'ob_name';
    const isOnboarding = /^ob_/i.test(step);

    if (isOnboarding) {
      console.log('[start] 📝 Продовження онбордингу з кроку:', step);
      await ctx.reply(MESSAGES.WELCOME(firstName), keyboards.nameChoiceInline());
      return askCurrent(ctx);
    }

    // 3) Спец-пейлоади з Tilda
    if (payload.source === 'tilda' && payload.segment === 'burnout') {
      console.log('[start] 🎬 Маршрутизація → 5-video funnel');
      
      await ctx.reply(
        `👋 Вітаю, ${firstName}!\n\n` +
        `Це 5-денний курс «Поверни себе з вигорання».\n\n` +
        `Ти отримаєш:\n` +
        `🎥 5 потужних відео\n` +
        `💪 Практичні завдання\n` +
        `🎁 7 днів AI-наставника при завершенні\n\n` +
        `Готова почати? 👇`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎬 Почати курс', callback_data: 'start_funnel' }],
              [{ text: 'ℹ️ Дізнатись більше', url: 'https://yoursite.tilda.ws/free-course' }],
            ]
          }
        }
      );
      return;
    }

    if (payload.raw.startsWith('trial7_from_tilda')) {
      console.log('[start] 🎁 Маршрутизація → 7-day trial + wheel');
      
      // Активувати 7-денний trial
      await activateTrial(tgId, 7);
      
      await ctx.reply(
        `🎉 Активовано 7 днів з AI-наставником!\n\n` +
        `Перший крок — заповнити «Колесо балансу».\n` +
        `Це швидкий аудит 8 сфер життя (5-10 хвилин).\n\n` +
        `Готова? 👇`,
        keyboards.wheelCtaInline()
      );
      return;
    }

    // 4) Повністю зареєстрований — welcome back
    console.log('[start] 🏠 Маршрутизація → General welcome back');
    await sendWelcomeBack(ctx, { fields: userData });

  } catch (err) {
    logger.error('[start]', err);
    await ctx.reply('❌ Помилка. Спробуй ще раз: /start');
  }
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

export const onCallback = async () => true;

export const start5v = async (ctx) => {
  const { sendWelcomeMessage } = await import('../free5videos/flow.js');
  await sendWelcomeMessage(ctx);
};

export const startTrial = async (ctx) => {
  const tgId = ctx.from.id;
  const user = await getUserByTgId(tgId);
  
  if (!hasActiveAccess(user)) {
 await activateTrial(tgId, 7);
  }
  await ctx.reply(MESSAGES.TRIAL_WELCOME, keyboards.wheelCtaInline());
};

// ДОДАТИ callbacks
callbacks.on('start_5video', start5v);
callbacks.on('start_7day_trial', startTrial);
// ═══════════════════════════════════════════════════════════════════════════════
// 🔘 CALLBACKS REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════════
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
  const { startWheelFromText } = await import('../dashboard/index.js');
  return startWheelFromText(ctx);
});

callbacks.on('wheel_later', async (ctx) => {
  await ctx.answerCbQuery('✅ Добре!');
  const message =
    `✅ Без проблем!\n\n` +
    `🎡 Колесо чекає на тебе в меню:\n` +
    `👉 **🎯 Колесо балансу**\n\n` +
    `Займе всього 5–10 хвилин, а результат допоможе визначити пріоритети на місяць 📊`;
  await ctx.reply(message, keyboards.mainMenuKeyboard());
  return true;
});

callbacks.on('wheel_info', async (ctx) => {
  await ctx.answerCbQuery('ℹ️ Інформація...');
  const { showWheelInfo } = await import('../dashboard/index.js');
  return showWheelInfo(ctx);
});

callbacks.on('skip_first_wheel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    `⚠️ Колесо балансу обов'язкове!\n\n` +
    `Без нього пробний період не активується.\n` +
    `Займе лише 5-10 хвилин.\n\n` +
    `Готова почати?`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎯 Так, почати', callback_data: 'wheel_start' }],
          [{ text: '📞 Підтримка', callback_data: 'contact_support' }]
        ]
      }
    }
  );
});

export default { start, onText, onCallback };