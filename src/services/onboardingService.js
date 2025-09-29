// src/services/onboardingService.js - ВСЯ ЛОГІКА ОНБОРДИНГУ

import userService from './userService.js';
import subscriptionService from './subscriptionService.js';
import { ONBOARDING_STEPS, MESSAGES, getTzLabel, CONFIG } from '../config/constants.js';
import { isValidEmail, isValidName, formatPhone, formatEmail, formatName } from '../utils/validators.js';

// ===== ОБРОБКА КРОКІВ =====
export const handleNameStep = async (tgId, text) => {
  if (!isValidName(text)) {
    return { error: true, message: MESSAGES.ERROR_NAME };
  }
  
  await userService.updateUserFields(tgId, {
    'User Name': formatName(text),
    Answer_Step: ONBOARDING_STEPS.EMAIL
  });
  
  return { success: true, nextStep: ONBOARDING_STEPS.EMAIL };
};

export const handleEmailStep = async (tgId, text, isSkip = false) => {
  if (isSkip || !text) {
    await userService.updateUserFields(tgId, {
      Answer_Step: ONBOARDING_STEPS.PHONE
    });
    return { success: true, nextStep: ONBOARDING_STEPS.PHONE };
  }
  
  if (!isValidEmail(text)) {
    return { error: true, message: MESSAGES.ERROR_EMAIL };
  }
  
  await userService.updateUserFields(tgId, {
    Email: formatEmail(text),
    Answer_Step: ONBOARDING_STEPS.PHONE
  });
  
  return { success: true, nextStep: ONBOARDING_STEPS.PHONE };
};

export const handlePhoneStep = async (tgId, text, isSkip = false) => {
  if (isSkip || !text) {
    await userService.updateUserFields(tgId, {
      Answer_Step: ONBOARDING_STEPS.TIMEZONE
    });
    return { success: true, nextStep: ONBOARDING_STEPS.TIMEZONE };
  }
  
  const phone = formatPhone(text);
  if (!CONFIG.PHONE_REGEX.test(phone)) {
    return { error: true, message: MESSAGES.ERROR_PHONE };
  }
  
  await userService.updateUserFields(tgId, {
    Phone: phone,
    Answer_Step: ONBOARDING_STEPS.TIMEZONE
  });
  
  return { success: true, nextStep: ONBOARDING_STEPS.TIMEZONE };
};

export const handleTimezoneStep = async (tgId, tzSlug) => {
  const tzLabel = getTzLabel(tzSlug);
  
  await userService.updateUserFields(tgId, {
    'Time Zone': tzLabel,
    Answer_Step: ONBOARDING_STEPS.PLAN
  });
  
  return { success: true, nextStep: ONBOARDING_STEPS.PLAN };
};

export const handlePlanStep = async (tgId, planKey) => {
  const user = await userService.getUserByTgId(tgId);
  if (!user) return { error: true, message: MESSAGES.ERROR_GENERIC };
  
  // Фіналізуємо реєстрацію
  await userService.finalizeRegistration(tgId, {
    name: user['User Name'],
    email: user.Email,
    phone: user.Phone,
    timezone: user['Time Zone']
  });
  
  if (planKey === 'TRIAL') {
    // Активуємо trial
    await userService.activateTrial(tgId, 7);
    
    // Створюємо запис підписки
    await subscriptionService.createTrialSubscription(tgId, user['User Name']);
    
    return { success: true, trial: true };
  }
  
  // Платні плани - показуємо інфо
  return { success: true, paid: true, planKey };
};

export default {
  handleNameStep,
  handleEmailStep,
  handlePhoneStep,
  handleTimezoneStep,
  handlePlanStep
};