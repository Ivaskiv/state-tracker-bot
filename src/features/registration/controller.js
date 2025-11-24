// src/features/registration/controller.js
import * as QE from '../../services/questionEngine.js';
import keyboards from '../../utils/keyboards.js';
import { ONBOARDING_CONFIG } from './config.js';
import { 
  MESSAGES, 
  TILDA_URLS, 
  TILDA_MESSAGES,
  shouldShowPitch, 
  PITCH_TILDA 
} from './constants.js';
import { getUserStats } from '../../services/stats.js';
import { formatDate, getDaysWord, parseStartPayload } from '../../utils/helpers.js';
import callbacks from '../../services/callbacks.js';
import { 
  createUser, 
  getUserByTgId, 
  hasActiveAccess, 
  activateTrial 
} from '../../services/users.js';
import { getRegistrationData } from './service.js';
import { getMemberAreaUrl } from '../../tilda/service.js';
import logger from '../../utils/logger.js';

const tgIdOf = (ctx) => String(ctx.from?.id || ctx.chat?.id);
const cfgWithRecord = (recordId) => ({ ...ONBOARDING_CONFIG, recordId });

// ═══════════════════════════════════════════════════════════
// MAIN START HANDLER
// ═══════════════════════════════════════════════════════════

export const start = async (ctx) => {
  try {
    const tgId = tgIdOf(ctx);
    const firstName = (ctx.from.first_name || '').trim();
    const rawPayload = ctx.startPayload || ctx.message?.text?.split(' ')[1] || '';
    
    const payload = parseStartPayload(rawPayload);
    
    logger.info('═══════════════════════════════════════════════════════');
    logger.info('🎯 [START] User:', tgId);
    logger.info('🎯 [START] Name:', firstName);
    logger.info('🎯 [START] Payload:', JSON.stringify(payload, null, 2));
    logger.info('═══════════════════════════════════════════════════════');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 1️⃣ ПЕРЕВІРКА КОРИСТУВАЧА В AIRTABLE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    const userData = await getRegistrationData(tgId);
    const userExists = !!userData;
    
    logger.info('📊 [START] UserExists:', userExists);
    if (userExists) {
      logger.info('📊 [START] UserData:', {
        registered: userData.User_Registered,
        step: userData.Answer_Step,
        status: userData.Status,
        subscriptionStatus: userData['Subscription_Status']
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 2️⃣ НОВИЙ КОРИСТУВАЧ → ФОРМА РЕЄСТРАЦІЇ
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    if (!userExists) {
  logger.info('📝 [START] NEW_USER → Tilda Registration WebApp');

  const registrationUrl = `${TILDA_URLS.REGISTRATION}?tg_id=${tgId}`;

  await ctx.reply(
    TILDA_MESSAGES.NEW_USER(firstName),
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{
            text: '📝 Заповнити форму реєстрації',
            web_app: { url: registrationUrl }, // web_app: { url: 'https://tilda.cc/' },
          }],
          [{
            text: 'ℹ️ Що може цей бот?',
            callback_data: 'show_bot_info',
          }],
        ],
      },
    }
  );

  return;
}


    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 3️⃣ КОРИСТУВАЧ ІСНУЄ → АНАЛІЗ СТАТУСУ
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    const step = userData.Answer_Step || 'idle';
    const isOnboarding = /^ob_/i.test(step);
    const isRegistered = userData.User_Registered === true;
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 3.1 — НЕЗАВЕРШЕНА РЕЄСТРАЦІЯ → ПРОДОВЖИТИ ОНБОРДИНГ
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    if (isOnboarding && !isRegistered) {
      logger.info('📝 [START] Route: CONTINUE_ONBOARDING');
      logger.info('📝 [START] Current step:', step);
      
      if (shouldShowPitch(payload, { fields: userData })) {
        await ctx.reply(PITCH_TILDA);
      }
      
      await ctx.reply(MESSAGES.WELCOME(firstName), keyboards.nameChoiceInline());
      return askCurrent(ctx);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 3.2 — РЕЄСТРАЦІЯ ЗАВЕРШЕНА → ПЕРЕВІРКА ПІДПИСКИ
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    const user = await getUserByTgId(tgId);
    const hasAccess = hasActiveAccess(user);
    
    logger.info('🔐 [START] Access Status:', hasAccess);
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 3.2.1 — БЕЗ ПІДПИСКИ → АКТИВУВАТИ TRIAL
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    if (isRegistered && !hasAccess) {
      logger.info('🧪 [START] Route: ACTIVATE_TRIAL');
      
      await activateTrial(tgId, 7);
      
      await ctx.reply(
        '🎉 Активовано пробний період на 7 днів!\n\n' +
        '✨ Тепер тобі доступні:\n' +
        '• 🎯 Колесо балансу\n' +
        '• 🤖 AI-наставник 24/7\n' +
        '• 📊 Щоденні рефлексії\n' +
        '• 📈 Звіти та статистика\n\n' +
        'Почнемо з Колеса балансу? 👇',
        keyboards.wheelCtaInline()
      );
      
      return;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 3.2.2 — З ПІДПИСКОЮ → WELCOME BACK + CABINET
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    if (isRegistered && hasAccess) {
      logger.info('🏠 [START] Route: WELCOME_BACK + CABINET');
      
      await sendWelcomeBack(ctx, { fields: userData });
      
      // Показуємо кнопку кабінету
      const cabinetUrl = await getMemberAreaUrl(tgId);
      
      await ctx.reply(
        '🗂️ **ТВІЙ ОСОБИСТИЙ КАБІНЕТ**\n\n' +
        '📚 Тут зібрані всі твої матеріали:\n' +
        '• Прогрес курсів\n' +
        '• Статистика\n' +
        '• Геймифікація (рівні, бейджі)\n' +
        '• Виконані завдання\n\n' +
        '👇 Відкрий кабінет:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔗 Відкрити кабінет', url: cabinetUrl }],
              [{ text: '🏠 До меню бота', callback_data: 'main_menu' }]
            ]
          }
        }
      );
      
      return;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 4️⃣ FALLBACK → ДЕФОЛТНЕ ВІТАННЯ
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    logger.warn('⚠️ [START] Route: FALLBACK → Default Welcome');
    await ctx.reply(
      `👋 Привіт, ${firstName}!\n\n` +
      'Щось пішло не так. Спробуй ще раз або зверніться до підтримки @vira_333',
      keyboards.mainMenuKeyboard()
    );

  } catch (err) {
    logger.error('❌ [START] ERROR:', err.message);
    logger.error('❌ [START] Stack:', err.stack);
    
    await ctx.reply(
      '❌ Виникла помилка при запуску.\n\n' +
      'Спробуй ще раз: /start\n\n' +
      'Якщо проблема повториться — напиши @vira_333'
    );
  }
};

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

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
    await activateTrial(tgId, 7);
    
    await ctx.reply(
      TILDA_MESSAGES.REGISTRATION_COMPLETE(ctx.from.first_name),
      keyboards.afterRegistrationKeyboard()
    );
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
  try {
    stats = await getUserStats(String(ctx.from?.id || ctx.chat?.id));
  } catch {}
  
  const text = buildWelcomeBackText({
    userName: user.fields['User_Name'] || ctx.from?.first_name,
    wheelCompleted: !!stats?.wheelCompleted,
    wheelCompletedDate: stats?.wheelCompletedDate || null,
    nextWheelDate: stats?.nextWheelDate || null,
    currentStreak: stats?.currentStreak ?? 0,
    lastSessionDate: stats?.lastSessionDate || null,
    subscriptionLabel: stats?.subscriptionLabel || '❌ Немає активної підписки',
  });

  await ctx.reply(text, keyboards.mainMenuKeyboard());

  if (!stats?.wheelCompleted) {
    await ctx.reply(
      '🎯 **РЕКОМЕНДАЦІЯ**\n\n' +
      'Колесо балансу допомагає швидко оцінити 8 сфер життя і вибрати 2–3 пріоритети на місяць.\n\n' +
      '⏱ Займе 5-10 хвилин\n\n' +
      'Готова пройти зараз?',
      keyboards.wheelCtaInline()
    );
  }
  return true;
};

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
    `🤖 Я — твій AI-ментор. Допомагаю тримати фокус і рухатись до балансу.\n\n` +
    `Обирай дію в меню нижче 👇`
  );
};

