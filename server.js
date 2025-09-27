// server.js - ВИПРАВЛЕНИЙ ГОЛОВНИЙ ФАЙЛ СЕРВЕРУ
import dotenv from 'dotenv';
dotenv.config();

import { Telegraf, session } from 'telegraf';
import userService from './src/auth/services/userService.js';
import keyboards from './src/utils/keyboards.js';
import { isValidEmail, isValidUaPhone, isValidName, formatEmail, formatPhone, formatName } from './src/utils/validators.js';
import { resolveTz } from './src/config/constants.js';
// Перевірка ENV
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN відсутній у .env');
  process.exit(1);
}

// Константи
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

// Створюємо бота
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Middleware
bot.use(session({
  defaultSession: () => ({
    step: undefined,
    temp: {}
  })
}));

// Логування
bot.use(async (ctx, next) => {
  console.log('➡️', {
    type: ctx.updateType,
    text: ctx.message?.text?.substring(0, 30),
    cb: ctx.callbackQuery?.data,
    from: ctx.from?.id
  });
  
  try { 
    await next(); 
  } catch (err) { 
    console.error('💥 middleware err', err);
    try {
      await ctx.reply('❌ Виникла помилка. Спробуй /start');
    } catch {}
  }
});

// ===== КОМАНДА /start =====
// ===== КОМАНДА /start =====
bot.start(async (ctx) => {
  const tgId = ctx.from.id;
  const telegramName = ctx.from.first_name || 'Користувач';
  console.log(`🚀 [/start] від ${tgId} (${telegramName})`);

  try {
    // 1) гарантуємо, що в Airtable/кеші є рядок (не блокує UX)
    await userService.ensureUserRow(tgId, { name: telegramName }).catch(e => {
      console.warn('[START] ensureUserRow warn:', e.message);
    });

    // 2) читаємо користувача (може прийти “тимчасовий” з кешу)
    let user = null;
    try {
      user = await userService.getUserByTelegramId(tgId);
    } catch (error) {
      console.warn(`[START] ⚠️ Помилка отримання користувача:`, error.message);
    }

    // 3) якщо користувач повністю зареєстрований
    if (user && user.UserRegistered) {
      const userName = user['User Name'] || telegramName;
      const hasAccess = userService.hasActiveAccess(user);

      if (hasAccess) {
        await ctx.reply(
          `👋 З поверненням, ${userName}!\n\n✅ Підписка активна\n\nПродовжимо розвиток? 🚀`,
          keyboards.mainMenuKeyboard()
        );
      } else {
        await showSubscriptionRequired(ctx, user);
      }
      return;
    }

    // 4) інакше — запускаємо онбординг (питаємо ім’я)
    await startRegistration(ctx, telegramName);

  } catch (err) {
    console.error('[START] ❌ Помилка:', err);
    try { await ctx.reply('❌ Помилка запуску. Спробуй ще раз.'); } catch {}
  }
});


const askForEmail = async (ctx) => {
  ctx.session.step = REGISTRATION_STEPS.EMAIL;
  
  await ctx.reply(
    '📧 Введи свій email для звітів:\n\n(або пропусти)',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '⏭️ Пропустити email', callback_data: 'skip_email' }]
        ]
      }
    }
  );
};

const askForPhone = async (ctx) => {
  ctx.session.step = REGISTRATION_STEPS.PHONE;
  
  await ctx.reply(
    '📱 Введи номер телефону (+380XXXXXXXXX):\n\n(або пропусти)',
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '⏭️ Пропустити телефон', callback_data: 'skip_phone' }]
        ]
      }
    }
  );
};

const askForTimezone = async (ctx) => {
  ctx.session.step = REGISTRATION_STEPS.TIMEZONE;

  const rows = tzList.map(t => [{ text: t.label, callback_data: `tz_${t.slug}` }]);
  await ctx.reply(
    '🌍 Обери свій часовий пояс:\n\n(Важливо для точного розкладу нагадувань)',
    { reply_markup: { inline_keyboard: rows } }
  );
};

