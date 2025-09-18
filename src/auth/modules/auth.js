// src/auth/modules/auth.js - ПОВНА СИСТЕМА ОНБОРДИНГУ
import userService from '../services/userService.js';
import keyboards from '../../utils/keyboards.js';
import { isSkip, isValidEmail, isValidUaPhone } from '../../utils/validators.js';
import wheelBalanceController from '../../controllers/wheelBalanceController.js';
import wayforpayService from '../../services/wayforpayService.js';
import { SUBSCRIPTION_PLANS, ANSWER_STEPS } from '../../config/constants.js';

const TIMEZONES = [
  'Europe/Prague (UTC+1)',
  'Europe/Kyiv (UTC+2)',
  'Europe/Berlin (UTC+1)',
  'Europe/Paris (UTC+1)',
  'Europe/London (UTC+0)',
  'America/New_York (UTC-5)',
  'Asia/Dubai (UTC+4)'
];

const timezoneKeyboard = () => ({
  reply_markup: {
    keyboard: TIMEZONES.map(tz => [tz]),
    resize_keyboard: true,
    one_time_keyboard: true
  }
});

// ——— helpers
const isUserIncomplete = (user) => {
  if (!user) return true;
  const hasName = !!user['User Name'];
  const hasTz = !!(user['Timezone'] || user['TZ']);
  const regDone = user['Registration_Status'] === 'done';
  return !(hasName && hasTz && regDone);
};

const parseTz = (label) => (label || '').split(' ')[0];

function startRegSession(ctx, name) {
  if (!ctx.session) ctx.session = {};
  ctx.session.step = ANSWER_STEPS.OB_PITCH;
  ctx.session.temp = {
    name: name || ctx.from.first_name || 'Користувач',
    tgId: ctx.from.id,
    username: ctx.from.username || null
  };
}

function resetRegSession(ctx) {
  if (!ctx.session) return;
  ctx.session.step = undefined;
  ctx.session.temp = {};
}

// ——— /start
export async function handleStart(ctx) {
  const tgId = ctx.from.id;
  const name = ctx.from.first_name || 'Користувач';

  try {
    console.log(`[auth.handleStart] /start від користувача ${tgId}`);
    
    let user = null;
    try {
      user = await userService.getUserByTelegramId(tgId);
      console.log(`[auth.handleStart] Користувач ${tgId} знайдений:`, user ? 'ТАК' : 'НІ');
    } catch (e) {
      console.error('[auth.handleStart] DB error:', e);
      await ctx.reply('❌ Помилка доступу до бази. Спробуй пізніше.');
      return;
    }

    // ✅ ЯКЩО КОРИСТУВАЧА НЕМАЄ - ОДРАЗУ СТВОРЮЄМО БАЗОВИЙ РЯДОК
    if (!user) {
      console.log(`[auth.handleStart] Створюємо базовий рядок для нового користувача ${tgId}`);
      
      try {
        const userData = {
          tgId: tgId,
          name: name,
          email: null,
          phone: null,
          timezone: null,
          registrationStatus: 'in_progress' // ще не завершена
        };

        user = await userService.createUser(userData);
        console.log(`[auth.handleStart] ✅ Базовий рядок створено для ${tgId}`);
      } catch (createError) {
        console.error('[auth.handleStart] ❌ Помилка створення користувача:', createError);
        await ctx.reply('❌ Помилка створення акаунта. Спробуй пізніше.');
        return;
      }
    }
    
    // ✅ ЯКЩО КОРИСТУВАЧ Є АБО ЩОЙНО СТВОРЕНИЙ, АЛЕ РЕЄСТРАЦІЯ НЕЗАВЕРШЕНА
    if (!user || isUserIncomplete(user)) {
      if (!user) {
        console.log(`[auth.handleStart] Новий користувач ${tgId}, запускаємо онбординг`);
      } else {
        console.log(`[auth.handleStart] Користувач ${tgId} існує, але реєстрація незавершена - перезапускаємо онбординг`);
      }
      
      // ✅ СКИДАЄМО СЕСІЮ ТА ПОЧИНАЄМО З ПОЧАТКУ
      resetRegSession(ctx);
      startRegSession(ctx, name);
      
      // ob_pitch - показуємо кнопки без будь-яких перевірок
      await ctx.reply(
        `Я твій АІ мотиватор‑коуч. Короткі щоденні питання → фокус → прогрес. Поїхали?`,
        keyboards.onboardingStartKeyboard()
      );
      return;
    }

    // ✅ КОРИСТУВАЧ ІСНУЄ І ЗАРЕЄСТРОВАНИЙ - ПОКАЗУЄМО МЕНЮ
    console.log(`[auth.handleStart] Користувач ${tgId} зареєстрований, перевіряємо підписку`);
    const active = user['Active_Subscription_Status']?.includes('✅ Активна');
    if (active) {
      await ctx.reply(
        `Привіт знову, ${name}! 👋\n\n✅ Підписка активна. Поїхали далі?`,
        keyboards.mainMenuKeyboard()
      );
    } else {
      await ctx.reply(
        `Привіт знову, ${name}! 👋\n\n❌ Підписка неактивна. Активуй підписку для доступу до всіх функцій.`,
        keyboards.subscriptionKeyboard()
      );
    }
  } catch (error) {
    console.error('[auth.handleStart] fatal:', error);
    await ctx.reply('❌ Помилка. Спробуй /start ще раз або напиши: nadyastarway@gmail.com');
  }
}

