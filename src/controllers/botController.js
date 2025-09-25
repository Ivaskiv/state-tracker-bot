// src/controllers/botController.js - ВИПРАВЛЕНО: ВИДАЛЕНО ДУБЛЮВАННЯ ІМПОРТІВ

import userService from '../auth/services/userService.js';
import subscriptionService from '../auth/services/subscriptionService.js';
import paymentService from '../auth/services/paymentService.js';
import wheelBalanceController from './wheelBalanceController.js';
import aiMentorController from '../aiMentor/controllers/aiMentorController.js';
import { aiMentorSession } from '../aiMentor/session.js';
import { handleStart, handleRegistrationStep, handleOnboardingCallback } from '../auth/modules/auth.js';
import keyboards from '../utils/keyboards.js';
import { ANSWER_STEPS } from '../config/constants.js';

// Імпорт dailyQuestionsController буде динамічним щоб уникнути циклічних залежностей
let dailyQuestionsController = null;

const botController = (bot) => {
  console.log('[botController] ✅ Ініціалізація...');

  // /start команда - ОПТИМІЗОВАНО
  bot.start(async (ctx) => {
    const tgId = ctx.from.id;
    const name = ctx.from.first_name || 'Користувач';
    
    console.log(`🚀 /start від ${tgId} (${name})`);

    try {
      // 1. Перевіряємо чи користувач зареєстрований
      const user = await userService.getUserByTelegramId(tgId);
      
      if (!user) {
        console.log(`🆕 [start] Новий користувач ${tgId} - запуск реєстрації`);
        await handleStart(ctx);
        return;
      }

      // 2. Користувач є - перевіряємо підписку
      const hasActiveSubscription = userService.hasActiveAccess(user);
      
      if (!hasActiveSubscription) {
        console.log(`⚠️ [start] Користувач ${tgId} без активної підписки`);
        
        // Перевіряємо чи це перша відмова підписки - даємо пробну
        const hasTrialBefore = await checkTrialHistory(tgId);
        
        if (!hasTrialBefore) {
          await activateTrialAndStartWheel(ctx, user);
          return;
        }
        
        // Вже був пробний період - показуємо платні плани
        await showSubscriptionPlans(ctx, user);
        return;
      }

      // 3. Підписка активна - перевіряємо перше колесо
      const hasCompletedFirstWheel = await checkFirstWheelCompletion(tgId);
      
      if (!hasCompletedFirstWheel) {
        console.log(`🎯 [start] Користувач ${tgId} не завершив перше колесо`);
        await startFirstWheel(ctx, user);
        return;
      }

      // 4. Все готово - доступ до повного функціоналу
      console.log(`✅ [start] Повний доступ для ${tgId}`);
      await showMainMenu(ctx, user);

    } catch (error) {
      console.error('[start] Критична помилка:', error);
      await ctx.reply('❌ Помилка. Спробуй ще раз /start');
    }
  });

  // Текстові повідомлення - ОПТИМІЗОВАНО
  bot.on('text', async (ctx) => {
    const tgId = ctx.from.id;
    const text = ctx.message?.text?.trim();
    
    if (!text) return;
    
    console.log(`💬 Текст від ${tgId}: "${text}"`);

    try {
      // 1. Онбординг має найвищий пріоритет
      const isOnboarding = await handleRegistrationStep(ctx);
      if (isOnboarding) return;

      // 2. Перевіряємо чи користувач зареєстрований
      const user = await userService.getUserByTelegramId(tgId);
      if (!user || !user['UserRegistered']) {
        await ctx.reply('Спочатку зареєструйся /start');
        return;
      }

      // 3. Перевіряємо активні сесії
      const step = user.Answer_Step;
      
      // AI Наставник активний
      if (aiMentorSession.isActive(tgId)) {
        await aiMentorController.handleAIMentorQuestion(ctx, text);
        return;
      }
      
      // Колесо балансу активне
      if (step === 'WheelBalance') {
        await wheelBalanceController.handleWheelNoteText(ctx);
        return;
      }
      
      // Ранкові питання активні
      if (step && step.startsWith('Q_m_')) {
        if (!dailyQuestionsController) {
          dailyQuestionsController = (await import('./dailyQuestionsController.js')).default;
        }
        const handled = await dailyQuestionsController.handleMorningAnswer(ctx, text);
        if (handled) return;
      }
      
      // Вечірні питання активні
      if (step && step.startsWith('Q_e_')) {
        if (!dailyQuestionsController) {
          dailyQuestionsController = (await import('./dailyQuestionsController.js')).default;
        }
        const handled = await dailyQuestionsController.handleEveningAnswer(ctx, text);
        if (handled) return;
      }

      // 4. Перевіряємо чи заблокована сесія
      if (await isActiveSession(tgId)) {
        await handleBlockedMenu(ctx);
        return;
      }

      // 5. Перевіряємо підписку для функцій
      const hasAccess = userService.hasActiveAccess(user);
      
      // 6. Обробка команд меню
      await handleMenuCommand(ctx, user, text, hasAccess);

    } catch (error) {
      console.error('❌ Помилка text handler:', error);
      await ctx.reply('❌ Помилка. Спробуйте ще раз.', keyboards.mainMenuKeyboard());
    }
  });

  // Callback queries - ОПТИМІЗОВАНО
  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const tgId = ctx.from.id;

    console.log(`📱 Callback: ${data} від ${tgId}`);

    try {
      // Онбординг callbacks
      if (await handleOnboardingCallback(ctx)) {
        return;
      }

      // Щоденні сесії callbacks
      if (data === 'start_morning') {
        if (!dailyQuestionsController) {
          dailyQuestionsController = (await import('./dailyQuestionsController.js')).default;
        }
        await dailyQuestionsController.startMorningSession(ctx);
        await ctx.answerCbQuery('Почали ранкову рефлексію');
        return;
      }
      
      if (data === 'start_evening') {
        if (!dailyQuestionsController) {
          dailyQuestionsController = (await import('./dailyQuestionsController.js')).default;
        }
        await dailyQuestionsController.startEveningSession(ctx);
        await ctx.answerCbQuery('Почали вечірню рефлексію');
        return;
      }
      
      if (data === 'exit_morning') {
        if (!dailyQuestionsController) {
          dailyQuestionsController = (await import('./dailyQuestionsController.js')).default;
        }
        await dailyQuestionsController.exitSession(ctx, 'morning');
        await ctx.answerCbQuery('Ранкову сесію завершено');
        return;
      }
      
      if (data === 'exit_evening') {
        if (!dailyQuestionsController) {
          dailyQuestionsController = (await import('./dailyQuestionsController.js')).default;
        }
        await dailyQuestionsController.exitSession(ctx, 'evening');
        await ctx.answerCbQuery('Вечірню сесію завершено');
        return;
      }

      // AI наставник callbacks
      if (data.startsWith('ai_')) {
        await aiMentorController.handleAIMentorCallback(ctx);
        return;
      }

      // Колесо балансу callbacks
      if (data.startsWith('wheel_') || data.startsWith('mw_')) {
        await wheelBalanceController.handleWheelCallback(ctx);
        return;
      }

      // Підписка callbacks
      if (data.startsWith('plan_') || data === 'subscription_plans' || data.startsWith('subscribe_')) {
        await handleSubscriptionCallback(ctx, data);
        return;
      }

      // Сесійні callbacks
      if (data.startsWith('continue_') || data.startsWith('exit_')) {
        await handleSessionControl(ctx, data);
        return;
      }

      await ctx.answerCbQuery('Команда не розпізнана');

    } catch (error) {
      console.error(`❌ Помилка callback ${data}:`, error);
      await ctx.answerCbQuery('Помилка');
    }
  });

  console.log('✅ Bot controller ініціалізовано');
  return { bot };
};

