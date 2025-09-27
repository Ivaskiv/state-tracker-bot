// src/controllers/botController.js - ВИПРАВЛЕНО З РЕЄСТРАЦІЄЮ

import userService from '../auth/services/userService.js';
import keyboards from '../utils/keyboards.js';

// Імпорти модулів авторизації
import { handleStart, handleRegistrationStep, handleOnboardingCallback } from '../auth/modules/auth.js';

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
      
      // Використовуємо новий обробник з auth.js
      await handleStart(ctx);
      
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

      // 1. ПЕРЕВІРЯЄМО РЕЄСТРАЦІЮ (найвищий пріоритет)
      const isRegistrationStep = await handleRegistrationStep(ctx);
      if (isRegistrationStep) {
        console.log(`[botController] ✅ Оброблено як крок реєстрації`);
        return;
      }

      // 2. ПЕРЕВІРЯЄМО РЕЄСТРАЦІЮ ЧЕРЕЗ КОНТРОЛЕР
      const isRegistrationText = await registrationController.handleText(ctx);
      if (isRegistrationText) {
        console.log(`[botController] ✅ Оброблено через registrationController`);
        return;
      }

      // 3. ОТРИМУЄМО КОРИСТУВАЧА
      let user = null;
      try {
        user = await userService.getUserByTelegramId(tgId);
      } catch (error) {
        console.warn('[botController] База недоступна:', error.message);
        await ctx.reply('⚠️ Тимчасові проблеми. Спробуй /start');
        return;
      }

      // 4. ПЕРЕВІРЯЄМО ЧИ КОРИСТУВАЧ ЗАРЕЄСТРОВАНИЙ
      if (!user || !user.UserRegistered) {
        await ctx.reply('Спочатку зареєструйся /start');
        return;
      }

      // 5. ПЕРЕВІРЯЄМО АКТИВНІ СЕСІЇ
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

      // 6. КОМАНДИ МЕНЮ
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

      // 1. ОНБОРДИНГ CALLBACKS (найвищий пріоритет)
      const isOnboardingCallback = await handleOnboardingCallback(ctx);
      if (isOnboardingCallback) {
        console.log(`[botController] ✅ Оброблено через handleOnboardingCallback`);
        return;
      }

      // 2. РЕЄСТРАЦІЯ CALLBACKS
      const isRegistrationCallback = await registrationController.handleCallback(ctx, data);
      if (isRegistrationCallback) {
        console.log(`[botController] ✅ Оброблено через registrationController callback`);
        return;
      }

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

  console.log('✅ [botController] Готово з реєстрацією');
  return { bot };
};

export default botController;