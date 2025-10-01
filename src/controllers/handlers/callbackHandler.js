// src/controllers/handlers/callbackHandler.js - Колбеки через централізовані хендлери/меню

import antiSpam from '../../utils/antiSpam.js';
import { handleCallback as startCb } from './startHandler.js';
import subscriptionController from '../subscriptionController.js';
import wheelController from '../flows/wheelController.js';
import aiMentorController from '../../aiMentor/controllers/aiMentorController.js';
import dailyController from '../flows/dailyController.js';
import mainFlowController from '../flows/mainFlowController.js';
import keyboards from '../../utils/keyboards.js';

export const handle = async (ctx) => {
  const userId = ctx.from.id;
  const data = ctx.callbackQuery?.data || '';

  console.log(`[callbackHandler] ${data} від ${userId}`);

  if (antiSpam.isSpam(userId, data)) {
    await ctx.answerCbQuery('⏳ Зачекай трохи').catch(() => {});
    return true;
  }
  await ctx.answerCbQuery().catch(() => {});

  try {
    // 1) онбординг
    if (await startCb(ctx)) return true;

    // 2) явний старт ранкової/вечірньої сесії (ПРІОРИТЕТНО!)
    if (data === 'start_morning') {
      await dailyController.startMorningSession(ctx);
      return true;
    }
    if (data === 'start_evening') {
      await dailyController.startEveningSession(ctx);
      return true;
    }

    // 3) підписки
    if (
      data.startsWith('subscription_') || data.startsWith('subscribe_') ||
      data === 'activate_trial' || data === 'sync_subscription' ||
      data === 'contact_support' || data.startsWith('plan_')
    ) {
      await subscriptionController.handleCallback(ctx);
      return true;
    }

    // 4) колесо
    if (data.startsWith('wheel_')) {
      await wheelController.handleCallback(ctx, data);
      return true;
    }

    // 5) AI
    if (data.startsWith('ai_')) {
      await aiMentorController.handleAIMentorCallback(ctx);
      return true;
    }

    // 6) інші ранкові/вечірні дії (continue_/later_/exit_ тощо)
    if (
      data.startsWith('continue_morning') || data.startsWith('later_morning') ||
      data.startsWith('continue_evening') || data.startsWith('later_evening') ||
      data === 'exit_morning' || data === 'exit_evening' ||
      data.includes('morning') || data.includes('evening')
    ) {
      await dailyController.handleCallback(ctx, data);
      return true;
    }

    // 7) головне / звіти / службові
    switch (data) {
      case 'main_menu':
      case 'open_main':
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
        await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
        return true;

      case 'my_progress':
      case 'get_weekly_report':
      case 'get_monthly_report':
      case 'show_affirmation':
      case 'help':
      case 'contact':
      case 'instructions':
      case 'continue_session':
        await mainFlowController.handleCallback(ctx, data);
        return true;

      default:
        console.log(`[callbackHandler] ❓ Невідомий callback: ${data}`);
        return false;
    }
  } catch (error) {
    console.error('[callbackHandler] Помилка:', error);
    await ctx.reply('❌ Помилка. Спробуй ще раз.');
    return true;
  }
};

export default { handle };
