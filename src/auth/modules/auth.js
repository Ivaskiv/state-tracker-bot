// src/auth/modules/auth.js
import userService from '../services/userService.js';
import keyboards from '../../utils/keyboards.js';
import { isSkip, isValidEmail, isValidUaPhone } from '../../utils/validators.js';
import wheelBalanceController from '../../controllers/wheelBalanceController.js';

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
  if (!ctx.session) return;
  ctx.session.step = 'reg_name';
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

// ——— пости підписки як на скріні
async function sendSubscriptionCTA(ctx) {
  // блок 1: інфо + три кнопки
  await ctx.reply(
`💰 Для початку роботи потрібна активна підписка.

📞 Зв'яжися з підтримкою для оформлення:
nadyastarway@gmail.com`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🪙 Інформація про підписку', callback_data: 'subscription_info' }],
          [{ text: '🔄 Оновити статус', callback_data: 'sync_subscription' }],
          [{ text: "📞 Зв'язатися з підтримкою", callback_data: 'contact_support' }]
        ]
      }
    }
  );

  // блок 2: вибір плану + кнопки оплати
  await ctx.reply(
`🪙 ОБЕРІТЬ ПЛАН ПІДПИСКИ:

🔷 **Тиждень фокусу — 7€**
Ідеально для короткого фокусу або тесту системи

🔷 **Місяць дії — 30€**
Глибинна робота з цілями та стратегією

🔷 **Рік трансформації — 300€**
Максимальна економія та підтримка протягом року

✅ Безпечна оплата через WayForPay`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '7€ - Тиждень', callback_data: 'subscribe_week' }],
          [{ text: '30€ - Місяць', callback_data: 'subscribe_month' }],
          [{ text: '300€ - Рік', callback_data: 'subscribe_year' }],
          [{ text: '📞 Підтримка', callback_data: 'contact_support' }],
          [{ text: '⬅️ Назад', callback_data: 'subscription_info' }]
        ]
      }
    }
  );
}

// ——— /start
export async function handleStart(ctx) {
  const tgId = ctx.from.id;
  const name = ctx.from.first_name || 'Користувач';

  try {
    let user = null;
    try {
      user = await userService.getUserByTelegramId(tgId);
    } catch (e) {
      console.error('[auth.handleStart] DB error:', e);
      await ctx.reply('❌ Помилка доступу до бази. Спробуй пізніше.');
      return;
    }

    if (isUserIncomplete(user)) {
      if (ctx.session) startRegSession(ctx, name);
      await ctx.reply(
        `🌟 Вітаю в aiMentor, ${name}!\n\nПочнемо реєстрацію. Підтверди своє ім'я або введи інше:`,
        keyboards.skipKeyboard()
      );
      return;
    }

    const active = user['Active_Subscription_Status']?.includes('✅ Активна');
    if (active) {
      await ctx.reply(
        `Привіт знову, ${name}! 👋\n\n✅ Підписка активна. Поїхали далі?`,
        keyboards.mainMenuKeyboard()
      );
    } else {
      await sendSubscriptionCTA(ctx);
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

  if (!step || !step.startsWith('reg_')) return false;

  try {
    // ім'я
    if (step === 'reg_name') {
      if (!text && !ctx.session.temp?.name) {
        await ctx.reply('Введи ім’я:', keyboards.skipKeyboard());
        return true;
      }
      ctx.session.temp.name = (text || ctx.session.temp.name || ctx.from.first_name || '').trim();
      ctx.session.step = 'reg_email';
      await ctx.reply('Вкажи email (або пропусти):', keyboards.skipKeyboard());
      return true;
    }

    // email
    if (step === 'reg_email') {
      if (!isSkip(text) && text && !isValidEmail(text)) {
        await ctx.reply('Некоректний email. Спробуй ще раз або пропусти:', keyboards.skipKeyboard());
        return true;
      }
      ctx.session.temp.email = isSkip(text) ? null : text;
      ctx.session.step = 'reg_phone';
      await ctx.reply('Номер телефону у форматі +380XXXXXXXXX (або пропусти):', keyboards.skipKeyboard());
      return true;
    }

    // телефон
    if (step === 'reg_phone') {
      if (!isSkip(text) && text && !isValidUaPhone(text)) {
        await ctx.reply('Формат: +380XXXXXXXXX. Спробуй ще раз або пропусти:', keyboards.skipKeyboard());
        return true;
      }
      ctx.session.temp.phone = isSkip(text) ? null : text;
      ctx.session.step = 'reg_timezone';
      await ctx.reply('Обери часовий пояс для нагадувань:', timezoneKeyboard());
      return true;
    }

    // TZ + створення юзера
    if (step === 'reg_timezone') {
      const picked = TIMEZONES.find((tz) => tz === text);
      if (!picked) {
        await ctx.reply('Обери часовий пояс зі списку:', timezoneKeyboard());
        return true;
      }

      const tz = parseTz(picked);
      const finalName = ctx.session.temp.name;

      const payload = {
        tgId: ctx.from.id,
        name: finalName,
        email: ctx.session.temp.email,
        phone: ctx.session.temp.phone,
        timezone: tz,
        registrationStatus: 'done'
      };

      try {
        const created = await userService.createUser(payload);
        // дублюю прапорець, якщо createUser його не виставив
        try {
          await userService.updateUser(ctx.from.id, {
            Registration_Status: 'done',
            Timezone: tz,
            'User Name': finalName
          });
        } catch {}

        // чистимо сесію акуратно
        resetRegSession(ctx);

        // 1) “Реєстрацію завершено!” + TZ (точно як на скріні)
        await ctx.reply(
          `🎉 Реєстрацію завершено!\n\nТвій часовий пояс: ${picked}`,
          keyboards.removeKeyboard()
        );

        // 2) якщо немає активної підписки — показуємо блоки з CTA і планами
        const hasActive = created?.['Active_Subscription_Status']?.includes('✅ Активна');
        if (!hasActive) {
          await sendSubscriptionCTA(ctx);
          return true;
        }

        // якщо активна — одразу в колесо
        await ctx.reply('🎯 Почнемо з оцінки твого життєвого балансу!');
        await wheelBalanceController.handleWheelBalanceRequest(ctx);
        return true;
      } catch (e) {
        console.error('[auth] createUser error:', e);
        resetRegSession(ctx);
        await ctx.reply(
          '❌ Помилка створення акаунта. Спробуй ще раз через хвилину або напиши в підтримку:\n' +
          'nadyastarway@gmail.com'
        );
        return true;
      }
    }
  } catch (error) {
    console.error('[auth.handleRegistrationStep] error:', error);
    resetRegSession(ctx);
    await ctx.reply('❌ Помилка реєстрації. Натисни /start, щоб почати заново.');
  }

  return false;
}
