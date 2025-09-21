// src/auth/modules/auth.js - ВИПРАВЛЕНО КЛАВІАТУРИ

import userService, { ensureNewUserStub, finalizeRegistration } from '../services/userService.js';
import keyboards from '../../utils/keyboards.js';
import { isValidEmail, isValidUaPhone } from '../../utils/validators.js';
import wheelBalanceController from '../../controllers/wheelBalanceController.js';
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

// ——— /start
export async function handleStart(ctx) {
  const tgId = ctx.from.id;
  const name = ctx.from.first_name || 'Користувач';
  if (!ctx.session) ctx.session = { step: undefined, temp: {} };

  try {
    let user = null;
    try {
      user = await userService.getUserByTelegramId(tgId);
      if (!user) user = await ensureUserExists(tgId);
    } catch (dbErr) {
      console.warn('[auth.handleStart] ⚠️ DB issue, continue onboarding:', dbErr?.message);
    }

    if (user && !isProfileIncomplete(user)) {
      const active = (user['Active_Subscription_Status'] || '').includes('✅ Активна') || (user['Subscription Status'] === 'Active');
      if (active) {
        await ctx.reply(`Привіт знову, ${name}! 👋`, keyboards.mainMenuKeyboard());
      } else {
        await ctx.reply(
          `❌ Твоя підписка неактивна.\n\n📞 Підтримка: nadyastarway@gmail.com`,
          keyboards.subscriptionKeyboard()
        );
      }
      return;
    }

    ctx.session.step = OB_STEPS.PITCH;
    ctx.session.temp = { tgId, username: ctx.from.username || null };

    await ctx.reply(
      '🌟 Я твій АІ мотиватор-коуч. Короткі щоденні питання → фокус → прогрес. Поїхали?',
      keyboards.onboardingStartKeyboard()
    );
  } catch (e) {
    const errId = `H1-${Date.now()}`;
    console.error(`[auth.handleStart] ❌ error ${errId}:`, e);
    await ctx.reply(`❌ Помилка. Спробуй ще раз.\n\n(код: ${errId})`);
  }
}

// ——— ТЕКСТОВІ КРОКИ
export async function handleRegistrationStep(ctx) {
  if (!ctx.session) ctx.session = { step: undefined, temp: {} };
  if (!ctx.session.step) return false;

  const step = ctx.session.step;
  const text = (ctx.message?.text || '').trim();
  const tgId = ctx.session.temp?.tgId || ctx.from.id;

  const isOurStep = Object.values(OB_STEPS).includes(step);
  if (!isOurStep) return false;

  try {
    // NAME
    if (step === OB_STEPS.NAME && text) {
      if (text.length < 2 || text.length > 30) {
        await ctx.reply('⚠️ Краще коротше/довше: 2–30 символів.');
        return true;
      }
      await ensureUserExists(tgId);
      await safeUpsert(tgId, { 'User Name': text.trim() });
      ctx.session.temp.name = text.trim();

      ctx.session.step = OB_STEPS.EMAIL;
await ctx.reply('📧 Введи e-mail для чеків і доступів.', keyboards.emailInputKeyboard());
      return true;
    }

    // EMAIL
    if (step === OB_STEPS.EMAIL && text) {
      if (!isValidEmail(text)) {
        await ctx.reply(
          '⚠️ Схоже на помилку в адресі. Введи e-mail ще раз або натисни "Пропустити".',
          keyboards.emailInputKeyboard()
        );
        return true;
      }
      await ensureUserExists(tgId);
      await safeUpsert(tgId, { Email: text.trim() });
      ctx.session.temp.email = text.trim();

      ctx.session.step = OB_STEPS.PHONE;
await ctx.reply('📱 Введи телефон у форматі +380…', keyboards.phoneInputKeyboard());      // ✅ ВИПРАВЛЕНО: замість двох повідомлень - одне з текстом
      return true;
    }

    // PHONE
    if (step === OB_STEPS.PHONE && text) {
      if (!isValidUaPhone(text)) {
        await ctx.reply(
          '⚠️ Формат не схожий на телефон. Спробуй ще раз або натисни "Пропустити".',
          keyboards.phoneInputKeyboard()
        );
        return true;
      }
      await ensureUserExists(tgId);
      await safeUpsert(tgId, { Phone: text.trim() });
      ctx.session.temp.phone = text.trim();

      ctx.session.step = OB_STEPS.TIMEZONE;
      await ctx.reply('🕒 Обери часовий пояс для нагадувань:', keyboards.timezoneKeyboard());
      return true;
    }

    return false;
  } catch (error) {
    console.error('[auth.handleRegistrationStep] ❌ error:', error);
    await ctx.reply('❌ Помилка реєстрації. Натисни /start, щоб почати заново.');
    ctx.session = { step: undefined, temp: {} };
    return true;
  }
}

