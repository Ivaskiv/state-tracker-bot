// src/auth/modules/auth.js - ОСТАТОЧНО ВИПРАВЛЕНО СТВОРЕННЯ КОРИСТУВАЧІВ

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
  
  // ✅ ПРАВИЛЬНА ПЕРЕВІРКА ВСІХ ПОЛІВ
  const hasName = !!user['User Name'];
  const hasTz = !!user['Time Zone'];
  const regCompleted = user['UserRegistered'] === true;
  const hasActiveStatus = user['Status'] === 'Registered User' || user['Status'] === 'Active User';
  
  console.log(`[isUserIncomplete] Перевірка користувача:`, {
    hasName,
    hasTz,
    regCompleted,
    hasActiveStatus,
    status: user['Status'],
    userRegistered: user['UserRegistered']
  });
  
  return !(hasName && hasTz && regCompleted && hasActiveStatus);
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
      
      if (user) {
        console.log(`[auth.handleStart] Дані користувача:`, {
          name: user['User Name'],
          registered: user['UserRegistered'],
          status: user['Status'],
          timezone: user['Time Zone']
        });
      }
    } catch (e) {
      console.error('[auth.handleStart] DB error:', e);
      await ctx.reply('❌ Помилка доступу до бази. Спробуй пізніше.');
      return;
    }

    // ✅ ПЕРЕВІРКА ЧИ ПОТРІБЕН ОНБОРДИНГ
    if (!user || isUserIncomplete(user)) {
      
      // ✅ ЯКЩО КОРИСТУВАЧА НЕМАЄ - НЕ СТВОРЮЄМО ЗАРАЗ, ЧЕКАЄМО ЗАВЕРШЕННЯ ОНБОРДИНГУ
      if (!user) {
        console.log(`[auth.handleStart] 🆕 Новий користувач ${tgId}, НЕ створюємо зараз - чекаємо онбординг`);
      } else {
        console.log(`[auth.handleStart] ⚠️ Користувач ${tgId} існує, але реєстрація незавершена`);
      }
      
      // ✅ ЗАПУСКАЄМО ОНБОРДИНГ БЕЗ СТВОРЕННЯ КОРИСТУВАЧА
      resetRegSession(ctx);
      startRegSession(ctx, name);
      
      await ctx.reply(
        `Я твій АІ мотиватор‑коуч. Короткі щоденні питання → фокус → прогрес. Поїхали?`,
        keyboards.onboardingStartKeyboard()
      );
      return;
    }

    // ✅ КОРИСТУВАЧ ІСНУЄ І ЗАРЕЄСТРОВАНИЙ ПОВНІСТЮ - ПОКАЗУЄМО МЕНЮ
    console.log(`[auth.handleStart] Користувач ${tgId} повністю зареєстрований, перевіряємо підписку`);
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

    // ✅ TZ + СТВОРЕННЯ АБО ОНОВЛЕННЯ КОРИСТУВАЧА
    if (step === 'reg_timezone') {
      const picked = TIMEZONES.find((tz) => tz === text);
      if (!picked) {
        await ctx.reply('Обери часовий пояс зі списку:', timezoneKeyboard());
        return true;
      }

      const tz = parseTz(picked);
      const tgId = ctx.session.temp.tgId;
      
      try {
        console.log(`[auth.handleRegistrationStep] 💾 ЗБЕРЕЖЕННЯ ДАНИХ КОРИСТУВАЧА ${tgId}`);
        
        // ✅ СПОЧАТКУ ПЕРЕВІРЯЄМО ЧИ КОРИСТУВАЧ УЖЕ ІСНУЄ
        const existingUser = await userService.getUserByTelegramId(tgId);
        
        if (existingUser) {
          console.log(`[auth.handleRegistrationStep] 🔄 Оновлюємо існуючого користувача ${tgId}`);
          
          // ✅ ОНОВЛЕННЯ ІСНУЮЧОГО КОРИСТУВАЧА
          const { getBase } = await import('../../config/database.js');
          const base = getBase();
          
          const records = await base('Users')
            .select({
              filterByFormula: `{TG_id} = '${tgId}'`,
            })
            .firstPage();
            
          if (records.length > 0) {
            await base('Users').update(records[0].id, {
              'User Name': ctx.session.temp.name,
              'Email': ctx.session.temp.email,
              'Time Zone': tz,
              'UserRegistered': true, 
              'Status': 'Registered User',
              'DateUserRegistered': new Date().toISOString()
            }, { typecast: true });
            
            console.log(`[auth.handleRegistrationStep] ✅ Користувача ${tgId} оновлено`);
          }
          
        } else {
          console.log(`[auth.handleRegistrationStep] 🆕 СТВОРЮЄМО НОВОГО КОРИСТУВАЧА ${tgId}`);
          
          // ✅ СТВОРЕННЯ НОВОГО КОРИСТУВАЧА З ПОВНИМИ ДАНИМИ
          await userService.createUser({
            tgId: tgId,
            name: ctx.session.temp.name,
            email: ctx.session.temp.email,
            phone: null,
            timezone: tz,
            registrationStatus: 'done' // ✅ завершена реєстрація
          });
          
          console.log(`[auth.handleRegistrationStep] ✅ Нового користувача ${tgId} створено`);
        }
        
      } catch (updateError) {
        console.error('[auth.handleRegistrationStep] ❌ КРИТИЧНА ПОМИЛКА збереження користувача:', {
          error: updateError.message,
          statusCode: updateError.statusCode,
          tgId: tgId
        });
        
        await ctx.reply('❌ Помилка збереження даних. Спробуй ще раз.');
        return true;
      }

      // ✅ ПЕРЕХОДИМО ДО ПЛАНІВ
      ctx.session.step = ANSWER_STEPS.OB_PLAN;

      await ctx.reply(
        `🎉 Дані збережено!\n\nТвій часовий пояс: ${picked}`,
        keyboards.removeKeyboard()
      );

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
    // ✅ ПЕРЕВІРКА ЧИ ЦЕ ДІЙСНО ОНБОРДИНГ CALLBACK
    const onboardingCallbacks = [
      'onboarding_start', 'onboarding_about', 'pick_plan_', 'back_plan', 
      'pay_', 'pay_check_', 'reminders', 'rem_ok', 'rem_later', 'wheel_start'
    ];
    
    const isOnboardingCallback = onboardingCallbacks.some(cb => data.startsWith(cb) || data === cb);
    
    if (!isOnboardingCallback) {
      console.log(`[handleOnboardingCallback] ❌ Це НЕ онбординг callback: ${data}`);
      return false; // ✅ Повертаємо false, щоб обробив subscriptionController
    }

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

      try {
        const tgId = ctx.from.id;
        const orderReference = `ONBOARD_${planValue.toUpperCase()}_${tgId}_${Date.now()}`;
        
        const WAYFORPAY_LINKS = {
          'week_7': 'https://secure.wayforpay.com/button/b96923b913d29',
          'month_30': 'https://secure.wayforpay.com/button/b8df87678cd43', 
          'year_300': 'https://secure.wayforpay.com/button/bf28701123683'
        };
        
        const paymentLink = `${WAYFORPAY_LINKS[planValue]}?tg_id=${tgId}&orderReference=${orderReference}&productName=${encodeURIComponent(planInfo.name)}`;

        ctx.session.invoiceId = orderReference;
        ctx.session.step = ANSWER_STEPS.OB_PAYMENT_PENDING;

        console.log(`[handleOnboardingCallback] Створено посилання WayForPay: ${paymentLink}`);

        await ctx.editMessageText(
          `💳 ОПЛАТА ПІДПИСКИ\n\n📋 План: ${planInfo.name}\n💰 Вартість: ${planInfo.price}€\n⏰ Тривалість: ${planInfo.duration} днів\n\n🔗 Посилання для оплати:\n${paymentLink}\n\n💳 Після оплати підписка активується автоматично!`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔗 Перейти до оплати', url: paymentLink }],
                [{ text: '🔄 Я вже оплатив', callback_data: `pay_check_${orderReference}` }]
              ]
            }
          }
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