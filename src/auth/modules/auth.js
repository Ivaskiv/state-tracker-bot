// src/auth/modules/auth.js - АВТЕНТИФІКАЦІЯ З ДЕТАЛЬНИМИ ЛОГАМИ

import userService from '../services/userService.js';
import paymentService from '../services/paymentService.js';
import keyboards from '../../utils/keyboards.js';
import { isValidEmail, isValidUaPhone, isValidName, formatEmail, formatPhone, formatName } from '../../utils/validators.js';
import { SUBSCRIPTION_PLANS, OB_STEPS, TIMEZONES, parseTz } from '../../config/constants.js';

// ===== ПЕРЕВІРКА СТАТУСУ КОРИСТУВАЧА =====

/**
 * Перевіряємо чи профіль незавершений
 */
const isProfileIncomplete = (user) => {
  console.log(`[auth] 🔍 isProfileIncomplete check:`, {
    userExists: !!user,
    hasName: !!user?.['User Name'],
    hasEmail: !!user?.Email,
    status: user?.Status,
    userRegistered: user?.UserRegistered
  });
  
  if (!user) {
    console.log(`[auth] ❌ isProfileIncomplete: користувач відсутній`);
    return true;
  }
  
  const hasBasicData = !!user['User Name'] && !!user['Email'];
  const isRegistered = user.Status === 'Registered User' || user.UserRegistered === true;
  
  const incomplete = !(hasBasicData && isRegistered);
  console.log(`[auth] 📊 isProfileIncomplete результат:`, {
    hasBasicData,
    isRegistered, 
    incomplete
  });
  
  return incomplete;
};

/**
 * Безпечне створення або оновлення користувача
 */
const safeUpsertUser = async (tgId, fields) => {
  console.log(`[auth] 🔄 safeUpsertUser для ${tgId}:`, Object.keys(fields));
  
  try {
    // Спочатку пробуємо оновити
    const updated = await userService.updateUser(tgId, fields);
    if (updated) {
      console.log(`[auth] ✅ safeUpsertUser: користувач оновлений`);
      return updated;
    }
    
    console.log(`[auth] 🆕 safeUpsertUser: створюємо нового користувача`);
    
    // З TIMEOUT для створення
    const createPromise = userService.createUser({
      tgId,
      name: fields['User Name'],
      email: fields.Email,
      phone: fields.Phone,
      timezone: fields['Time Zone'],
      registrationStatus: fields['Subscription Status'] || 'New'
    });
    
    const createTimeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('createUser timeout after 15s')), 15000)
    );
    
    let created;
    try {
      created = await Promise.race([createPromise, createTimeoutPromise]);
    } catch (createTimeoutError) {
      console.error('[safeUpsertUser] ⏰ createUser TIMEOUT:', createTimeoutError.message);
      throw new Error('База даних недоступна');
    }
    
    console.log(`[auth] ✅ safeUpsertUser: новий користувач створений`);
    return created;
    
  } catch (error) {
    console.error('[safeUpsertUser] ❌ Помилка:', error);
    throw error;
  }
};
/**
 * Швидке створення користувача з мінімальними даними
 */
const createMinimalUser = async (tgId, name) => {
  console.log(`[auth] 🚀 createMinimalUser для ${tgId} з ім'ям "${name}"`);
  
  try {
    const created = await userService.createUser({
      tgId,
      name: name || 'Користувач',
      registrationStatus: 'New'
    });
    
    console.log(`[auth] ✅ createMinimalUser: користувач створений`);
    return created;
  } catch (error) {
    console.error('[createMinimalUser] ❌ Помилка:', error);
    return null;
  }
};

// ===== ОБРОБКА /start =====

/**
 * Головний обробник команди /start - ШВИДКИЙ З TYPING
 */
