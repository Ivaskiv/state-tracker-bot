// src/features/registration/handlers.js
import { updateUserStep, updateUserFields, finalizeRegistration, getUserByTgId, hasActiveAccess, activateTrial } from '../../services/users.js';
import { isValidName, isValidEmail, isValidPhone } from '../../utils/validators.js';
import keyboards from '../../utils/keyboards.js';
import { TILDA_MESSAGES, TILDA_URLS } from './constants.js';
import { getRegistrationData } from './service.js';
import { getMemberAreaUrl } from '../../tilda/service.js';
import { getUserStats } from '../../services/stats.js';
import { formatDate, getDaysWord } from '../../utils/helpers.js';

const WEBAPP_URL = process.env.NGROK_URL || process.env.WEBAPP_URL || 'https://star-way.pro';

export const startHandler = async (ctx) => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🚀 [startHandler] ПОЧАТОК');
  console.log('═══════════════════════════════════════════════════════');
  
  try {
    const tgId = String(ctx.from?.id);
    const firstName = ctx.from.first_name || 'Користувач';
    
    console.log('📱 [startHandler] TG ID:', tgId);
    console.log('👤 [startHandler] First Name:', firstName);
    
    // 1️⃣ ПЕРЕВІРКА КОРИСТУВАЧА
    const userData = await getRegistrationData(tgId);
    const userExists = !!userData;
    
    console.log('📊 [startHandler] UserExists:', userExists);
    
    // 2️⃣ НОВИЙ КОРИСТУВАЧ → ФОРМА РЕЄСТРАЦІЇ
    if (!userExists) {
      console.log('🆕 [startHandler] СЦЕНАРІЙ: Новий користувач → Tilda');
      const registrationUrl = `${TILDA_URLS.REGISTRATION}?tg_id=${tgId}`;
        console.log('🔗 [Registration] URL:', registrationUrl);

      await ctx.reply(
        TILDA_MESSAGES.NEW_USER(firstName, registrationUrl),
       {
      parse_mode: 'Markdown',
      ...keyboards.registrationOptionsInline(registrationUrl)  
    }
      );
      return;
    }
    
    // 3️⃣ КОРИСТУВАЧ ІСНУЄ
    const isRegistered = userData.User_Registered === true;
    const step = userData.Answer_Step || 'idle';
    const isOnboarding = /^ob_/i.test(step);
    
    console.log('📊 [startHandler] Status:', { isRegistered, step, isOnboarding });
    
    // 3.1 НЕЗАВЕРШЕНА РЕЄСТРАЦІЯ
    if (isOnboarding && !isRegistered) {
      console.log('🔄 [startHandler] СЦЕНАРІЙ: Продовжуємо онбординг');
      return continueOnboarding(ctx);
    }
    
    // 3.2 РЕЄСТРАЦІЯ ЗАВЕРШЕНА
    const user = await getUserByTgId(tgId);
    const hasAccess = hasActiveAccess(user);
    
    console.log('🔐 [startHandler] Access:', hasAccess);
    
    // БЕЗ ПІДПИСКИ → АКТИВУВАТИ TRIAL
    if (isRegistered && !hasAccess) {
      console.log('🧪 [startHandler] СЦЕНАРІЙ: Активація trial');
      await activateTrial(tgId, 7);
      
      await ctx.reply(
        '🎉 Активовано пробний період на 7 днів!\n\n' +
        '✨ Тепер тобі доступні:\n' +
        '• 🎯 Колесо балансу\n' +
        '• 🤖 AI-наставник 24/7\n' +
        '• 📊 Щоденні рефлексії\n' +
        '• 📈 Звіти та статистика\n\n' +
        'Почнемо з Колеса балансу? 👇',
        keyboards.wheelCtaInline()
      );
      return;
    }
    
    // З ПІДПИСКОЮ → WELCOME BACK
    if (isRegistered && hasAccess) {
      console.log('🏠 [startHandler] СЦЕНАРІЙ: Welcome back');
      await sendWelcomeBack(ctx, { fields: userData });
      
      const cabinetUrl = await getMemberAreaUrl(tgId);
      await ctx.reply(
        '🗂️ **ТВІЙ ОСОБИСТИЙ КАБІНЕТ**\n\n' +
        '📚 Тут зібрані всі твої матеріали:\n' +
        '• Прогрес курсів\n' +
        '• Статистика\n' +
        '• Геймифікація (рівні, бейджі)\n' +
        '• Виконані завдання\n\n' +
        '👇 Відкрий кабінет:',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔗 Відкрити кабінет', url: cabinetUrl }],
              [{ text: '🏠 До меню бота', callback_data: 'main_menu' }]
            ]
          }
        }
      );
      return;
    }
    
  } catch (err) {
    console.error('❌ [startHandler] ERROR:', err);
    await ctx.reply(
      '❌ Виникла помилка.\nСпробуй: /start\nПідтримка: @vira_333'
    );
  }
};

