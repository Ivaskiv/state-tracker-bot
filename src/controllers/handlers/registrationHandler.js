// src/controllers/handlers/registrationHandler.js

import userService from '../../services/userService.js';
import keyboards from '../../utils/keyboards.js';
import { ANSWER_STEPS, CONFIG, MESSAGES } from '../../config/constants.js';

// ===== ВАЛІДАТОРИ =====
const isValidEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email) && email.length <= CONFIG.EMAIL_MAX_LENGTH;
};

const isValidPhone = (phone) => {
  return CONFIG.PHONE_REGEX.test(phone);
};

const isValidName = (name) => {
  return name.length >= CONFIG.NAME_MIN_LENGTH && name.length <= CONFIG.NAME_MAX_LENGTH;
};

// ===== CALLBACK ОБРОБКА =====
export async function handleCallback(ctx) {
  const tgId = ctx.from.id;
  const data = ctx.callbackQuery?.data || '';
  
  console.log(`[registrationHandler] 📞 Callback: ${data} від ${tgId}`);
  
  try {
    const user = await userService.getUserByTgId(tgId, { skipCache: true });
    
    if (!user) {
      await ctx.reply('🔄 Натисни /start для початку');
      return true;
    }
// ===== КНОПКИ "НАЗАД" =====
    
    if (data === 'back_to_name') {
      await userService.updateUserStep(tgId, ANSWER_STEPS.OB_NAME);
      const telegramName = ctx.from.first_name || 'Користувач';
      await ctx.reply(
        MESSAGES.ONBOARDING_NAME_CHOICE(telegramName),
        keyboards.nameChoiceInline()
      );
      return true;
    }

    if (data === 'back_to_email') {
      await userService.updateUserStep(tgId, ANSWER_STEPS.OB_EMAIL);
      await ctx.reply(
        '📧 Вкажи e-mail для звітів або натисни «Пропустити»',
        keyboards.kbSkipEmail()
      );
      return true;
    }

    if (data === 'back_to_phone') {
      await userService.updateUserStep(tgId, ANSWER_STEPS.OB_PHONE);
      await ctx.reply(
        '📞 Вкажи номер телефону для зв\'язку (формат: +380XXXXXXXXX) або натисни «Пропустити»',
        keyboards.kbSkipPhone()
      );
      return true;
    }

    if (data === 'back_to_timezone') {
      await userService.updateUserStep(tgId, ANSWER_STEPS.OB_TZ);
      await ctx.reply(
        '🌍 Обери свій часовий пояс:\n\n⏰ Це потрібно для ранкових питань (о 08:00 за твоїм місцевим часом)',
        keyboards.timezoneKeyboard()
      );
      return true;
    }
    // ===== ВИБІР ІМЕНІ =====
    if (data === 'use_telegram_name') {
      const telegramName = ctx.from.first_name || 'Користувач';
      
      await userService.updateUserFields(tgId, {
        'User Name': telegramName,
        Answer_Step: ANSWER_STEPS.OB_EMAIL
      });
      
      await ctx.reply(
        `✅ Залишаємо ім'я: ${telegramName}\n\n📧 Тепер вкажи e-mail для звітів або натисни «Пропустити»`,
        keyboards.kbSkipEmail()
      );
      return true;
    }

    if (data === 'enter_custom_name') {
      await userService.updateUserStep(tgId, ANSWER_STEPS.OB_NAME);
      
      await ctx.reply(
        '✏️ Введи своє ім\'я (2-50 символів):'
      );
      return true;
    }

    // ===== ПРОПУСК EMAIL =====
    if (data === 'skip_email') {
      await userService.updateUserFields(tgId, {
        Email: null,
        Answer_Step: ANSWER_STEPS.OB_PHONE
      });
      
      await ctx.reply(
        '📞 Вкажи номер телефону для зв\'язку (формат: +380XXXXXXXXX) або натисни «Пропустити»',
        keyboards.kbSkipPhone()
      );
      return true;
    }

    // ===== ПРОПУСК PHONE =====
    if (data === 'skip_phone') {
      await userService.updateUserFields(tgId, {
        Phone: null,
        Answer_Step: ANSWER_STEPS.OB_TZ
      });
      
      await ctx.reply(
        '🌍 Обери свій часовий пояс:\n\n⏰ Це потрібно для ранкових питань (о 08:00 за твоїм місцевим часом)',
        keyboards.timezoneKeyboard()
      );
      return true;
    }

    // ===== ВИБІР ТАЙМЗОНИ =====
    if (data.startsWith('tz_')) {
      const tzSlug = data.replace('tz_', '');
      
      // Якщо це пагінація
      if (tzSlug.startsWith('page_')) {
        const page = parseInt(tzSlug.replace('page_', ''), 10);
        await ctx.editMessageReplyMarkup(keyboards.timezoneKeyboard(page).reply_markup);
        return true;
      }
      
      // Вибрано часовий пояс
      await userService.updateUserFields(tgId, {
        'Time Zone': tzSlug,
        Answer_Step: ANSWER_STEPS.OB_PLAN
      });
      
      await ctx.reply(
        MESSAGES.ASK_PLAN,
        keyboards.subscriptionPlansKeyboard()
      );
      return true;
    }

    // ===== АКТИВАЦІЯ TRIAL =====
    if (data === 'activate_trial') {
      const currentUser = await userService.getUserByTgId(tgId, { skipCache: true });
      
      // Фіналізуємо реєстрацію
      await userService.finalizeRegistration(tgId, {
        name: currentUser['User Name'] || ctx.from.first_name || 'Користувач',
        email: currentUser.Email || null,
        phone: currentUser.Phone || null,
        timezone: currentUser['Time Zone'] || CONFIG.DEFAULT_TIMEZONE
      });
      
      // Активуємо trial
      await userService.activateTrial(tgId, 7);
      
      // Отримуємо оновлені дані
      const updatedUser = await userService.getUserByTgId(tgId, { skipCache: true });
      
      await ctx.reply(
        `🎉 Реєстрацію завершено!\n\n` +
        `✅ Дані збережено:\n` +
        `👤 Ім'я: ${updatedUser['User Name']}\n` +
        `📧 Email: ${updatedUser.Email || 'не вказано'}\n` +
        `📱 Телефон: ${updatedUser.Phone || 'не вказано'}\n` +
        `🌍 Часовий пояс: ${updatedUser['Time Zone']}\n\n` +
        `🧪 Пробний доступ активовано на 7 днів\n` +
        `📅 Діє до: ${updatedUser.End_Date}\n\n` +
        `🎯 Наступний крок: Почни з 🛞 Колеса балансу для аналізу всіх сфер життя!`,
        keyboards.afterRegistrationKeyboard()
      );
      
      console.log(`[registrationHandler] ✅ Trial активовано для ${tgId}`);
      return true;
    }
  // ===== ПРОПУСК ПЕРШОГО КОЛЕСА =====
    if (data === 'skip_first_wheel') {
      await ctx.editMessageText(
        `✅ Добре!\n\n` +
        `Колесо балансу можна пройти будь-коли через головне меню:\n` +
        `👉 «🎯 Колесо балансу»\n\n` +
        `📱 Використовуй кнопки внизу для навігації.`,
        keyboards.mainMenuKeyboard()
      );
      return true;
    }
// ===== ПЛАТНІ ПІДПИСКИ =====
    if (data.startsWith('subscribe_')) {
      const planType = data.replace('subscribe_', '');
      
      const currentUser = await userService.getUserByTgId(tgId, { skipCache: true });
      await userService.finalizeRegistration(tgId, {
        name: currentUser['User Name'] || ctx.from.first_name || 'Користувач',
        email: currentUser.Email || null,
        phone: currentUser.Phone || null,
        timezone: currentUser['Time Zone'] || CONFIG.DEFAULT_TIMEZONE
      });
      
      const subscriptionController = (await import('../subscriptionController.js')).default;
      ctx.callbackQuery.data = `plan_${planType}`;
      await subscriptionController.handleCallback(ctx);
      
      console.log(`[registrationHandler] 💳 Платна підписка ${planType} для ${tgId}`);
      return true;
    }

    // ===== ЗАВЕРШИТИ БЕЗ ПІДПИСКИ =====
    if (data === 'skip_subscription') {
      const currentUser = await userService.getUserByTgId(tgId, { skipCache: true });
      
      await userService.finalizeRegistration(tgId, {
        name: currentUser['User Name'] || ctx.from.first_name || 'Користувач',
        email: currentUser.Email || null,
        phone: currentUser.Phone || null,
        timezone: currentUser['Time Zone'] || CONFIG.DEFAULT_TIMEZONE
      });
      
      await userService.updateUserFields(tgId, {
        'Subscription_Status': 'New',
        'Active Subscription Plan': 'Без підписки'
      });
      
      await ctx.editMessageText(
        MESSAGES.REGISTRATION_WITHOUT_SUBSCRIPTION,
        keyboards.mainMenuKeyboard()
      );
      
      console.log(`[registrationHandler] ⏭️ Реєстрація без підписки для ${tgId}`);
      return true;
    }


    return false;
  } catch (error) {
    console.error('[registrationHandler] ❌ Помилка callback:', error);
    await ctx.reply('❌ Виникла помилка. Спробуй /start', keyboards.mainMenuKeyboard());
    return true;
  }
}

