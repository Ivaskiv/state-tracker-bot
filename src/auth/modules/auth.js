// src/auth/modules/auth.js - ВИПРАВЛЕНО З ПРАВИЛЬНОЮ ЛОГІКОЮ

import userService, { ensureNewUserStub, finalizeRegistration } from '../services/userService.js';
import keyboards from '../../utils/keyboards.js';
import { isValidEmail, isValidUaPhone } from '../../utils/validators.js';
import wheelBalanceController from '../../controllers/wheelBalanceController.js';
import wheelBalanceService from '../../services/wheelBalanceService.js';
import wayforpayService from '../../services/wayforpayService.js';

import {
  SUBSCRIPTION_PLANS,
  OB_STEPS,
  ANSWER_STEPS,
  TIMEZONES,
  parseTz,
} from '../../config/constants.js';

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

// ——— нормалізація ключа плану під SUBSCRIPTION_PLANS
function normalizePlanKey(plan) {
  if (!plan) return null;
  const p = String(plan).trim().toLowerCase();
  if (p === 'free' || p === 'безкоштовна' || p === 'free_plan') return 'free';
  if (p === 'trial' || p === 'пробний' || p === 'trial7' || p === 'trial_7') return 'TRIAL';
  if (p === 'week' || p === 'тиждень') return 'WEEK';
  if (p === 'month' || p === 'місяць') return 'MONTH';
  if (p === 'year' || p === 'рік' || p === 'yearly') return 'YEAR';
  // якщо прийшов уже валідний ключ
  if (SUBSCRIPTION_PLANS[p]) return p;
  if (SUBSCRIPTION_PLANS[p?.toUpperCase?.()] ) return p.toUpperCase();
  return null;
}

// ✅ fallback: обчислення потреби у колесі, якщо немає wheelBalanceService.shouldShowWheelReminder
async function fallbackWheelNeed(tgId, registrationDate) {
  try {
    const active = await wheelBalanceService.getActiveWheel?.(tgId);
    if (active) {
      return {
        needed: true,
        type: 'continue',
        message: 'У тебе є незавершене колесо балансу.',
      };
    }
    const needsMonthly = await wheelBalanceService.needsWheelBalance?.(tgId);
    if (needsMonthly) {
      return {
        needed: true,
        type: 'monthly',
        message: 'Минуло понад 30 днів від попереднього колеса. Рекомендовано оновити.',
      };
    }
    // перше колесо (через дату реєстрації без Completed записів)
    return {
      needed: true,
      type: 'first',
      message: 'Щоб AI краще тебе розумів — заповни перше колесо балансу.',
    };
  } catch (e) {
    console.warn('[fallbackWheelNeed] warn:', e?.message);
    return { needed: false, type: 'none', message: '' };
  }
}

// ✅ перевірка та показ нагадування про колесо
const checkAndShowWheelReminder = async (ctx, user) => {
  try {
    const tgId = ctx.from.id;
    const registrationDate = user?.['Registration Date'] || user?.Created_Date || new Date().toISOString();

    console.log(`🎯 [auth] Перевірка потреби в колесі для ${tgId}, реєстрація: ${registrationDate}`);

    let wheelCheck = { needed: false, type: 'none', message: '' };
    if (typeof wheelBalanceService.shouldShowWheelReminder === 'function') {
      wheelCheck = await wheelBalanceService.shouldShowWheelReminder(tgId, registrationDate);
    } else {
      wheelCheck = await fallbackWheelNeed(tgId, registrationDate);
    }

    if (!wheelCheck?.needed) {
      console.log(`🎯 [auth] Нагадування не потрібне для ${tgId}: ${wheelCheck?.message || 'без повідомлення'}`);
      return false;
    }

    console.log(`🎯 [auth] Потрібне колесо: ${wheelCheck.type}, повідомлення: ${wheelCheck.message}`);

    // Затримка перед показом нагадування
    await new Promise(r => setTimeout(r, 1500));

    let reminderMessage = '';
    let reminderKeyboard = null;

    if (wheelCheck.type === 'first') {
      reminderMessage =
        `🎯 ПЕРШЕ КОЛЕСО БАЛАНСУ\n\n` +
        `${wheelCheck.message}\n\n` +
        `Колесо балансу — інструмент, що допоможе:\n` +
        `• Оцінити 8 ключових сфер життя\n` +
        `• Зрозуміти сильні та слабкі сторони\n` +
        `• Отримати персональні AI-рекомендації\n\n` +
        `⏱ 5–10 хвилин • 📊 Буде короткий аналіз`;
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
        `Прогрес збережено — можна продовжити з місця зупинки.`;
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
        `Регулярне оновлення допомагає відслідковувати прогрес та баланс.`;
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
      return true;
    }

    return false;
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
          `🚀 Готова до продуктивного дня?\n\n` +
          `Обирай, що хочеш зробити:`;

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
    ctx.session.step = OB_STEPS.PITCH; // було GREETING — у constants його нема
    ctx.session.temp = { name };

    const greetingText =
      `👋 Привіт, ${name}!\n\n` +
      `Я твій AI-мотиватор та коуч! Допомагаю людям:\n\n` +
      `🎯 Ставити та досягати цілі\n` +
      `⚖️ Знаходити баланс у житті\n` +
      `💪 Підтримувати мотивацію\n` +
      `📈 Відслідковувати прогрес\n\n` +
      `Готова розпочати свій шлях до кращого життя?`;

    await ctx.reply(greetingText, keyboards.greetingKeyboard());
    console.log(`✅ [auth] Онбординг запущено для ${tgId}`);

  } catch (error) {
    console.error('[auth.handleStart] Критична помилка:', error);
    await ctx.reply(
      '❌ Виникла помилка при запуску. Спробуй ще раз через кілька секунд.',
      { reply_markup: { keyboard: [[{ text: '/start' }]], resize_keyboard: true } }
    );
  }
}

