// src/controllers/botController.js
import keyboards from '../utils/keyboards.js';
import userService from '../auth/services/userService.js';

import startHandler from './handlers/startHandler.js';
import mainFlowController from './flows/mainFlowController.js';
import registrationController from './flows/registrationController.js';
import dailyController from './flows/dailyController.js';
import wheelController from './flows/wheelController.js';
import aiMentorController from '../aiMentor/controllers/aiMentorController.js';
import subscriptionController from './subscriptionController.js';

const botController = (bot) => {
  console.log('🤖 [botController] Ініціалізація хендлерів');

  // ---- базове middleware: сесія + лог апдейтів
  bot.use(async (ctx, next) => {
    ctx.session = ctx.session || { step: undefined, temp: {} };

    const log = {
      type: ctx.updateType,
      text: ctx.message?.text,
      cb: ctx.callbackQuery?.data,
      from: ctx.from?.id
    };
    console.log('➡️', log);

    try {
      await next();
    } catch (err) {
      console.error('❌ [botController] middleware error:', err);
      try { await ctx.reply('❌ Помилка. Спробуй /start', keyboards.mainMenuKeyboard()); } catch {}
    }
  });

  // ---- анти-спам + миттєвий answerCbQuery (щоб не ловити 400 "query is too old...")
  const inflightCallbacks = new Set();
  bot.on('callback_query', async (ctx, next) => {
    const id = ctx.callbackQuery?.id;
    const key = `${ctx.from?.id}:${id}`;
    if (!id) return;

    if (inflightCallbacks.has(key)) {
      try { await ctx.answerCbQuery('⏳ Обробляю…'); } catch {}
      return;
    }
    inflightCallbacks.add(key);

    try { await ctx.answerCbQuery(); } catch {}

    try {
      await next();
    } finally {
      setTimeout(() => inflightCallbacks.delete(key), 3000);
    }
  });

  // ===== 1) /start
  bot.start(async (ctx) => {
    const tgId = ctx.from.id;
    console.log(`🚀 [/start] від ${tgId}`);

    try {
      await startHandler.handle(ctx); // <— єдиний вхід для аутентифікації/меню/онбордингу
    } catch (err) {
      console.error('[botController] ❌ /start error:', err);
      try { await ctx.reply('⚠️ Тимчасові труднощі. Відкриваю меню.', keyboards.mainMenuKeyboard()); } catch {}
    }
  });

  // ===== 2) TEXT
  bot.on('text', async (ctx) => {
    // команди обробляються окремо
    if (ctx.message?.entities?.some(e => e.type === 'bot_command')) return;

    const tgId = ctx.from.id;
    const text = ctx.message?.text?.trim();
    if (!text) return;

    try {
      // якщо користувач у процесі онбордингу — хай перехопить registrationController
      if (registrationController?.handleText) {
        const consumed = await registrationController.handleText(ctx);
        if (consumed) {
          console.log('[botController] ✅ registrationController.handleText спрацював');
          return;
        }
      }

      // легкий запит юзера (без жорстких таймаутів)
      let user = null;
      try { user = await userService.getUserByTelegramId(tgId); }
      catch (e) { console.warn('[botController] ⚠️ getUserByTelegramId failed:', e?.message || e); }

      const currentStep = user?.Answer_Step || ctx.session?.step || '';

      // AI наставник активний?
      const { aiMentorSession } = await import('../aiMentor/session.js');
      if (aiMentorSession?.isActive?.(tgId)) {
        await aiMentorController.handleAIMentorQuestion(ctx, text);
        return;
      }

      // колесо балансу
      if (currentStep === 'WheelBalance') {
        await wheelController.handleText(ctx, text);
        return;
      }

      // ранкові/вечірні питання
      if (currentStep?.startsWith('Q_m_') || currentStep?.startsWith('Q_e_')) {
        await dailyController.handleText(ctx, text, currentStep);
        return;
      }

      // дефолт: головний флоу меню
      await mainFlowController.handleText(ctx, text, user);
    } catch (error) {
      console.error('[botController] ❌ Text error:', error);
      try { await ctx.reply('❌ Помилка. Спробуй /start', keyboards.mainMenuKeyboard()); } catch {}
    }
  });

  // ===== 3) CALLBACKS (роутінг)
  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery?.data || '';
    const tgId = ctx.from.id;
    console.log(`📱 [callback] ${data} від ${tgId}`);

    try {
      // онбординг
      if (registrationController?.isRegistrationCallback?.(data)) {
        await registrationController.handleCallback(ctx, data);
        return;
      }

      // AI наставник
      if (data.startsWith('ai_')) {
        await aiMentorController.handleAIMentorCallback(ctx);
        return;
      }

      // колесо
      if (data.startsWith('wheel_')) {
        await wheelController.handleCallback(ctx, data);
        return;
      }

      // ранкові/вечірні
      if (data.includes('morning') || data.includes('evening')) {
        await dailyController.handleCallback(ctx, data);
        return;
      }

      // підписки та trial
      if (
        data.startsWith('subscribe_') ||
        data === 'subscription_plans' ||
        data === 'subscription_info' ||
        data === 'sync_subscription' ||
        data === 'activate_trial' ||
        data === 'plan_free' ||
        data === 'contact_support'
      ) {
        // trial зручно обробляє наш startHandler (plan_free)
        if (data === 'plan_free') {
          const mod = (await import('./handlers/startHandler.js')).default;
          await mod.handleCallback(ctx);
        } else {
          await subscriptionController.handleCallback(ctx);
        }
        return;
      }

      // дефолт
      let user = null;
      try { user = await userService.getUserByTelegramId(tgId); } catch {}
      await mainFlowController.handleCallback(ctx, data, user);
    } catch (error) {
      console.error('[botController] ❌ Callback error:', error);
      try { await ctx.answerCbQuery('Помилка'); } catch {}
    }
  });

  // ===== 4) ГЛОБАЛЬНІ ПОМИЛКИ
  bot.catch(async (err, ctx) => {
    console.error('❌ [botController] Global error:', err);
    if (ctx?.reply) {
      try { await ctx.reply('❌ Помилка. Спробуй /start', keyboards.mainMenuKeyboard()); } catch {}
    }
  });

  console.log('✅ [botController] Готово з реєстрацією');
  return { bot };
};

export default botController;
