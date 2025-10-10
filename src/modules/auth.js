// src/auth/modules/auth.js - ВИПРАВЛЕНО З ПРАВИЛЬНОЮ ЛОГІКОЮ

import userService, { ensureNewUserStub, finalizeRegistration } from '../services/userService.js';
import keyboards from '../../utils/keyboards.js';
import { isValidEmail, isValidUaPhone } from '../../utils/validators.js';
import wheelBalanceService from '../../services/wheelBalance/index.js';
import wayforpayService from '../../services/wayforpayService.js';

import { SUBSCRIPTION_PLANS, OB_STEPS, ANSWER_STEPS } from '../../config/constants.js';

// ——— утиліта: профіль незавершений?
const isProfileIncomplete = (user) => {
  if (!user) return true;
  const hasBasicData = !!user['User Name'] && !!user['Email'];
  const isRegistered = user.Status === 'Registered User' || user.UserRegistered === true;
  return !(hasBasicData && isRegistered);
};

// ——— апсерт
async function safeUpsert(tgId, fields) {
  try {
    if (typeof userService.upsertUser === 'function') {
      return await userService.upsertUser({ tgId, ...fields });
    }
  } catch (e) {
    console.warn('[safeUpsert] upsertUser failed → fallback:', e?.message);
  }

  try {
    const updated = await userService.updateUser(tgId, fields);
    if (updated) return updated;
  } catch {}

  if (typeof userService.createUser === 'function') {
    const payload = {
      tgId,
      name: fields['User Name'],
      email: fields.Email,
      phone: fields.Phone,
      timezone: fields['Time Zone'],
      registrationStatus: fields['Subscription Status'] || 'New'
    };
    return await userService.createUser(payload);
  }

  throw new Error('safeUpsert: no viable path');
}

// ——— гарантія існування юзера
async function ensureUserExists(tgId) {
  let u = await userService.getUserByTelegramId(tgId);
  if (u) return u;

  try {
    await ensureNewUserStub(tgId);
  } catch (e) {
    console.warn('[ensureUserExists] ensureNewUserStub warn:', e?.message);
  }

  u = await userService.getUserByTelegramId(tgId);
  if (u) return u;

  try {
    const created = await userService.createUser({ tgId, registrationStatus: 'New' });
    return created || (await userService.getUserByTelegramId(tgId));
  } catch (e) {
    console.error('[ensureUserExists] createUser fail:', e);
    throw e;
  }
}