// ——— обробка кроків онбордингу
export async function handleRegistrationStep(ctx) {
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
      // було SUBSCRIPTION — у constants його нема, використовуємо PLAN
      case OB_STEPS.PLAN:
        return await handleSubscriptionStep(ctx, userInput);
      default:
        console.warn(`❓ [auth] Невідомий крок онбордингу: ${currentStep}`);
        return false;
    }
  } catch (error) {
    console.error(`❌ [auth] Помилка в кроці ${currentStep}:`, error);
    await ctx.reply('❌ Помилка при обробці. Спробуй ще раз або перезапусти /start');
    return false;
  }
}

// ——— крок: ім'я
async function handleNameStep(ctx, name) {
  const tgId = ctx.from.id;

  if (!name || name.length < 2) {
    await ctx.reply('⚠️ Введи правильне ім\'я (мінімум 2 символи):', keyboards.skipKeyboard());
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
    await ctx.reply('⚠️ Невірний формат email. Введи коректний email (наприклад: example@gmail.com):', keyboards.skipKeyboard());
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
async function handleTimezoneStep(ctx, tzLabelOrId) {
  const tgId = ctx.from.id;

  // Підтримка вибору як "Europe/Kyiv (UTC+...)" так і "Europe/Kyiv"
  const allowedIds = TIMEZONES.map(parseTz);
  const chosen = parseTz(tzLabelOrId);
  if (!chosen || !allowedIds.includes(chosen)) {
    await ctx.reply('⚠️ Будь ласка, обери часовий пояс з кнопок:', keyboards.timezoneKeyboard());
    return true;
  }

  ctx.session.temp.timezone = chosen;
  ctx.session.step = OB_STEPS.PLAN; // було SUBSCRIPTION — узгодили з constants

  const subscriptionText =
    `✅ Часовий пояс встановлено!\n\n` +
    `🎯 ОСТАННІЙ КРОК — ПЛАН\n\n` +
    `Оберіть тарифний план, або залишайтесь у безкоштовній версії:`;

  await ctx.reply(subscriptionText, keyboards.subscriptionPlansKeyboard());

  console.log(`✅ [auth] Таймзона збережена: ${chosen} для ${tgId}`);
  return true;
}

// ——— крок: підписка/план
async function handleSubscriptionStep(ctx, planInput) {
  const tgId = ctx.from.id;

  console.log(`💳 [auth] Обрано план: ${planInput} для ${tgId}`);

  try {
    const planKey = normalizePlanKey(planInput);
    if (!planKey) {
      await ctx.reply('⚠️ Обери план з кнопок нижче:', keyboards.subscriptionPlansKeyboard());
      return true;
    }

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
    };

    // Безкоштовна гілка
    if (planKey === 'free') {
      userData['Subscription Status'] = 'Free';
      userData['Active_Subscription_Status'] = '❌ Безкоштовна';
      console.log(`💾 [auth] Зберігаємо користувача (free) ${tgId}:`, userData);

      const savedUser = await safeUpsert(tgId, userData);
      if (!savedUser) throw new Error('Не вдалося зберегти користувача');

      try {
        await finalizeRegistration(tgId);
        console.log(`✅ [auth] Реєстрація завершена для ${tgId}`);
      } catch (finalizeError) {
        console.warn(`⚠️ [auth] finalizeRegistration warn:`, finalizeError?.message);
      }

      // Очищення сесії
      ctx.session.step = undefined;
      ctx.session.temp = {};

      const welcomeMessage =
        `🎉 Реєстрація завершена!\n\n` +
        `Вітаю в безкоштовній версії, ${userData['User Name']}!\n\n` +
        `🚀 Ти можеш:\n` +
        `• Використовувати базові функції AI\n` +
        `• Заповнити колесо балансу\n` +
        `• Отримувати щоденні питання\n\n` +
        `💡 Для повного доступу можеш оновити підписку будь-коли!`;

      await ctx.reply(welcomeMessage, keyboards.mainMenuKeyboard());

      // Нагадування про колесо
      setTimeout(() => checkAndShowWheelReminder(ctx, savedUser), 1500);
      console.log(`✅ [auth] Онбординг завершено (free) для ${tgId}`);
      return true;
    }

    // Платні плани
    const planDetails = SUBSCRIPTION_PLANS[planKey];
    if (!planDetails) {
      await ctx.reply('⚠️ Невідомий план. Обери з кнопок нижче:', keyboards.subscriptionPlansKeyboard());
      return true;
    }

    // зберігаємо стан «очікує оплати»
    userData['Subscription Status'] = 'Pending';
    userData['Active_Subscription_Status'] = '⏳ Очікує оплати';
    console.log(`💾 [auth] Зберігаємо користувача (paid pending) ${tgId}:`, userData);

    const savedUser = await safeUpsert(tgId, userData);
    if (!savedUser) throw new Error('Не вдалося зберегти користувача');

    try {
      await finalizeRegistration(tgId);
      console.log(`✅ [auth] Реєстрація завершена для ${tgId}`);
    } catch (finalizeError) {
      console.warn(`⚠️ [auth] finalizeRegistration warn:`, finalizeError?.message);
    }

    // Очищаємо сесію, але ведемо до оплати
    ctx.session.step = undefined;

    const paymentText =
      `💳 ОПЛАТА ПІДПИСКИ\n\n` +
      `План: ${planDetails.name}\n` +
      `Вартість: ${planDetails.price}€\n` +
      `Період: ${planDetails.duration} днів\n\n` +
      `Після оплати підписка активується автоматично.`;

    const paymentKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💳 Оплатити зараз', callback_data: `pay_${planKey}` }],
          [{ text: '⏭ Оплатити пізніше', callback_data: 'pay_later' }],
          [{ text: '🆓 Залишитись на безкоштовній', callback_data: 'switch_to_free' }]
        ]
      }
    };

    await ctx.reply(paymentText, paymentKeyboard);
    console.log(`✅ [auth] Онбординг завершено (pending pay) для ${tgId}, план: ${planKey}`);
    return true;

  } catch (error) {
    console.error(`❌ [auth] Помилка збереження користувача ${tgId}:`, error);
    await ctx.reply(
      '❌ Помилка при збереженні даних. Спробуй ще раз або звернись до підтримки.',
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
      const raw = data.replace('plan_', '');
      await handleSubscriptionStep(ctx, raw);
      await ctx.answerCbQuery(`Обрано план: ${raw}`);

    } else if (data.startsWith('tz_')) {
      const tz = data.replace('tz_', '');
      await handleTimezoneStep(ctx, tz);
      await ctx.answerCbQuery(`Часовий пояс: ${tz}`);

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
      const planKey = data.replace('pay_', '');
      await initializePayment(ctx, planKey);
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
async function initializePayment(ctx, planTypeRaw) {
  const tgId = ctx.from.id;

  try {
    console.log(`💳 [auth] Ініціалізація оплати для ${tgId}, план: ${planTypeRaw}`);

    const planKey = normalizePlanKey(planTypeRaw);
    const planDetails = planKey && SUBSCRIPTION_PLANS[planKey];
    if (!planDetails) {
      throw new Error(`Невідомий план: ${planTypeRaw}`);
    }

    // Генеруємо посилання на оплату через WayForPay
    const paymentUrl = await wayforpayService.createPaymentUrl({
      userId: tgId,
      planType: planKey,
      amount: planDetails.price,
      description: `Підписка ${planDetails.name}`
    });

    const paymentMessage =
      `💳 ОПЛАТА ПІДПИСКИ\n\n` +
      `План: ${planDetails.name}\n` +
      `Вартість: ${planDetails.price}€\n` +
      `Період: ${planDetails.duration} днів\n\n` +
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
    await ctx.reply('❌ Помилка створення оплати. Спробуй пізніше або звернись до підтримки.');
  }
}

// ——— експорт
export default {
  handleStart,
  handleRegistrationStep,
  handleOnboardingCallback,
  isProfileIncomplete,
  checkAndShowWheelReminder
};
