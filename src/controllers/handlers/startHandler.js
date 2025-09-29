// src/controllers/handlers/startHandler.js - ВИПРАВЛЕНО ІМ'Я

import userService from '../../services/userService.js';
import onboardingService from '../../services/onboardingService.js';
import keyboards from '../../utils/keyboards.js';
import typing from '../../utils/typing.js';
import { MESSAGES, ANSWER_STEPS, USER_STATUS } from '../../config/constants.js';

// ===== ГОЛОВНИЙ ХЕНДЛЕР /start =====
export const handle = async (ctx) => {
  const tgId = ctx.from.id;
  const telegramName = ctx.from.first_name || ctx.from.username || 'Користувач';
  
  console.log(`[startHandler] /start від ${tgId} (${telegramName})`);
  
  try {
    await typing(ctx, 500);
    
    // 1) Ensure користувач
    const user = await userService.ensureUser(tgId, telegramName);
    console.log(`[startHandler] Користувач:`, user ? user['User Name'] : 'ERROR');
    
    if (!user) {
      console.error(`[startHandler] ❌ Не вдалося створити користувача!`);
      await ctx.reply(MESSAGES.ERROR_GENERIC);
      return;
    }
    
    // ✅ ВИПРАВЛЕННЯ: Якщо User Name = TG_id, оновлюємо на ім'я з Telegram
    if (user['User Name'] === String(tgId)) {
      console.log(`[startHandler] 🔄 Оновлюємо User Name з ${tgId} на ${telegramName}`);
      await userService.updateUserFields(tgId, { 'User Name': telegramName });
      user['User Name'] = telegramName; // Оновлюємо локально
    }
    
    // 2) Якщо зареєстрований
    if (user.UserRegistered) {
      console.log(`[startHandler] ✅ Користувач зареєстрований`);
      const hasAccess = userService.hasActiveAccess(user);
      
      await typing(ctx, 300);
      
      if (hasAccess) {
        console.log(`[startHandler] ✅ Є доступ - показуємо меню`);
        await ctx.reply(
          MESSAGES.WELCOME_BACK_ACTIVE(user['User Name']), 
          keyboards.mainMenuKeyboard()
        );
      } else {
        console.log(`[startHandler] ⚠️ Немає доступу - показуємо плани`);
        await ctx.reply(
          MESSAGES.WELCOME_BACK_INACTIVE(user['User Name']), 
          keyboards.subscriptionPlansKeyboard()
        );
      }
      return;
    }
    
    // 3) Якщо НЕ зареєстрований - показуємо привітання
    console.log(`[startHandler] 🆕 Показуємо привітання для онбордингу`);
    await startOnboarding(ctx, user);
    
  } catch (error) {
    console.error('[startHandler] ❌ Помилка:', error);
    await ctx.reply(MESSAGES.ERROR_GENERIC);
  }
};

// ===== ПОЧАТОК ОНБОРДИНГУ =====
const startOnboarding = async (ctx, user) => {
  const userName = user['User Name'];
  
  await typing(ctx, 300);
  
  // ✅ ВИПРАВЛЕНО - пропонуємо підтвердити або змінити ім'я
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

// ===== ОБРОБКА ТЕКСТУ =====
export const handleText = async (ctx) => {
  const tgId = ctx.from.id;
  const text = ctx.message?.text?.trim();
  
  console.log(`[startHandler] handleText(${tgId}): "${text}"`);
  
  const user = await userService.getUserByTgId(tgId);
  if (!user || user.UserRegistered) {
    console.log(`[startHandler] ❌ Не онбординг`);
    return false;
  }
  
  const step = user.Answer_Step;
  console.log(`[startHandler] Крок: ${step}`);
  
  try {
    if (step === ANSWER_STEPS.OB_NAME) {
      await typing(ctx, 300);
      const result = await onboardingService.handleNameStep(tgId, text);
      if (result.error) {
        await ctx.reply(result.message);
      } else {
        await ctx.reply(MESSAGES.ASK_EMAIL, keyboards.emailInputKeyboard());
      }
      return true;
    }
    
    if (step === ANSWER_STEPS.OB_EMAIL) {
      await typing(ctx, 300);
      const result = await onboardingService.handleEmailStep(tgId, text);
      if (result.error) {
        await ctx.reply(result.message, keyboards.emailInputKeyboard());
      } else {
        await ctx.reply(MESSAGES.ASK_PHONE, keyboards.phoneInputKeyboard());
      }
      return true;
    }
    
    if (step === ANSWER_STEPS.OB_PHONE) {
      await typing(ctx, 300);
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

// ===== ОБРОБКА CALLBACK =====
export const handleCallback = async (ctx) => {
  const tgId = ctx.from.id;
  const data = ctx.callbackQuery?.data;
  
  console.log(`[startHandler] handleCallback(${tgId}): ${data}`);
  
  const user = await userService.getUserByTgId(tgId);
  if (!user) return false;
  
  try {
    // Підтвердження імені з Telegram
    if (data === 'use_telegram_name') {
      await typing(ctx, 300);
      
      await userService.updateUserFields(tgId, { 
        Status: USER_STATUS.REGISTERED,
        Answer_Step: ANSWER_STEPS.OB_EMAIL
      });
      
      await ctx.reply(MESSAGES.ASK_EMAIL, keyboards.emailInputKeyboard());
      return true;
    }
    
    // Введення власного імені
    if (data === 'enter_custom_name') {
      await typing(ctx, 300);
      
      await userService.updateUserFields(tgId, { 
        Status: USER_STATUS.REGISTERED,
        Answer_Step: ANSWER_STEPS.OB_NAME
      });
      
      await ctx.reply(MESSAGES.ASK_NAME);
      return true;
    }
    
    // Привітання
    if (data === 'start_registration') {
      await typing(ctx, 300);
      
      await userService.updateUserFields(tgId, { 
        Status: USER_STATUS.REGISTERED,
        Answer_Step: ANSWER_STEPS.OB_NAME
      });
      
      await ctx.reply(MESSAGES.ASK_NAME);
      return true;
    }
    
    // Скіпи
    if (data === 'skip_email') {
      await typing(ctx, 300);
      await onboardingService.handleEmailStep(tgId, null, true);
      await ctx.reply(MESSAGES.ASK_PHONE, keyboards.phoneInputKeyboard());
      return true;
    }
    
    if (data === 'skip_phone') {
      await typing(ctx, 300);
      await onboardingService.handlePhoneStep(tgId, null, true);
      await ctx.reply(MESSAGES.ASK_TIMEZONE, keyboards.timezoneKeyboard());
      return true;
    }
    
    // Таймзона
    if (data.startsWith('tz_')) {
      await typing(ctx, 300);
      const tzSlug = data.slice(3);
      await onboardingService.handleTimezoneStep(tgId, tzSlug);
      await ctx.reply(MESSAGES.ASK_PLAN, keyboards.subscriptionPlansKeyboard());
      return true;
    }
    
    // Плани
    if (data === 'plan_free' || data === 'activate_trial') {
      await typing(ctx, 500);
      const result = await onboardingService.handlePlanStep(tgId, 'TRIAL');
      
      if (result.success && result.trial) {
        await ctx.reply(MESSAGES.TRIAL_ACTIVATED, keyboards.mainMenuKeyboard());
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

export default {
  handle,
  handleText,
  handleCallback
};