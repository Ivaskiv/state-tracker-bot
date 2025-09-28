// src/controllers/botController.js
// ПЕРЕПИСАНО: використання асинхронного userService з миттєвими операціями

import keyboards from '../utils/keyboards.js';
import userService from '../auth/services/userService.js';
import paymentService from '../auth/services/paymentService.js';
import typing from '../utils/typing.js';

import startHandler from './handlers/startHandler.js';
import mainFlowController from './flows/mainFlowController.js';
import registrationController from './flows/registrationController.js';
import dailyController from './flows/dailyController.js';
import wheelController from './flows/wheelController.js';
import aiMentorController from '../aiMentor/controllers/aiMentorController.js';
import subscriptionController from './subscriptionController.js';
import { resolveTz, TIMEZONES, parseTz } from '../config/constants.js';
import { isValidEmail, isValidUaPhone, isValidName, formatEmail, formatPhone, formatName } from '../utils/validators.js';

// Константи для реєстрації
const SUBSCRIPTION_PLANS = {
  TRIAL: { name: '🧪 Пробний 7 днів — 0€', price: 0, duration: 7 },
  WEEK: { name: '🎯 Тиждень — 7€', price: 7, duration: 7 },
  MONTH: { name: '📅 Місяць — 30€', price: 30, duration: 30 },
  YEAR: { name: '🗓️ Рік — 300€', price: 300, duration: 365 }
};

const REGISTRATION_STEPS = {
  NAME: 'ob_name',
  EMAIL: 'ob_email', 
  PHONE: 'ob_phone',
  TIMEZONE: 'ob_timezone',
  PLAN: 'ob_plan'
};

