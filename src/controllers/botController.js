// src/controllers/botController.js
import userService from '../auth/services/userService.js';
import keyboards from '../utils/keyboards.js';

import mainFlowController from './flows/mainFlowController.js';
import registrationController from './flows/registrationController.js';
import dailyController from './flows/dailyController.js';
import wheelController from './flows/wheelController.js';
import aiMentorController from '../aiMentor/controllers/aiMentorController.js';
import startHandler from './handlers/startHandler.js';

const botController = (bot) => {
  console.log('🤖 [botController] Ініціалізація хендлерів');

  // Явний хендлер для /start
  bot.start(async (ctx) => {
    try {
      console.log(`🚀 [/start] отримано від ${ctx.from.id}`);
      await startHandler.handle(ctx, userService);
    } catch (err) {
      console.error('[botController] ❌ start error:', err);
      try { await ctx.reply('❌ Помилка. Спробуй /start', keyboards.mainMenuKeyboard()); } catch {}
    }
  });

  // Один (і тільки один) загальний хендлер для текстів (без bot_command)
  bot.on('text', async (ctx) => {
    // ігноруємо /команди тут (щоб не дублювалося з bot.start)
    if (ctx.message?.entities?.some(e => e.type === 'bot_command')) return;

    const tgId = ctx.from.id;
    const text = ctx.message?.text?.trim();
    if (!text) return;

    try {
      const user = await userService.getUserByTelegramId(tgId);
      const currentStep = user?.Answer_Step || ctx.session?.step;
      console.log(`💬 [botController] "${text}" від ${tgId}, step: ${currentStep}`);

      if (registrationController.isRegistrationStep?.(currentStep)) {
        await registrationController.handleText(ctx);
        return;
      }

      if (currentStep?.startsWith('Q_m_') || currentStep?.startsWith('Q_e_')) {
        await dailyController.handleText(ctx, text, currentStep);
        return;
      }

      if (currentStep === 'WheelBalance') {
        await wheelController.handleText(ctx, text);
        return;
      }

      if (currentStep === 'ai_mentor_active') {
        await aiMentorController.handleAIMentorQuestion(ctx, text);
        return;
      }

      await mainFlowController.handleText(ctx, text, user);
    } catch (error) {
      console.error('[botController] ❌ Text error:', error);
      try { await ctx.reply('❌ Помилка. Спробуй /start', keyboards.mainMenuKeyboard()); } catch {}
    }
  });

  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery?.data || '';
    const tgId = ctx.from.id;
    console.log(`📱 [botController] Callback: ${data} від ${tgId}`);

    try {
      await ctx.answerCbQuery();
      const user = await userService.getUserByTelegramId(tgId);

      if (data.startsWith('ai_')) {
        await aiMentorController.handleAIMentorCallback(ctx);
      } else if (data.startsWith('wheel_')) {
        await wheelController.handleCallback(ctx, data);
      } else if (data.includes('morning') || data.includes('evening')) {
        await dailyController.handleCallback(ctx, data);
      } else if (registrationController.isRegistrationCallback?.(data)) {
        await registrationController.handleCallback(ctx, data);
      } else {
        await mainFlowController.handleCallback(ctx, data, user);
      }
    } catch (error) {
      console.error('[botController] ❌ Callback error:', error);
      try { await ctx.answerCbQuery('Помилка обробки'); } catch {}
    }
  });

  bot.catch(async (err, ctx) => {
    console.error('❌ [botController] Global error:', err);
    if (ctx?.reply) {
      try { await ctx.reply('❌ Помилка. Спробуй /start', keyboards.mainMenuKeyboard()); } catch {}
    }
  });

  console.log('✅ [botController] Готово');
  return { bot };
};

export default botController;
