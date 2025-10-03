// src/services/onboardingService.js - ОПТИМІЗОВАНА ВЕРСІЯ

import userService from './userService.js';
import subscriptionService from './subscriptionService.js';
import { ONBOARDING_STEPS, MESSAGES, getTzLabel, CONFIG } from '../config/constants.js';
import { isValidEmail, isValidName, formatPhone, formatEmail, formatName } from '../utils/validators.js';

// ===== ОБРОБКА КРОКІВ (БЕЗ ЗМІН) =====

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

// ===== ✅ ОПТИМІЗОВАНА АКТИВАЦІЯ TRIAL =====

export const handlePlanStep = async (tgId, planKey) => {
  console.log(`[onboarding] 🎯 handlePlanStep(${tgId}, ${planKey})`);
  
  try {
    const user = await userService.getUserByTgId(tgId);
    if (!user) {
      console.error(`[onboarding] ❌ Користувач ${tgId} не знайдений`);
      return { error: true, message: MESSAGES.ERROR_GENERIC };
    }
    
    // 1️⃣ ФІНАЛІЗУЄМО РЕЄСТРАЦІЮ
    console.log(`[onboarding] 1️⃣ Фіналізація реєстрації...`);
    await userService.finalizeRegistration(tgId, {
      name: user['User Name'],
      email: user.Email,
      phone: user.Phone,
      timezone: user['Time Zone']
    });
    
    if (planKey === 'TRIAL') {
      console.log(`[onboarding] 2️⃣ Активація TRIAL для ${tgId}...`);
      
      // ✅ ПЕРЕВІРЯЄМО ЧИ ВЖЕ Є АКТИВНИЙ TRIAL
      if (user['Subscription Status'] === 'Active' && user.End_Date) {
        const endDate = new Date(user.End_Date);
        if (endDate > new Date()) {
          console.log(`[onboarding] ℹ️ Trial вже активний до ${endDate.toLocaleDateString('uk-UA')}`);
          
          return { 
            success: true, 
            trial: true,
            alreadyActive: true,
            endDate: user.End_Date 
          };
        }
      }
      
      // 2️⃣ АКТИВУЄМО TRIAL (оновлює Users)
      const trialUser = await userService.activateTrial(tgId, 7);
      if (!trialUser) {
        throw new Error('Не вдалося активувати trial в Users');
      }
      
      console.log(`[onboarding] ✅ Trial активовано в Users`);
      
      // 3️⃣ СТВОРЮЄМО ЗАПИС ПІДПИСКИ (логування в Subscriptions)
      try {
        await subscriptionService.createTrialSubscription(tgId, user['User Name']);
        console.log(`[onboarding] ✅ Trial запис створено в Subscriptions`);
      } catch (subError) {
        console.warn(`[onboarding] ⚠️ Не вдалося створити запис підписки:`, subError.message);
        // Не критично - головне що Users оновлено
      }
      
      console.log(`[onboarding] 🎉 TRIAL УСПІШНО АКТИВОВАНО`);
      
      return { 
        success: true, 
        trial: true,
        endDate: trialUser.End_Date
      };
    }
    
    // Платні плани - просто повідомляємо
    console.log(`[onboarding] 💳 Платний план ${planKey} - показуємо інфо`);
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
  handlePlanStep
};

console.log('✅ [onboarding] Оптимізований сервіс онбордингу ініціалізовано');