// ========== ДОПОМІЖНІ ФУНКЦІЇ ==========

// Активація пробної підписки та запуск першого колеса
const activateTrialAndStartWheel = async (ctx, user) => {
  const tgId = ctx.from.id;
  
  try {
    // Активуємо пробну підписку 7 днів
    const activated = await paymentService.activateTrialSubscription(tgId, 7);
    
    if (activated) {
      console.log(`🧪 [start] Пробна підписка активована для ${tgId}`);
      
      // Запускаємо перше колесо
      await startFirstWheel(ctx, user);
    } else {
      await showSubscriptionPlans(ctx, user);
    }
  } catch (error) {
    console.error('[activateTrialAndStartWheel] Помилка:', error);
    await showSubscriptionPlans(ctx, user);
  }
};

// Перевірка історії пробної підписки
const checkTrialHistory = async (tgId) => {
  try {
    const { getBase, tables } = await import('../config/database.js');
    const base = getBase();
    
    const records = await base(tables.SUBSCRIPTIONS)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", FIND("Пробний", {Plan_Name}) > 0)`,
        maxRecords: 1
      })
      .firstPage();
    
    return records.length > 0;
  } catch (error) {
    console.error('[checkTrialHistory] Помилка:', error);
    return false;
  }
};

// Перевірка завершення першого колеса
const checkFirstWheelCompletion = async (tgId) => {
  try {
    const { getBase, tables } = await import('../config/database.js');
    const base = getBase();
    
    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Status}="Completed")`,
        maxRecords: 1
      })
      .firstPage();
    
    return records.length > 0;
  } catch (error) {
    console.error('[checkFirstWheelCompletion] Помилка:', error);
    return false;
  }
};

// Запуск першого колеса
const startFirstWheel = async (ctx, user) => {
  const userName = user['User Name'] || ctx.from.first_name || 'Користувач';
  
  const message = 
    `🎯 ПЕРШЕ КОЛЕСО БАЛАНСУ\n\n` +
    `Привіт, ${userName}! 👋\n\n` +
    `Для персоналізації AI-наставника потрібно заповнити колесо балансу.\n\n` +
    `📊 Оцініш 8 ключових сфер життя\n` +
    `🎯 Отримаєш персональні рекомендації\n` +
    `⏱ Займе 5-10 хвилин\n\n` +
    `Готова почати?`;

  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎯 Почати колесо балансу', callback_data: 'wheel_start' }],
        [{ text: '❓ Що це таке?', callback_data: 'wheel_info' }]
      ]
    }
  });
};

// Показати головне меню
const showMainMenu = async (ctx, user) => {
  const userName = user['User Name'] || ctx.from.first_name || 'Користувач';
  const status = user['Active_Subscription_Status'] || '';
  
  const message = 
    `🎉 Вітаю, ${userName}!\n\n` +
    `✅ ${status}\n` +
    `🚀 Готова до продуктивного дня?`;

  await ctx.reply(message, keyboards.mainMenuKeyboard());
};

// Показати плани підписки
const showSubscriptionPlans = async (ctx, user) => {
  const userName = user['User Name'] || ctx.from.first_name || 'Користувач';
  
  const message = 
    `👋 З поверненням, ${userName}!\n\n` +
    `💡 Для повного доступу активуй підписку:\n\n` +
    `🎯 AI коучинг 24/7\n` +
    `📊 Колесо балансу\n` +
    `📈 Персональна аналітика`;

  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💰 Переглянути плани', callback_data: 'subscription_plans' }],
        [{ text: '🏠 До меню', callback_data: 'main_menu' }]
      ]
    }
  });
};

// Обробка команд меню
const handleMenuCommand = async (ctx, user, text, hasAccess) => {
  switch (text) {
    case '🤖 AI наставник':
      if (!hasAccess) {
        await showSubscriptionRequired(ctx, 'AI наставник');
        return;
      }
      await aiMentorController.handleAIMentorRequest(ctx);
      break;
      
    case '🎯 Колесо балансу':
      if (!hasAccess) {
        await showSubscriptionRequired(ctx, 'Колесо балансу');
        return;
      }
      await wheelBalanceController.handleWheelBalanceRequest(ctx);
      break;
      
    case '💰 Підписка':
      await showSubscriptionInfo(ctx, user);
      break;
      
    case '💎 Афірмація':
      const affirmation = getRandomAffirmation();
      await ctx.reply(`✨ ${affirmation}`, keyboards.mainMenuKeyboard());
      break;
      
    case '📊 Мій прогрес':
      if (!hasAccess) {
        await showSubscriptionRequired(ctx, 'Прогрес');
        return;
      }
      await showProgress(ctx, user);
      break;
      
    case '📈 Щотижневий звіт':
      if (!hasAccess) {
        await showSubscriptionRequired(ctx, 'Щотижневий звіт');
        return;
      }
      await startWeeklyReport(ctx, user);
      break;
      
    case '📈 Щомісячний звіт':
      if (!hasAccess) {
        await showSubscriptionRequired(ctx, 'Щомісячний звіт');
        return;
      }
      await startMonthlyReport(ctx, user);
      break;
      
    case '❓ Допомога':
      await ctx.reply('❓ ДОПОМОГА\n\nЯкщо виникли питання — пишіть на nadyastarway@gmail.com', keyboards.mainMenuKeyboard());
      break;
      
    case "📞 Зв'язок з нами":
      await ctx.reply('📞 ЗВ\'ЯЗОК З НАМИ\n\nEmail: nadyastarway@gmail.com\nTelegram: @Nadya2316', keyboards.mainMenuKeyboard());
      break;
      
    case '📝 Інструкції':
      await showInstructions(ctx);
      break;
      
    default:
      await ctx.reply('Оберіть пункт з меню нижче:', keyboards.mainMenuKeyboard());
  }
};

// Показати що потрібна підписка
const showSubscriptionRequired = async (ctx, featureName) => {
  await ctx.reply(
    `🚫 ${featureName} недоступний\n\n` +
    `❌ Потрібна активна підписка для доступу до цієї функції.\n\n` +
    `💰 Активуй підписку для повного доступу.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💰 Переглянути плани', callback_data: 'subscription_plans' }],
          [{ text: '🏠 До меню', callback_data: 'main_menu' }]
        ]
      }
    }
  );
};

