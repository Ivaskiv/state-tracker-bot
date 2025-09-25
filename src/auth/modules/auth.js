// src/auth/modules/auth.js - ВИПРАВЛЕНО

import userService from '../services/userService.js';
import keyboards from '../../utils/keyboards.js';
import { isValidEmail, isValidUaPhone } from '../../utils/validators.js';
import wayforpayService from '../../services/wayforpayService.js';
import {
  SUBSCRIPTION_PLANS,
  OB_STEPS,
  ANSWER_STEPS,
  TIMEZONES,
  parseTz,
} from '../../config/constants.js';

// Перевіряємо чи профіль незавершений
const isProfileIncomplete = (user) => {
  if (!user) return true;
  const hasBasicData = !!user['User Name'] && !!user['Email'];
  const isRegistered = user.Status === 'Registered User' || user.UserRegistered === true;
  return !(hasBasicData && isRegistered);
};

// Безпечний upsert користувача
async function safeUpsert(tgId, fields) {
  try {
    const updated = await userService.updateUser(tgId, fields);
    if (updated) return updated;
    
    // Якщо оновлення не вдалось, створюємо нового
    return await userService.createUser({
      tgId,
      name: fields['User Name'],
      email: fields.Email,
      phone: fields.Phone,
      timezone: fields['Time Zone'],
      registrationStatus: fields['Subscription Status'] || 'New'
    });
  } catch (error) {
    console.error('[safeUpsert] error:', error);
    throw error;
  }
}

// Гарантія існування користувача
async function ensureUserExists(tgId) {
  let u = await userService.getUserByTelegramId(tgId);
  if (u) return u;

  return await userService.createUser({ 
    tgId, 
    registrationStatus: 'New' 
  });
}

// Нормалізація ключа плану
function normalizePlanKey(plan) {
  if (!plan) return null;
  const p = String(plan).trim().toLowerCase();
  if (p === 'free' || p === 'безкоштовна') return 'free';
  if (p === 'trial' || p === 'пробний') return 'TRIAL';
  if (p === 'week' || p === 'тиждень') return 'WEEK';
  if (p === 'month' || p === 'місяць') return 'MONTH';
  if (p === 'year' || p === 'рік') return 'YEAR';
  if (SUBSCRIPTION_PLANS[p?.toUpperCase()]) return p.toUpperCase();
  return null;
}

// /start обробник
export async function handleStart(ctx) {
  const tgId = ctx.from.id;
  const name = ctx.from.first_name || 'Користувач';
  
  if (!ctx.session) ctx.session = { step: undefined, temp: {} };

  try {
    console.log(`🚀 [auth] /start для ${tgId} (${name})`);

    let user = null;
    try {
      user = await userService.getUserByTelegramId(tgId);
      if (!user) user = await ensureUserExists(tgId);
    } catch (dbErr) {
      console.warn('[auth.handleStart] DB issue:', dbErr?.message);
    }

    console.log(`👤 [auth] Користувач ${tgId}:`, {
      exists: !!user,
      registered: user?.UserRegistered,
      status: user?.Status,
      subscription: user?.['Active_Subscription_Status']
    });

    if (user && !isProfileIncomplete(user)) {
      const active = (user['Active_Subscription_Status'] || '').includes('✅ Активна') || 
                     (user['Subscription Status'] === 'Active');

      if (active) {
        console.log(`✅ [auth] Зареєстрований користувач ${tgId} з активною підпискою`);

        // Очищаємо стан
        ctx.session.step = undefined;
        ctx.session.temp = {};
        ctx.session.wheel = undefined;

        const welcomeText =
          `🎉 Вітаю, ${user['User Name'] || name}!\n\n` +
          `✅ Твоя підписка активна\n` +
          `🚀 Готова до продуктивного дня?`;

        await ctx.reply(welcomeText, keyboards.mainMenuKeyboard());
        return;

      } else {
        console.log(`⚠️ [auth] Користувач ${tgId} без активної підписки`);

        const subscriptionText =
          `👋 З поверненням, ${user['User Name'] || name}!\n\n` +
          `💡 Для повного доступу активуй підписку:\n\n` +
          `🎯 AI коучинг 24/7\n` +
          `📊 Колесо балансу\n` +
          `📈 Персональна аналітика`;

        await ctx.reply(subscriptionText, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💰 Переглянути плани', callback_data: 'subscription_plans' }],
              [{ text: '🏠 До меню', callback_data: 'main_menu' }]
            ]
          }
        });
        return;
      }
    }

    // Початок онбордингу
    console.log(`🔄 [auth] Запуск онбордингу для ${tgId}`);
    ctx.session.step = OB_STEPS.PITCH;
    ctx.session.temp = { name };

    const greetingText =
      `👋 Привіт, ${name}!\n\n` +
      `Я твій AI-мотиватор та коуч! Допомагаю:\n\n` +
      `🎯 Ставити та досягати цілі\n` +
      `⚖️ Знаходити баланс у житті\n` +
      `💪 Підтримувати мотивацію\n` +
      `📈 Відслідковувати прогрес\n\n` +
      `Готова розпочати?`;

    await ctx.reply(greetingText, keyboards.greetingKeyboard());

  } catch (error) {
    console.error('[auth.handleStart] Критична помилка:', error);
    await ctx.reply('❌ Помилка. Спробуй ще раз /start');
  }
}

