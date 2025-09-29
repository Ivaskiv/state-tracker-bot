// src/controllers/botController.js
// ОПТИМІЗОВАНО: спрощена логіка реєстрації з прямим збереженням в Airtable

import keyboards from '../utils/keyboards.js';
import userService from '../auth/services/userService.js';
import paymentService from '../auth/services/paymentService.js';
import typing from '../utils/typing.js';

import startHandler from './handlers/startHandler.js';
import mainFlowController from './flows/mainFlowController.js';
import dailyController from './flows/dailyController.js';
import wheelController from './flows/wheelController.js';
import aiMentorController from '../aiMentor/controllers/aiMentorController.js';
import subscriptionController from './subscriptionController.js';

const botController = (bot) => {
  console.log('🤖 [botController] Ініціалізація оптимізованих хендлерів');

  // ===== MIDDLEWARE =====
  bot.use(async (ctx, next) => {
    const base = { type: ctx.updateType, from: ctx.from?.id };

    if (ctx.updateType === 'message') {
      base.text = ctx.message?.text?.slice(0, 60);
    }
    if (ctx.updateType === 'callback_query') {
      base.cb = ctx.callbackQuery?.data;
    }

    console.log('➡️', base);
    
    try {
      await next();
    } catch (error) {
      console.error('💥 middleware error:', error.message);
      try {
        await ctx.reply('❌ Виникла помилка. Спробуй /start');
      } catch {}
    }
  });

  // ===== КОМАНДА /start - ВИКОРИСТОВУЄМО STARTHANDLER =====
  bot.start(async (ctx) => {
    try {
      await startHandler.handle(ctx);
    } catch (error) {
      console.error('[START] ❌ Критична помилка:', error);
      await ctx.reply('❌ Помилка запуску. Спробуй ще раз /start');
    }
  });

  // ===== ОБРОБКА ТЕКСТУ =====
  bot.on('text', async (ctx) => {
    if (ctx.message?.entities?.some(e => e.type === 'bot_command')) return;

    const tgId = ctx.from.id;
    const text = ctx.message?.text?.trim();
    
    if (!text) return;

    try {
      // 1. ОНБОРДИНГ (startHandler)
      const isOnboarding = await startHandler.handleText(ctx);
      if (isOnboarding) return;

      // 2. ШВИДКЕ ОТРИМАННЯ КОРИСТУВАЧА
      let user = userService.getFromCache(tgId);
      if (!user) {
        user = await userService.getUserByTelegramId(tgId);
      }

      if (!user || !user.UserRegistered) {
        await ctx.reply('Спочатку зареєструйся /start');
        return;
      }

      // 3. АКТИВНІ СЕСІЇ
      const step = user.Answer_Step;
      
      // AI Наставник
      const { aiMentorSession } = await import('../aiMentor/session.js');
      if (aiMentorSession?.isActive?.(tgId)) {
        await aiMentorController.handleAIMentorQuestion(ctx, text);
        return;
      }
      
      // Колесо балансу
      if (step === 'WheelBalance') {
        await wheelController.handleText(ctx, text);
        return;
      }
      
      // Ранкові/вечірні питання
      if (step && (step.startsWith('Q_m_') || step.startsWith('Q_e_'))) {
        await dailyController.handleText(ctx, text, step);
        return;
      }

      // 4. ГОЛОВНИЙ ФЛОУ МЕНЮ
      const hasAccess = userService.hasActiveAccess(user);
      await mainFlowController.handleText(ctx, text, user, hasAccess);
      
    } catch (error) {
      console.error('[TEXT] ❌', error.message);
      await ctx.reply('❌ Помилка. Спробуй ще раз.');
    }
  });

  // ===== ОБРОБКА CALLBACK =====
  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery?.data || '';
    const tgId = ctx.from.id;

    try {
      await ctx.answerCbQuery();

      // 1. ОНБОРДИНГ (startHandler)
      const isOnboarding = await startHandler.handleCallback(ctx);
      if (isOnboarding) return;

      // 2. AI наставник
      if (data.startsWith('ai_')) {
        await aiMentorController.handleAIMentorCallback(ctx);
        return;
      }

      // 3. Колесо балансу
      if (data.startsWith('wheel_')) {
        await wheelController.handleCallback(ctx, data);
        return;
      }

      // 4. Ранкові/вечірні питання
      if (data.includes('morning') || data.includes('evening')) {
        await dailyController.handleCallback(ctx, data);
        return;
      }

      // 5. Підписки
      if (
        data.startsWith('subscribe_') ||
        data === 'subscription_plans' ||
        data === 'subscription_info' ||
        data === 'sync_subscription' ||
        data === 'activate_trial' ||
        data === 'contact_support'
      ) {
        await subscriptionController.handleCallback(ctx);
        return;
      }

      // 6. Головне меню
      if (data === 'main_menu') {
        await ctx.reply('🏠 Меню:', keyboards.mainMenuKeyboard());
        return;
      }

      // 7. Дефолт через mainFlowController
      let user = userService.getFromCache(tgId);
      if (!user) {
        user = await userService.getUserByTelegramId(tgId);
      }
      await mainFlowController.handleCallback(ctx, data, user);

    } catch (error) {
      console.error('[CALLBACK] ❌', error.message);
      try { await ctx.answerCbQuery('Помилка'); } catch {}
    }
  });

  // ===== ГЛОБАЛЬНІ ПОМИЛКИ =====
  bot.catch(async (err, ctx) => {
    console.error('❌ [botController] Global error:', err);
    if (ctx?.reply) {
      try { 
        await ctx.reply('❌ Помилка. Спробуй /start', keyboards.mainMenuKeyboard()); 
      } catch {}
    }
  });

  console.log('✅ [botController] Оптимізований botController готовий');
  return { bot };
};

export default botController;