// ——— кроки онбордингу
export async function handleRegistrationStep(ctx) {
  if (!ctx.session) return false;

  const step = ctx.session.step;
  const text = (ctx.message?.text || '').trim();

  if (!step || !step.startsWith('ob_')) return false;

  try {
    // ім'я
    if (step === ANSWER_STEPS.OB_NAME) {
      if (!text || text.length < 2 || text.length > 30) {
        await ctx.reply('Краще коротше/довше: 2–30 символів.');
        return true;
      }
      ctx.session.temp.name = text.trim();
      ctx.session.step = ANSWER_STEPS.OB_EMAIL;
      await ctx.reply('Введи e‑mail для чеків і доступів.');
      return true;
    }

    // email
    if (step === ANSWER_STEPS.OB_EMAIL) {
      if (!isSkip(text) && text && !isValidEmail(text)) {
        await ctx.reply('Схоже на помилку у адресі. Введи e‑mail ще раз.');
        return true;
      }
      ctx.session.temp.email = isSkip(text) ? null : text;
      ctx.session.step = 'reg_timezone';
      await ctx.reply('Обери часовий пояс для нагадувань:', timezoneKeyboard());
      return true;
    }

    // TZ + створення юзера + переходимо до планів
    if (step === 'reg_timezone') {
      const picked = TIMEZONES.find((tz) => tz === text);
      if (!picked) {
        await ctx.reply('Обери часовий пояс зі списку:', timezoneKeyboard());
        return true;
      }

      const tz = parseTz(picked);
      
      // ✅ ЗБЕРІГАЄМО ТАЙМ-ЗОНУ В СЕСІЇ, але ще НЕ створюємо користувача
      ctx.session.temp.timezone = tz;

      // чистимо сесію і переходимо до планів
      ctx.session.step = ANSWER_STEPS.OB_PLAN;

      // показуємо повідомлення про завершення збору даних
      await ctx.reply(
        `🎉 Дані зібрано!\n\nТвій часовий пояс: ${picked}`,
        keyboards.removeKeyboard()
      );

      // переходимо до вибору плану
      await ctx.reply(
        'Обери план, що підходить зараз.',
        keyboards.onboardingPlanKeyboard()
      );
      
      return true;
    }
  } catch (error) {
    console.error('[auth.handleRegistrationStep] error:', error);
    resetRegSession(ctx);
    await ctx.reply('❌ Помилка реєстрації. Натисни /start, щоб почати заново.');
  }

  return false;
}

