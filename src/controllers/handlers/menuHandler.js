// src/controllers/handlers/menuHandler.js - ОБРОБКА КОМАНД МЕНЮ

import keyboards from '../../utils/keyboards.js';
import aiMentorController from '../../aiMentor/controllers/aiMentorController.js';
import wheelBalanceController from '../wheelBalanceController.js';

const handleCommand = async (ctx, user, text, hasAccess) => {
  console.log(`[menuHandler] Команда: "${text}", доступ: ${hasAccess}`);

  switch (text) {
    case '🤖 AI наставник':
      if (!hasAccess) {
        await showFeatureBlocked(ctx, 'AI наставник');
        return;
      }
      await aiMentorController.handleAIMentorRequest(ctx);
      break;
      
    case '🎯 Колесо балансу':
      if (!hasAccess) {
        await showFeatureBlocked(ctx, 'Колесо балансу');
        return;
      }
      await wheelBalanceController.handleWheelBalanceRequest(ctx);
      break;
      
    case '💰 Підписка':
      await showSubscriptionMenu(ctx, user);
      break;
      
    case '💎 Афірмація':
      const affirmation = getRandomAffirmation();
      await ctx.reply(`✨ ${affirmation}`, keyboards.mainMenuKeyboard());
      break;
      
    case '📊 Мій прогрес':
      if (!hasAccess) {
        await showFeatureBlocked(ctx, 'Прогрес');
        return;
      }
      await showProgress(ctx, user);
      break;
      
    case '📈 Щотижневий звіт':
      if (!hasAccess) {
        await showFeatureBlocked(ctx, 'Щотижневий звіт');
        return;
      }
      await startWeeklyReport(ctx);
      break;
      
    case '📈 Щомісячний звіт':
      if (!hasAccess) {
        await showFeatureBlocked(ctx, 'Щомісячний звіт');
        return;
      }
      await startMonthlyReport(ctx);
      break;
      
    case '❓ Допомога':
      await showHelp(ctx);
      break;
      
    case "📞 Зв'язок з нами":
      await showContact(ctx);
      break;
      
    case '📝 Інструкції':
      await showInstructions(ctx);
      break;
      
    default:
      // Невідома команда - показуємо меню
      await ctx.reply(
        '❓ Не розпізнав команду. Обери з меню нижче:',
        keyboards.mainMenuKeyboard()
      );
  }
};

// Блокування функції
const showFeatureBlocked = async (ctx, featureName) => {
  await ctx.reply(
    `🚫 ${featureName} недоступний\n\n` +
    `❌ Потрібна активна підписка.\n\n` +
    `💰 Активуй підписку:`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎁 Пробний період 7 днів', callback_data: 'activate_trial' }],
          [{ text: '💰 Переглянути плани', callback_data: 'subscription_plans' }],
          [{ text: '🏠 До меню', callback_data: 'main_menu' }]
        ]
      }
    }
  );
};