export const handleStart = async (ctx) => {
  const tgId = ctx.from.id;
  const name = ctx.from.first_name || 'Користувач';
  
  console.log(`[auth] 🚀 handleStart ПОЧАТОК для ${tgId} (${name})`);
  
  // Одразу показуємо typing
  await ctx.sendChatAction('typing');
  
  if (!ctx.session) {
    console.log(`[auth] 🔧 Ініціалізуємо сесію`);
    ctx.session = { step: undefined, temp: {} };
  }
  
  try {
    console.log(`[auth] 📞 Швидка перевірка користувача ${tgId}`);
    
    // ШВИДКА перевірка - спочатку кеш, потім швидкий запит
    let user = null;
    let needsRegistration = false;
    
    try {
      // Перевіряємо кеш
      const cached = userService.getFromCache?.(tgId);
      if (cached) {
        user = cached;
        console.log(`[auth] ⚡ Користувач з кешу`);
      } else {
        // Швидкий запит з timeout 5 сек
        const quickCheck = userService.getUserByTelegramId(tgId);
        const timeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Quick check timeout')), 5000)
        );
        
        user = await Promise.race([quickCheck, timeout]);
        console.log(`[auth] ⚡ Швидка перевірка завершена`);
      }
    } catch (error) {
      console.warn(`[auth] ⚠️ Швидка перевірка не вдалась, створюємо користувача`);
      needsRegistration = true;
    }
    
    // Якщо користувача немає або БД недоступна - одразу створюємо мінімальний запис
    if (!user || needsRegistration) {
      console.log(`[auth] 🆕 Створюємо мінімальний запис для ${tgId}`);
      
      // Створюємо мінімальний запис В ФОНІ
      createMinimalUserInBackground(tgId, name);
      
      // А користувачу одразу показуємо реєстрацію
      console.log(`[auth] 📝 Показуємо реєстрацію`);
      await startRegistration(ctx, name);
      return;
    }
    
    // Користувач існує - перевіряємо чи завершив реєстрацію
    if (isProfileIncomplete(user)) {
      console.log(`[auth] 📝 Профіль незавершений, продовжуємо реєстрацію`);
      await continueRegistration(ctx, user);
      return;
    }
    
    console.log(`[auth] ✅ Користувач зареєстрований, перевіряємо доступ`);
    await ctx.sendChatAction('typing');
    
    // Перевіряємо підписку
    const hasAccess = userService.hasActiveAccess(user);
    console.log(`[auth] 💰 Підписка: ${hasAccess ? 'АКТИВНА' : 'НЕАКТИВНА'}`);
    
    if (!hasAccess) {
      console.log(`[auth] 💳 Показуємо потребу в підписці`);
      await showSubscriptionRequired(ctx, user);
      return;
    }
    
    // Перевіряємо перше колесо
    console.log(`[auth] 🎯 Перевіряємо колесо`);
    await ctx.sendChatAction('typing');
    
    let hasWheel = false;
    try {
      hasWheel = await checkFirstWheelQuick(tgId);
    } catch {
      hasWheel = true; // Якщо не можемо перевірити, припускаємо що є
    }
    
    if (!hasWheel) {
      console.log(`[auth] 🎯 Показуємо перше колесо`);
      await showFirstWheel(ctx, user);
      return;
    }
    
    // Все готово - головне меню
    console.log(`[auth] ✅ Головне меню`);
    await ctx.sendChatAction('typing');
    await showMainMenu(ctx, user);
    
  } catch (error) {
    console.error('[auth.handleStart] ❌ КРИТИЧНА ПОМИЛКА:', error);
    
    try {
      await ctx.reply('❌ Помилка. Спробуй ще раз /start');
    } catch {}
  }
};
/**
 * Створення мінімального користувача в фоні
 */