// ✅ ДОДАНО: перевірка та показ нагадування про колесо
const checkAndShowWheelReminder = async (ctx, user) => {
  try {
    const tgId = ctx.from.id;
    const registrationDate = user?.['Registration Date'] || user?.Created_Date || new Date().toISOString();
    
    console.log(`🎯 [auth] Перевірка потреби в колесі для ${tgId}, реєстрація: ${registrationDate}`);
    
    // Перевіряємо чи потрібно колесо
    const wheelCheck = await wheelBalanceService.shouldShowWheelReminder(tgId, registrationDate);
    
    if (wheelCheck.needed) {
      console.log(`🎯 [auth] Потрібне колесо: ${wheelCheck.type}, повідомлення: ${wheelCheck.message}`);
      
      // Затримка перед показом нагадування
      await new Promise(r => setTimeout(r, 1500));
      
      let reminderMessage = '';
      let reminderKeyboard = null;
      
      if (wheelCheck.type === 'first') {
        reminderMessage = 
          `🎯 ПЕРШЕ КОЛЕСО БАЛАНСУ\n\n` +
          `${wheelCheck.message}\n\n` +
          `Колесо балансу - це інструмент самоаналізу, який допоможе:\n` +
          `• Оцінити 8 ключових сфер життя\n` +
          `• Зрозуміти свої сильні та слабкі сторони\n` +
          `• Отримати персональні рекомендації від AI\n\n` +
          `⏱ Займає всього 5-10 хвилин\n` +
          `📊 Результат: детальний аналіз твого стану`;
          
        reminderKeyboard = {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎯 Заповнити колесо балансу', callback_data: 'wheel_start' }],
              [{ text: '❓ Дізнатися більше', callback_data: 'wheel_info' }],
              [{ text: '⏭ Пізніше', callback_data: 'dismiss_reminder' }]
            ]
          }
        };
      } else if (wheelCheck.type === 'continue') {
        reminderMessage = 
          `⏰ НЕЗАВЕРШЕНЕ КОЛЕСО\n\n` +
          `${wheelCheck.message}\n\n` +
          `Твій прогрес збережено, можеш продовжити з того місця, де зупинилась.`;
          
        reminderKeyboard = {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Продовжити колесо', callback_data: 'wheel_continue' }],
              [{ text: '🔄 Почати заново', callback_data: 'wheel_restart' }],
              [{ text: '🚪 Скасувати', callback_data: 'wheel_cancel' }]
            ]
          }
        };
      } else if (wheelCheck.type === 'monthly') {
        reminderMessage = 
          `📅 ЧАС ДЛЯ НОВОГО КОЛЕСА\n\n` +
          `${wheelCheck.message}\n\n` +
          `Регулярне заповнення колеса допомагає відслідковувати прогрес у розвитку та підтримувати баланс у всіх сферах життя.`;
          
        reminderKeyboard = {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎯 Заповнити нове колесо', callback_data: 'wheel_start' }],
              [{ text: '📊 Переглянути прогрес', callback_data: 'wheel_stats' }],
              [{ text: '⏭ Пізніше', callback_data: 'dismiss_reminder' }]
            ]
          }
        };
      }
      
      if (reminderMessage) {
        await ctx.reply(reminderMessage, reminderKeyboard);
        console.log(`🎯 [auth] ✅ Показано нагадування про колесо для ${tgId}, тип: ${wheelCheck.type}`);
        return true; // Показали нагадування
      }
    } else {
      console.log(`🎯 [auth] Нагадування не потрібне для ${tgId}: ${wheelCheck.message || 'без повідомлення'}`);
    }
    
    return false; // Нагадування не потрібне
    
  } catch (error) {
    console.error('❌ [auth] Помилка перевірки колеса при /start:', error);
    return false;
  }
};

