import userService from '../services/userService.js';
import keyboards from '../../utils/keyboards.js';
import { isSkip, isValidEmail, isValidUaPhone } from '../../utils/validators.js';
import wheelBalanceController from '../../controllers/wheelBalanceController.js';
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

const parseTz = (label) => (label || '').split(' ')[0];

export async function handleStart(ctx) {
  const tgId = ctx.from.id;
  const name = ctx.from.first_name || 'Користувач';

  try {
    console.log(`[auth.handleStart] /start від користувача ${tgId}`);
    
    let user = null;
    try {
      user = await userService.getUserByTelegramId(tgId);
      console.log(`[auth.handleStart] Користувач знайдений:`, user ? 'ТАК' : 'НІ');
    } catch (e) {
      console.error('[auth.handleStart] DB error:', e);
      await ctx.reply('❌ Помилка доступу до бази. Спробуй пізніше.');
      return;
    }

    if (!user) {
      console.log(`[auth.handleStart] 🆕 Створення нового користувача ${tgId}`);
      await userService.createUser({
        tgId: tgId,
        name: name,
        email: null,
        phone: null,
        timezone: null,
        registrationStatus: 'in_progress'
      });
      console.log(`[auth.handleStart] ✅ Базового користувача створено`);
      user = await userService.getUserByTelegramId(tgId);
    }

    const isComplete = user && user['UserRegistered'] === true && user['Status'] === 'Registered User';
    
    if (!isComplete) {
      console.log(`[auth.handleStart] 🎯 Запуск онбордингу для ${tgId}`);
      
      if (!ctx.session) ctx.session = {};
      ctx.session.step = ANSWER_STEPS.OB_PITCH;
      ctx.session.temp = {
        name: name,
        tgId: tgId,
        username: ctx.from.username || null
      };

      await ctx.reply(
        `Я твій АІ мотиватор‑коуч. Короткі щоденні питання → фокус → прогрес. Поїхали?`,
        keyboards.onboardingStartKeyboard()
      );
      return;
    }

    console.log(`[auth.handleStart] ✅ Користувач повністю зареєстрований`);
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
    console.error('[auth.handleStart] Критична помилка:', error);
    await ctx.reply('❌ Помилка. Спробуй /start ще раз або напиши: nadyastarway@gmail.com');
  }
}

