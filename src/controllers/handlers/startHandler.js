// src/controllers/handlers/startHandler.js
// ВИПРАВЛЕНО: повідомлення TRIAL + оптимізація, без дубльованих export’ів

import userService from '../../services/userService.js';
import onboardingService from '../../services/onboardingService.js';
import keyboards from '../../utils/keyboards.js';
import {
  MESSAGES,
  ANSWER_STEPS,
  USER_STATUS,
  REGISTRATION_SUCCESS_TEMPLATE
} from '../../config/constants.js';

// ---------- helpers ----------
const formatDateUA = (dateLike) => {
  try {
    if (!dateLike) return null;
    const d = (dateLike instanceof Date) ? dateLike : new Date(dateLike);
    // Якщо не валідна дата — повернемо null, щоб не ламати повідомлення.
    return isNaN(d.getTime()) ? null : d.toLocaleDateString('uk-UA');
  } catch {
    return null;
  }
};

const computeTrialEndFromNow = (days = 7) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatDateUA(d);
};

const isAccessActive = (user) => {
  // універсальна перевірка активності доступу
  if (!user) return false;
  // якщо є зручний метод у сервісі — скористаємося ним
  if (typeof userService.hasActiveAccess === 'function') {
    try { return !!userService.hasActiveAccess(user); } catch { /* noop */ }
  }
  // запасна евристика по полях:
  const a = (user['Active_Subscription_Status'] || '');
  const s = (user['Subscription Status'] || '').toLowerCase();
  return a.includes('✅') || s === 'active';
};

// ---------- /start ----------
export default function registerStartHandlers(bot) {
  bot.start(async (ctx) => {
    try {
      const tgId = ctx.from.id;
      const telegramName = ctx.from.first_name || ctx.from.username || 'Користувач';

      // якщо юзера немає — делегуємо у твій онбординг (мінімальне вітання)
      let user = await userService.getUserByTelegramId(tgId);
      if (!user) {
        // ensureUser створить запис; далі — стандартний онбординг
        user = await userService.ensureUser(tgId, telegramName);
        await ctx.reply('👋 Привіт! Давай зареєструємось: натисни «Почати».', keyboards.greetingKeyboard?.() || undefined);
        return;
      }

      // Якщо ім’я у Users = TG_id → оновлюємо на людське
      if (user['User Name'] === String(tgId)) {
        await userService.updateUserFields(tgId, { 'User Name': telegramName });
        user['User Name'] = telegramName;
      }

      // Якщо не пройдений онбординг — запуск онбордингу
      if (!user.UserRegistered) {
        await startOnboarding(ctx, user);
        return;
      }

      // Повернення: активна/неактивна підписка
      const name = user['User Name'] || telegramName;
      const endStr = formatDateUA(user.End_Date) || 'скоро';

      if (isAccessActive(user)) {
        const text = typeof MESSAGES.WELCOME_BACK_ACTIVE === 'function'
          ? MESSAGES.WELCOME_BACK_ACTIVE(name, endStr)
          : `👋 З поверненням, ${name}!\n✅ Підписка активна до ${endStr}.\nПродовжимо?`;
        await ctx.reply(text, keyboards.quickStartInlineKeyboard?.() || keyboards.mainMenuKeyboard());
      } else {
        const text = typeof MESSAGES.WELCOME_BACK_INACTIVE === 'function'
          ? MESSAGES.WELCOME_BACK_INACTIVE(name)
          : `👋 З поверненням, ${name}!\n❗ Підписка не активна. Активуй, щоб користуватись усім.`;
        await ctx.reply(text, keyboards.quickStartInlineKeyboard?.() || keyboards.subscriptionPlansKeyboard());
      }
    } catch (e) {
      console.error('[startHandler]/start error:', e);
      await ctx.reply(MESSAGES.ERROR_GENERIC || '❌ Сталася помилка. Спробуй ще раз /start');
    }
  });
}

// ---------- онбординг: перше привітання ----------
const startOnboarding = async (ctx, user) => {
  const userName = user['User Name'] || 'Користувач';
  const message =
    `👋 Привіт, ${userName}!\n\n` +
    `Я твій AI-мотиватор та коуч! Допомагаю:\n\n` +
    `🎯 Ставити та досягати цілі\n` +
    `⚖️ Знаходити баланс у житті\n` +
    `💪 Підтримувати мотивацію\n` +
    `📈 Відслідковувати прогрес\n\n` +
    `Залишити ім'я "${userName}" або ввести інше?`;

  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: `✅ Залишити "${userName}"`, callback_data: 'use_telegram_name' }],
        [{ text: '✏️ Ввести інше ім\'я', callback_data: 'enter_custom_name' }]
      ]
    }
  });
};