const continueOnboarding = async (ctx) => {
  console.log('🔄 [continueOnboarding] ПОЧАТОК');
  const { step } = ctx.state;
  
  const steps = {
    ob_name: () => ctx.reply('Як тебе звати?', keyboards.nameChoiceInline()),
    ob_name_input: () => ctx.reply('Введи імʼя (2-50 символів):'),
ob_email: () => ctx.reply(
      '📧 **Email обов\'язковий**\n\n' +
      'Він потрібен для:\n' +
      '• Щотижневих звітів\n' +
      '• Відновлення доступу\n' +
      '• Важливих повідомлень\n\n' +
      'Введи email:',
      { parse_mode: 'Markdown' }
    ),    ob_phone: () => ctx.reply('Введи телефон:', keyboards.kbSkipPhone()),
  };
  
  await steps[step]?.();
};

const sendWelcomeBack = async (ctx, user) => {
  const tgId = String(ctx.from?.id);
  let stats = {};
  
  try {
    stats = await getUserStats(tgId);
  } catch {}
  
  const wheelLine = stats?.wheelCompleted 
    ? `✅ Заповнено ${stats.wheelCompletedDate ? formatDate(stats.wheelCompletedDate) : ''}` 
    : '❌ Ще ні';
  
  const streakLine = stats?.currentStreak > 0 
    ? `${stats.currentStreak} ${getDaysWord(stats.currentStreak)} поспіль` 
    : '—';
  
  const lastStr = stats?.lastSessionDate ? formatDate(stats.lastSessionDate) : 'немає даних';
  
  const text = 
    `👋 Рада вітати тебе знову, ${user.fields['User_Name'] || ctx.from.first_name}!\n\n` +
    `Ось коротко про твої справи:\n\n` +
    `🎯 Колесо балансу — ${wheelLine}\n` +
    `🔥 Активність — ${streakLine}\n` +
    `📊 Остання сесія — ${lastStr}\n\n` +
    `Обирай дію в меню 👇`;
  
  await ctx.reply(text, keyboards.mainMenuKeyboard());
  
  if (!stats?.wheelCompleted) {
    await ctx.reply(
      '🎯 **РЕКОМЕНДАЦІЯ**\n\n' +
      'Колесо балансу допомагає оцінити 8 сфер життя.\n' +
      '⏱ Займе 5-10 хвилин\n\n' +
      'Готова пройти зараз?',
      keyboards.wheelCtaInline()
    );
  }
};