// ——— /start - ВИПРАВЛЕНО З ПЕРЕВІРКОЮ КОЛЕСА
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
      console.warn('[auth.handleStart] ⚠️ DB issue, continue onboarding:', dbErr?.message);
    }

    console.log(`👤 [auth] Користувач ${tgId}:`, {
      exists: !!user,
      registered: user?.UserRegistered,
      status: user?.Status,
      subscription: user?.['Active_Subscription_Status']
    });

    if (user && !isProfileIncomplete(user)) {
      const active = (user['Active_Subscription_Status'] || '').includes('✅ Активна') || (user['Subscription Status'] === 'Active');
      
      if (active) {
        console.log(`✅ [auth] Зареєстрований користувач ${tgId} з активною підпискою повернувся`);
        
        // Очищаємо стан
        if (ctx.session) {
          ctx.session.step = undefined;
          ctx.session.temp = {};
          ctx.session.wheel = undefined;
        }

        const welcomeText = 
          `🎉 Вітаю, ${user['User Name'] || name}!\n\n` +
          `✅ Твоя підписка активна\n` +
          `🚀 Готовий до продуктивного дня?\n\n` +
          `Обирай що хочеш зробити:`;
        
        await ctx.reply(welcomeText, keyboards.mainMenuKeyboard());
        
        // Перевіряємо чи потрібно показати нагадування про колесо
        await checkAndShowWheelReminder(ctx, user);
        return;
        
      } else {
        console.log(`⚠️ [auth] Зареєстрований користувач ${tgId} без активної підписки`);
        
        const subscriptionText = 
          `👋 З поверненням, ${user['User Name'] || name}!\n\n` +
          `💡 Щоб отримати повний доступ до AI-наставника, колеса балансу та персональних рекомендацій, активуй підписку:\n\n` +
          `🎯 AI коучинг 24/7\n` +
          `📊 Інтерактивне колесо балансу\n` +
          `📈 Персональна аналітика\n` +
          `⏰ Ранкові та вечірні питання`;
        
        await ctx.reply(subscriptionText, keyboards.subscriptionKeyboard());
        
        // Все одно перевіряємо колесо - можливо є безплатні можливості
        setTimeout(() => checkAndShowWheelReminder(ctx, user), 2000);
        return;
      }
    }

    // Початок онбордингу для нового/незареєстрованого користувача
    console.log(`🔄 [auth] Запуск онбордингу для ${tgId}`);
    ctx.session.step = OB_STEPS.GREETING;
    ctx.session.temp = { name };

    const greetingText = 
      `👋 Привіт, ${name}!\n\n` +
      `Я твій AI-мотиватор та коуч! Допомагаю людям:\n\n` +
      `🎯 Ставити та досягати цілі\n` +
      `⚖️ Знаходити баланс у житті\n` +
      `💪 Підтримувати мотивацію\n` +
      `📈 Відслідковувати прогрес\n\n` +
      `Готовий розпочати свій шлях до кращого життя?`;

    await ctx.reply(greetingText, keyboards.greetingKeyboard());
    console.log(`✅ [auth] Онбординг запущено для ${tgId}`);

  } catch (error) {
    console.error('[auth.handleStart] Критична помилка:', error);
    await ctx.reply(
      '❌ Виникла помилка при запуску. Спробуйте ще раз через кілька секунд.',
      { reply_markup: { keyboard: [[{ text: '/start' }]], resize_keyboard: true } }
    );
  }
}

// ——— обробка кроків онбордингу
export async function handleOnboardingStep(ctx) {
  const tgId = ctx.from.id;
  if (!ctx.session) ctx.session = { step: undefined, temp: {} };

  const currentStep = ctx.session.step;
  const userInput = ctx.message?.text?.trim() || '';

  console.log(`👤 [auth] Крок онбордингу: ${currentStep}, input: ${userInput.substring(0, 30)}...`);

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
      case OB_STEPS.SUBSCRIPTION:
        return await handleSubscriptionStep(ctx, userInput);
      default:
        console.warn(`❓ [auth] Невідомий крок онбордингу: ${currentStep}`);
        return false;
    }
  } catch (error) {
    console.error(`❌ [auth] Помилка в кроці ${currentStep}:`, error);
    await ctx.reply('❌ Помилка при обробці. Спробуйте ще раз або перезапустіть /start');
    return false;
  }
}

// ——— крок: ім'я
async function handleNameStep(ctx, name) {
  const tgId = ctx.from.id;

  if (!name || name.length < 2) {
    await ctx.reply('⚠️ Будь ласка, введи правильне ім\'я (мінімум 2 символи):', keyboards.skipKeyboard());
    return true;
  }

  if (name.length > 50) {
    await ctx.reply('⚠️ Ім\'я занадто довге (максимум 50 символів):', keyboards.skipKeyboard());
    return true;
  }

  ctx.session.temp.name = name;
  ctx.session.step = OB_STEPS.EMAIL;

  await ctx.reply(
    `✅ Чудово, ${name}!\n\n📧 Тепер введи свій email для збереження прогресу:`,
    keyboards.skipKeyboard()
  );

  console.log(`✅ [auth] Ім'я збережено: ${name} для ${tgId}`);
  return true;
}