const showPlans = async (ctx) => {
  ctx.session.step = REGISTRATION_STEPS.PLAN;
  const message =
    `💰 ОБЕРИ ПЛАН ДОСТУПУ:\n\n` +
    `🧪 Пробний — 0€ (7 днів)\n` +
    `🎯 Тиждень — 7€\n` +
    `📅 Місяць — 30€\n` +
    `🗓️ Рік — 300€ (економія!)\n\n` +
    `Можеш почати з безкоштовного тесту:`;

  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🧪 Пробний 7 днів — 0€', callback_data: 'plan_trial' }],
        [{ text: '🎯 Тиждень — 7€',        callback_data: 'plan_week' }],
        [{ text: '📅 Місяць — 30€',        callback_data: 'plan_month' }],
        [{ text: '🗓️ Рік — 300€',         callback_data: 'plan_year' }]
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
        [{ text: '🎁 Пробний період 7 днів', callback_data: 'plan_trial' }],
        [{ text: '💰 Переглянути плани', callback_data: 'show_plans' }]
      ]
    }
  });
};

// ===== ОБРОБКА ТЕКСТУ =====
bot.on('text', async (ctx) => {
  if (ctx.message?.entities?.some(e => e.type === 'bot_command')) return;

  const tgId = ctx.from.id;
  const text = ctx.message?.text?.trim();
  const currentStep = ctx.session?.step;
  
  if (!text) return;

  console.log(`💬 [TEXT] від ${tgId}: "${text}", step: ${currentStep}`);

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

    // Інші команди меню
    await handleMenuCommands(ctx, text);
    
  } catch (error) {
    console.error('[TEXT] ❌ Помилка:', error);
    await ctx.reply('❌ Помилка. Спробуй ще раз.');
  }
});

// ===== ОБРОБКА CALLBACK =====
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery?.data || '';
  const tgId = ctx.from.id;
  const telegramName = ctx.from.first_name || 'Користувач';

  console.log(`📱 [CALLBACK] ${data} від ${tgId}`);

  try {
    await ctx.answerCbQuery();

    // Обробка вибору імені
    if (data === 'use_telegram_name') {
      ctx.session.temp.name = telegramName;
      await askForEmail(ctx);
      return;
    }

    if (data === 'enter_custom_name') {
      await ctx.reply('✏️ Введи своє ім\'я:');
      // step залишається REGISTRATION_STEPS.NAME
      return;
    }

    // Пропуски
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
      const timezone = data.replace('tz_', '');
      ctx.session.temp.timezone = timezone;
      
      await ctx.reply(`✅ Часовий пояс: ${timezone}`);
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

    console.log(`❓ [CALLBACK] Невідома команда: ${data}`);

  } catch (error) {
    console.error('[CALLBACK] ❌ Помилка:', error);
    await ctx.answerCbQuery('Помилка');
  }
});

// ===== ОБРОБКА ВИБОРУ ПЛАНУ =====
const handlePlanSelection = async (ctx, planType) => {
  const tgId = ctx.from.id;
  console.log(`[PLAN] 💰 Обробка плану ${planType} для ${tgId}`);

  try {
    try { await ctx.reply('⏳ Обробляю вибір плану…'); } catch {}

    // 1) читаємо або створюємо
    let user = await userService.getUserByTelegramId(tgId);
    if (!user) {
      const userData = {
        tgId: String(tgId),
        name: ctx.session.temp?.name || ctx.from.first_name || 'Користувач',
        email: ctx.session.temp?.email || `user${tgId}@temp.com`,
        phone: ctx.session.temp?.phone || '+380000000000',
        timezone: ctx.session.temp?.timezone || '', // ВАЖЛИВО: LABEL або порожньо
        registrationStatus: 'Active'
      };
      user = await userService.createUser(userData);
    } else if (ctx.session.temp?.timezone) {
      try {
        user = await userService.updateUserById(user.id, { 'Time Zone': ctx.session.temp.timezone });
      } catch (e) {
        console.warn('[PLAN] warn: update TZ by id failed:', e.message);
      }
    }

    // 2) очищаємо сесію онбордингу
    ctx.session.step = undefined;
    ctx.session.temp = {};

    // 3) TRIAL одразу активуємо
    if (planType === 'TRIAL') {
      const updated = await userService.activateTrial(tgId, 7, { recordId: user?.id });
      if (updated) {
        await ctx.reply(
          `🎉 Реєстрацію завершено!\n\n` +
          `🧪 Пробна підписка активована на 7 днів\n\n` +
          `🎯 Можеш користуватися всіма функціями!`,
          keyboards.mainMenuKeyboard()
        );
      } else {
        await ctx.reply('❌ Не вдалося активувати пробну підписку. Спробуй ще раз.');
      }
      return;
    }

    // 4) платні плани — як було
    const planInfo = SUBSCRIPTION_PLANS[planType];
    if (planInfo) {
      await ctx.reply(
        `💳 ОПЛАТА ПІДПИСКИ\n\n` +
        `План: ${planInfo.name}\n` +
        `Вартість: ${planInfo.price}€\n` +
        `Період: ${planInfo.duration} днів\n\n` +
        `Для оплати зверніться до підтримки:\n` +
        `📧 nadyastarway@gmail.com\n` +
        `💬 @Nadya2316`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🧪 Пробна версія', callback_data: 'plan_trial' }],
              [{ text: '📞 Звʼязатися з підтримкою', callback_data: 'contact_support' }]
            ]
          }
        }
      );
    }
  } catch (error) {
    console.error('[PLAN] ❌ Помилка:', error);
    await ctx.reply('❌ Помилка обробки плану. Спробуй ще раз.');
  }
};

