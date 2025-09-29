// src/controllers/flows/registrationController.js
import keyboards from '../../utils/keyboards.js';
import { parseTz } from '../../config/constants.js';
import userService from '../../auth/services/userService.js';

const STEPS = {
  NAME: 'ob_name',
  EMAIL: 'ob_email',
  PHONE: 'ob_phone',
  TIMEZONE: 'ob_timezone',
  PLAN: 'ob_plan'
};

function initSession(ctx) {
  ctx.session ??= {};
  ctx.session.reg ??= { step: null, name: '', email: '', phone: '', tzLabel: '' };
}

async function askName(ctx) {
  initSession(ctx);
  ctx.session.reg.step = STEPS.NAME;

  const telegramName = ctx.from.first_name || 'Користувач';
  await ctx.reply(
    `👋 Привіт! Я твій AI-мотиватор і коуч.\n\nЯк до тебе звертатись?`,
    keyboards.greetingKeyboard(telegramName)
  );
}

async function askEmail(ctx) {
  ctx.session.reg.step = STEPS.EMAIL;
  await ctx.reply('📧 Введи email для звітів (або пропусти):', keyboards.emailSkipKeyboard());
}

async function askPhone(ctx) {
  ctx.session.reg.step = STEPS.PHONE;
  await ctx.reply('📱 Введи номер телефону у форматі +380XXXXXXXXX (або пропусти):', keyboards.phoneSkipKeyboard());
}

async function askTimezone(ctx) {
  ctx.session.reg.step = STEPS.TIMEZONE;
  await ctx.reply('🌍 Обери свій часовий пояс (важливо для нагадувань):', keyboards.timezoneKeyboard());
}

async function askPlan(ctx) {
  ctx.session.reg.step = STEPS.PLAN;
  await ctx.reply('💰 Обери план доступу:', keyboards.subscriptionPlansKeyboard());
}

async function finishTrial(ctx) {
  // записуємо все в Users
  const { name, email, phone, tzLabel } = ctx.session.reg;
  const tgId = ctx.from.id;

  await userService.finalizeRegistration(tgId, {
    name,
    email,
    phone,
    timezoneLabel: tzLabel
  });

  await userService.activateTrial(tgId, 7);

  ctx.session.reg = { step: null, name: '', email: '', phone: '', tzLabel: '' };

  await ctx.reply(
    `🎉 Реєстрацію завершено!\n🧪 Пробний доступ активовано на 7 днів.\n\nГотова почати?`,
    keyboards.mainMenuKeyboard()
  );
}

export default {
  // Викликаємо зі /start, якщо користувач НЕ зареєстрований
  async start(ctx) {
    await askName(ctx);
  },

  // Обробка тексту під час онбордингу
  async onText(ctx) {
    initSession(ctx);
    const step = ctx.session.reg.step;
    const text = (ctx.message?.text || '').trim();

    if (step === STEPS.NAME) {
      if (!text || text.length < 2 || text.length > 50) {
        await ctx.reply('⚠️ Введи коректне ім’я (2–50 символів):');
        return true;
      }
      ctx.session.reg.name = text;
      await askEmail(ctx);
      return true;
    }

    if (step === STEPS.EMAIL) {
      if (text) ctx.session.reg.email = text;
      await askPhone(ctx);
      return true;
    }

    if (step === STEPS.PHONE) {
      if (text) ctx.session.reg.phone = text.startsWith('+') ? text : `+${text}`;
      await askTimezone(ctx);
      return true;
    }

    // якщо не наш крок — не споживаємо текст
    return false;
  },

  // Обробка callback-ів під час онбордингу
  async onCallback(ctx, data) {
    initSession(ctx);

    if (data === 'use_telegram_name') {
      ctx.session.reg.name = ctx.from.first_name || 'Користувач';
      await askEmail(ctx);
      return true;
    }
    if (data === 'enter_custom_name') {
      await ctx.reply('✏️ Введи своє ім’я:');
      ctx.session.reg.step = STEPS.NAME;
      return true;
    }

    if (data === 'skip_email') {
      await askPhone(ctx);
      return true;
    }
    if (data === 'skip_phone') {
      await askTimezone(ctx);
      return true;
    }

    if (data.startsWith('tz_')) {
      const slug = data.slice(3);
      const label = parseTz(slug);
      ctx.session.reg.tzLabel = label;
      await askPlan(ctx);
      return true;
    }

    if (data === 'plan_trial') {
      await finishTrial(ctx);
      return true;
    }

    // інші плани — просто показуємо інструкцію (без платіжки)
    if (data === 'plan_week' || data === 'plan_month' || data === 'plan_year') {
      await ctx.reply(
        `💳 Оплата поки вручну.\nНапиши в підтримку:\n📧 nadyastarway@gmail.com\n💬 @Nadya2316`
      );
      return true;
    }

    return false;
  }
};