const createMinimalUserInBackground = async (tgId, name) => {
  console.log(`[auth] 🔄 Створюємо мінімальний запис в фоні для ${tgId}`);
  
  try {
    // Створюємо базовий запис одразу
    const minimalData = {
      'TG_id': String(tgId),
      'User Name': name || 'Користувач',
      'Email': `temp${tgId}@example.com`, // Тимчасовий email
      'Phone': '+380000000000', // Тимчасовий телефон
      'Time Zone': 'Europe/Kyiv',
      'Registration Date': new Date().toISOString(),
      'Status': 'Registration Started',
      'UserRegistered': false,
      'Subscription Status': 'New',
      'Active_Subscription_Status': '❌ Неактивна',
      'Created_At': new Date().toISOString(),
    };
    
    // Створюємо з timeout 10 сек
    const createPromise = userService.createUserDirect(minimalData);
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Background create timeout')), 10000)
    );
    
    const created = await Promise.race([createPromise, timeout]);
    
    if (created) {
      console.log(`[auth] ✅ Мінімальний запис створено в фоні`);
    } else {
      console.warn(`[auth] ⚠️ Не вдалось створити мінімальний запис`);
    }
    
  } catch (error) {
    console.error(`[auth] ❌ Помилка створення в фоні:`, error.message);
  }
};

/**
 * Швидка перевірка колеса
 */
const checkFirstWheelQuick = async (tgId) => {
  try {
    const { getBase, tables } = await import('../../config/database.js');
    const base = getBase();
    
    const quickPromise = base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Status}="Completed")`,
        maxRecords: 1
      })
      .firstPage();
    
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Wheel check timeout')), 3000)
    );
    
    const records = await Promise.race([quickPromise, timeout]);
    return records.length > 0;
    
  } catch (error) {
    console.warn(`[auth] ⚠️ Швидка перевірка колеса не вдалась:`, error.message);
    return false;
  }
};

/**
 * Продовження реєстрації для існуючого користувача
 */
const continueRegistration = async (ctx, user) => {
  await ctx.sendChatAction('typing');
  
  const message = `👋 З поверненням!\n\nДавай завершимо реєстрацію.\n\nВведи своє ім'я:`;
  
  ctx.session.step = OB_STEPS.NAME;
  ctx.session.temp = {
    userId: user.id,
    existingData: user
  };
  
  await ctx.reply(message, keyboards.skipKeyboard());
};

// ===== РЕЄСТРАЦІЯ =====

/**
 * Запуск процесу реєстрації
 */
const startRegistration = async (ctx, name) => {
  console.log(`[auth] 📝 startRegistration для ${name}`);
  
  ctx.session.step = OB_STEPS.NAME;
  ctx.session.temp = { name };
  
  const greetingText =
    `👋 Привіт, ${name}!\n\n` +
    `Я твій AI-мотиватор та коуч! Допомагаю:\n\n` +
    `🎯 Ставити та досягати цілі\n` +
    `⚖️ Знаходити баланс у житті\n` +
    `💪 Підтримувати мотивацію\n` +
    `📈 Відслідковувати прогрес\n\n` +
    `Готова розпочати?`;
  
  try {
    await ctx.reply(greetingText, keyboards.greetingKeyboard());
    console.log(`[auth] ✅ startRegistration: привітання надіслано`);
  } catch (error) {
    console.error('[auth] ❌ startRegistration: помилка надсилання:', error);
  }
};

/**
 * Обробка кроків реєстрації
 */