// ——— крок: email
async function handleEmailStep(ctx, email) {
  const tgId = ctx.from.id;

  if (!email || !isValidEmail(email)) {
    await ctx.reply('⚠️ Неправильний формат email. Введи коректний email (наприклад: example@gmail.com):', keyboards.skipKeyboard());
    return true;
  }

  ctx.session.temp.email = email.toLowerCase();
  ctx.session.step = OB_STEPS.PHONE;

  await ctx.reply(
    `✅ Email збережено!\n\n📱 Введи номер телефону у форматі +380XXXXXXXXX:`,
    keyboards.skipKeyboard()
  );

  console.log(`✅ [auth] Email збережено: ${email} для ${tgId}`);
  return true;
}

// ——— крок: телефон
async function handlePhoneStep(ctx, phone) {
  const tgId = ctx.from.id;

  if (!phone || !isValidUaPhone(phone)) {
    await ctx.reply('⚠️ Неправильний формат телефону. Введи український номер: +380XXXXXXXXX:', keyboards.skipKeyboard());
    return true;
  }

  ctx.session.temp.phone = phone;
  ctx.session.step = OB_STEPS.TIMEZONE;

  await ctx.reply(
    `✅ Телефон збережено!\n\n🌍 Обери свій часовий пояс:`,
    keyboards.timezoneKeyboard()
  );

  console.log(`✅ [auth] Телефон збережено: ${phone} для ${tgId}`);
  return true;
}

// ——— крок: часовий пояс
async function handleTimezoneStep(ctx, timezone) {
  const tgId = ctx.from.id;

  // Перевіряємо чи це валідний часовий пояс
  const validTimezones = ['Europe/Kiev', 'Europe/Warsaw', 'Europe/Berlin', 'Europe/London', 'America/New_York'];
  if (!timezone || !validTimezones.includes(timezone)) {
    await ctx.reply('⚠️ Будь ласка, обери часовий пояс з кнопок:', keyboards.timezoneKeyboard());
    return true;
  }

  ctx.session.temp.timezone = timezone;
  ctx.session.step = OB_STEPS.SUBSCRIPTION;

  const subscriptionText = 
    `✅ Часовий пояс встановлено!\n\n` +
    `🎯 ОСТАННІЙ КРОК - ПІДПИСКА\n\n` +
    `Обери тарифний план:\n\n` +
    `💎 **ПРЕМІУМ** (199 грн/міс)\n` +
    `• AI-наставник 24/7\n` +
    `• Колесо балансу\n` +
    `• Персональна аналітика\n` +
    `• Ранкові/вечірні питання\n` +
    `• Безлімітні консультації\n\n` +
    `🚀 **СТАНДАРТ** (99 грн/міс)\n` +
    `• AI-наставник\n` +
    `• Базове колесо балансу\n` +
    `• Щоденні питання\n\n` +
    `💡 **БЕЗКОШТОВНА ВЕРСІЯ**\n` +
    `• Обмежений AI-наставник\n` +
    `• Основні функції`;

  await ctx.reply(subscriptionText, keyboards.subscriptionPlansKeyboard());

  console.log(`✅ [auth] Часовий пояс збережено: ${timezone} для ${tgId}`);
  return true;
}

