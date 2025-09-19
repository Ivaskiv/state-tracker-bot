// src/auth/modules/auth.js - ВИПРАВЛЕНО ПІД VIEW: Subscribers (New Users / Form Submited)

import userService, { ensureNewUserStub, finalizeRegistration } from '../services/userService.js';
import keyboards from '../../utils/keyboards.js';
import { isSkip, isValidEmail, isValidUaPhone } from '../../utils/validators.js';
import wheelBalanceController from '../../controllers/wheelBalanceController.js';
import { SUBSCRIPTION_PLANS, ANSWER_STEPS } from '../../config/constants.js';

// ✅ Фолбеки, якщо в constants нема потрібних OB_* ключів
const OB = {
  NAME: ANSWER_STEPS?.OB_NAME || 'ob_name',
  EMAIL: ANSWER_STEPS?.OB_EMAIL || 'ob_email',
  PHONE: ANSWER_STEPS?.OB_PHONE || 'ob_phone',
  TZ: ANSWER_STEPS?.OB_TZ || 'ob_timezone',
  PLAN: ANSWER_STEPS?.OB_PLAN || 'ob_plan',
  PAYMENT_PENDING: ANSWER_STEPS?.OB_PAYMENT_PENDING || 'ob_payment_pending',
  PAYMENT_SUCCESS: ANSWER_STEPS?.OB_PAYMENT_SUCCESS || 'ob_payment_success',
  REMINDERS_INTRO: ANSWER_STEPS?.OB_REMINDERS_INTRO || 'ob_reminders_intro',
  DONE: ANSWER_STEPS?.OB_DONE || 'ob_done',
};

const TIMEZONES = [
  // Київ: у Airtable збережемо тільки ідентифікатор (до пробілу)
  'Europe/Kyiv (UTC+2/UTC+3)',
  'Europe/Prague (UTC+1/UTC+2)',
  'Europe/Berlin (UTC+1/UTC+2)',
  'Europe/Paris (UTC+1/UTC+2)',
  'Europe/London (UTC+0/UTC+1)',
  'America/New_York (UTC-5/UTC-4)',
  'Asia/Dubai (UTC+4)'
];

const timezoneKeyboard = () => ({
  reply_markup: {
    keyboard: TIMEZONES.map(tz => [tz]),
    resize_keyboard: true,
    one_time_keyboard: true
  }
});

const parseTz = (label) => (label || '').split(' ')[0]; // "Europe/Prague (..)" -> "Europe/Prague"

const isProfileIncomplete = (user) => {
  if (!user) return true;
  const hasName = !!user['User Name'];
  const hasTz = !!user['Time Zone'];
  const isRegistered = user.Status === 'Registered User' || user.UserRegistered === true;
  return !(hasName && hasTz && isRegistered);
};

// ───────────────────────────────────────────────────────────
// /start — створюємо New User у відповідній view і запускаємо онбординг
// ───────────────────────────────────────────────────────────
export async function handleStart(ctx) {
  const tgId = ctx.from.id;
  const name = ctx.from.first_name || 'Користувач';

  try {
    let user = await userService.getUserByTelegramId(tgId);

    // якщо юзера нема — створюємо “болванку” (Status="New User") → попаде у Subscribers - New Users
    if (!user) {
      console.log(`[auth.handleStart] 🔰 Не знайдено юзера ${tgId} — створюю New User stub`);
      await ensureNewUserStub(tgId);
      user = await userService.getUserByTelegramId(tgId);
    }

    // якщо профіль неповний → онбординг
    if (isProfileIncomplete(user)) {
      if (!ctx.session) {
        await ctx.reply('⚠️ Не знайдено session(). Перевір, що bot.use(session()) підключено у server.js');
        return;
      }

      // стартуємо з імені
      ctx.session.step = OB.NAME;
      ctx.session.temp = { name, tgId, username: ctx.from.username || null };

      await ctx.reply(
        `🌟 Вітаю в aiMentor, ${name}!\n\nПочнемо реєстрацію. Підтверди своє ім'я або введи інше (2–30 символів):`,
        keyboards.skipKeyboard()
      );
      return;
    }

    // якщо юзер вже зареєстрований — далі за статусом підписки
    const active = (user['Active_Subscription_Status'] || '').includes('✅ Активна');
    if (active) {
      await ctx.reply(`Привіт знову, ${name}! 👋`, keyboards.mainMenuKeyboard());
    } else {
      await ctx.reply(
        `❌ Твоя підписка неактивна.\n\n📞 Підтримка: nadyastarway@gmail.com`,
        keyboards.subscriptionKeyboard()
      );
    }
  } catch (e) {
    console.error('[auth.handleStart] ❌ error:', e);
    await ctx.reply('❌ Помилка. Спробуй ще раз.');
  }
}