export const handleRegistrationStep = async (ctx) => {
  const tgId = ctx.from.id;
  const currentStep = ctx.session?.step;
  const userInput = ctx.message?.text?.trim() || '';
  
  console.log(`[auth] 📝 handleRegistrationStep:`, {
    tgId,
    currentStep,
    inputLength: userInput.length,
    isOBStep: Object.values(OB_STEPS).includes(currentStep)
  });
  
  if (!currentStep || !Object.values(OB_STEPS).includes(currentStep)) {
    console.log(`[auth] ❌ handleRegistrationStep: не є кроком онбордингу`);
    return false; // Не є кроком онбордингу
  }
  
  console.log(`[auth] ✅ handleRegistrationStep: обробляємо крок ${currentStep}`);
  
  try {
    switch (currentStep) {
      case OB_STEPS.NAME:
        console.log(`[auth] 📝 Обробка кроку NAME`);
        return await handleNameStep(ctx, userInput);
      case OB_STEPS.EMAIL:
        console.log(`[auth] 📧 Обробка кроку EMAIL`);
        return await handleEmailStep(ctx, userInput);
      case OB_STEPS.PHONE:
        console.log(`[auth] 📱 Обробка кроку PHONE`);
        return await handlePhoneStep(ctx, userInput);
      case OB_STEPS.TIMEZONE:
        console.log(`[auth] 🌍 Обробка кроку TIMEZONE`);
        return await handleTimezoneStep(ctx, userInput);
      case OB_STEPS.PLAN:
        console.log(`[auth] 💰 Обробка кроку PLAN`);
        return await handleSubscriptionStep(ctx, userInput);
      default:
        console.log(`[auth] ❓ Невідомий крок: ${currentStep}`);
        return false;
    }
  } catch (error) {
    console.error(`[auth] ❌ Помилка в кроці ${currentStep}:`, {
      message: error.message,
      stack: error.stack?.substring(0, 300)
    });
    
    try {
      await ctx.reply('❌ Помилка. Спробуй ще раз або /start');
    } catch (replyError) {
      console.error('[auth] ❌ Помилка надсилання повідомлення про помилку:', replyError);
    }
    return true;
  }
};

// ===== КРОКИ РЕЄСТРАЦІЇ =====

/**
 * Крок: введення імені
 */
const handleNameStep = async (ctx, name) => {
  console.log(`[auth] 📝 handleNameStep: "${name}", валідність: ${isValidName(name)}`);
  
  if (!isValidName(name)) {
    await ctx.reply('⚠️ Введи правильне ім\'я (2-50 символів):', keyboards.skipKeyboard());
    return true;
  }
  
  ctx.session.temp.name = formatName(name);
  ctx.session.step = OB_STEPS.EMAIL;
  
  console.log(`[auth] ✅ handleNameStep: ім'я збережено, перехід до EMAIL`);
  await ctx.reply(`✅ Чудово, ${name}!\n\n📧 Введи email:`, keyboards.skipKeyboard());
  return true;
};

/**
 * Крок: введення email
 */
const handleEmailStep = async (ctx, email) => {
  console.log(`[auth] 📧 handleEmailStep: "${email}", валідність: ${isValidEmail(email)}`);
  
  if (!isValidEmail(email)) {
    await ctx.reply('⚠️ Невірний email. Введи коректний (example@gmail.com):', keyboards.skipKeyboard());
    return true;
  }
  
  ctx.session.temp.email = formatEmail(email);
  ctx.session.step = OB_STEPS.PHONE;
  
  console.log(`[auth] ✅ handleEmailStep: email збережено, перехід до PHONE`);
  await ctx.reply('✅ Email збережено!\n\n📱 Введи телефон (+380XXXXXXXXX):', keyboards.skipKeyboard());
  return true;
};

/**
 * Крок: введення телефону
 */
const handlePhoneStep = async (ctx, phone) => {
  const formattedPhone = formatPhone(phone);
  console.log(`[auth] 📱 handlePhoneStep: "${phone}" → "${formattedPhone}", валідність: ${isValidUaPhone(formattedPhone)}`);
  
  if (!isValidUaPhone(formattedPhone)) {
    await ctx.reply('⚠️ Неправильний телефон. Введи +380XXXXXXXXX:', keyboards.skipKeyboard());
    return true;
  }
  
  ctx.session.temp.phone = formattedPhone;
  // Пропускаємо крок з часовим поясом - встановлюємо за замовчуванням
  ctx.session.temp.timezone = 'Europe/Kyiv';
  ctx.session.step = OB_STEPS.PLAN;
  
  console.log(`[auth] ✅ handlePhoneStep: телефон збережено, перехід до PLAN`);
  await ctx.reply('✅ Телефон збережено!\n\n🎁 Останній крок - обери план:', keyboards.subscriptionPlansKeyboard());
  return true;
};

