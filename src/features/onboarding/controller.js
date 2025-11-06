// src/features/onboarding/controller.js
import * as QE from '../../services/questionEngine.js';
import keyboards from '../../utils/keyboards.js';
import { ONBOARDING_CONFIG } from './config.js';
import { MESSAGES, CALLBACKS } from './constants.js';
import { getUserByTgId, createUser, ensureUserExists } from '../../services/users.js';
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

// const looksRegisteredByFields = (f = {}) => {
//   if (f.UserRegistered === true) {
//     return true;
//   }
//   const status = String(f.Status || '').toLowerCase();
//   const step = String(f.Answer_Step || '').trim();

//  if (status === 'new user' || status === 'new' || status === '') {
//     return false;
//   }
//   const isOnboardingStep = /^ob_/i.test(step) || step === 'pitch' || step === '';
//   if (isOnboardingStep) {
//     return false;
//   }
//   const hasProfile = Boolean(f['User Name'] || f.Email || f.Phone || f.Time_Zone);
//   const isDoneStep = ['COMPLETED', 'ob_done', 'OB_DONE'].includes(step);

//   const regStatus = status.includes('registered') || status.includes('active');
//   return Boolean(
//     f.UserRegistered ||
//       isDoneStep ||
//       regStatus ||
//       (hasProfile && step && !/^ob_/i.test(step))
//   );
// };

// const isRegistered = async (user, tgId) => {
//   const f = user?.fields || {};
//   if (looksRegisteredByFields(f)) return true;
//   const state = await QE.getSessionState(tgId, ONBOARDING_CONFIG);
//   return Boolean(state && state.isCompleted);
// };

const askCurrent = async (ctx) => {
  const tgId = tgIdOf(ctx);
  console.log('📝 [askCurrent] START:', { tgId });
  
  let session = await QE.getSessionState(tgId, ONBOARDING_CONFIG);
  console.log('📝 [askCurrent] Session state:', { 
    exists: !!session, 
    currentIndex: session?.currentIndex,
    isCompleted: session?.isCompleted,
    recordId: session?.recordId
  });
  
  if (!session) {
    console.log('📝 [askCurrent] Initializing new session...');
    session = await QE.initializeSession(tgId, ONBOARDING_CONFIG);
    console.log('📝 [askCurrent] New session created:', session);
  }
  
  const { currentIndex, isCompleted } = session;
  if (isCompleted) {
    console.log('✅ [askCurrent] Session already completed');
    return true;
  }
  
  const q = QE.getQuestion(ONBOARDING_CONFIG, currentIndex);
  console.log('❓ [askCurrent] Showing question:', { 
    index: currentIndex, 
    title: q?.title,
    hasKeyboard: !!q?.keyboard
  });
  
  const text = `${q.emoji || '❓'} *${q.title}*\n\n${q.question}${
    q.hint ? `\n\n💡 ${q.hint}` : ''
  }`;
  const kb = QE.getKeyboardForQuestion(q);
  await ctx.reply(text, { parse_mode: 'Markdown', ...kb });
  return true;
};