// ——— обробка callback-ів онбордингу
export async function handleOnboardingCallback(ctx) {
  const data = ctx.callbackQuery?.data;
  if (!data || !ctx.session) return false;

  console.log(`[handleOnboardingCallback] Отримано callback: ${data}, session step: ${ctx.session?.step}`);

  try {
    // Початок онбордингу
    if (data === 'onboarding_start') {
      console.log(`[handleOnboardingCallback] Обробляємо onboarding_start`);
      ctx.session.step = ANSWER_STEPS.OB_NAME;
      await ctx.editMessageText('Як звертатись до тебе? Введи ім\'я (2–30 символів).');
      await ctx.answerCbQuery();
      return true;
    }

    // Про бота
    if (data === 'onboarding_about') {
      console.log(`[handleOnboardingCallback] Обробляємо onboarding_about`);
      await ctx.editMessageText(
        'ℹ️ ПРО БОТА\n\naiMentor - твій персональний коуч для щоденної трансформації.\n\n🌅 Ранкові питання для фокусу\n🌙 Вечірні питання для аналізу\n📊 AI-звіти та інсайти\n🎯 Колесо балансу\n💎 Щоденні афірмації',
        keyboards.onboardingStartKeyboard()
      );
      await ctx.answerCbQuery();
      return true;
    }

    // Вибір плану
    if (data.startsWith('pick_plan_')) {
      console.log(`[handleOnboardingCallback] Обробляємо pick_plan`);
      const planValue = data.replace('pick_plan_', '');
      ctx.session.selectedPlan = planValue;
      
      const planInfo = getPlanInfo(planValue);
      if (planInfo) {
        await ctx.editMessageText(
          `У плані: ранок/вечір, щотижня, колесо щомісяця, PDF‑звіти.\n\n📋 План: ${planInfo.name}\n💰 Вартість: ${planInfo.price}€\n⏰ Тривалість: ${planInfo.duration} днів`,
          keyboards.onboardingPlanConfirmKeyboard(planValue)
        );
      }
      await ctx.answerCbQuery();
      return true;
    }

    // Повернутись до вибору плану
    if (data === 'back_plan') {
      console.log(`[handleOnboardingCallback] Обробляємо back_plan`);
      ctx.session.step = ANSWER_STEPS.OB_PLAN;
      await ctx.editMessageText(
        'Обери план, що підходить зараз.',
        keyboards.onboardingPlanKeyboard()
      );
      await ctx.answerCbQuery();
      return true;
    }

    // Оплата
    if (data.startsWith('pay_')) {
      console.log(`[handleOnboardingCallback] Обробляємо pay`);
      const planValue = data.replace('pay_', '');
      const planInfo = getPlanInfo(planValue);
      
      if (!planInfo) {
        await ctx.answerCbQuery('Невірний план');
        return true;
      }

      // ✅ ГЕНЕРУЄМО ПРАВИЛЬНЕ ПОСИЛАННЯ WayForPay
      try {
        // Конвертуємо планValue в правильний ключ для WayForPay
        const planKeyForWayForPay = planValue.toUpperCase(); // week_7 -> WEEK_7
        console.log(`[handleOnboardingCallback] Створюємо платіж для плану: ${planKeyForWayForPay}`);
        
        const paymentUrl = wayforpayService.generatePaymentUrl(
          ctx.from.id,
          planKeyForWayForPay,
          ctx.session.temp?.email
        );

        const invoiceId = `INV_${ctx.from.id}_${Date.now()}`;
        ctx.session.invoiceId = invoiceId;
        ctx.session.step = ANSWER_STEPS.OB_PAYMENT_PENDING;

        console.log(`[handleOnboardingCallback] Створено посилання WayForPay: ${paymentUrl}`);

        await ctx.editMessageText(
          `Тримай рахунок. Оплата через WayForPay. Я зачекаю вебхук 😉\n\n💳 Посилання для оплати:\n${paymentUrl}`,
          keyboards.onboardingPaymentPendingKeyboard(invoiceId)
        );
        await ctx.answerCbQuery();
        return true;
        
      } catch (paymentError) {
        console.error('[handleOnboardingCallback] Помилка створення платежу:', paymentError);
        await ctx.editMessageText('❌ Помилка створення платежу. Спробуй ще раз або зв\'яжись з підтримкою.');
        await ctx.answerCbQuery('Помилка платежу');
        return true;
      }
    }

    // Перевірка оплати
    if (data.startsWith('pay_check_')) {
      console.log(`[handleOnboardingCallback] Обробляємо pay_check`);
      const invoiceId = data.replace('pay_check_', '');
      
      // TODO: Реальна перевірка через WayForPay API
      // Поки що симулюємо успішну оплату
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      
      ctx.session.step = ANSWER_STEPS.OB_PAYMENT_SUCCESS;
      await ctx.editMessageText(
        `✅ Платіж успішний! Підписка активна до ${endDate.toLocaleDateString('uk-UA')}.`,
        keyboards.onboardingPaymentSuccessKeyboard()
      );
      await ctx.answerCbQuery();
      return true;
    }

    // Налаштування нагадувань
    if (data === 'reminders') {
      console.log(`[handleOnboardingCallback] Обробляємо reminders`);
      ctx.session.step = ANSWER_STEPS.OB_REMINDERS_INTRO;
      await ctx.editMessageText(
        'Ставлю фіксований графік: ранок 08:00, вечір 21:30 (за твоєю TZ). Ок?',
        keyboards.onboardingRemindersKeyboard()
      );
      await ctx.answerCbQuery();
      return true;
    }

    // Підтвердження нагадувань
    if (data === 'rem_ok' || data === 'rem_later') {
      console.log(`[handleOnboardingCallback] Обробляємо reminders confirm`);
      ctx.session.step = ANSWER_STEPS.OB_DONE;
      await ctx.editMessageText(
        'Готово. Запускаю перше Колесо балансу — займе ~3 хвилини.',
        keyboards.onboardingWheelStartKeyboard()
      );
      await ctx.answerCbQuery();
      return true;
    }

    // Запуск колеса
    if (data === 'wheel_start') {
      console.log(`[handleOnboardingCallback] Обробляємо wheel_start`);
      resetRegSession(ctx);
      await ctx.answerCbQuery();
      await wheelBalanceController.handleWheelBalanceRequest(ctx);
      return true;
    }

    console.log(`[handleOnboardingCallback] Невідомий callback: ${data}`);
    return false;

  } catch (error) {
    console.error('[auth.handleOnboardingCallback] error:', error);
    await ctx.answerCbQuery('Помилка');
    return false;
  }
}

// ——— допоміжні функції
function getPlanInfo(planValue) {
  const planMap = {
    'week_7': SUBSCRIPTION_PLANS.WEEK,
    'month_30': SUBSCRIPTION_PLANS.MONTH, 
    'year_300': SUBSCRIPTION_PLANS.YEAR
  };
  return planMap[planValue] || null;
}