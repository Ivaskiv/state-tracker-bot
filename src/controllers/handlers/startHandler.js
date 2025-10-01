// src/controllers/handlers/startHandler.js
// Централізовано: повідомлення/константи з constants.js, клавіатури з keyboards.js

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
    return isNaN(d.getTime()) ? null : d.toLocaleDateString('uk-UA');
  } catch { return null; }
};

const computeTrialEndFromNow = (days = 7) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatDateUA(d);
};

const isAccessActive = (user) => {
  if (!user) return false;
  if (typeof userService.hasActiveAccess === 'function') {
    try { return !!userService.hasActiveAccess(user); } catch {}
  }
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

      let user = await userService.getUserByTgId(tgId);
      if (!user) {
        user = await userService.ensureUser(tgId, telegramName);
        await ctx.reply(MESSAGES.WELCOME(telegramName), keyboards.greetingKeyboard());
        return;
      }

      if (user['User Name'] === String(tgId)) {
        await userService.updateUserFields(tgId, { 'User Name': telegramName });
        user['User Name'] = telegramName;
      }

      if (!user.UserRegistered) {
        await startOnboarding(ctx, user);
        return;
      }

      const name = user['User Name'] || telegramName;
      const endStr = formatDateUA(user.End_Date) || 'скоро';

      if (isAccessActive(user)) {
        await ctx.reply(MESSAGES.WELCOME_BACK_ACTIVE(name, endStr), keyboards.quickStartInlineKeyboard());
      } else {
        await ctx.reply(MESSAGES.WELCOME_BACK_INACTIVE(name), keyboards.quickStartInlineKeyboard());
      }
    } catch (e) {
      console.error('[startHandler]/start error:', e);
      await ctx.reply(MESSAGES.ERROR_GENERIC);
    }
  });
}

// ---------- онбординг: перше привітання ----------
const startOnboarding = async (ctx, user) => {
  const userName = user['User Name'] || 'Користувач';
  await ctx.reply(MESSAGES.ONBOARDING_NAME_CHOICE(userName), {
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

  const user = await userService.getUserByTgId(tgId);
  if (!user || user.UserRegistered) return false;

  const step = user.Answer_Step;

  try {
    if (step === ANSWER_STEPS.OB_NAME) {
      const result = await onboardingService.handleNameStep(tgId, text);
      if (result.error) await ctx.reply(result.message);
      else await ctx.reply(MESSAGES.ASK_EMAIL, keyboards.emailInputKeyboard());
      return true;
    }
    if (step === ANSWER_STEPS.OB_EMAIL) {
      const result = await onboardingService.handleEmailStep(tgId, text);
      if (result.error) await ctx.reply(result.message, keyboards.emailInputKeyboard());
      else await ctx.reply(MESSAGES.ASK_PHONE, keyboards.phoneInputKeyboard());
      return true;
    }
    if (step === ANSWER_STEPS.OB_PHONE) {
      const result = await onboardingService.handlePhoneStep(tgId, text);
      if (result.error) await ctx.reply(result.message, keyboards.phoneInputKeyboard());
      else await ctx.reply(MESSAGES.ASK_TIMEZONE, keyboards.timezoneKeyboard());
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

  const user = await userService.getUserByTgId(tgId);
  if (!user) return false;

  try {
    if (data === 'use_telegram_name') {
      await userService.updateUserFields(tgId, {
        Status: USER_STATUS.REGISTERED,
        Answer_Step: ANSWER_STEPS.OB_EMAIL
      });
      await ctx.reply(MESSAGES.ASK_EMAIL, keyboards.emailInputKeyboard());
      return true;
    }

    if (data === 'enter_custom_name' || data === 'start_registration') {
      await userService.updateUserFields(tgId, {
        Status: USER_STATUS.REGISTERED,
        Answer_Step: ANSWER_STEPS.OB_NAME
      });
      await ctx.reply(MESSAGES.ASK_NAME);
      return true;
    }

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

    if (data.startsWith('tz_')) {
      const tzSlug = data.slice(3);
      await onboardingService.handleTimezoneStep(tgId, tzSlug);
      await ctx.reply(MESSAGES.ASK_PLAN, keyboards.subscriptionPlansKeyboard());
      return true;
    }

    // Trial: ідемпотентно
    if (data === 'plan_free' || data === 'activate_trial') {
      if (isAccessActive(user)) {
        const name = user['User Name'] || ctx.from.first_name || 'друже';
        const endStr = formatDateUA(user.End_Date) || 'скоро';
        await ctx.reply(MESSAGES.WELCOME_BACK_ACTIVE(name, endStr), keyboards.mainMenuKeyboard());
        return true;
      }

      const result = await onboardingService.handlePlanStep(tgId, 'TRIAL');
      if (result?.success && result?.trial) {
        const fresh = await userService.getUserByTgId(tgId);
        const endDateFromService = formatDateUA(result.endDate);
        const endDateFromUser = formatDateUA(fresh?.End_Date);
        const endDateStr = endDateFromService || endDateFromUser || computeTrialEndFromNow(7);
        const message = REGISTRATION_SUCCESS_TEMPLATE.replace('{END_DATE}', endDateStr);
        await ctx.reply(message, keyboards.mainMenuKeyboard());
      } else {
        const name = user['User Name'] || ctx.from.first_name || 'друже';
        const fresh = await userService.getUserByTgId(tgId);
        const endStr = formatDateUA(fresh?.End_Date) || computeTrialEndFromNow(7);
        await ctx.reply(MESSAGES.WELCOME_BACK_ACTIVE(name, endStr), keyboards.mainMenuKeyboard());
      }
      return true;
    }

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