// Перевірка активних сесій
const isActiveSession = async (tgId) => {
  try {
    const user = await userService.getUserByTelegramId(tgId);
    const step = user?.Answer_Step;
    
    return (
      aiMentorSession.isActive(tgId) ||
      step === 'WheelBalance' ||
      (step && (step.startsWith('Q_m_') || step.startsWith('Q_e_')))
    );
  } catch (error) {
    console.error('[isActiveSession] Помилка:', error);
    return false;
  }
};

// Блокування меню під час сесій
const handleBlockedMenu = async (ctx) => {
  const tgId = ctx.from.id;
  const user = await userService.getUserByTelegramId(tgId);
  const step = user?.Answer_Step;
  
  let sessionType = 'сесія';
  
  if (aiMentorSession.isActive(tgId)) {
    sessionType = 'AI наставник';
  } else if (step === 'WheelBalance') {
    sessionType = 'колесо балансу';
  } else if (step && step.startsWith('Q_m_')) {
    sessionType = 'ранкова рефлексія';
  } else if (step && step.startsWith('Q_e_')) {
    sessionType = 'вечірня рефлексія';
  }

  const message = 
    `⚠️ Зараз іде ${sessionType}\n\n` +
    `Завершимо поточну сесію?`;

  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔁 Продовжити', callback_data: 'continue_session' }],
        [{ text: '🚪 Вийти із сесії', callback_data: 'exit_session' }]
      ]
    }
  });
};