// Обробка кроків реєстрації
export async function handleRegistrationStep(ctx) {
  const tgId = ctx.from.id;
  const currentStep = ctx.session?.step;
  const userInput = ctx.message?.text?.trim() || '';

  if (!currentStep || !Object.values(OB_STEPS).includes(currentStep)) {
    return false; // Не є кроком онбордингу
  }

  console.log(`👤 [auth] Крок: ${currentStep}, input: ${userInput.substring(0, 30)}...`);

  try {
    switch (currentStep) {
      case OB_STEPS.NAME:
        return await handleNameStep(ctx, userInput);
      case OB_STEPS.EMAIL:
        return await handleEmailStep(ctx, userInput);
      case OB_STEPS.PHONE:
        return await handlePhoneStep(ctx, userInput);
      case OB_STEPS.TIMEZONE:
        return await handleTimezoneStep(ctx, userInput);
      case OB_STEPS.PLAN:
        return await handleSubscriptionStep(ctx, userInput);
      default:
        return false;
    }
  } catch (error) {
    console.error(`❌ [auth] Помилка в кроці ${currentStep}:`, error);
    await ctx.reply('❌ Помилка. Спробуй ще раз або /start');
    return true;
  }
}

// Крок: ім'я
async function handleNameStep(ctx, name) {
  if (!name || name.length < 2 || name.length > 50) {
    await ctx.reply('⚠️ Введи правильне ім\'я (2-50 символів):', keyboards.skipKeyboard());
    return true;
  }

  ctx.session.temp.name = name;
  ctx.session.step = OB_STEPS.EMAIL;

  await ctx.reply(`✅ Чудово, ${name}!\n\n📧 Введи email:`, keyboards.skipKeyboard());
  return true;
}

// Крок: email
async function handleEmailStep(ctx, email) {
  if (!email || !isValidEmail(email)) {
    await ctx.reply('⚠️ Невірний email. Введи коректний (example@gmail.com):', keyboards.skipKeyboard());
    return true;
  }

  ctx.session.temp.email = email.toLowerCase();
  ctx.session.step = OB_STEPS.PHONE;

  await ctx.reply('✅ Email збережено!\n\n📱 Введи телефон (+380XXXXXXXXX):', keyboards.skipKeyboard());
  return true;
}

// Крок: телефон
async function handlePhoneStep(ctx, phone) {
  if (!phone || !isValidUaPhone(phone)) {
    await ctx.reply('⚠️ Неправильний телефон. Введи +380XXXXXXXXX:', keyboards.skipKeyboard());
    return true;
  }

  ctx.session.temp.phone = phone;
  ctx.session.step = OB_STEPS.TIMEZONE;

  await ctx.reply('✅ Телефон збережено!\n\n🌍 Обери часовий пояс:', keyboards.timezoneKeyboard());
  return true;
}

// Крок: часовий пояс
async function handleTimezoneStep(ctx, tzInput) {
  const chosen = parseTz(tzInput);
  const allowedIds = TIMEZONES.map(parseTz);
  
  if (!chosen || !allowedIds.includes(chosen)) {
    await ctx.reply('⚠️ Обери часовий пояс з кнопок:', keyboards.timezoneKeyboard());
    return true;
  }

  ctx.session.temp.timezone = chosen;
  ctx.session.step = OB_STEPS.PLAN;

  await ctx.reply('✅ Часовий пояс встановлено!\n\n🎯 Останній крок - план:', keyboards.subscriptionPlansKeyboard());
  return true;
}

