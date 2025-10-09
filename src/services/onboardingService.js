// src/services/onboardingService.js — ВИПРАВЛЕНО: тільки Answer_Step у Users

import userService from './userService.js';
import subscriptionService from './subscriptionService.js';
import { ANSWER_STEPS, MESSAGES, getTzLabel, CONFIG } from '../config/constants.js';
import { isValidEmail, isValidName, formatPhone, formatEmail, formatName } from '../utils/validators.js';

// ===== КРОК: ІМ'Я =====
export const handleNameStep = async (tgId, text) => {
  if (!isValidName(text)) {
    return { error: true, message: MESSAGES.ERROR_NAME };
  }

  await userService.updateUserFields(tgId, {
    'User Name': formatName(text),
    // 👇 тільки в Users і тільки Answer_Step
    Answer_Step: ANSWER_STEPS.OB_EMAIL,
  });

  return { success: true, nextStep: ANSWER_STEPS.OB_EMAIL };
};

// ===== КРОК: EMAIL =====
export const handleEmailStep = async (tgId, text, isSkip = false) => {
  if (isSkip || !text) {
    await userService.updateUserFields(tgId, { Answer_Step: ANSWER_STEPS.OB_PHONE });
    return { success: true, nextStep: ANSWER_STEPS.OB_PHONE };
  }

  if (!isValidEmail(text)) {
    return { error: true, message: MESSAGES.ERROR_EMAIL };
  }

  await userService.updateUserFields(tgId, {
    Email: formatEmail(text),
    Answer_Step: ANSWER_STEPS.OB_PHONE,
  });

  return { success: true, nextStep: ANSWER_STEPS.OB_PHONE };
};

// ===== КРОК: PHONE =====
export const handlePhoneStep = async (tgId, text, isSkip = false) => {
  if (isSkip || !text) {
    await userService.updateUserFields(tgId, { Answer_Step: ANSWER_STEPS.OB_TZ });
    return { success: true, nextStep: ANSWER_STEPS.OB_TZ };
  }

  const phone = formatPhone(text);
  if (!CONFIG.PHONE_REGEX.test(phone)) {
    return { error: true, message: MESSAGES.ERROR_PHONE };
  }

  await userService.updateUserFields(tgId, {
    Phone: phone,
    Answer_Step: ANSWER_STEPS.OB_TZ,
  });

  return { success: true, nextStep: ANSWER_STEPS.OB_TZ };
};

// ===== КРОК: TIMEZONE =====
export const handleTimezoneStep = async (tgId, tzSlug) => {
  const tzLabel = getTzLabel(tzSlug);

  await userService.updateUserFields(tgId, {
    'Time Zone': tzLabel,
    Answer_Step: ANSWER_STEPS.OB_PLAN,
  });

  return { success: true, nextStep: ANSWER_STEPS.OB_PLAN };
};

// ===== КРОК: ПЛАН (TRIAL / PAID) =====
export const handlePlanStep = async (tgId, planKey) => {
  console.log(`[onboarding] 🎯 handlePlanStep(${tgId}, ${planKey})`);

  try {
    const user = await userService.getUserByTgId(tgId);
    if (!user) {
      console.error(`[onboarding] ❌ Користувач ${tgId} не знайдений`);
      return { error: true, message: MESSAGES.ERROR_GENERIC };
    }

    // 1) Фіналізуємо реєстрацію (всередині ставиться Answer_Step: completed)
    console.log(`[onboarding] 1️⃣ Фіналізація реєстрації...`);
    await userService.finalizeRegistration(tgId, {
      name: user['User Name'],
      email: user.Email,
      phone: user.Phone,
      timezone: user['Time Zone'],
    });

    if (planKey === 'TRIAL') {
      console.log(`[onboarding] 2️⃣ Активація TRIAL для ${tgId}...`);

      // Якщо вже активний доступ (за датами в Users) — повертаємо
      const alreadyActive = userService.hasActiveAccess(user);
      if (alreadyActive && user.End_Date) {
        console.log(`[onboarding] ℹ️ Доступ вже активний до ${new Date(user.End_Date).toLocaleDateString('uk-UA')}`);
        return {
          success: true,
          trial: true,
          alreadyActive: true,
          endDate: user.End_Date,
        };
      }

      // 2) Активуємо Trial (оновлює Users полями плану/дат)
      const trialUser = await userService.activateTrial(tgId, 7);
      if (!trialUser) throw new Error('Не вдалося активувати trial в Users');

      console.log(`[onboarding] ✅ Trial активовано в Users`);

      // 3) Логуємо підписку в Subscriptions (не критично при фейлі)
      try {
        await subscriptionService.createTrialSubscription(tgId, trialUser['User Name'] || user['User Name'] || 'Користувач');
        console.log(`[onboarding] ✅ Trial запис створено в Subscriptions`);
      } catch (subError) {
        console.warn(`[onboarding] ⚠️ Не вдалося створити запис підписки:`, subError?.message || subError);
      }

      console.log(`[onboarding] 🎉 TRIAL УСПІШНО АКТИВОВАНО`);

      // На випадок, якщо finalizeRegistration не поставив (або поставили раніше) — дублюємо
      await userService.updateUserFields(tgId, { Answer_Step: ANSWER_STEPS.COMPLETED });

      return {
        success: true,
        trial: true,
        endDate: trialUser.End_Date,
      };
    }

    // Платні плани — тут просто повертаємо, оплату завершуєш іншим флоу
    console.log(`[onboarding] 💳 Платний план ${planKey} — покажемо інфо/лінк на оплату`);
    return { success: true, paid: true, planKey };

  } catch (error) {
    console.error('[onboarding] ❌ Критична помилка handlePlanStep:', error);
    console.error('[onboarding] Stack:', error.stack);
    return { error: true, message: 'Помилка активації. Спробуй ще раз.' };
  }
};

export default {
  handleNameStep,
  handleEmailStep,
  handlePhoneStep,
  handleTimezoneStep,
  handlePlanStep,
};

console.log('✅ [onboarding] Виправлено: онбординг записує тільки Answer_Step у Users');