// Обробка контролю сесій
const handleSessionControl = async (ctx, data) => {
  const tgId = ctx.from.id;
  const user = await userService.getUserByTelegramId(tgId);
  const step = user?.Answer_Step;

  if (data === 'continue_session') {
    if (aiMentorSession.isActive(tgId)) {
      await ctx.reply('💬 Продовжуємо діалог з AI наставником. Напиши своє питання!', keyboards.aiMentorControlKeyboard());
    } else if (step === 'WheelBalance') {
      await ctx.reply('🎯 Продовжуємо колесо балансу...');
      // Тут буде логіка продовження колеса
    } else if (step && step.startsWith('Q_m_')) {
      if (!dailyQuestionsController) {
        dailyQuestionsController = (await import('./dailyQuestionsController.js')).default;
      }
      const questionNumber = parseInt(step.split('_')[2]);
      await dailyQuestionsController.askMorningQuestion(ctx, questionNumber);
    } else if (step && step.startsWith('Q_e_')) {
      if (!dailyQuestionsController) {
        dailyQuestionsController = (await import('./dailyQuestionsController.js')).default;
      }
      const questionNumber = parseInt(step.split('_')[2]);
      await dailyQuestionsController.askEveningQuestion(ctx, questionNumber);
    }
    await ctx.answerCbQuery('Продовжуємо сесію');
    
  } else if (data === 'exit_session') {
    if (aiMentorSession.isActive(tgId)) {
      aiMentorSession.end(tgId);
    } else if (step === 'WheelBalance') {
      await wheelBalanceController.handleWheelCallback(ctx); // Делегуємо до wheel controller
    } else if (step && (step.startsWith('Q_m_') || step.startsWith('Q_e_'))) {
      const sessionType = step.startsWith('Q_m_') ? 'morning' : 'evening';
      if (!dailyQuestionsController) {
        dailyQuestionsController = (await import('./dailyQuestionsController.js')).default;
      }
      await dailyQuestionsController.exitSession(ctx, sessionType);
    }
    
    await userService.updateUserActivity(tgId);
    await ctx.reply('🏠 Повернулися до головного меню', keyboards.mainMenuKeyboard());
    await ctx.answerCbQuery('Сесію завершено');
  }
};

