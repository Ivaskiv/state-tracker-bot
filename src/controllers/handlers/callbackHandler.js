// src/controllers/handlers/callbackHandler.js - ОБРОБКА CALLBACK QUERIES

import { handleOnboardingCallback } from '../../auth/modules/auth.js';
import keyboards from '../../utils/keyboards.js';
import aiMentorController from '../../aiMentor/controllers/aiMentorController.js';
import wheelBalanceController from '../wheelBalanceController.js';
import sessionHandler from './sessionHandler.js';
import menuHandler from './menuHandler.js';

const handle = async (ctx, userService) => {
  const data = ctx.callbackQuery.data;
  const tgId = ctx.from.id;

  console.log(`📱 [callbackHandler] Callback: ${data} від ${tgId}`);

  try {
    // Відповідаємо на callback query відразу щоб уникнути timeout
    await ctx.answerCbQuery();

    // СПЕЦІАЛЬНІ КОМАНДИ
    if (data === 'restart') {
      await ctx.reply('🔄 Перезапуск...');
      setTimeout(() => {
        ctx.telegram.sendMessage(tgId, '/start');
      }, 500);
      return;
    }

    // ОНБОРДИНГ CALLBACKS
    if (await handleOnboardingCallback(ctx)) {
      return;
    }

    // ЩОДЕННІ СЕСІЇ
    if (data === 'start_morning' || data === 'start_evening') {
      await handleDailySession(ctx, data);
      return;
    }

    if (data.startsWith('exit_') && (data.includes('morning') || data.includes('evening'))) {
      await handleDailyExit(ctx, data);
      return;
    }

    // AI НАСТАВНИК
    if (data.startsWith('ai_')) {
      await aiMentorController.handleAIMentorCallback(ctx);
      return;
    }

    // КОЛЕСО БАЛАНСУ
    if (data.startsWith('wheel_') || data.startsWith('mw_')) {
      await wheelBalanceController.handleWheelCallback(ctx);
      return;
    }

    // ПІДПИСКИ
    if (data.startsWith('plan_') || data === 'subscription_plans' || 
        data.startsWith('subscribe_') || data === 'subscription_info' ||
        data === 'sync_subscription' || data === 'activate_trial') {
      await handleSubscriptionCallback(ctx, data);
      return;
    }

    // СЕСІЙНІ CALLBACKS
    if (data.startsWith('continue_') || data.startsWith('exit_')) {
      await sessionHandler.handleSessionControl(ctx, data);
      return;
    }

    // МЕНЮ CALLBACKS
    if (data === 'main_menu') {
      try {
        const user = await userService.getUserByTelegramId(tgId);
        await showMainMenu(ctx, user);
      } catch (error) {
        await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
      }
      return;
    }

    // ШВИДКІ ДІЇ
    if (data === 'my_progress') {
      try {
        const user = await userService.getUserByTelegramId(tgId);
        await menuHandler.showProgress(ctx, user);
      } catch (error) {
        await ctx.reply('📊 Завантаження прогресу...', keyboards.mainMenuKeyboard());
      }
      return;
    }

    if (data === 'wheel_balance') {
      await wheelBalanceController.handleWheelBalanceRequest(ctx);
      return;
    }

    if (data === 'ai_mentor') {
      await aiMentorController.handleAIMentorRequest(ctx);
      return;
    }

    if (data === 'contact_support') {
      await menuHandler.showContact(ctx);
      return;
    }

    // ЗВІТИ
    if (data === 'start_weekly' || data === 'get_weekly_report') {
      await menuHandler.startWeeklyReport(ctx);
      return;
    }

    if (data === 'start_monthly' || data === 'get_monthly_report') {
      await menuHandler.startMonthlyReport(ctx);
      return;
    }

    console.log(`❓ [callbackHandler] Невідома команда: ${data}`);

  } catch (error) {
    console.error(`❌ [callbackHandler] Помилка ${data}:`, error);
    try {
      await ctx.answerCbQuery('Помилка обробки');
    } catch (answerError) {
      console.error('Помилка answerCbQuery:', answerError);
    }
  }
};

// Обробка щоденних сесій
const handleDailySession = async (ctx, data) => {
  try {
    const dailyController = await import('../dailyQuestionsController.js');
    
    if (data === 'start_morning') {
      await dailyController.default.startMorningSession(ctx);
    } else if (data === 'start_evening') {
      await dailyController.default.startEveningSession(ctx);
    }
  } catch (error) {
    console.error('[handleDailySession] Помилка:', error);
    await ctx.reply('❌ Помилка запуску сесії. Спробуй пізніше.');
  }
};

// Вихід з щоденних сесій
const handleDailyExit = async (ctx, data) => {
  try {
    const dailyController = await import('../dailyQuestionsController.js');
    const sessionType = data.includes('morning') ? 'morning' : 'evening';
    
    await dailyController.default.exitSession(ctx, sessionType);
  } catch (error) {
    console.error('[handleDailyExit] Помилка:', error);
    await ctx.reply('🏠 Повертаємося до меню', keyboards.mainMenuKeyboard());
  }
};

// Обробка підписок
const handleSubscriptionCallback = async (ctx, data) => {
  try {
    const subscriptionController = await import('../subscriptionController.js');
    await subscriptionController.default.handleCallback(ctx);
  } catch (error) {
    console.error('[handleSubscriptionCallback] Помилка:', error);
    await ctx.reply('❌ Помилка підписки. Спробуй пізніше.', keyboards.mainMenuKeyboard());
  }
};

// Показ головного меню
const showMainMenu = async (ctx, user) => {
  const userName = user?.['User Name'] || ctx.from.first_name || 'Користувач';
  const status = user?.['Active_Subscription_Status'] || '✅ Активна';
  
  const message = 
    `🏠 Головне меню\n\n` +
    `👋 ${userName}\n` +
    `${status}`;

  await ctx.reply(message, keyboards.mainMenuKeyboard());
};

export default { handle };