/**
 * Крок: часовий пояс (опційний)
 */
const handleTimezoneStep = async (ctx, tzInput) => {
  const chosen = parseTz(tzInput);
  const allowedIds = TIMEZONES.map(parseTz);
  
  console.log(`[auth] 🌍 handleTimezoneStep: "${tzInput}" → "${chosen}", дозволені: ${allowedIds.join(', ')}`);
  
  if (!chosen || !allowedIds.includes(chosen)) {
    await ctx.reply('⚠️ Обери часовий пояс з кнопок:', keyboards.timezoneKeyboard());
    return true;
  }
  
  ctx.session.temp.timezone = chosen;
  ctx.session.step = OB_STEPS.PLAN;
  
  console.log(`[auth] ✅ handleTimezoneStep: часовий пояс збережено, перехід до PLAN`);
  await ctx.reply('✅ Часовий пояс встановлено!\n\n🎯 Останній крок - план:', keyboards.subscriptionPlansKeyboard());
  return true;
};

/**
 * Крок: вибір плану підписки
 */
const handleSubscriptionStep = async (ctx, planInput) => {
  const tgId = ctx.from.id;
  const planKey = normalizePlanKey(planInput);
  
  console.log(`[auth] 💰 handleSubscriptionStep:`, {
    tgId,
    planInput,
    planKey,
    sessionTemp: ctx.session.temp
  });
  
  if (!planKey) {
    await ctx.reply('⚠️ Обери план з кнопок:', keyboards.subscriptionPlansKeyboard());
    return true;
  }
  
  try {
    console.log(`[auth] 🔄 Створюємо користувача з даними`);
    
    // Створюємо користувача з даними
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
    
    console.log(`[auth] 💾 Дані користувача для створення:`, userData);
    
    const savedUser = await safeUpsertUser(tgId, userData);
    if (!savedUser) {
      throw new Error('Не вдалося створити користувача');
    }
    
    console.log(`[auth] ✅ Користувач створений/оновлений успішно`);
    
    // Очищаємо сесію
    ctx.session.step = undefined;
    ctx.session.temp = {};
    
    // Обробляємо план
    if (planKey === 'trial' || planKey === 'free') {
      console.log(`[auth] 🧪 Обробляємо пробний план`);
      return await handleTrialPlan(ctx, tgId);
    } else {
      console.log(`[auth] 💳 Обробляємо платний план: ${planKey}`);
      return await handlePaidPlan(ctx, tgId, planKey);
    }
    
  } catch (error) {
    console.error(`[auth] ❌ Помилка збереження користувача:`, {
      message: error.message,
      stack: error.stack,
      tgId,
      planKey
    });
    
    await ctx.reply('❌ Помилка збереження. Спробуй ще раз /start');
    return true;
  }
};

/**
 * Нормалізація ключа плану
 */
const normalizePlanKey = (plan) => {
  console.log(`[auth] 🔧 normalizePlanKey: "${plan}"`);
  
  if (!plan) return null;
  const p = String(plan).trim().toLowerCase();
  
  let result = null;
  if (p === 'free' || p === 'безкоштовна' || p === 'trial' || p === 'пробний') result = 'trial';
  else if (p === 'week' || p === 'тиждень') result = 'WEEK';
  else if (p === 'month' || p === 'місяць') result = 'MONTH';
  else if (p === 'year' || p === 'рік') result = 'YEAR';
  else if (SUBSCRIPTION_PLANS[p?.toUpperCase()]) result = p.toUpperCase();
  
  console.log(`[auth] 🔧 normalizePlanKey результат: "${plan}" → "${result}"`);
  return result;
};