// Запуск щотижневого звіту
const startWeeklyReport = async (ctx, user) => {
  const message = 
    `📊 ЩОТИЖНЕВИЙ ЗВІТ\n\n` +
    `Час проаналізувати тиждень та скоригувати стратегію.\n\n` +
    `⏱ Займе 5 хвилин`;

  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📊 Почати аналіз', callback_data: 'start_weekly' }],
        [{ text: '📈 Отримати готовий звіт', callback_data: 'get_weekly_report' }]
      ]
    }
  });
};

// Запуск щомісячного звіту
const startMonthlyReport = async (ctx, user) => {
  const message = 
    `📅 ЩОМІСЯЧНИЙ ЗВІТ\n\n` +
    `Глибокий аналіз місяця та колесо балансу.\n\n` +
    `⏱ Займе 10-15 хвилин`;

  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📅 Почати аналіз', callback_data: 'start_monthly' }],
        [{ text: '🎯 Нове колесо балансу', callback_data: 'wheel_start' }],
        [{ text: '📊 Отримати звіт', callback_data: 'get_monthly_report' }]
      ]
    }
  });
};

// Показати інструкції
const showInstructions = async (ctx) => {
  const message = 
    `📝 ЯК КОРИСТУВАТИСЯ БОТОМ\n\n` +
    `🚀 **ПОЧАТОК РОБОТИ:**\n` +
    `• Пройди реєстрацію /start\n` +
    `• Заповни перше колесо балансу\n` +
    `• Активуй підписку для повного доступу\n\n` +
    `📊 **ЩОДЕННА РОБОТА:**\n` +
    `• 🌞 Ранкові питання (08:00) - 6 питань для фокусу\n` +
    `• 🌙 Вечірні питання (21:30) - 5 питань для аналізу\n` +
    `• 🤖 AI наставник - персональна підтримка\n` +
    `• 💎 Афірмації - щоденна мотивація\n\n` +
    `📈 **АНАЛІТИКА:**\n` +
    `• 📊 Щотижневі звіти - аналіз прогресу\n` +
    `• 📅 Щомісячні звіти - глибока аналітика\n` +
    `• 🎯 Колесо балансу - оцінка 8 сфер життя\n\n` +
    `💡 **ПОРАДИ:**\n` +
    `• Відповідай щиро на питання\n` +
    `• Використовуй AI наставника для підтримки\n` +
    `• Переглядай звіти для усвідомлення прогресу\n` +
    `• При проблемах пиши в "📞 Зв'язок з нами"`;

  await ctx.reply(message, keyboards.mainMenuKeyboard());
};

// Інші допоміжні функції...
const getRandomAffirmation = () => {
  const affirmations = [
    'Моя енергія створює позитивні зміни',
    'Я заслуговую на все найкраще прямо зараз',
    'Моя рішучість творить нові можливості',
    'Щодня я впевнено просуваюся до мети',
    'Я довіряю своїй інтуїції та внутрішній силі',
    'Дія — це моя мова проти страху',
    'Кожне рішення прокачує мою рішучність',
    'Впевненість і рішучість — мої інструменти досягнення цілей'
  ];
  return affirmations[Math.floor(Math.random() * affirmations.length)];
};

const showSubscriptionInfo = async (ctx, user) => {
  const status = user['Active_Subscription_Status'] || '❌ Неактивна';
  await ctx.reply(`💰 ПІДПИСКА: ${status}`, keyboards.subscriptionKeyboard());
};

const showProgress = async (ctx, user) => {
  await ctx.reply('📊 ПРОГРЕС\n\nТут буде ваша статистика прогресу за останні тижні та місяці...', keyboards.mainMenuKeyboard());
};

const handleSubscriptionCallback = async (ctx, data) => {
  // Делегуємо до subscriptionController
  try {
    const subscriptionController = await import('./subscriptionController.js');
    await subscriptionController.default.handleCallback(ctx);
  } catch (error) {
    console.error('[handleSubscriptionCallback] Помилка:', error);
    await ctx.answerCbQuery('Помилка обробки підписки');
  }
};

export default botController;