// ——— крок: підписка
async function handleSubscriptionStep(ctx, plan) {
  const tgId = ctx.from.id;

  console.log(`💳 [auth] Обрано план підписки: ${plan} для ${tgId}`);

  try {
    // Зберігаємо всі дані користувача
    const userData = {
      'TG_id': String(tgId),
      'User Name': ctx.session.temp.name,
      'Email': ctx.session.temp.email,
      'Phone': ctx.session.temp.phone,
      'Time Zone': ctx.session.temp.timezone,
      'Registration Date': new Date().toISOString(),
      'Status': 'Registered User',
      'UserRegistered': true,
      'Subscription Status': plan === 'free' ? 'Free' : 'Pending',
      'Active_Subscription_Status': plan === 'free' ? '❌ Безкоштовна' : '⏳ Очікує оплати'
    };

    console.log(`💾 [auth] Зберігаємо користувача ${tgId}:`, userData);

    const savedUser = await safeUpsert(tgId, userData);
    
    if (!savedUser) {
      throw new Error('Не вдалося зберегти користувача');
    }

    // Завершуємо реєстрацію
    try {
      await finalizeRegistration(tgId);
      console.log(`✅ [auth] Реєстрація завершена для ${tgId}`);
    } catch (finalizeError) {
      console.warn(`⚠️ [auth] finalizeRegistration warn:`, finalizeError?.message);
    }

    // Очищаємо сесію
    ctx.session.step = undefined;
    ctx.session.temp = {};

    if (plan === 'free') {
      const welcomeMessage = 
        `🎉 Реєстрація завершена!\n\n` +
        `Вітаю в безкоштовній версії, ${userData['User Name']}!\n\n` +
        `🚀 Ти можеш:\n` +
        `• Використовувати базові функції AI\n` +
        `• Заповнити колесо балансу\n` +
        `• Отримувати щоденні питання\n\n` +
        `💡 Для повного доступу можеш оновити підписку в будь-який момент!`;

      await ctx.reply(welcomeMessage, keyboards.mainMenuKeyboard());
      
      // Показуємо нагадування про колесо для безкоштовних користувачів
      setTimeout(() => checkAndShowWheelReminder(ctx, savedUser), 1500);
      
    } else {
      // Платна підписка - запускаємо процес оплати
      const planDetails = SUBSCRIPTION_PLANS[plan];
      if (!planDetails) {
        throw new Error(`Невідомий план: ${plan}`);
      }

      const paymentText = 
        `💳 ОПЛАТА ПІДПИСКИ\n\n` +
        `План: ${planDetails.name}\n` +
        `Вартість: ${planDetails.price} грн/міс\n\n` +
        `Після оплати отримаєш повний доступ до всіх функцій!`;

      const paymentKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💳 Оплатити зараз', callback_data: `pay_${plan}` }],
            [{ text: '⏭ Оплатити пізніше', callback_data: 'pay_later' }],
            [{ text: '🆓 Залишитись на безкоштовній', callback_data: 'switch_to_free' }]
          ]
        }
      };

      await ctx.reply(paymentText, paymentKeyboard);
    }

    console.log(`✅ [auth] Онбординг завершено для ${tgId}, план: ${plan}`);
    return true;

  } catch (error) {
    console.error(`❌ [auth] Помилка збереження користувача ${tgId}:`, error);
    await ctx.reply(
      '❌ Помилка при збереженні даних. Спробуйте ще раз або зверніться до підтримки.',
      keyboards.mainMenuKeyboard()
    );
    return false;
  }
}

// ——— callback обробники онбордингу
export async function handleOnboardingCallback(ctx) {
  const tgId = ctx.from.id;
  const data = ctx.callbackQuery.data;

  console.log(`📱 [auth] Callback онбордингу: ${data} для ${tgId}`);

  try {
    if (data === 'start_registration') {
      ctx.session.step = OB_STEPS.NAME;
      ctx.session.temp = ctx.session.temp || {};
      
      await ctx.reply(
        `📝 Давай знайомитись!\n\nЯк тебе звати? (введи своє справжнє ім'я):`,
        keyboards.skipKeyboard()
      );
      await ctx.answerCbQuery('Початок реєстрації');

    } else if (data.startsWith('plan_')) {
      const planType = data.replace('plan_', '');
      await handleSubscriptionStep(ctx, planType);
      await ctx.answerCbQuery(`Обрано план: ${planType}`);

    } else if (data.startsWith('tz_')) {
      const timezone = data.replace('tz_', '');
      await handleTimezoneStep(ctx, timezone);
      await ctx.answerCbQuery(`Часовий пояс: ${timezone}`);

    } else if (data === 'skip_step') {
      await handleSkipStep(ctx);
      await ctx.answerCbQuery('Крок пропущено');

    } else if (data === 'pay_later') {
      await ctx.reply(
        `⏰ Зрозуміло! Ти можеш оплатити підписку пізніше через меню.\n\n` +
        `Поки що доступна безкоштовна версія:`,
        keyboards.mainMenuKeyboard()
      );
      await ctx.answerCbQuery('Оплата відкладена');

    } else if (data === 'switch_to_free') {
      // Оновлюємо статус на безкоштовний
      await safeUpsert(tgId, {
        'Subscription Status': 'Free',
        'Active_Subscription_Status': '❌ Безкоштовна'
      });
      
      await ctx.reply(
        `🆓 Перемкнуто на безкоштовну версію!\n\nТи завжди можеш оновити підписку пізніше:`,
        keyboards.mainMenuKeyboard()
      );
      await ctx.answerCbQuery('Безкоштовна версія активована');

    } else if (data.startsWith('pay_')) {
      const plan = data.replace('pay_', '');
      await initializePayment(ctx, plan);
      await ctx.answerCbQuery('Перехід до оплати');

    } else {
      console.warn(`❓ [auth] Невідомий callback: ${data}`);
      await ctx.answerCbQuery('Команда не розпізнана');
    }

  } catch (error) {
    console.error('[auth.callback] Помилка:', error);
    await ctx.answerCbQuery('Помилка обробки команди');
  }
}