const handleTrialPlan = async (ctx, tgId) => {
  console.log(`[auth] 🧪 handleTrialPlan для ${tgId}`);
  try {
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
    
    return true;
  } catch (error) {
    console.error('[handleTrialPlan] ❌ Помилка:', error);
    await ctx.reply('❌ Не вдалося активувати пробну підписку.');
    return true;
  }
};

const handlePaidPlan = async (ctx, tgId, planKey) => {
  console.log(`[auth] 💳 handlePaidPlan для ${tgId}, план: ${planKey}`);
  
  const planInfo = SUBSCRIPTION_PLANS[planKey];
  if (!planInfo) {
    await ctx.reply('❌ Невірний план підписки.');
    return true;
  }

  const message = 
    `💳 ОПЛАТА ПІДПИСКИ\n\n` +
    `План: ${planInfo.name}\n` +
    `Вартість: ${planInfo.price}€\n` +
    `Період: ${planInfo.duration} днів\n\n` +
    `Після оплати підписка активується автоматично.`;

  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💳 Оплатити зараз', callback_data: `subscribe_${planKey.toLowerCase()}` }],
        [{ text: '🧪 Пробна версія', callback_data: 'plan_trial' }],
        [{ text: '⏭ Пізніше', callback_data: 'main_menu' }]
      ]
    }
  });
  
  return true;
};

// CALLBACK ОБРОБНИКИ
export const handleOnboardingCallback = async (ctx) => {
  const tgId = ctx.from.id;
  const data = ctx.callbackQuery.data;
  
  console.log(`[auth] 📱 handleOnboardingCallback: ${data} для ${tgId}`);
  
  try {
    switch (data) {
      case 'start_registration':
      case 'onboarding_start':
        ctx.session.step = OB_STEPS.NAME;
        ctx.session.temp = ctx.session.temp || {};
        await ctx.reply('📝 Як тебе звати? (введи ім\'я):', keyboards.skipKeyboard());
        await ctx.answerCbQuery('Початок реєстрації');
        return true;
        
      case 'about_bot':
      case 'onboarding_about':
        await showAboutBot(ctx);
        await ctx.answerCbQuery('Інформація про бота');
        return true;
        
      case 'skip_step':
        await handleSkipStep(ctx);
        await ctx.answerCbQuery('Крок пропущено');
        return true;
        
      case 'activate_trial':
        const activated = await paymentService.activateTrialSubscription(tgId, 7);
        if (activated) {
          await ctx.reply('🎁 Пробна підписка активована!');
        } else {
          await ctx.reply('❌ Не вдалося активувати пробну підписку.');
        }
        await ctx.answerCbQuery(activated ? 'Пробна підписка активована!' : 'Помилка активації');
        return true;
        
      default:
        if (data.startsWith('plan_')) {
          const planKey = data.replace('plan_', '');
          await handleSubscriptionStep(ctx, planKey);
          await ctx.answerCbQuery(`План: ${planKey}`);
          return true;
        }
        return false;
    }
  } catch (error) {
    console.error('[auth.callback] ❌ Помилка:', error);
    await ctx.answerCbQuery('Помилка');
    return true;
  }
};

// ДОПОМІЖНІ ФУНКЦІЇ
const handleSkipStep = async (ctx) => {
  console.log(`[auth] ⏭️ handleSkipStep для кроку: ${ctx.session.step}`);
  
  const currentStep = ctx.session.step;
  const tgId = ctx.from.id;
  const name = ctx.from.first_name || 'Користувач';

  switch (currentStep) {
    case OB_STEPS.NAME:
      ctx.session.temp.name = name;
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
      ctx.session.step = OB_STEPS.PLAN;
      await ctx.reply('🎁 Обери план:', keyboards.subscriptionPlansKeyboard());
      break;
      
    default:
      await ctx.reply('❌ Цей крок не можна пропустити');
  }
};