// ═══════════════════════════════════════════════════════════
// TEXT & CALLBACK HANDLERS
// ═══════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════
// CALLBACK REGISTRATION
// ═══════════════════════════════════════════════════════════

callbacks.onPrefix('ob_tz_', (ctx, data) => {
  const slug = data.slice('ob_tz_'.length);
  return writeAnswerAndMove(ctx, slug);
});

callbacks.on('use_telegram_name', (ctx) => {
  const name = ctx.from?.first_name || '';
  return writeAnswerAndMove(ctx, name);
});

callbacks.on('enter_custom_name', (ctx) => askCurrent(ctx));
callbacks.on('ob_skip_email', (ctx) => writeAnswerAndMove(ctx, '/skip'));
callbacks.on('ob_skip_phone', (ctx) => writeAnswerAndMove(ctx, '/skip'));
callbacks.on('ob_plan_trial', (ctx) => writeAnswerAndMove(ctx, 'TRIAL'));
callbacks.on('ob_plan_week', (ctx) => writeAnswerAndMove(ctx, 'WEEK'));
callbacks.on('ob_plan_month', (ctx) => writeAnswerAndMove(ctx, 'MONTH'));
callbacks.on('ob_plan_year', (ctx) => writeAnswerAndMove(ctx, 'YEAR'));
callbacks.on('ob_no_subscription', (ctx) => writeAnswerAndMove(ctx, 'NO_SUBSCRIPTION'));

callbacks.on('show_bot_info', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    '🤖 **AI МЕНТОР - ЩО Я ВМІЮ**\n\n' +
    '🎯 **Колесо балансу**\n' +
    'Оціни 8 сфер життя і отримай персоналізовані рекомендації\n\n' +
    '🌞🌙 **Щоденні рефлексії**\n' +
    'Ранкова настройка на день + вечірній аналіз\n\n' +
    '🤖 **AI-наставник 24/7**\n' +
    'Персональні поради та підтримка в будь-який момент\n\n' +
    '📊 **Звіти та статистика**\n' +
    'Відстежуй свій прогрес і досягнення\n\n' +
    '🎮 **Геймифікація**\n' +
    'Отримуй бейджі, рівні та нагороди\n\n' +
    '💎 **Та багато іншого!**',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📝 Зареєструватись', url: `${TILDA_URLS.REGISTRATION}?tg_id=${ctx.from.id}` }]
        ]
      }
    }
  );
});

callbacks.on('start_wheel_now', async (ctx) => {
  const { startWheelFromText } = await import('../dashboard/index.js');
  return startWheelFromText(ctx);
});

callbacks.on('wheel_later', async (ctx) => {
  await ctx.answerCbQuery('✅ Добре!');
  await ctx.reply(
    `✅ Без проблем!\n\n🎡 Колесо чекає на тебе в меню 📊`,
    keyboards.mainMenuKeyboard()
  );
  return true;
});

export default { start, onText, onCallback };

console.log('✅ [registration/controller] Завантажено');