// Крок: підписка/план
async function handleSubscriptionStep(ctx, planInput) {
  const tgId = ctx.from.id;
  const planKey = normalizePlanKey(planInput);
  
  if (!planKey) {
    await ctx.reply('⚠️ Обери план з кнопок:', keyboards.subscriptionPlansKeyboard());
    return true;
  }

  try {
    // Зберігаємо користувача
    const userData = {
      'TG_id': String(tgId),
      'User Name': ctx.session.temp.name,
      'Email': ctx.session.temp.email,
      'Phone': ctx.session.temp.phone,
      'Time Zone': ctx.session.temp.timezone,
      'Registration Date': new Date().toISOString(),
      'Status': 'Registered User',
      'UserRegistered': true,
    };

    // Безкоштовна версія
    if (planKey === 'free') {
      userData['Subscription Status'] = 'Free';
      userData['Active_Subscription_Status'] = '❌ Безкоштовна';
      
      const savedUser = await safeUpsert(tgId, userData);
      ctx.session.step = undefined;
      ctx.session.temp = {};

      await ctx.reply(
        `🎉 Реєстрація завершена!\n\n` +
        `Вітаю в безкоштовній версії, ${userData['User Name']}!\n\n` +
        `💡 Для повного доступу можеш оновити підписку будь-коли!`,
        keyboards.mainMenuKeyboard()
      );
      return true;
    }

    // Платні плани
    const planDetails = SUBSCRIPTION_PLANS[planKey];
    userData['Subscription Status'] = 'Pending';
    userData['Active_Subscription_Status'] = '⏳ Очікує оплати';
    
    const savedUser = await safeUpsert(tgId, userData);
    ctx.session.step = undefined;

    const paymentText =
      `💳 ОПЛАТА ПІДПИСКИ\n\n` +
      `План: ${planDetails.name}\n` +
      `Вартість: ${planDetails.price}€\n` +
      `Період: ${planDetails.duration} днів\n\n` +
      `Після оплати підписка активується автоматично.`;

    await ctx.reply(paymentText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💳 Оплатити зараз', callback_data: `subscribe_${planKey.toLowerCase()}` }],
          [{ text: '⏭ Пізніше', callback_data: 'main_menu' }],
          [{ text: '🆓 Безкоштовна версія', callback_data: 'plan_free' }]
        ]
      }
    });
    return true;

  } catch (error) {
    console.error(`❌ [auth] Помилка збереження:`, error);
    await ctx.reply('❌ Помилка збереження. Спробуй ще раз /start');
    return true;
  }
}

// Callback обробники онбордингу
export async function handleOnboardingCallback(ctx) {
  const tgId = ctx.from.id;
  const data = ctx.callbackQuery.data;

  console.log(`📱 [auth] Callback: ${data} для ${tgId}`);

  try {
    if (data === 'start_registration' || data === 'onboarding_start') {
      ctx.session.step = OB_STEPS.NAME;
      ctx.session.temp = ctx.session.temp || {};

      await ctx.reply('📝 Як тебе звати? (введи ім\'я):', keyboards.skipKeyboard());
      await ctx.answerCbQuery('Початок реєстрації');
      return true;

    } else if (data.startsWith('plan_')) {
      const planKey = data.replace('plan_', '');
      await handleSubscriptionStep(ctx, planKey);
      await ctx.answerCbQuery(`План: ${planKey}`);
      return true;

    } else if (data.startsWith('tz_')) {
      const tz = data.replace('tz_', '');
      await handleTimezoneStep(ctx, tz);
      await ctx.answerCbQuery(`Часовий пояс: ${tz}`);
      return true;

    } else if (data === 'skip_step') {
      await handleSkipStep(ctx);
      await ctx.answerCbQuery('Крок пропущено');
      return true;

    } else if (data === 'onboarding_about') {
      const aboutText =
        `🤖 AI МОТИВАТОР-КОУЧ\n\n` +
        `✨ Що я роблю:\n` +
        `• Ранкові питання для фокусу\n` +
        `• Вечірні питання для рефлексії\n` +
        `• AI-наставник для підтримки\n` +
        `• Колесо балансу для аналізу життя\n` +
        `• Персональні звіти та рекомендації\n\n` +
        `🎯 Результат: більше усвідомленості, мотивації та досягнень!`;
      
      await ctx.reply(aboutText, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Почати реєстрацію', callback_data: 'start_registration' }]
          ]
        }
      });
      await ctx.answerCbQuery('Інформація про бота');
      return true;
    }

    return false;
  } catch (error) {
    console.error('[auth.callback] Помилка:', error);
    await ctx.answerCbQuery('Помилка');
    return true;
  }
}

// Пропуск кроку
async function handleSkipStep(ctx) {
  const currentStep = ctx.session.step;
  const tgId = ctx.from.id;

  switch (currentStep) {
    case OB_STEPS.NAME:
      ctx.session.temp.name = ctx.from.first_name || 'Користувач';
      ctx.session.step = OB_STEPS.EMAIL;
      await ctx.reply('📧 Введи email:', keyboards.skipKeyboard());
      break;

    case OB_STEPS.EMAIL:
      ctx.session.temp.email = `user${tgId}@temp.com`;
      ctx.session.step = OB_STEPS.PHONE;
      await ctx.reply('📱 Введи телефон:', keyboards.skipKeyboard());
      break;

    case OB_STEPS.PHONE:
      ctx.session.temp.phone = '+380000000000';
      ctx.session.step = OB_STEPS.TIMEZONE;
      await ctx.reply('🌍 Обери часовий пояс:', keyboards.timezoneKeyboard());
      break;

    default:
      await ctx.reply('❌ Цей крок не можна пропустити');
  }
}

export default {
  handleStart,
  handleRegistrationStep,
  handleOnboardingCallback,
  isProfileIncomplete
};