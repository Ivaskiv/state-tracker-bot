// src/auth/modules/auth.js - ВИПРАВЛЕНО ПІД НОВИЙ АЛГОРИТМ

import userService from '../services/userService.js';
import paymentService from '../services/paymentService.js';
import keyboards from '../../utils/keyboards.js';
import { isValidEmail, isValidUaPhone } from '../../utils/validators.js';
import {
  SUBSCRIPTION_PLANS,
  OB_STEPS,
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

// Швидке створення користувача з мінімальними даними
async function createMinimalUser(tgId, name) {
  try {
    return await userService.createUser({
      tgId,
      name: name || 'Користувач',
      registrationStatus: 'New'
    });
  } catch (error) {
    console.error('[createMinimalUser] error:', error);
    return null;
  }
}

// /start обробник - СПРОЩЕНО ПІД НОВИЙ АЛГОРИТМ
export async function handleStart(ctx) {
  const tgId = ctx.from.id;
  const name = ctx.from.first_name || 'Користувач';
  
  if (!ctx.session) ctx.session = { step: undefined, temp: {} };

  try {
    console.log(`🚀 [auth] /start для ${tgId} (${name}) - fallback режим`);

    // Запускаємо стандартний онбординг без перевірки бази
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
  
  // ПРОПУСКАЄМО ТАЙМЗОНУ - переходимо відразу до плану
  ctx.session.temp.timezone = 'Europe/Kyiv'; // За замовчуванням
  ctx.session.step = OB_STEPS.PLAN;

  await ctx.reply('✅ Телефон збережено!\n\n🎁 Останній крок - обери план:', keyboards.subscriptionPlansKeyboard());
  return true;
}

// Крок: часовий пояс (якщо потрібно)
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

// Крок: підписка/план - ОНОВЛЕНО
async function handleSubscriptionStep(ctx, planInput) {
  const tgId = ctx.from.id;
  const planKey = normalizePlanKey(planInput);
  
  if (!planKey) {
    await ctx.reply('⚠️ Обери план з кнопок:', keyboards.subscriptionPlansKeyboard());
    return true;
  }

  try {
    console.log(`[handleSubscriptionStep] Обробка плану ${planKey} для ${tgId}`);

    // Створюємо користувача з мінімальними даними
    let savedUser = null;
    try {
      const userData = {
        'TG_id': String(tgId),
        'User Name': ctx.session.temp.name || ctx.from.first_name || 'Користувач',
        'Email': ctx.session.temp.email || `user${tgId}@temp.com`,
        'Phone': ctx.session.temp.phone || '+380000000000',
        'Time Zone': ctx.session.temp.timezone || 'Europe/Kyiv',
        'Registration Date': new Date().toISOString(),
        'Status': 'Registered User',
        'UserRegistered': true,
      };

      savedUser = await safeUpsert(tgId, userData);
      console.log(`[handleSubscriptionStep] ✅ Користувача створено/оновлено`);

    } catch (userError) {
      console.error(`[handleSubscriptionStep] Помилка збереження користувача:`, userError);
      
      // Fallback - створюємо мінімального користувача
      savedUser = await createMinimalUser(tgId, ctx.session.temp.name);
      if (!savedUser) {
        throw new Error('Не вдалося створити користувача');
      }
    }

    // Очищаємо сесію
    ctx.session.step = undefined;
    ctx.session.temp = {};

    // Безкоштовна версія
    if (planKey === 'free' || planKey === 'trial') {
      console.log(`[handleSubscriptionStep] Активація пробної підписки для ${tgId}`);

      try {
        // Активуємо пробну підписку на 7 днів
        const activated = await paymentService.activateTrialSubscription(tgId, 7);
        
        if (activated) {
          const message = 
            `🎉 Пробна підписка активована!\n\n` +
            `✅ 7 днів повного доступу\n` +
            `🎯 Тепер заповн перше колесо балансу для персоналізації AI-наставника\n\n` +
            `Готова почати?`;

          await ctx.reply(message, {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎯 Заповнити колесо балансу', callback_data: 'wheel_start' }],
                [{ text: '🏠 До головного меню', callback_data: 'main_menu' }]
              ]
            }
          });
        } else {
          throw new Error('Не вдалося активувати пробну підписку');
        }

      } catch (trialError) {
        console.error(`[handleSubscriptionStep] Помилка активації пробної підписки:`, trialError);
        
        await ctx.reply(
          `🎉 Реєстрація завершена!\n\n` +
          `⚠️ Не вдалося автоматично активувати пробну підписку.\n\n` +
          `💡 Активуй її вручну або обери платний план:`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎁 Активувати пробну', callback_data: 'activate_trial' }],
                [{ text: '💰 Платні плани', callback_data: 'subscription_plans' }],
                [{ text: '🏠 До меню', callback_data: 'main_menu' }]
              ]
            }
          }
        );
      }
      
      return true;
    }

    // Платні плани
    const planDetails = SUBSCRIPTION_PLANS[planKey];
    if (!planDetails) {
      await ctx.reply('❌ Невірний план. Обери з доступних:', keyboards.subscriptionPlansKeyboard());
      return true;
    }

    try {
      await userService.updateUser(tgId, {
        'Subscription Status': 'Pending',
        'Active_Subscription_Status': '⏳ Очікує оплати'
      });
    } catch (updateError) {
      console.warn('[handleSubscriptionStep] Не вдалося оновити статус підписки:', updateError);
    }

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
          [{ text: '🆓 Пробна версія', callback_data: 'activate_trial' }]
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