// Меню підписки
const showSubscriptionMenu = async (ctx, user) => {
  const status = user?.['Active_Subscription_Status'] || '❌ Неактивна';
  
  await ctx.reply(`💰 ПІДПИСКА:\n\n${status}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📋 Детальна інформація', callback_data: 'subscription_info' }],
        [{ text: '🔄 Оновити статус', callback_data: 'sync_subscription' }],
        [{ text: '💰 Плани підписки', callback_data: 'subscription_plans' }],
        [{ text: '🏠 До меню', callback_data: 'main_menu' }]
      ]
    }
  });
};

// Прогрес
const showProgress = async (ctx, user) => {
  await ctx.reply('📊 ПРОГРЕС\n\nТут буде статистика твого прогресу...', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📊 Колесо балансу', callback_data: 'wheel_stats' }],
        [{ text: '🤖 AI діалоги', callback_data: 'ai_report' }],
        [{ text: '🏠 До меню', callback_data: 'main_menu' }]
      ]
    }
  });
};

// Щотижневий звіт
const startWeeklyReport = async (ctx) => {
  const message = 
    `📊 ЩОТИЖНЕВИЙ ЗВІТ\n\n` +
    `Час проаналізувати тиждень та скоригувати стратегію.\n\n` +
    `⏱ Займе 5 хвилин`;

  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📊 Почати аналіз', callback_data: 'start_weekly' }],
        [{ text: '📈 Готовий звіт', callback_data: 'get_weekly_report' }],
        [{ text: '🏠 До меню', callback_data: 'main_menu' }]
      ]
    }
  });
};

// Щомісячний звіт
const startMonthlyReport = async (ctx) => {
  const message = 
    `📅 ЩОМІСЯЧНИЙ ЗВІТ\n\n` +
    `Глибокий аналіз місяця та колесо балансу.\n\n` +
    `⏱ Займе 10-15 хвилин`;

  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📅 Почати аналіз', callback_data: 'start_monthly' }],
        [{ text: '🎯 Нове колесо балансу', callback_data: 'wheel_start' }],
        [{ text: '📊 Готовий звіт', callback_data: 'get_monthly_report' }],
        [{ text: '🏠 До меню', callback_data: 'main_menu' }]
      ]
    }
  });
};

// Допомога
const showHelp = async (ctx) => {
  const message = 
    `❓ ДОПОМОГА\n\n` +
    `При питаннях або технічних проблемах:\n\n` +
    `📧 Email: nadyastarway@gmail.com\n` +
    `💬 Telegram: @Nadya2316\n\n` +
    `⏰ Відповідаємо протягом 2-4 годин у робочі дні.`;
    
  await ctx.reply(message, keyboards.mainMenuKeyboard());
};

// Контакти
const showContact = async (ctx) => {
  const message = 
    `📞 ЗВ'ЯЗОК З НАМИ\n\n` +
    `💬 **ТЕХПІДТРИМКА:**\n` +
    `Email: nadyastarway@gmail.com\n` +
    `Telegram: @Nadya2316 (ментор)\n` +
    `Telegram: @vira_333 (техпідтримка)\n\n` +
    `📋 **ПИТАННЯ ПРО ПІДПИСКУ:**\n` +
    `Пишіть з вказівкою Telegram ID: ${ctx.from.id}\n\n` +
    `⏰ **ЧАС ВІДПОВІДІ:**\n` +
    `2-4 години у робочі дні`;
    
  await ctx.reply(message, keyboards.mainMenuKeyboard());
};

// Інструкції
const showInstructions = async (ctx) => {
  const message = 
    `📝 ЯК КОРИСТУВАТИСЯ\n\n` +
    `🚀 **ПОЧАТОК:**\n` +
    `/start → реєстрація → підписка → колесо балансу\n\n` +
    `📊 **ЩОДНЯ:**\n` +
    `🌞 Ранкові питання (08:00)\n` +
    `🌙 Вечірні питання (21:30)\n` +
    `🤖 AI наставник для підтримки\n\n` +
    `📈 **АНАЛІТИКА:**\n` +
    `📊 Щотижневі звіти\n` +
    `📅 Щомісячні звіти\n` +
    `🎯 Колесо балансу (щомісяця)\n\n` +
    `💡 Відповідай щиро, використовуй AI наставника`;
    
  await ctx.reply(message, keyboards.mainMenuKeyboard());
};

// Випадкова афірмація
const getRandomAffirmation = () => {
  const affirmations = [
    'Моя енергія створює позитивні зміни',
    'Я заслуговую на все найкраще прямо зараз', 
    'Моя рішучість творить нові можливості',
    'Щодня я впевнено просуваюся до мети',
    'Дія — це моя мова проти страху',
    'Кожне рішення прокачує мою рішучість',
    'Впевненість і рішучість — мої інструменти'
  ];
  return affirmations[Math.floor(Math.random() * affirmations.length)];
};

export default { 
  handleCommand,
  showFeatureBlocked,
  showSubscriptionMenu,
  showProgress,
  startWeeklyReport,
  startMonthlyReport,
  showHelp,
  showContact,
  showInstructions
};