// ——— пропуск кроку
async function handleSkipStep(ctx) {
  const currentStep = ctx.session.step;
  const tgId = ctx.from.id;

  console.log(`⏭ [auth] Пропуск кроку: ${currentStep} для ${tgId}`);

  switch (currentStep) {
    case OB_STEPS.NAME:
      ctx.session.temp.name = ctx.from.first_name || 'Користувач';
      ctx.session.step = OB_STEPS.EMAIL;
      await ctx.reply('📧 Введи email:', keyboards.skipKeyboard());
      break;

    case OB_STEPS.EMAIL:
      ctx.session.temp.email = `user${tgId}@temp.com`;
      ctx.session.step = OB_STEPS.PHONE;
      await ctx.reply('📱 Введи телефон (+380XXXXXXXXX):', keyboards.skipKeyboard());
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

// ——— ініціалізація оплати
async function initializePayment(ctx, planType) {
  const tgId = ctx.from.id;
  
  try {
    console.log(`💳 [auth] Ініціалізація оплати для ${tgId}, план: ${planType}`);
    
    const planDetails = SUBSCRIPTION_PLANS[planType];
    if (!planDetails) {
      throw new Error(`Невідомий план: ${planType}`);
    }

    // Генеруємо посилання на оплату через WayForPay
    const paymentUrl = await wayforpayService.createPaymentUrl({
      userId: tgId,
      planType: planType,
      amount: planDetails.price,
      description: `Підписка ${planDetails.name}`
    });

    const paymentMessage = 
      `💳 ОПЛАТА ПІДПИСКИ\n\n` +
      `План: ${planDetails.name}\n` +
      `Вартість: ${planDetails.price} грн\n` +
      `Період: 1 місяць\n\n` +
      `Після оплати підписка активується автоматично.`;

    const paymentKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💳 Перейти до оплати', url: paymentUrl }],
          [{ text: '🔄 Перевірити оплату', callback_data: 'check_payment' }],
          [{ text: '❌ Скасувати', callback_data: 'cancel_payment' }]
        ]
      }
    };

    await ctx.reply(paymentMessage, paymentKeyboard);
    console.log(`✅ [auth] Посилання на оплату надіслано для ${tgId}`);

  } catch (error) {
    console.error(`❌ [auth] Помилка створення оплати:`, error);
    await ctx.reply('❌ Помилка створення оплати. Спробуйте пізніше або зверніться до підтримки.');
  }
}

// ——— експорт
export default {
  handleStart,
  handleOnboardingStep,
  handleOnboardingCallback,
  isProfileIncomplete,
  checkAndShowWheelReminder
};