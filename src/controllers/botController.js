// src/controllers/botController.js - ВИПРАВЛЕНО
import userService from '../auth/services/userService.js';
import keyboards from '../utils/keyboards.js';
import { handleOnboardingCallback } from '../auth/modules/auth.js';
import { handleRegistrationStep } from '../auth/modules/auth.js';

// Імпорти контролерів
import mainFlowController from './flows/mainFlowController.js';
import registrationController from './flows/registrationController.js';
import dailyController from './flows/dailyController.js';
import wheelController from './flows/wheelController.js';
import aiMentorController from '../aiMentor/controllers/aiMentorController.js';
import subscriptionController from './subscriptionController.js';

const botController = (bot) => {
  console.log('🤖 [botController] Ініціалізація хендлерів');

  // ===== 1. КОМАНДА /start =====
  bot.start(async (ctx) => {
    const tgId = ctx.from.id;
    console.log(`🚀 [/start] від ${tgId}`);
    
    try {
      // Ініціалізуємо сесію
      ctx.session = ctx.session || { step: undefined, temp: {} };
      
      await mainFlowController.handleStart(ctx);
    } catch (err) {
      console.error('[botController] ❌ start error:', err);
      try { 
        await ctx.reply('❌ Помилка. Спробуй /start', keyboards.mainMenuKeyboard()); 
      } catch {}
    }
  });

  // ===== 2. ОБРОБКА ТЕКСТУ =====
  bot.on('text', async (ctx) => {
    // Ігноруємо команди (вони обробляються окремо)
    if (ctx.message?.entities?.some(e => e.type === 'bot_command')) return;

    const tgId = ctx.from.id;
    const text = ctx.message?.text?.trim();
    if (!text) return;

    console.log(`💬 [botController] Текст від ${tgId}: "${text.substring(0, 30)}..."`);

    try {
      // Ініціалізуємо сесію якщо немає
      ctx.session = ctx.session || { step: undefined, temp: {} };

      // 1. ПЕРЕВІРЯЄМО ОНБОРДИНГ
      const isOnboarding = await handleRegistrationStep(ctx);
      if (isOnboarding) return;

      // 2. ОТРИМУЄМО КОРИСТУВАЧА
      let user = null;
      try {
        user = await userService.getUserByTelegramId(tgId);
      } catch (error) {
        console.warn('[botController] База недоступна:', error.message);
        await ctx.reply('⚠️ Тимчасові проблеми. Спробуй /start');
        return;
      }

      // 3. ПЕРЕВІРЯЄМО РЕЄСТРАЦІЮ
      if (!user || !user.UserRegistered) {
        await ctx.reply('Спочатку зареєструйся /start');
        return;
      }

      // 4. ПЕРЕВІРЯЄМО АКТИВНІ СЕСІЇ
      const currentStep = user?.Answer_Step || ctx.session?.step;
      
      // AI Наставник активний
      const { aiMentorSession } = await import('../aiMentor/session.js');
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
      console.error('[botController] ❌ Text error:', error);
      try { 
        await ctx.reply('❌ Помилка. Спробуй /start', keyboards.mainMenuKeyboard()); 
      } catch {}
    }
  });

  // ===== 3. ОБРОБКА CALLBACK =====
  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery?.data || '';
    const tgId = ctx.from.id;
    
    console.log(`📱 [botController] Callback: ${data} від ${tgId}`);

    try {
      // Завжди відповідаємо на callback
      await ctx.answerCbQuery();
      
      // Ініціалізуємо сесію
      ctx.session = ctx.session || { step: undefined, temp: {} };

      // ОНБОРДИНГ CALLBACKS
      if (await handleOnboardingCallback(ctx)) {
        return;
      }

      // AI НАСТАВНИК
      if (data.startsWith('ai_')) {
        await aiMentorController.handleAIMentorCallback(ctx);
        return;
      }

      // КОЛЕСО БАЛАНСУ
      if (data.startsWith('wheel_')) {
        await wheelController.handleCallback(ctx, data);
        return;
      }

      // ЩОДЕННІ ПИТАННЯ
      if (data.includes('morning') || data.includes('evening')) {
        await dailyController.handleCallback(ctx, data);
        return;
      }

      // ПІДПИСКИ
      if (data.startsWith('subscribe_') || data === 'subscription_plans' || 
          data === 'subscription_info' || data === 'sync_subscription' || 
          data === 'activate_trial' || data === 'contact_support') {
        await subscriptionController.handleCallback(ctx);
        return;
      }

      // РЕЄСТРАЦІЯ
      if (registrationController.isRegistrationCallback?.(data)) {
        await registrationController.handleCallback(ctx, data);
        return;
      }

      // ОСНОВНІ CALLBACKS
      const user = await userService.getUserByTelegramId(tgId);
      await mainFlowController.handleCallback(ctx, data, user);

    } catch (error) {
      console.error('[botController] ❌ Callback error:', error);
      try { 
        await ctx.answerCbQuery('Помилка обробки'); 
      } catch {}
    }
  });

  // ===== 4. ГЛОБАЛЬНА ОБРОБКА ПОМИЛОК =====
  bot.catch(async (err, ctx) => {
    console.error('❌ [botController] Global error:', err);
    if (ctx?.reply) {
      try { 
        await ctx.reply('❌ Помилка. Спробуй /start', keyboards.mainMenuKeyboard()); 
      } catch {}
    }
  });

  console.log('✅ [botController] Готово');
  return { bot };
};

export default botController;