// ——— CALLBACK КРОКИ
export async function handleOnboardingCallback(ctx) {
  const data = ctx.callbackQuery?.data;
  if (!data) return false;
  if (!ctx.session) ctx.session = { step: undefined, temp: {} };

  const tgId = ctx.session.temp?.tgId || ctx.from.id;

  try {
    // PITCH → NAME + СТВОРЕННЯ ЗАПИСУ "New User"
    if (data === 'onboarding_start' && ctx.session.step === OB_STEPS.PITCH) {
      let user = null;
      try {
        user = await ensureUserExists(tgId);
      } catch (e) {
        console.error('[onboarding_start] ensureUserExists fail:', e);
      }

      try {
        await safeUpsert(tgId, {
          'TG_id': String(tgId),
          Status: 'New User',
          UserRegistered: false,
          'Subscription Status': user?.['Subscription Status'] || 'New'
        });
      } catch (e) {
        console.error('[onboarding_start] upsert fail:', e);
      }

      ctx.session.step = OB_STEPS.NAME;
      await ctx.answerCbQuery();
      await ctx.reply('Як звертатись до тебе? Введи імʼя (2–30 символів).');
      return true;
    }

    if (data === 'onboarding_about' && ctx.session.step === OB_STEPS.PITCH) {
      const aboutText =
        `ℹ️ ПРО БОТА\n\n` +
        `🎯 Щоденна рефлексія:\n• Ранкові питання (08:00)\n• Вечірні питання (21:30)\n\n` +
        `📊 AI-аналіз:\n• Щотижневі звіти\n• Щомісячні рекомендації\n\n` +
        `🎯 Інструменти:\n• Колесо балансу\n• Персональний коуч\n• Афірмації\n\n` +
        `Готова почати?`;

      await ctx.reply(aboutText, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Почати реєстрацію', callback_data: 'onboarding_start' }],
            [{ text: '🔙 Назад', callback_data: 'back_to_pitch' }]
          ]
        }
      });
      await ctx.answerCbQuery();
      return true;
    }

    if (data === 'back_to_pitch') {
      ctx.session.step = OB_STEPS.PITCH;
      await ctx.answerCbQuery();
      await ctx.reply(
        '🌟 Я твій АІ мотиватор-коуч. Короткі щоденні питання → фокус → прогрес. Поїхали?',
        keyboards.onboardingStartKeyboard()
      );
      return true;
    }

    // ——— Back/Skip навігація
    if (data === 'back_email' && ctx.session.step === OB_STEPS.EMAIL) {
      ctx.session.step = OB_STEPS.NAME;
      await ctx.answerCbQuery('Назад');
      await ctx.reply('Як звертатись до тебе? Введи імʼя (2–30 символів).');
      return true;
    }

    if (data === 'back_phone' && ctx.session.step === OB_STEPS.PHONE) {
      ctx.session.step = OB_STEPS.EMAIL;
      await ctx.answerCbQuery('Назад');
      await ctx.reply('📧 Введи e-mail для чеків і доступів.', keyboards.emailInputKeyboard());
      await ctx.reply(' ', keyboards.backFromEmailKeyboard());
      return true;
    }

    if (data === 'back_timezone' && ctx.session.step === OB_STEPS.TIMEZONE) {
      ctx.session.step = OB_STEPS.PHONE;
      await ctx.answerCbQuery('Назад');
      await ctx.reply('📱 Введи телефон у форматі +380…', keyboards.phoneInputKeyboard());
      await ctx.reply(' ', keyboards.backFromPhoneKeyboard());
      return true;
    }

    // ——— Пропуск полів
    if (data === 'skip_email' && ctx.session.step === OB_STEPS.EMAIL) {
      ctx.session.step = OB_STEPS.PHONE;
      await ctx.answerCbQuery('Email пропущено');
      await ctx.reply('📱 Введи телефон у форматі +380…', keyboards.phoneInputKeyboard());
      await ctx.reply(' ', keyboards.backFromPhoneKeyboard());
      return true;
    }

    if (data === 'skip_phone' && ctx.session.step === OB_STEPS.PHONE) {
      ctx.session.step = OB_STEPS.TIMEZONE;
      await ctx.answerCbQuery('Телефон пропущено');
      await ctx.reply('🕒 Обери часовий пояс для нагадувань:', keyboards.timezoneKeyboard());
      return true;
    }

    // ——— Глобальна зміна TZ
    if (data === 'change_tz') {
      ctx.session.step = OB_STEPS.TIMEZONE;
      await ctx.answerCbQuery('Змінюємо TZ');
      await ctx.reply('🕒 Обери новий часовий пояс:', keyboards.timezoneKeyboard());
      return true;
    }

    // ——— ВИБІР TZ → finalizeRegistration → апсерт → Registered User → підтвердження
    if (data.startsWith('tz_') && ctx.session.step === OB_STEPS.TIMEZONE) {
      const tz = data.replace('tz_', '');
      ctx.session.temp.timezone = tz;

      try {
        const res = await finalizeRegistration(tgId, {
          name: ctx.session.temp.name || ctx.from.first_name || 'Користувач',
          email: ctx.session.temp.email,
          phone: ctx.session.temp.phone,
          timezone: tz
        });

        const fresh = await userService.getUserByTelegramId(tgId);
        const atId = res?.id || fresh?.id || fresh?.AT_id;

        await safeUpsert(tgId, {
          'AT_id': atId,
          'TG_id': String(tgId),
          'User Name': ctx.session.temp.name || fresh?.['User Name'],
          'Email': ctx.session.temp.email || fresh?.Email,
          'Time Zone': tz,
          'Phone': ctx.session.temp?.phone || fresh?.Phone,
          Status: 'Registered User',         // ✅ Single select
          UserRegistered: true,
          Answer_Step: ANSWER_STEPS.COMPLETED
        });
      } catch (e) {
        const errId = `FR-${Date.now()}`;
        console.error(`[finalizeRegistration] ❌ ${errId}:`, e);
      }

      ctx.session.step = OB_STEPS.PLAN;
      await ctx.answerCbQuery(`Часовий пояс: ${tz}`);
      await ctx.reply(`⏰ Часовий пояс: ${tz}`);
      await ctx.reply('Часовий пояс збережено. Можеш змінити або йти далі:', keyboards.timezoneConfirmedKeyboard());
      return true;
    }

    // ——— «Далі» після підтвердження TZ
    if (data === 'go_plan' && (ctx.session.step === OB_STEPS.TIMEZONE || ctx.session.step === OB_STEPS.PLAN)) {
      ctx.session.step = OB_STEPS.PLAN;
      await ctx.answerCbQuery();
      await ctx.reply('💰 Обери план, що підходить зараз.', keyboards.onboardingPlanKeyboard());
      return true;
    }

    // PLAN → CONFIRM
    if (data.startsWith('pick_plan_') && ctx.session.step === OB_STEPS.PLAN) {
      const planValue = data.replace('pick_plan_', '');
      let planInfo;

      switch (planValue) {
        case 'trial_7d':
          planInfo = { name: '🧪 Пробний 7 днів — 0€', price: 0, duration: 7, key: 'TRIAL_7D' };
          break;
        case 'week_7':   planInfo = { ...SUBSCRIPTION_PLANS.WEEK,  key: 'WEEK'  }; break;
        case 'month_30': planInfo = { ...SUBSCRIPTION_PLANS.MONTH, key: 'MONTH' }; break;
        case 'year_300': planInfo = { ...SUBSCRIPTION_PLANS.YEAR,  key: 'YEAR'  }; break;
        default:
          await ctx.answerCbQuery('Невірний план');
          return true;
      }

      ctx.session.temp.selectedPlan = planInfo;

      const detailsText =
        `📋 ОБРАНИЙ ПЛАН: ${planInfo.name}\n\n` +
        `✨ У плані:\n• Ранкові питання (08:00)\n• Вечірні питання (21:30)\n• Тижневий AI-звіт\n• Колесо балансу (перше)\n• PDF-звіти\n\n` +
        `💰 Вартість: ${planInfo.price}€\n⏰ Тривалість: ${planInfo.duration} днів`;

      await ctx.reply(detailsText, keyboards.onboardingPlanConfirmKeyboard(planValue));
      await ctx.answerCbQuery(`Обрано: ${planInfo.name}`);
      return true;
    }

    if (data === 'back_plan' && ctx.session.step === OB_STEPS.PLAN) {
      await ctx.answerCbQuery('Змінюємо план');
      await ctx.reply('💰 Обери план, що підходить зараз.', keyboards.onboardingPlanKeyboard());
      return true;
    }

    // PAY / ACTIVATE
    if (data.startsWith('pay_') && ctx.session.step === OB_STEPS.PLAN) {
      const planValue = data.replace('pay_', '');
      const planInfo = ctx.session.temp.selectedPlan;

      if (!planInfo) {
        await ctx.answerCbQuery('Помилка: план не обраний');
        return true;
      }

      // Trial 7 днів — миттєво, повний доступ
      if (planValue === 'trial_7d') {
        await activateTrial(ctx, tgId, 7);
        return true;
      }

      // Платні — WayForPay
      try {
        ctx.session.step = OB_STEPS.PAYMENT_PENDING;
        ctx.session.temp.paymentPlan = planInfo;

        const user = await userService.getUserByTelegramId(tgId);
        const email = user?.Email || ctx.session.temp.email;
        const paymentUrl = wayforpayService.generatePaymentUrl(tgId, planInfo.key, email);
        const orderReference = `AIMENTOR_${planInfo.key}_${tgId}_${Date.now()}`;
        ctx.session.temp.orderReference = orderReference;

        const paymentText =
          `💳 ОПЛАТА\n\n📋 План: ${planInfo.name}\n💰 Сума: ${planInfo.price}€\n\n` +
          `🔗 Посилання для оплати:\n${paymentUrl}\n\n` +
          `⏰ Тримай рахунок. Оплата через WayForPay. Я зачекаю вебхук 😉`;

        await ctx.reply(paymentText, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔗 Перейти до оплати', url: paymentUrl }],
              [{ text: '🔁 Перевірити оплату', callback_data: `pay_check_${orderReference}` }],
              [{ text: '🔙 Змінити план', callback_data: 'back_plan' }]
            ]
          }
        });

        await ctx.answerCbQuery('Посилання для оплати створено');
        return true;

      } catch (paymentError) {
        console.error('[onboarding] Помилка створення платежу:', paymentError);
        await ctx.reply('❌ Помилка створення платежу. Спробуй пізніше або звернись у підтримку.');
        await ctx.answerCbQuery('Помилка платежу');
        return true;
      }
    }

    // CHECK PAYMENT (плейсхолдер)
    if (data.startsWith('pay_check_') && ctx.session.step === OB_STEPS.PAYMENT_PENDING) {
      await ctx.answerCbQuery('Перевіряємо оплату...');
      return true;
    }

    // Нагадування: без ОК і «змінити пізніше» → одразу показуємо час і запускаємо колесо
    if (data === 'reminders' && (ctx.session.step === OB_STEPS.PAYMENT_SUCCESS || ctx.session.trialJustActivated)) {
      ctx.session.step = OB_STEPS.DONE;

      // Повідомлення про фіксований графік
      const user = await userService.getUserByTelegramId(tgId);
      const tz = user?.['Time Zone'] || ctx.session.temp?.timezone || 'Europe/Kyiv';
      await ctx.reply(`Фіксований графік: ранок 08:00, вечір 21:30 (за твоєю TZ: ${tz}).`);

      // Старт колеса (без «— займе ~3 хвилини.»)
      await ctx.reply('Готово. Запускаю перше Колесо балансу.', keyboards.onboardingWheelStartKeyboard());
      // одразу ж запускаємо його програмно
      ctx.session.trialJustActivated = true;
      await wheelBalanceController.handleWheelBalanceRequest(ctx);

      await ctx.answerCbQuery();
      return true;
    }

    // WHEEL ручний старт (кнопка)
    if (data === 'wheel_start' && (ctx.session.step === OB_STEPS.DONE || ctx.session.trialJustActivated)) {
      ctx.session.step = undefined;
      ctx.session.temp = {};
      await ctx.answerCbQuery('Запускаємо колесо балансу!');
      await wheelBalanceController.handleWheelBalanceRequest(ctx);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[auth.handleOnboardingCallback] Помилка:', error);
    try { await ctx.answerCbQuery('Помилка обробки'); } catch {}
    return false;
  }
}