const botController = (bot) => {
  console.log('🤖 [botController] Ініціалізація хендлерів');

  // ===== MIDDLEWARE =====
  bot.use(async (ctx, next) => {
    const base = { type: ctx.updateType, from: ctx.from?.id };

    if (ctx.updateType === 'message') {
      base.text = ctx.message?.text?.slice(0, 60);
    }
    if (ctx.updateType === 'callback_query') {
      base.cb = ctx.callbackQuery?.data;
    }

    console.log('➡️', base);
    
    try {
      await next();
    } catch (error) {
      console.error('💥 middleware error:', error.message);
      try {
        await ctx.reply('❌ Виникла помилка. Спробуй /start');
      } catch {}
    }
  });

  // ===== ФУНКЦІЇ РЕЄСТРАЦІЇ =====
  const startRegistration = async (ctx, name) => {
    ctx.session.step = REGISTRATION_STEPS.NAME;
    ctx.session.temp = { name };
    
    await typing(ctx, 500);
    await ctx.reply(
      `Я твій AI-мотиватор! Допомагаю:\n\n🎯 Досягати цілі\n⚖️ Знаходити баланс\n💪 Підтримувати мотивацію\n\nЯк до тебе звертатись? (2–30 символів)`
    );
  };

  const askForEmail = async (ctx) => {
    ctx.session.step = REGISTRATION_STEPS.EMAIL;
    await ctx.reply(
      '📧 Email для звітів (або пропусти):',
      { reply_markup: { inline_keyboard: [[{ text: '⏭️ Пропустити', callback_data: 'skip_email' }]] } }
    );
  };

  const askForPhone = async (ctx) => {
    ctx.session.step = REGISTRATION_STEPS.PHONE;
    await ctx.reply(
      '📱 Телефон +380XXXXXXXXX (або пропусти):',
      { reply_markup: { inline_keyboard: [[{ text: '⏭️ Пропустити', callback_data: 'skip_phone' }]] } }
    );
  };

  const askForTimezone = async (ctx) => {
    ctx.session.step = REGISTRATION_STEPS.TIMEZONE;
    const rows = TIMEZONES.slice(0, 8).map(tzLabel => [{ 
      text: tzLabel, 
      callback_data: `tz_${parseTz(tzLabel)}` 
    }]);
    
    await ctx.reply('🌍 Часовий пояс:', { reply_markup: { inline_keyboard: rows } });
  };

  const showPlans = async (ctx) => {
    ctx.session.step = REGISTRATION_STEPS.PLAN;
    await ctx.reply(
      `💰 ОБЕРИ ПЛАН:\n\n🧪 Пробний — 0€ (7 днів)\n🎯 Тиждень — 7€\n📅 Місяць — 30€\n🗓️ Рік — 300€\n\nПочни з безкоштовного:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🧪 Пробний 7 днів — 0€', callback_data: 'plan_trial' }],
            [{ text: '🎯 Тиждень — 7€', callback_data: 'plan_week' }],
            [{ text: '📅 Місяць — 30€', callback_data: 'plan_month' }],
            [{ text: '🗓️ Рік — 300€', callback_data: 'plan_year' }]
          ]
        }
      }
    );
  };

  const showSubscriptionRequired = async (ctx) => {
    await ctx.reply(
      `💡 Потрібна підписка:\n\n🎯 AI коучинг 24/7\n📊 Колесо балансу\n📈 Аналітика`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎁 Пробний 7 днів', callback_data: 'plan_trial' }],
            [{ text: '💰 Плани', callback_data: 'show_plans' }]
          ]
        }
      }
    );
  };

  // ===== ОБРОБКА ПЛАНІВ =====
  const handlePlanSelection = async (ctx, planType) => {
    const tgId = ctx.from.id;
    
    try {
      await typing(ctx, 800);
      await ctx.reply('⏳ Активую...');
      
      const sessionData = { ...ctx.session.temp };
      ctx.session.step = undefined;
      ctx.session.temp = {};

      if (planType === 'TRIAL') {
        await typing(ctx, 1200);

        // Негайна відповідь користувачу
        await ctx.reply(
          `🎉 Реєстрацію завершено!\n\n🧪 Пробна підписка активована на 7 днів\n\n🎯 Можеш користуватися всіма функціями!`,
          keyboards.mainMenuKeyboard()
        );

        // Фонове оновлення через paymentService
        activateTrialInBackground(tgId, sessionData);

      } else {
        // Платні плани
        updateUserInBackground(tgId, sessionData);

        await typing(ctx, 800);

        const planInfo = SUBSCRIPTION_PLANS[planType];
        if (planInfo) {
          await ctx.reply(
            `💳 ОПЛАТА\n\nПлан: ${planInfo.name}\nВартість: ${planInfo.price}€\n\nДля оплати:\n📧 nadyastarway@gmail.com\n💬 @Nadya2316`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🧪 Пробна версія', callback_data: 'plan_trial' }],
                  [{ text: '📞 Підтримка', callback_data: 'contact_support' }]
                ]
              }
            }
          );
        }
      }
      
    } catch (error) {
      console.error('[handlePlanSelection] ❌', error.message);
      await ctx.reply(
        `⚠️ Помилка. Спробуй ще раз або зверніся:\n📧 nadyastarway@gmail.com`,
        keyboards.mainMenuKeyboard()
      );
    }
  };

  // ===== ФОНОВІ ОПЕРАЦІЇ =====
  const activateTrialInBackground = async (tgId, sessionData) => {
    console.log(`[activateTrialInBackground] 🧪 Активація trial для ${tgId}`);
    
    try {
      // ✅ НАДІЙНЕ ОНОВЛЕННЯ: використовуємо finalizeRegistration
      await userService.finalizeRegistration(tgId, {
        name: sessionData?.name || 'Користувач',
        email: sessionData?.email || null,
        phone: sessionData?.phone || null,
        timezone: sessionData?.timezone || 'Europe/Kyiv'
      });
      console.log(`[activateTrialInBackground] ✅ Реєстрацію завершено`);
      
      // Спробуємо через paymentService
      const trialActivated = await paymentService.activateTrialSubscription(tgId, 7);
      
      if (trialActivated) {
        console.log(`[activateTrialInBackground] ✅ Trial активовано через paymentService`);
      } else {
        console.warn(`[activateTrialInBackground] ⚠️ paymentService не спрацював, fallback`);
        
        // Fallback через userService
        const now = new Date();
        const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const trialFields = {
          'Active Subscription Plan': '🧪 Пробний період — 0€',
          'Subscription Status': 'Active',
          'Start_Date': now.toISOString(),
          'End_Date': endDate.toISOString()
        };

        await userService.updateUser(tgId, trialFields);
        console.log(`[activateTrialInBackground] ✅ Fallback активація завершена`);
      }

    } catch (error) {
      console.error('[activateTrialInBackground] ❌', error.message);
    }
  };

  const updateUserInBackground = async (tgId, sessionData) => {
    console.log(`[updateUserInBackground] 🔄 Оновлення для ${tgId}`);
    
    try {
      // ✅ НАДІЙНЕ ОНОВЛЕННЯ: використовуємо finalizeRegistration
      await userService.finalizeRegistration(tgId, {
        name: sessionData?.name || 'Користувач',
        email: sessionData?.email || null,
        phone: sessionData?.phone || null,
        timezone: sessionData?.timezone || 'Europe/Kyiv'
      });
      console.log(`[updateUserInBackground] ✅ Реєстрацію завершено`);

    } catch (error) {
      console.error('[updateUserInBackground] ❌', error.message);
    }
  };

  // ===== КОМАНДА /start =====
  bot.start(async (ctx) => {
    const tgId = ctx.from.id;
    const telegramName = ctx.from.first_name || 'Користувач';
    console.log(`🚀 [/start] від ${tgId} (${telegramName})`);

    try {
      // Захист від подвійного виконання
      if (ctx.session._processing) {
        console.log(`⚠️ [/start] Подвійний запуск для ${tgId} - ігноруємо`);
        return;
      }
      ctx.session._processing = true;

      // Миттєва відповідь
      await typing(ctx, 500);
      await ctx.reply(`👋 Привіт, ${telegramName}!\n\n⏳ Підготовлюю твій профіль...`);

      // ✅ ПРЯМЕ СТВОРЕННЯ В AIRTABLE: використовуємо createUser
      console.log(`[START] 🔄 Створюємо користувача в Airtable напряму`);
      
      let user = await userService.createUser({
        tgId: tgId,
        name: telegramName,
        email: null,
        phone: null,
        timezone: 'Europe/Kyiv',
        registrationStatus: 'New'
      });
      
      console.log(`[START] ✅ Користувач створений: ${user ? 'так' : 'ні'}`);
      
      if (user) {
        const hasAccess = userService.hasActiveAccess(user);
        
        if (user.UserRegistered && hasAccess) {
          await typing(ctx, 800);
          await ctx.reply(
            `✅ З поверненням, ${user['User Name'] || telegramName}!\n\n✅ Підписка активна\n\nПродовжимо розвиток? 🚀`,
            keyboards.mainMenuKeyboard()
          );
          return;
        }
        
        if (user.UserRegistered && !hasAccess) {
          await typing(ctx, 600);
          await showSubscriptionRequired(ctx);
          return;
        }
        
        // Незавершена реєстрація
        await typing(ctx, 500);
        await ctx.reply(`✅ Завершимо реєстрацію!`);
        await startRegistration(ctx, user['User Name'] || telegramName);
        return;
      }

      // Fallback - якщо ensureNewUserStub не спрацював
      console.log(`[START] ⚠️ ensureNewUserStub не спрацював, запускаємо реєстрацію`);
      await typing(ctx, 600);
      await ctx.reply(`✅ Створюю твій профіль! Почнемо реєстрацію.`);
      await startRegistration(ctx, telegramName);

    } catch (err) {
      console.error('[START] ❌ Критична помилка:', err);
      try { 
        await ctx.reply('❌ Помилка запуску. Спробуй ще раз /start'); 
      } catch {}
    } finally {
      ctx.session._processing = false;
    }
  });

  // ===== ОБРОБКА ТЕКСТУ =====
  bot.on('text', async (ctx) => {
    if (ctx.message?.entities?.some(e => e.type === 'bot_command')) return;

    const tgId = ctx.from.id;
    const text = ctx.message?.text?.trim();
    const currentStep = ctx.session?.step;
    
    if (!text) return;

    try {
      // Обробка кроків реєстрації
      if (currentStep === REGISTRATION_STEPS.NAME) {
        if (!isValidName(text)) {
          await ctx.reply('⚠️ Введи правильне ім\'я (2-50 символів):');
          return;
        }
        ctx.session.temp.name = formatName(text);
        await askForEmail(ctx);
        return;
      }

      if (currentStep === REGISTRATION_STEPS.EMAIL) {
        if (text && !isValidEmail(text)) {
          await ctx.reply('⚠️ Невірний email. Введи коректний або пропусти:');
          return;
        }
        if (text) ctx.session.temp.email = formatEmail(text);
        await askForPhone(ctx);
        return;
      }

      if (currentStep === REGISTRATION_STEPS.PHONE) {
        const formattedPhone = formatPhone(text);
        if (text && !isValidUaPhone(formattedPhone)) {
          await ctx.reply('⚠️ Неправильний телефон. Введи +380XXXXXXXXX або пропусти:');
          return;
        }
        if (text) ctx.session.temp.phone = formattedPhone;
        await askForTimezone(ctx);
        return;
      }

      // Якщо registrationController є - спробуємо його
      if (registrationController?.handleText) {
        const consumed = await registrationController.handleText(ctx);
        if (consumed) {
          console.log('[botController] ✅ registrationController.handleText спрацював');
          return;
        }
      }

      // Швидке отримання користувача
      let user = userService.cacheGet(tgId);
      if (!user) {
        user = await userService.getUserByTelegramId(tgId);
      }

      const userStep = user?.Answer_Step || ctx.session?.step || '';

      // AI наставник активний?
      const { aiMentorSession } = await import('../aiMentor/session.js');
      if (aiMentorSession?.isActive?.(tgId)) {
        await aiMentorController.handleAIMentorQuestion(ctx, text);
        return;
      }

      // Колесо балансу
      if (userStep === 'WheelBalance') {
        await wheelController.handleText(ctx, text);
        return;
      }

      // Ранкові/вечірні питання
      if (userStep?.startsWith('Q_m_') || userStep?.startsWith('Q_e_')) {
        await dailyController.handleText(ctx, text, userStep);
        return;
      }

      // Головний флоу меню
      await mainFlowController.handleText(ctx, text, user);
      
    } catch (error) {
      console.error('[TEXT] ❌', error.message);
      await ctx.reply('❌ Помилка. Спробуй ще раз.');
    }
  });

  // ===== ОБРОБКА CALLBACK =====
  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery?.data || '';
    const tgId = ctx.from.id;

    try {
      await ctx.answerCbQuery();

      // Пропуски в реєстрації
      if (data === 'skip_email') {
        await askForPhone(ctx);
        return;
      }

      if (data === 'skip_phone') {
        await askForTimezone(ctx);
        return;
      }

      // Вибір таймзони
      if (data.startsWith('tz_')) {
        const slug = data.slice(3);
        const label = resolveTz(slug);
        ctx.session.temp.timezone = label;

        // Фонове оновлення таймзони
        userService.updateUserInstant(tgId, { 'Time Zone': label });

        await ctx.reply(`✅ Часовий пояс: ${label}`);
        await showPlans(ctx);
        return;
      }

      // Вибір планів
      if (data.startsWith('plan_')) {
        const planType = data.replace('plan_', '').toUpperCase();
        await handlePlanSelection(ctx, planType);
        return;
      }

      if (data === 'show_plans') {
        await showPlans(ctx);
        return;
      }

      // Онбординг через registrationController
      if (registrationController?.isRegistrationCallback?.(data)) {
        await registrationController.handleCallback(ctx, data);
        return;
      }

      // AI наставник
      if (data.startsWith('ai_')) {
        await aiMentorController.handleAIMentorCallback(ctx);
        return;
      }

      // Колесо балансу
      if (data.startsWith('wheel_')) {
        await wheelController.handleCallback(ctx, data);
        return;
      }

      // Ранкові/вечірні питання
      if (data.includes('morning') || data.includes('evening')) {
        await dailyController.handleCallback(ctx, data);
        return;
      }

      // Підписки та trial
      if (
        data.startsWith('subscribe_') ||
        data === 'subscription_plans' ||
        data === 'subscription_info' ||
        data === 'sync_subscription' ||
        data === 'activate_trial' ||
        data === 'plan_free' ||
        data === 'contact_support'
      ) {
        if (data === 'plan_free') {
          await handlePlanSelection(ctx, 'TRIAL');
        } else {
          await subscriptionController.handleCallback(ctx);
        }
        return;
      }

      // Головне меню
      if (data === 'main_menu') {
        await ctx.reply('🏠 Меню:', keyboards.mainMenuKeyboard());
        return;
      }

      // Дефолт через mainFlowController
      let user = userService.cacheGet(tgId);
      if (!user) {
        user = await userService.getUserByTelegramId(tgId);
      }
      await mainFlowController.handleCallback(ctx, data, user);

    } catch (error) {
      console.error('[CALLBACK] ❌', error.message);
      try { await ctx.answerCbQuery('Помилка'); } catch {}
    }
  });

  // ===== ГЛОБАЛЬНІ ПОМИЛКИ =====
  bot.catch(async (err, ctx) => {
    console.error('❌ [botController] Global error:', err);
    if (ctx?.reply) {
      try { 
        await ctx.reply('❌ Помилка. Спробуй /start', keyboards.mainMenuKeyboard()); 
      } catch {}
    }
  });

  console.log('✅ [botController] Готово з реєстрацією');
  return { bot };
};

export default botController;