// ===== ОБРОБКА ТЕКСТОВИХ ВІДПОВІДЕЙ =====
export async function handleOnboardingAnswer(ctx, user) {
  const tgId = ctx.from.id;
  const text = (ctx.message?.text || '').trim();
  
  console.log(`[registrationHandler] 📝 Текст на кроці ${user.Answer_Step}: "${text.substring(0, 30)}..."`);
  
  try {
    // ===== ІМ'Я =====
    if (user.Answer_Step === ANSWER_STEPS.OB_NAME) {
      if (!isValidName(text)) {
        await ctx.reply(
          '⚠️ Ім\'я має бути від 2 до 50 символів. Спробуй ще раз:'
        );
        return true;
      }
      
      await userService.updateUserFields(tgId, {
        'User Name': text,
        Answer_Step: ANSWER_STEPS.OB_EMAIL
      });
      
      await ctx.reply(
        `✅ Чудово, ${text}!\n\n📧 Тепер вкажи e-mail для звітів або натисни «Пропустити»`,
        keyboards.kbSkipEmail()
      );
      return true;
    }

    // ===== EMAIL =====
    if (user.Answer_Step === ANSWER_STEPS.OB_EMAIL) {
      if (!isValidEmail(text)) {
        await ctx.reply(
          '⚠️ Некоректний email. Спробуй ще раз або натисни «Пропустити»',
          keyboards.kbSkipEmail()
        );
        return true;
      }
      
      await userService.updateUserFields(tgId, {
        Email: text,
        Answer_Step: ANSWER_STEPS.OB_PHONE
      });
      
      await ctx.reply(
        '✅ Email збережено!\n\n📞 Вкажи номер телефону (формат: +380XXXXXXXXX) або натисни «Пропустити»',
        keyboards.kbSkipPhone()
      );
      return true;
    }

    // ===== PHONE =====
    if (user.Answer_Step === ANSWER_STEPS.OB_PHONE) {
      if (!isValidPhone(text)) {
        await ctx.reply(
          '⚠️ Некоректний номер. Формат: +380XXXXXXXXX\n\nСпробуй ще раз або натисни «Пропустити»',
          keyboards.kbSkipPhone()
        );
        return true;
      }
      
      await userService.updateUserFields(tgId, {
        Phone: text,
        Answer_Step: ANSWER_STEPS.OB_TZ
      });
      
      await ctx.reply(
        '✅ Телефон збережено!\n\n🌍 Обери свій часовий пояс:',
        keyboards.timezoneKeyboard()
      );
      return true;
    }
// ===== ЯКЩО КОРИСТУВАЧ НА КРОЦІ ВИБОРУ ТАЙМЗОНИ АБО ПЛАНУ =====
    // І надсилає текст замість натискання кнопок
    if (user.Answer_Step === ANSWER_STEPS.OB_TZ) {
      await ctx.reply(
        '⚠️ Будь ласка, обери часовий пояс з кнопок 👇',
        keyboards.timezoneKeyboard()
      );
      return true;
    }

    if (user.Answer_Step === ANSWER_STEPS.OB_PLAN) {
      await ctx.reply(
        '⚠️ Будь ласка, обери план підписки з кнопок 👇',
        keyboards.subscriptionPlansKeyboard()
      );
      return true;
    }
    return false;
  } catch (error) {
    console.error('[registrationHandler] ❌ Помилка текстової обробки:', error);
    await ctx.reply('❌ Виникла помилка. Спробуй /start', keyboards.mainMenuKeyboard());
    return true;
  }
}

export default { handleCallback, handleOnboardingAnswer };