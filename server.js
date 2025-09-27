// server.js - ПРАВИЛЬНИЙ З AUTH СИСТЕМОЮ

import dotenv from 'dotenv';
dotenv.config();

import { Telegraf, session } from 'telegraf';

// Імпорти auth системи
import { handleStart, handleRegistrationStep, handleOnboardingCallback } from './src/auth/modules/auth.js';
import userService from './src/auth/services/userService.js';

// Імпорти контролерів
import mainFlowController from './src/controllers/flows/mainFlowController.js';
import registrationController from './src/controllers/flows/registrationController.js';
import dailyController from './src/controllers/flows/dailyController.js';
import wheelController from './src/controllers/flows/wheelController.js';
import aiMentorController from './src/aiMentor/controllers/aiMentorController.js';
import subscriptionController from './src/controllers/subscriptionController.js';

// Імпорти утиліт
import keyboards from './src/utils/keyboards.js';
import { testConnection } from './src/config/database.js';

async function start() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN відсутній у .env');
    process.exit(1);
  }

  console.log('🚀 [SERVER] Запуск бота з auth системою...');

  // Створюємо бота
  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, { 
    handlerTimeout: 90000 // 90 секунд
  });

  // Знімаємо старий вебхук
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: false });
    console.log('🧹 [SERVER] Webhook очищено');
  } catch (e) {
    console.warn('⚠️ deleteWebhook:', e.message);
  }

  // Ініціалізуємо session
  bot.use(session({
    defaultSession: () => ({
      step: undefined,
      temp: {},
      wheel: null,
      ai: null
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
  bot.start(async (ctx) => {
    const tgId = ctx.from.id;
    console.log(`🚀 [/start] від ${tgId}`);
    
    try {
      // Ініціалізуємо сесію
      ctx.session = ctx.session || { step: undefined, temp: {} };
      
      // Використовуємо auth систему
      await handleStart(ctx);
      
    } catch (err) {
      console.error('[SERVER] ❌ start error:', err);
      try { 
        await ctx.reply('❌ Помилка. Спробуй /start', keyboards.mainMenuKeyboard()); 
      } catch {}
    }
  });

  // ===== ОБРОБКА ТЕКСТУ =====
  bot.on('text', async (ctx) => {
    // Ігноруємо команди
    if (ctx.message?.entities?.some(e => e.type === 'bot_command')) return;

    const tgId = ctx.from.id;
    const text = ctx.message?.text?.trim();
    if (!text) return;

    try {
      // Ініціалізуємо сесію
      ctx.session = ctx.session || { step: undefined, temp: {} };

      // 1. РЕЄСТРАЦІЯ (найвищий пріоритет)
      const isRegistrationStep = await handleRegistrationStep(ctx);
      if (isRegistrationStep) return;

      const isRegistrationText = await registrationController.handleText(ctx);
      if (isRegistrationText) return;

      // 2. ОТРИМУЄМО КОРИСТУВАЧА
      let user = null;
      try {
        user = await userService.getUserByTelegramId(tgId);
      } catch (error) {
        console.warn('[SERVER] База недоступна:', error.message);
        await ctx.reply('⚠️ Тимчасові проблеми. Спробуй /start');
        return;
      }

      // 3. ПЕРЕВІРЯЄМО РЕЄСТРАЦІЮ
      if (!user || !user.UserRegistered) {
        await ctx.reply('Спочатку зареєструйся /start');
        return;
      }

      // 4. АКТИВНІ СЕСІЇ
      const currentStep = user?.Answer_Step || ctx.session?.step;
      
      // AI Наставник
      const { aiMentorSession } = await import('./src/aiMentor/session.js');
      if (aiMentorSession.isActive(tgId)) {
        await aiMentorController.handleAIMentorQuestion(ctx, text);
        return;
      }
      
      // Колесо балансу
      if (currentStep === 'WheelBalance') {
        await wheelController.handleText(ctx, text);
        return;
      }
      
      // Ранкові/вечірні питання
      if (currentStep?.startsWith('Q_m_') || currentStep?.startsWith('Q_e_')) {
        await dailyController.handleText(ctx, text, currentStep);
        return;
      }

      // 5. КОМАНДИ МЕНЮ
      await mainFlowController.handleText(ctx, text, user);

    } catch (error) {
      console.error('[SERVER] ❌ Text error:', error);
      try { 
        await ctx.reply('❌ Помилка. Спробуй /start', keyboards.mainMenuKeyboard()); 
      } catch {}
    }
  });

  // ===== ОБРОБКА CALLBACK =====
  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery?.data || '';
    const tgId = ctx.from.id;

    try {
      // Завжди відповідаємо на callback
      await ctx.answerCbQuery();
      
      // Ініціалізуємо сесію
      ctx.session = ctx.session || { step: undefined, temp: {} };

      // 1. ОНБОРДИНГ CALLBACKS (найвищий пріоритет)
      const isOnboardingCallback = await handleOnboardingCallback(ctx);
      if (isOnboardingCallback) return;

      // 2. РЕЄСТРАЦІЯ CALLBACKS
      const isRegistrationCallback = await registrationController.handleCallback(ctx, data);
      if (isRegistrationCallback) return;

      // 3. AI НАСТАВНИК
      if (data.startsWith('ai_')) {
        await aiMentorController.handleAIMentorCallback(ctx);
        return;
      }

      // 4. КОЛЕСО БАЛАНСУ
      if (data.startsWith('wheel_')) {
        await wheelController.handleCallback(ctx, data);
        return;
      }

      // 5. ЩОДЕННІ ПИТАННЯ
      if (data.includes('morning') || data.includes('evening')) {
        await dailyController.handleCallback(ctx, data);
        return;
      }

      // 6. ПІДПИСКИ
      if (data.startsWith('subscribe_') || data === 'subscription_plans' || 
          data === 'subscription_info' || data === 'sync_subscription' || 
          data === 'activate_trial' || data === 'contact_support') {
        await subscriptionController.handleCallback(ctx);
        return;
      }

      // 7. ОСНОВНІ CALLBACKS
      const user = await userService.getUserByTelegramId(tgId);
      await mainFlowController.handleCallback(ctx, data, user);

    } catch (error) {
      console.error('[SERVER] ❌ Callback error:', error);
      try { 
        await ctx.answerCbQuery('Помилка обробки'); 
      } catch {}
    }
  });

  // ===== ДОДАТКОВІ КОМАНДИ =====
  
  // Тестова команда для колеса
  bot.command('wheel', async (ctx) => {
    try {
      await wheelController.handleRequest(ctx);
    } catch (error) {
      console.error('[SERVER] ❌ wheel command error:', error);
      await ctx.reply('❌ Помилка запуску колеса');
    }
  });

  // Health check
  bot.command('health', async (ctx) => {
    try {
      const dbStatus = await testConnection();
      await ctx.reply(`✅ Бот працює\n📊 База: ${dbStatus.success ? 'OK' : 'ERROR'}`);
    } catch (error) {
      await ctx.reply('❌ Помилка health check');
    }
  });

  // ===== ГЛОБАЛЬНА ОБРОБКА ПОМИЛОК =====
  bot.catch(async (err, ctx) => {
    console.error('❌ [SERVER] Global bot error:', err);
    try {
      await ctx.reply('❌ Виникла помилка. Спробуй /start', keyboards.mainMenuKeyboard());
    } catch {}
  });

  // ===== ЗАПУСК БОТА =====
  await bot.launch();
  const me = await bot.telegram.getMe();
  console.log(`🚀 [SERVER] Bot launched as @${me.username} (id=${me.id})`);

  // ===== ТЕСТ БАЗИ ДАНИХ =====
  setTimeout(async () => {
    try {
      const dbTest = await testConnection();
      if (dbTest.success) {
        console.log('✅ [SERVER] Database connection успішний');
      } else {
        console.error('❌ [SERVER] Database connection помилка:', dbTest.error);
      }
    } catch (error) {
      console.error('❌ [SERVER] Database test error:', error);
    }
  }, 3000);

  // ===== ПЛАНУВАЛЬНИК =====
  setTimeout(async () => {
    try {
      const { startScheduler } = await import('./src/utils/scheduler.js');
      await startScheduler(bot);
      console.log('⏰ [SERVER] Scheduler запущено');
    } catch (error) {
      console.error('❌ [SERVER] Scheduler помилка:', error);
    }
  }, 5000);

  // ===== GRACEFUL SHUTDOWN =====
  const gracefulShutdown = async (signal) => {
    console.log(`🛑 [SERVER] ${signal} отримано, зупинка...`);
    try {
      await bot.stop(signal);
      console.log('✅ [SERVER] Bot зупинено');
    } catch (error) {
      console.error('❌ [SERVER] Помилка при зупинці:', error);
    } finally {
      process.exit(0);
    }
  };

  process.once('SIGINT', () => gracefulShutdown('SIGINT'));
  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
  
  process.on('unhandledRejection', (reason) => {
    console.error('❌ [SERVER] Unhandled Rejection:', reason);
  });
  
  process.on('uncaughtException', (error) => {
    console.error('❌ [SERVER] Uncaught Exception:', error);
    process.exit(1);
  });

  console.log('✅ [SERVER] AI-наставник бот з auth системою готовий!');
}

start().catch(error => {
  console.error('❌ [SERVER] Критична помилка запуску:', error);
  process.exit(1);
});