// ---------- текст під час онбордингу ----------
export const handleText = async (ctx) => {
  const tgId = ctx.from.id;
  const text = ctx.message?.text?.trim();

  console.log(`[startHandler] handleText(${tgId}): "${text}"`);

  const user = await userService.getUserByTgId(tgId);
  if (!user || user.UserRegistered) {
    console.log('[startHandler] ❌ Не онбординг');
    return false;
  }

  const step = user.Answer_Step;
  console.log(`[startHandler] Крок: ${step}`);

  try {
    if (step === ANSWER_STEPS.OB_NAME) {
      const result = await onboardingService.handleNameStep(tgId, text);
      if (result.error) {
        await ctx.reply(result.message);
      } else {
        await ctx.reply(MESSAGES.ASK_EMAIL, keyboards.emailInputKeyboard());
      }
      return true;
    }

    if (step === ANSWER_STEPS.OB_EMAIL) {
      const result = await onboardingService.handleEmailStep(tgId, text);
      if (result.error) {
        await ctx.reply(result.message, keyboards.emailInputKeyboard());
      } else {
        await ctx.reply(MESSAGES.ASK_PHONE, keyboards.phoneInputKeyboard());
      }
      return true;
    }

    if (step === ANSWER_STEPS.OB_PHONE) {
      const result = await onboardingService.handlePhoneStep(tgId, text);
      if (result.error) {
        await ctx.reply(result.message, keyboards.phoneInputKeyboard());
      } else {
        await ctx.reply(MESSAGES.ASK_TIMEZONE, keyboards.timezoneKeyboard());
      }
      return true;
    }

    return false;
  } catch (error) {
    console.error('[startHandler] ❌ Помилка handleText:', error);
    await ctx.reply(MESSAGES.ERROR_GENERIC);
    return true;
  }
};

// ---------- callback-и під час онбордингу ----------
export const handleCallback = async (ctx) => {
  const tgId = ctx.from.id;
  const data = ctx.callbackQuery?.data;

  console.log(`[startHandler] handleCallback(${tgId}): ${data}`);

  const user = await userService.getUserByTgId(tgId);
  if (!user) return false;

  try {
    // підтвердження імені
    if (data === 'use_telegram_name') {
      await userService.updateUserFields(tgId, {
        Status: USER_STATUS.REGISTERED,
        Answer_Step: ANSWER_STEPS.OB_EMAIL
      });
      await ctx.reply(MESSAGES.ASK_EMAIL, keyboards.emailInputKeyboard());
      return true;
    }

    // введення іншого імені
    if (data === 'enter_custom_name' || data === 'start_registration') {
      await userService.updateUserFields(tgId, {
        Status: USER_STATUS.REGISTERED,
        Answer_Step: ANSWER_STEPS.OB_NAME
      });
      await ctx.reply(MESSAGES.ASK_NAME);
      return true;
    }

    // пропуски
    if (data === 'skip_email') {
      await onboardingService.handleEmailStep(tgId, null, true);
      await ctx.reply(MESSAGES.ASK_PHONE, keyboards.phoneInputKeyboard());
      return true;
    }

    if (data === 'skip_phone') {
      await onboardingService.handlePhoneStep(tgId, null, true);
      await ctx.reply(MESSAGES.ASK_TIMEZONE, keyboards.timezoneKeyboard());
      return true;
    }

    // таймзона
    if (data.startsWith('tz_')) {
      const tzSlug = data.slice(3);
      await onboardingService.handleTimezoneStep(tgId, tzSlug);
      await ctx.reply(MESSAGES.ASK_PLAN, keyboards.subscriptionPlansKeyboard());
      return true;
    }

    // ===== TRIAL: ідемпотентна активація + коректне повідомлення =====
    if (data === 'plan_free' || data === 'activate_trial') {
      // якщо доступ уже активний — не дублюємо підписку і не шлемо trial-повідомлення
      if (isAccessActive(user)) {
        const name = user['User Name'] || ctx.from.first_name || 'друже';
        const endStr = formatDateUA(user.End_Date) || 'скоро';
        const text = typeof MESSAGES.WELCOME_BACK_ACTIVE === 'function'
          ? MESSAGES.WELCOME_BACK_ACTIVE(name, endStr)
          : `👋 З поверненням, ${name}!\n✅ Підписка активна до ${endStr}.\nПродовжимо?`;
        await ctx.reply(text, keyboards.mainMenuKeyboard());
        return true;
      }

      const result = await onboardingService.handlePlanStep(tgId, 'TRIAL');

      if (result?.success && result?.trial) {
        // кращий пріоритет: дата з сервісу → оновлений юзер → запасний "через 7 днів"
        const fresh = await userService.getUserByTgId(tgId);
        const endDateFromService = formatDateUA(result.endDate);
        const endDateFromUser = formatDateUA(fresh?.End_Date);
        const endDateStr = endDateFromService || endDateFromUser || computeTrialEndFromNow(7);

        const message = REGISTRATION_SUCCESS_TEMPLATE.replace('{END_DATE}', endDateStr);
        await ctx.reply(message, keyboards.mainMenuKeyboard());

        // Можеш додатково перевести у завершений онбординг:
        // await userService.updateUserFields(tgId, { Answer_Step: ANSWER_STEPS.OB_DONE, UserRegistered: true });
      } else {
        // якщо сервіс повернув "вже активовано" або інший стан
        const name = user['User Name'] || ctx.from.first_name || 'друже';
        const fresh = await userService.getUserByTgId(tgId);
        const endStr = formatDateUA(fresh?.End_Date) || computeTrialEndFromNow(7);
        const text = typeof MESSAGES.WELCOME_BACK_ACTIVE === 'function'
          ? MESSAGES.WELCOME_BACK_ACTIVE(name, endStr)
          : `👋 З поверненням, ${name}!\n✅ Доступ активний до ${endStr}.\nПродовжимо?`;
        await ctx.reply(text, keyboards.mainMenuKeyboard());
      }
      return true;
    }

    // платні плани — поки вручну
    if (['plan_week', 'plan_month', 'plan_year'].includes(data)) {
      await ctx.reply('💳 Для оплати зверніться до підтримки: nadyastarway@gmail.com');
      return true;
    }

    return false;
  } catch (error) {
    console.error('[startHandler] ❌ Помилка callback:', error);
    await ctx.reply(MESSAGES.ERROR_GENERIC);
    return true;
  }
};