const writeAnswerAndMove = async (ctx, rawAnswer) => {
  const tgId = tgIdOf(ctx);
  console.log('💾 [writeAnswerAndMove] START:', { tgId, rawAnswer });
  
  let session = await QE.getSessionState(tgId, ONBOARDING_CONFIG);
  console.log('💾 [writeAnswerAndMove] Session:', { 
    exists: !!session,
    currentIndex: session?.currentIndex,
    recordId: session?.recordId
  });
  
  if (!session) {
    console.log('⚠️ [writeAnswerAndMove] No session, initializing...');
    session = await QE.initializeSession(tgId, ONBOARDING_CONFIG);
  }
  
  const { currentIndex, recordId } = session;
  const q = QE.getQuestion(ONBOARDING_CONFIG, currentIndex);
  
  if (!q) {
    console.error('❌ [writeAnswerAndMove] No question found for index:', currentIndex);
    return false;
  }

  const v = QE.validateAnswer(rawAnswer, q, ONBOARDING_CONFIG);
  console.log('🔍 [writeAnswerAndMove] Validation:', { 
    valid: v.valid, 
    error: v.error,
    value: v.value
  });
  
  if (!v.valid) {
    const err = v.error || '❌ Дані не відповідають формату. Спробуй ще раз.';
    await ctx.reply(err, QE.getKeyboardForQuestion(q));
    return true;
  }

  const processed = ONBOARDING_CONFIG.processAnswer
    ? ONBOARDING_CONFIG.processAnswer(v.value ?? rawAnswer, currentIndex)
    : v.value ?? rawAnswer;

  console.log('💾 [writeAnswerAndMove] Saving answer:', { 
    tgId, 
    recordId, 
    currentIndex, 
    processed 
  });
  
  await QE.saveAnswer(tgId, cfgWithRecord(recordId), currentIndex, processed);

  const stepNext = QE.getNextStep(ONBOARDING_CONFIG, currentIndex);
  console.log('➡️ [writeAnswerAndMove] Next step:', { 
    isCompleted: stepNext.isCompleted,
    nextIndex: stepNext.nextQuestion?.index
  });
  
  if (stepNext.isCompleted) {
    console.log('✅ [writeAnswerAndMove] Onboarding completed!');
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
  console.log('👋 [sendWelcomeBack] START:', { 
    tgId: tgIdOf(ctx),
    userName: user?.fields?.['User Name']
  });
  
  let stats = {};
  try {
    stats = await getUserStats(String(ctx.from?.id || ctx.chat?.id));
    console.log('📊 [sendWelcomeBack] Stats loaded:', stats);
  } catch (e) {
    console.error('❌ [sendWelcomeBack] Stats error:', e);
  }

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
  
  console.log('✅ [sendWelcomeBack] DONE');
};

export const start = async (ctx) => {
  const tgId = tgIdOf(ctx);
  const firstName = ctx.from?.first_name || '';
await ensureUserExists(tgId, firstName); 
  console.log('🚀 [START] ============================================');
  console.log('🚀 [START] New /start command:', { 
    tgId, 
    firstName,
    username: ctx.from?.username,
    timestamp: new Date().toISOString()
  });

  let user = await getUserByTgId(tgId);
  
  console.log('👤 [START] getUserByTgId result:', {
    userExists: !!user,
    userId: user?.id,
    recordId: user?.recordId,
    status: user?.fields?.Status,
    userName: user?.fields?.['User Name'],
    createdTime: user?.fields?.Created,
    allFields: user?.fields ? Object.keys(user.fields) : []
  });

  // КРИТИЧНА ПЕРЕВІРКА: чи користувач дійсно існує в базі?
  if (user && !user.id) {
    console.error('⚠️ [START] USER HAS NO ID - POSSIBLE CACHE ISSUE!', user);
    console.error('⚠️ [START] This might be a deleted user from cache!');
    user = null; // Вважаємо його відсутнім
  }

  // 1️⃣ Користувача немає → створити + онбординг
  if (!user) {
    console.log('➕ [START] No user found, creating new user...');
    user = await createUser(tgId, firstName);
    console.log('✅ [START] New user created:', {
      userId: user?.id,
      recordId: user?.recordId,
      status: user?.fields?.Status
    });
    
    await ctx.reply(MESSAGES.WELCOME(firstName), keyboards.nameChoiceInline());
    return askCurrent(ctx);
  }

  // 2️⃣ Перевіряємо ТІЛЬКИ Status
  const status = String(user.fields?.Status || '').trim();
  
  console.log('🔍 [START] Status check:', { 
    rawStatus: user.fields?.Status,
    normalizedStatus: status,
    isEmpty: !status,
    isNewUser: status === 'New User'
  });
  
  if (!status || status === 'New User') {
    console.log('👶 [START] Status is empty or "New User" → showing onboarding');
    await ctx.reply(MESSAGES.WELCOME(firstName), keyboards.nameChoiceInline());
    return askCurrent(ctx);
  }

  // 3️⃣ Welcome back тільки для чітких статусів
  if (status === 'Registered User' || status === 'Active User') {
    console.log('🎉 [START] Registered/Active user → showing welcome back');
    return sendWelcomeBack(ctx, user);
  }

  // 4️⃣ Будь-який інший випадок
  console.log('⚠️ [START] Unknown status, defaulting to onboarding:', status);
  await ctx.reply(MESSAGES.WELCOME(firstName), keyboards.nameChoiceInline());
  return askCurrent(ctx);
};

export const onText = async (ctx) => {
  const tgId = tgIdOf(ctx);
  const text = String(ctx.message?.text || '').trim();
  
  console.log('💬 [onText] Received:', { tgId, text: text.substring(0, 50) });
  
  if (!text) {
    console.log('⚠️ [onText] Empty text, ignoring');
    return false;
  }

  const user = await getUserByTgId(tgId);
  console.log('👤 [onText] User lookup:', { 
    exists: !!user,
    status: user?.fields?.Status
  });
  
  const state = await QE.getSessionState(tgId, ONBOARDING_CONFIG);
  console.log('📝 [onText] Session state:', { 
    exists: !!state,
    isCompleted: state?.isCompleted
  });

  if (user && state && !state.isCompleted) {
    console.log('✍️ [onText] Processing answer in onboarding');
    return writeAnswerAndMove(ctx, text);
  }
  
  console.log('⏭️ [onText] Not in onboarding, skipping');
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

export default { start, onText };
