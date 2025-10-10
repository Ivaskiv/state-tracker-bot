// src/controllers/botController.js — ГОЛОВНИЙ РОУТИНГ
import startHandler from './handlers/startHandler.js';
import registrationHandler from './handlers/registrationHandler.js';
import textHandler from './handlers/textHandler.js';
import callbackHandler from './handlers/callbackHandler.js';
import keyboards from '../utils/keyboards.js';
import profileController from './flows/profileController.js';

const botController = (bot) => {
  console.log('🤖 [botController] Ініціалізація...');

  // ===== MIDDLEWARE ЛОГУВАННЯ =====
  bot.use(async (ctx, next) => {
    const type = ctx.updateType;
    const from = ctx.from?.id;
    console.log(`➡️ ${type} від ${from}`);
    try {
      await next();
    } catch (error) {
      console.error('💥 Middleware error:', error);
      try { await ctx.reply('❌ Виникла помилка. Спробуй /start'); } catch {}
    }
  });

  // ===== /START =====
  bot.start(async (ctx) => {
    try {
      await startHandler.startHandler(ctx);
    } catch (error) {
      console.error('[botController] ❌ Помилка /start:', error);
      await ctx.reply('❌ Помилка запуску. Спробуй ще раз /start');
    }
  });

  // ===== ПРОФІЛЬ / ПРОГРЕС =====
  bot.hears('📊 Мій прогрес', async (ctx) => {
    try {
      await profileController.showProfile(ctx);
    } catch (error) {
      console.error('[botController] ❌ Помилка профілю:', error);
      await ctx.reply('❌ Не вдалося показати профіль', keyboards.mainMenuKeyboard());
    }
  });

  // ===== ТЕКСТОВІ ПОВІДОМЛЕННЯ =====
  bot.on('text', async (ctx) => {
    try {
      const handled = await textHandler.handle(ctx);
      if (!handled) {
        await ctx.reply('❌ Невідома команда', keyboards.mainMenuKeyboard());
      }
    } catch (error) {
      console.error('[botController] ❌ Text handler error:', error);
      await ctx.reply('❌ Помилка. Спробуй /start', keyboards.mainMenuKeyboard());
    }
  });

  // ===== CALLBACK З КНОПОК =====
  bot.on('callback_query', async (ctx) => {
    try {
      // 1️⃣ Спочатку — онбординг / реєстрація
      const onboardingHandled = await registrationHandler.handleCallback(ctx);
      if (onboardingHandled) return;

      // 2️⃣ Потім — глобальні callback-и
      const handled = await callbackHandler.handle(ctx);
      if (handled) return;

      // 3️⃣ Якщо нічого не оброблено
      await ctx.reply('❓ Невідома дія. Спробуй ще раз', keyboards.mainMenuKeyboard());
    } catch (error) {
      console.error('[botController] ❌ Callback error:', error);
      await ctx.reply('❌ Помилка callback. Спробуй /start', keyboards.mainMenuKeyboard());
    }
  });

  // ===== ГЛОБАЛЬНІ ПОМИЛКИ =====
  bot.catch(async (err, ctx) => {
    console.error('❌ [botController] Global error:', err);
    if (ctx?.reply) {
      try {
        await ctx.reply('❌ Сталася помилка. Спробуй /start', keyboards.mainMenuKeyboard());
      } catch {}
    }
  });

  console.log('✅ [botController] Готовий');
  return { bot };
};

export default botController;