// ===== ОБРОБКА КОМАНД МЕНЮ =====
const handleMenuCommands = async (ctx, text) => {
  const tgId = ctx.from.id;
  
  switch (text) {
    case '🤖 AI наставник':
      await ctx.reply(
        '🤖 AI-НАСТАВНИК\n\nПерсональний коуч для досягнення цілей!\n\n💬 Напиши своє питання:',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💬 Задати питання', callback_data: 'ai_question' }],
              [{ text: '🏠 До меню', callback_data: 'main_menu' }]
            ]
          }
        }
      );
      break;
      
    case '🎯 Колесо балансу':
      await ctx.reply(
        '🎯 КОЛЕСО БАЛАНСУ\n\nОціни 8 сфер свого життя та отримай персональні рекомендації!\n\n⏱ Займає 5-10 хвилин',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎯 Почати колесо', callback_data: 'wheel_start' }],
              [{ text: '❓ Що це таке?', callback_data: 'wheel_info' }],
              [{ text: '🏠 До меню', callback_data: 'main_menu' }]
            ]
          }
        }
      );
      break;
      
    case '💰 Підписка':
      await showSubscriptionInfo(ctx);
      break;
      
    case '💎 Афірмація':
      const affirmations = [
        'Моя енергія створює позитивні зміни',
        'Я заслуговую на все найкраще прямо зараз', 
        'Моя рішучість творить нові можливості',
        'Щодня я впевнено просуваюся до мети'
      ];
      const randomAffirmation = affirmations[Math.floor(Math.random() * affirmations.length)];
      await ctx.reply(`✨ ${randomAffirmation}`, keyboards.mainMenuKeyboard());
      break;
      
    case '❓ Допомога':
      await ctx.reply(
        '❓ ДОПОМОГА\n\n📧 Email: nadyastarway@gmail.com\n💬 Telegram: @Nadya2316\n\n⏰ Відповідаємо протягом 2-4 годин.',
        keyboards.mainMenuKeyboard()
      );
      break;
      
    default:
      await ctx.reply('❓ Не розпізнав команду. Обери з меню:', keyboards.mainMenuKeyboard());
  }
};

const showSubscriptionInfo = async (ctx) => {
  const tgId = ctx.from.id;
  
  try {
    const user = await userService.getUserByTelegramId(tgId);
    const status = user?.['Active_Subscription_Status'] || '❌ Неактивна';
    
    await ctx.reply(`💰 ПІДПИСКА:\n\n${status}`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💰 Плани підписки', callback_data: 'show_plans' }],
          [{ text: '📞 Підтримка', callback_data: 'contact_support' }],
          [{ text: '🏠 До меню', callback_data: 'main_menu' }]
        ]
      }
    });
  } catch (error) {
    await ctx.reply('❌ Помилка отримання інформації про підписку.');
  }
};

// ===== ЗАПУСК БОТА =====
async function start() {
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: false });
    console.log('🧹 Webhook очищено');
    
    await bot.launch();
    const me = await bot.telegram.getMe();
    console.log(`🚀 Bot launched as @${me.username} (id=${me.id})`);
    
    console.log('✅ AI-мотиватор бот готовий!');
  } catch (error) {
    console.error('❌ Критична помилка запуску:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

start();