// ───────────────────────────────────────────────────────────
// обробка кроків онбордингу: Name → Email → Phone → Timezone → finalize
// ───────────────────────────────────────────────────────────
export async function handleRegistrationStep(ctx) {
  // якщо немає активної сесії/кроку — не перехоплюємо текст
  if (!ctx.session || !ctx.session.step) return false;

  const step = ctx.session.step;
  const text = (ctx.message?.text || '').trim();
  const tgId = ctx.session.temp?.tgId || ctx.from.id;

  // приймаємо тільки наші кроки OB_* або сумісний 'reg_timezone'
  const isOurStep =
    step === OB.NAME ||
    step === OB.EMAIL ||
    step === OB.PHONE ||
    step === OB.TZ ||
    step === 'reg_timezone';

  if (!isOurStep) return false;

  try {
    // 1) ІМ'Я
    if (step === OB.NAME) {
      const inputName = text || ctx.session.temp?.name || '';
      if (inputName.length < 2 || inputName.length > 30) {
        await ctx.reply('⚠️ Ім’я має бути 2–30 символів. Спробуй ще раз.');
        return true;
      }

      await userService.updateUser(tgId, {
        'User Name': inputName.trim(),
      });

      ctx.session.temp.name = inputName.trim();
      ctx.session.step = OB.EMAIL;

      await ctx.reply('📧 Введи e-mail для чеків і доступів (або натисни "Пропустити"):', keyboards.skipKeyboard());
      return true;
    }

    // 2) EMAIL
    if (step === OB.EMAIL) {
      if (!isSkip(text) && text && !isValidEmail(text)) {
        await ctx.reply('⚠️ Схоже на помилку в e-mail. Введи ще раз або "Пропустити":', keyboards.skipKeyboard());
        return true;
      }

      const email = isSkip(text) ? null : text.trim();
      if (email) {
        await userService.updateUser(tgId, { Email: email });
      }

      ctx.session.temp.email = email;
      ctx.session.step = OB.PHONE;

      await ctx.reply('📱 Введи номер телефону у форматі +380XXXXXXXXX (або натисни "Пропустити"):', keyboards.skipKeyboard());
      return true;
    }

    // 3) PHONE
    if (step === OB.PHONE) {
      if (!isSkip(text) && text && !isValidUaPhone(text)) {
        await ctx.reply('⚠️ Номер має бути у форматі +380XXXXXXXXX або натисни "Пропустити":', keyboards.skipKeyboard());
        return true;
      }

      const phone = isSkip(text) ? null : text.trim();
      if (phone) {
        await userService.updateUser(tgId, { Phone: phone });
      }

      ctx.session.temp.phone = phone;
      ctx.session.step = OB.TZ;

      await ctx.reply('🌍 Обери часовий пояс для нагадувань:', timezoneKeyboard());
      return true;
    }

    // 4) TIMEZONE (підтримка і OB.TZ, і старого 'reg_timezone')
    if (step === OB.TZ || step === 'reg_timezone') {
      const picked = TIMEZONES.find((tz) => tz === text);
      if (!picked) {
        await ctx.reply('Обери часовий пояс зі списку нижче:', timezoneKeyboard());
        return true;
      }

      const tz = parseTz(picked);
      const finalName = ctx.session.temp?.name || 'Користувач';
      const email = ctx.session.temp?.email || null;
      const phone = ctx.session.temp?.phone || null;

      console.log('[auth.handleRegistrationStep] ✅ Finalize registration payload:', {
        tgId, finalName, email, phone, tz
      });

      try {
        // ► Переведемо запис у "Registered User" → попадеш у view: Subscribers - Form Submited
        const updated = await finalizeRegistration(tgId, {
          name: finalName,
          email,
          phone,
          timezone: tz
        });

        // чистимо мікродані сесії (НЕ перетираємо весь ctx.session!)
        ctx.session.step = undefined;
        ctx.session.temp = {};

        await ctx.reply(`🎉 Реєстрацію завершено!\n\nТвій часовий пояс: ${picked}`, keyboards.removeKeyboard());

        // далі — підписка або колесо
        const active = (updated['Active_Subscription_Status'] || '').includes('✅ Активна');
        if (!active) {
          await ctx.reply(
            '💰 Для початку роботи потрібна активна підписка.\n\n📞 Звʼяжись із підтримкою: nadyastarway@gmail.com',
            keyboards.subscriptionKeyboard()
          );
        } else {
          await ctx.reply('🎯 Почнемо з колеса балансу!');
          await wheelBalanceController.handleWheelBalanceRequest(ctx);
        }

        return true;
      } catch (error) {
        console.error('[auth.handleRegistrationStep] ❌ finalizeRegistration error:', error);
        await ctx.reply('❌ Помилка збереження. Спробуй ще раз або напиши в підтримку.');
        return true;
      }
    }

  } catch (error) {
    console.error('[auth.handleRegistrationStep] ❌ error:', error);
    // soft-reset
    if (ctx.session) {
      ctx.session.step = undefined;
      ctx.session.temp = {};
    }
    await ctx.reply('❌ Помилка реєстрації. Натисни /start, щоб почати заново.');
  }

  return false;
}

// ───────────────────────────────────────────────────────────
// Опціонально: обробка онбординг callback'ів (плани/оплата/нагадування/колесо)
// (залишив без змін, якщо використовуєш)
// ───────────────────────────────────────────────────────────
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
      ctx.session.step = OB.NAME;
      await ctx.editMessageText('Як звертатись до тебе? Введи ім\'я (2–30 символів).');
      await ctx.answerCbQuery();
      return true;
    }

    // ... (твоя існуюча логіка для оплат / нагадувань / колеса — без змін)

    return false;
  } catch (error) {
    console.error('[auth.handleOnboardingCallback] Помилка:', error);
    try { await ctx.answerCbQuery('Помилка'); } catch {}
    return false;
  }
}