const showAboutBot = async (ctx) => {
  const message = 
    `🤖 AI МОТИВАТОР-КОУЧ\n\n` +
    `✨ Що я роблю:\n` +
    `• Ранкові питання для фокусу\n` +
    `• Вечірні питання для рефлексії\n` +
    `• AI-наставник для підтримки\n` +
    `• Колесо балансу для аналізу життя\n` +
    `• Персональні звіти та рекомендації\n\n` +
    `🎯 Результат: більше усвідомленості, мотивації та досягнень!`;
  
  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Почати реєстрацію', callback_data: 'start_registration' }],
        [{ text: '🏠 Головне меню', callback_data: 'main_menu' }]
      ]
    }
  });
};

const showSubscriptionRequired = async (ctx, user) => {
  const userName = user?.['User Name'] || ctx.from.first_name || 'Користувач';
  
  const message = 
    `👋 З поверненням, ${userName}!\n\n` +
    `💡 Для повного доступу потрібна активна підписка:\n\n` +
    `🎯 AI коучинг 24/7\n` +
    `📊 Колесо балансу\n` +
    `📈 Персональна аналітика\n\n` +
    `💰 Активуй підписку:`;

  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎁 Пробний період 7 днів', callback_data: 'activate_trial' }],
        [{ text: '💰 Переглянути плани', callback_data: 'subscription_plans' }],
        [{ text: '🔄 Оновити статус', callback_data: 'sync_subscription' }]
      ]
    }
  });
};

const showFirstWheel = async (ctx, user) => {
  const userName = user?.['User Name'] || ctx.from.first_name || 'Користувач';
  
  const message = 
    `🎯 ПЕРШЕ КОЛЕСО БАЛАНСУ\n\n` +
    `Привіт, ${userName}! 👋\n\n` +
    `Рекомендую почати з колеса балансу 🌀\n` +
    `Це допоможе AI-наставнику дати тобі максимально ` +
    `персоналізовані підказки та рекомендації.\n\n` +
    `📊 8 сфер життя (5–10 хв)\n` +
    `🎯 Отримаєш інсайти та план дій\n\n` +
    `Готова почати?`;

  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎯 Почати колесо балансу', callback_data: 'wheel_start' }],
        [{ text: '❓ Що це таке?', callback_data: 'wheel_info' }],
        [{ text: '⏭ Пізніше', callback_data: 'main_menu' }]
      ]
    }
  });
};

const showMainMenu = async (ctx, user) => {
  const userName = user?.['User Name'] || ctx.from.first_name || 'Користувач';
  const status = user?.['Active_Subscription_Status'] || '✅ Активна';
  
  const message = 
    `🏠 Головне меню\n\n` +
    `👋 ${userName}\n` +
    `${status}\n\n` +
    `Готова до продуктивного дня?`;

  await ctx.reply(message, keyboards.mainMenuKeyboard());
  
  // Оновлюємо активність в фоні
  userService.updateUser(ctx.from.id, { 
    Last_Activity: new Date().toISOString() 
  }).catch(error => console.warn('Помилка оновлення активності:', error));
};

const checkFirstWheel = async (tgId) => {
  console.log(`[auth] 🎯 checkFirstWheel для ${tgId}`);
  
  try {
    const { getBase, tables } = await import('../../config/database.js');
    const base = getBase();
    
    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Status}="Completed")`,
        maxRecords: 1
      })
      .firstPage();
    
    const hasWheel = records.length > 0;
    console.log(`[auth] 🎯 checkFirstWheel результат: ${hasWheel}`);
    return hasWheel;
  } catch (error) {
    console.error('[checkFirstWheel] ❌ Помилка:', error);
    return false;
  }
};

// ===== ЕКСПОРТ =====
export default {
  handleStart,
  handleRegistrationStep,
  handleOnboardingCallback,
  isProfileIncomplete
};

console.log('✅ [auth] Модуль авторизації ініціалізовано З ДЕТАЛЬНИМИ ЛОГАМИ');