// ——— helper: активація trial і запис полів (повний доступ) + правильні назви полів/значень
async function activateTrial(ctx, tgId, days) {
  ctx.session.step = OB_STEPS.PAYMENT_SUCCESS;
  ctx.session.trialJustActivated = true; // дає доступ одразу в поточній сесії

  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + days);

  // підтягнемо поточного юзера (може вже є частина полів)
  const user = await userService.getUserByTelegramId(tgId);

  // TZ гарантуємо
  const tz = ctx.session.temp?.timezone || user?.['Time Zone'] || 'Europe/Kyiv';
  const atId = user?.id || user?.AT_id; // Airtable record id (якщо вже є)

  // формуємо підписку
  const planName = '🧪 Пробний 7 днів — 0€';
  const activeLine = `✅ Активна (TRIAL ${days} дн.) до ${endDate.toLocaleDateString('uk-UA')}`;

  // ⬇️ ВАЖЛИВО: саме ЦЕЙ апдейт записує 'Active Subscription Plan', Start_Date, End_Date тощо
  await ensureUserExists(tgId); // на випадок, якщо запис ще не створений
  await safeUpsert(tgId, {
    // ідентифікатори/профіль
    'AT_id': atId,                      // якщо порожньо — не страшно: upsertUser потім оновить
    'TG_id': String(tgId),
    'User Name': user?.['User Name'] || ctx.session.temp?.name || ctx.from.first_name || 'Користувач',
    'Email': user?.Email || ctx.session.temp?.email || null,
    'Phone': ctx.session.temp?.phone || user?.Phone || null,
    'Time Zone': tz,

    // статус реєстрації
    Status: 'Registered User',
    UserRegistered: true,

    // ПІДПИСКА (trial = повний доступ)
    'Active Subscription Plan': planName,
    'Active_Subscription_Status': activeLine,
    'Subscription Status': 'Active',
    'Start_Date': now.toISOString(),
    'End_Date': endDate.toISOString(),

    // одразу переведемо користувача в колесо
    Answer_Step: 'WheelBalance'
  });

  // повідомлення після активації
  await ctx.reply(
    `📋 ОБРАНИЙ ПЛАН: ${planName}\n\n` +
    `✨ У плані:\n` +
    `• Ранкові питання (08:00)\n` +
    `• Вечірні питання (21:30)\n` +
    `• Тижневий AI-звіт\n` +
    `• Колесо балансу (перше)\n` +
    `• PDF-звіти\n\n` +
    `💰 Вартість: 0€\n` +
    `⏰ Тривалість: ${days} днів`
  );

  await ctx.reply(
    `✅ Пробний період активовано!\n` +
    `Діє до: ${endDate.toLocaleDateString('uk-UA')}\n\n` +
    `🎯 Тепер доступні всі функції бота.`,
  );

  // без "Ок", без "Змінити пізніше" — фіксований графік
  await ctx.reply(`Фіксований графік: ранок 08:00, вечір 21:30 (за твоєю TZ).`);

  // одразу запропонуємо старт колеса (без тексту "— займе ~3 хвилини")
await ctx.reply('Готово. Запускаю перше Колесо балансу.', keyboards.onboardingWheelStartKeyboard());
setTimeout(async () => {
  try {
    // Імпорт тут щоб уникнути циклічних залежностей
    const wheelBalanceController = await import('../../controllers/wheelBalanceController.js');
    await wheelBalanceController.default.handleWheelBalanceRequest(ctx);
    console.log(`[auth] ✅ Колесо автоматично запущено для ${tgId}`);
  } catch (wheelError) {
    console.error('[auth] ❌ Помилка автозапуску колеса:', wheelError);
    // Fallback - показуємо кнопку
    await ctx.reply('🎯 Натисни кнопку нижче щоб почати колесо балансу:', keyboards.onboardingWheelStartKeyboard());
  }
}, 1000); // запуск через 1 секунду
}