export const nameActions = {
  use_telegram_name: async (ctx) => {
    console.log('👤 [nameActions] use_telegram_name');
    await ctx.answerCbQuery();
    
    const tgId = ctx.state.user.fields.TG_id;
    const name = ctx.from.first_name || 'Користувач';
    
    await updateUserFields(tgId, { 'User_Name': name });
    await updateUserStep(tgId, 'ob_email');
    await ctx.reply(`Записала: "${name}". Email:`, keyboards.kbSkipEmail());
  },
  
  enter_custom_name: async (ctx) => {
    console.log('✏️ [nameActions] enter_custom_name');
    await ctx.answerCbQuery();
    
    const tgId = ctx.state.user.fields.TG_id;
    await updateUserStep(tgId, 'ob_name_input');
    await ctx.reply('Введи імʼя (2-50 символів):');
  },
  
  skip_email: async (ctx) => {
    console.log('⏭️ [nameActions] skip_email');
    await ctx.answerCbQuery();
    
    const tgId = ctx.state.user.fields.TG_id;
    await updateUserStep(tgId, 'ob_phone');
    await ctx.reply('Email пропущено. Телефон:', keyboards.kbSkipPhone());
  },
  
  skip_phone: async (ctx) => {
    console.log('⏭️ [nameActions] skip_phone');
    await ctx.answerCbQuery();
    
    const tgId = ctx.state.user.fields.TG_id;
    
    await finalizeRegistration(tgId, {
      name: ctx.state.user.fields['User_Name'],
      email: ctx.state.user.fields.Email,
      phone: null,
    });
    
    await ctx.reply('✅ Реєстрація завершена!', keyboards.mainMenuKeyboard());
  }
};

export const textHandler = async (ctx) => {
  const { user, step } = ctx.state;
  if (!user) return;
  
  const text = ctx.message.text.trim();
  const tgId = user.fields.TG_id;
  
  const handlers = {
    ob_name_input: async () => {
      if (!isValidName(text)) {
        return ctx.reply('Імʼя: 2-50 символів. Спробуй ще:');
      }
      await updateUserFields(tgId, { 'User_Name': text });
      await updateUserStep(tgId, 'ob_email');
      await ctx.reply(`Чудово, ${text}! Email:`, keyboards.kbSkipEmail());
    },
    
    ob_email: async () => {
      if (!isValidEmail(text)) {
        return ctx.reply('Невірний email. Спробуй ще:', keyboards.kbSkipEmail());
      }
      await updateUserFields(tgId, { Email: text });
      await updateUserStep(tgId, 'ob_phone');
      await ctx.reply('Email збережено! Телефон:', keyboards.kbSkipPhone());
    },
    
    ob_phone: async () => {
      if (!isValidPhone(text)) {
        return ctx.reply('Невірний телефон. Спробуй ще:', keyboards.kbSkipPhone());
      }
      
      await finalizeRegistration(tgId, {
        name: user.fields['User_Name'],
        email: user.fields.Email,
        phone: text,
      });
      
      await ctx.reply('✅ Реєстрація завершена!', keyboards.mainMenuKeyboard());
    }
  };
  
  await handlers[step]?.();
};


export const sendRegistrationOptions = async (ctx, tgId, firstName) => {
  const webAppUrl = `https://https://star-way.pro//webapp/registration.html`;
  
  await ctx.reply(
    `👋 ${firstName}!\n\n` +
    `Обери спосіб реєстрації:`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📝 Заповнити форму', web_app: { url: webAppUrl } }],
          [{ text: '⚡ Швидка реєстрація', callback_data: 'quick_registration' }]
        ]
      }
    }
  );
};

export const sendCabinetLink = async (ctx, tgId) => {
  // const cabinetUrl = `https://https://star-way.pro/webapp/cabinet.html`;
    const cabinetUrl = `${WEBAPP_URL}/webapp/cabinet.html?tg_id=${tgId}`;

  await ctx.reply(
    '🗂️ **ТВІЙ КАБІНЕТ**\n\nВідкрий кабінет:',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔗 Відкрити кабінет', web_app: { url: cabinetUrl } }],
          [{ text: '🏠 До меню', callback_data: 'main_menu' }]
        ]
      }
    }
  );
};