// Нормалізація ключа плану
function normalizePlanKey(plan) {
  if (!plan) return null;
  const p = String(plan).trim().toLowerCase();
  if (p === 'free' || p === 'безкоштовна' || p === 'trial' || p === 'пробний') return 'trial';
  if (p === 'week' || p === 'тиждень') return 'WEEK';
  if (p === 'month' || p === 'місяць') return 'MONTH';
  if (p === 'year' || p === 'рік') return 'YEAR';
  if (SUBSCRIPTION_PLANS[p?.toUpperCase()]) return p.toUpperCase();
  return null;
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

    } else if (data === 'about_bot' || data === 'onboarding_about') {
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
            [{ text: '✅ Почати реєстрацію', callback_data: 'start_registration' }],
            [{ text: '🏠 Головне меню', callback_data: 'main_menu' }]
          ]
        }
      });
      await ctx.answerCbQuery('Інформація про бота');
      return true;

    } else if (data === 'activate_trial') {
      // Активація пробної підписки
      try {
        const activated = await paymentService.activateTrialSubscription(tgId, 7);
        
        if (activated) {
          await ctx.reply(
            `🎁 Пробна підписка активована!\n\n` +
            `✅ 7 днів повного доступу\n` +
            `🎯 Заповн перше колесо балансу\n\n` +
            `Готова почати?`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🎯 Заповнити колесо', callback_data: 'wheel_start' }],
                  [{ text: '🏠 До меню', callback_data: 'main_menu' }]
                ]
              }
            }
          );
        } else {
          await ctx.reply(
            `❌ Не вдалося активувати пробну підписку.\n\n` +
            `💡 Спробуй ще раз пізніше або зверніся до підтримки.`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🔄 Спробувати ще раз', callback_data: 'activate_trial' }],
                  [{ text: '📞 Підтримка', callback_data: 'contact_support' }],
                  [{ text: '🏠 До меню', callback_data: 'main_menu' }]
                ]
              }
            }
          );
        }
        
        await ctx.answerCbQuery(activated ? 'Пробна підписка активована!' : 'Помилка активації');
        return true;
        
      } catch (error) {
        console.error('[handleOnboardingCallback] Помилка активації пробної:', error);
        await ctx.reply('❌ Технічна помилка. Спробуй пізніше.', keyboards.mainMenuKeyboard());
        await ctx.answerCbQuery('Помилка');
        return true;
      }
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
      ctx.session.temp.timezone = 'Europe/Kyiv';
      ctx.session.step = OB_STEPS.PLAN;
      await ctx.reply('🎁 Обери план:', keyboards.subscriptionPlansKeyboard());
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