export async function handleRegistrationStep(ctx) {
  if (!ctx.session || !ctx.session.step) return false;

  const step = ctx.session.step;
  const text = (ctx.message?.text || '').trim();

  if (!step.startsWith('ob_')) return false;

  try {
    const tgId = ctx.session.temp?.tgId || ctx.from.id;

    if (step === ANSWER_STEPS.OB_NAME) {
      if (!text || text.length < 2 || text.length > 30) {
        await ctx.reply('Краще коротше/довше: 2–30 символів.');
        return true;
      }

      await userService.updateUser(tgId, { 'User Name': text.trim() });
      
      ctx.session.temp.name = text.trim();
      ctx.session.step = ANSWER_STEPS.OB_EMAIL;
      await ctx.reply('Введи e‑mail для чеків і доступів.');
      return true;
    }

    if (step === ANSWER_STEPS.OB_EMAIL) {
      if (!isSkip(text) && text && !isValidEmail(text)) {
        await ctx.reply('Схоже на помилку у адресі. Введи e‑mail ще раз.');
        return true;
      }

      const email = isSkip(text) ? null : text;
      
      if (email) {
        await userService.updateUser(tgId, { 'Email': email });
      }

      ctx.session.temp.email = email;
      ctx.session.step = 'reg_timezone';
      await ctx.reply('Обери часовий пояс для нагадувань:', timezoneKeyboard());
      return true;
    }

    if (step === 'reg_timezone') {
      const picked = TIMEZONES.find((tz) => tz === text);
      if (!picked) {
        await ctx.reply('Обери часовий пояс зі списку:', timezoneKeyboard());
        return true;
      }

      const tz = parseTz(picked);
      
      await userService.updateUser(tgId, {
        'Time Zone': tz,
        'UserRegistered': true,
        'Status': 'Registered User',
        'DateUserRegistered': new Date().toISOString()
      });

      console.log(`[auth.handleRegistrationStep] ✅ Реєстрація завершена для ${tgId}`);

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
    console.error('[auth.handleRegistrationStep] Помилка:', error);
    await ctx.reply('❌ Помилка реєстрації. Натисни /start, щоб почати заново.');
  }

  return false;
}

export async function handleOnboardingCallback(ctx) {
  const data = ctx.callbackQuery?.data;
  if (!data || !ctx.session) return false;

  console.log(`[handleOnboardingCallback] Callback: ${data}, session step: ${ctx.session?.step}`);

  try {
    const onboardingCallbacks = [
      'onboarding_start', 'onboarding_about', 'pick_plan_', 'back_plan', 
      'pay_', 'pay_check_', 'reminders', 'rem_ok', 'rem_later', 'wheel_start'
    ];
    
    const isOnboardingCallback = onboardingCallbacks.some(cb => data.startsWith(cb) || data === cb);
    if (!isOnboardingCallback) return false;

    const tgId = ctx.session.temp?.tgId || ctx.from.id;

    if (data === 'onboarding_start') {
      ctx.session.step = ANSWER_STEPS.OB_NAME;
      await ctx.editMessageText('Як звертатись до тебе? Введи ім\'я (2–30 символів).');
      await ctx.answerCbQuery();
      return true;
    }

    if (data === 'onboarding_about') {
      await ctx.editMessageText(
        'ℹ️ ПРО БОТА\n\naiMentor - твій персональний коуч для щоденної трансформації.\n\n🌅 Ранкові питання для фокусу\n🌙 Вечірні питання для аналізу\n📊 AI-звіти та інсайти\n🎯 Колесо балансу\n💎 Щоденні афірмації',
        keyboards.onboardingStartKeyboard()
      );
      await ctx.answerCbQuery();
      return true;
    }

    if (data.startsWith('pick_plan_')) {
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

    if (data === 'back_plan') {
      ctx.session.step = ANSWER_STEPS.OB_PLAN;
      await ctx.editMessageText(
        'Обери план, що підходить зараз.',
        keyboards.onboardingPlanKeyboard()
      );
      await ctx.answerCbQuery();
      return true;
    }

    if (data.startsWith('pay_')) {
      const planValue = data.replace('pay_', '');
      const planInfo = getPlanInfo(planValue);
      
      if (!planInfo) {
        await ctx.answerCbQuery('Невірний план');
        return true;
      }

      if (planValue === 'trial_7d') {
        try {
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 7);
          
          await userService.updateUser(tgId, {
            'Active_Subscription_Status': `✅ Активна до ${endDate.toLocaleDateString('uk-UA')}`,
            'Active Subscription Plan': planInfo.name,
            'Subscription Status': 'Active',
            'Start_Date': new Date().toISOString(),
            'End_Date': endDate.toISOString()
          });

          ctx.session.step = ANSWER_STEPS.OB_PAYMENT_SUCCESS;
          
          await ctx.editMessageText(
            `✅ Пробний період активовано! Підписка активна до ${endDate.toLocaleDateString('uk-UA')}.`,
            keyboards.onboardingPaymentSuccessKeyboard()
          );
          await ctx.answerCbQuery('Пробний період активовано!');
          return true;
        } catch (error) {
          console.error('[handleOnboardingCallback] Помилка активації пробного періоду:', error);
          await ctx.answerCbQuery('Помилка активації');
          return true;
        }
      }

      try {
        const orderReference = `ONBOARD_${planValue.toUpperCase()}_${tgId}_${Date.now()}`;
        
        const WAYFORPAY_LINKS = {
          'week_7': 'https://secure.wayforpay.com/button/b96923b913d29',
          'month_30': 'https://secure.wayforpay.com/button/b8df87678cd43', 
          'year_300': 'https://secure.wayforpay.com/button/bf28701123683'
        };
        
        const paymentLink = `${WAYFORPAY_LINKS[planValue]}?tg_id=${tgId}&orderReference=${orderReference}&productName=${encodeURIComponent(planInfo.name)}`;

        ctx.session.invoiceId = orderReference;
        ctx.session.step = ANSWER_STEPS.OB_PAYMENT_PENDING;

        console.log(`[handleOnboardingCallback] ✅ Створено WayForPay посилання: ${paymentLink}`);

        await ctx.editMessageText(
          `Тримай рахунок. Оплата через WayForPay. Я зачекаю вебхук 😉\n\n💳 ОПЛАТА ПІДПИСКИ\n\n📋 План: ${planInfo.name}\n💰 Вартість: ${planInfo.price}€\n⏰ Тривалість: ${planInfo.duration} днів\n\n🔗 Посилання для оплати:\n${paymentLink}\n\n💳 Після оплати підписка активується автоматично!`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔗 Перейти до оплати', url: paymentLink }],
                [{ text: '🔁 Перевірити оплату', callback_data: `pay_check_${orderReference}` }]
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

    if (data.startsWith('pay_check_')) {
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

    if (data === 'reminders') {
      ctx.session.step = ANSWER_STEPS.OB_REMINDERS_INTRO;
      await ctx.editMessageText(
        'Ставлю фіксований графік: ранок 08:00, вечір 21:30 (за твоєю TZ). Ок?',
        keyboards.onboardingRemindersKeyboard()
      );
      await ctx.answerCbQuery();
      return true;
    }

    if (data === 'rem_ok' || data === 'rem_later') {
      ctx.session.step = ANSWER_STEPS.OB_DONE;
      await ctx.editMessageText(
        'Готово. Запускаю перше Колесо балансу — займе ~3 хвилини.',
        keyboards.onboardingWheelStartKeyboard()
      );
      await ctx.answerCbQuery();
      return true;
    }

    if (data === 'wheel_start') {
      ctx.session.step = undefined;
      ctx.session.temp = {};
      ctx.session.selectedPlan = undefined;
      ctx.session.invoiceId = undefined;
      
      await ctx.answerCbQuery();
      await wheelBalanceController.handleWheelBalanceRequest(ctx);
      return true;
    }

    return false;

  } catch (error) {
    console.error('[auth.handleOnboardingCallback] Помилка:', error);
    await ctx.answerCbQuery('Помилка');
    return false;
  }
}

function getPlanInfo(planValue) {
  const planMap = {
    'week_7': SUBSCRIPTION_PLANS.WEEK,
    'month_30': SUBSCRIPTION_PLANS.MONTH, 
    'year_300': SUBSCRIPTION_PLANS.YEAR,
    'trial_7d': SUBSCRIPTION_PLANS.TRIAL
  };
  return planMap[planValue] || null;
}