// src/controllers/handlers/callbackHandler.js - ОПТИМІЗОВАНИЙ

import antiSpam from '../../utils/antiSpam.js';
import { handleCallback as startCb } from './startHandler.js';
import subscriptionController from '../subscriptionController.js';
import wheelController from '../flows/wheelController.js';
import aiMentorController from '../flows/aiMentorController.js';
import dailyController from '../flows/dailyController.js';
import mainFlowController from '../flows/mainFlowController.js';
import keyboards from '../../utils/keyboards.js';
import { GENERAL_AFFIRMATIONS, MENU_TEXTS } from '../../config/constants.js';

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
    // ===== ГОЛОВНЕ МЕНЮ =====
    if (data === 'main_menu' || data === 'open_main') {
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
      await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
      return true;
    }

    // ===== НОВІ ІНФОРМАЦІЙНІ МЕНЮ =====
    
    // ℹ️ Інформація (головне інфо-меню)
    if (data === 'info_menu') {
      await ctx.editMessageText(
        'ℹ️ ІНФОРМАЦІЯ\n\nОбери розділ:',
        keyboards.infoMenuInline()
      );
      return true;
    }

    // 💰 Підписка (меню підписки)
    if (data === 'subscription_info') {
      await ctx.editMessageText(
        '💰 ПІДПИСКА\n\nОбери дію:',
        keyboards.subscriptionMenuInline()
      );
      return true;
    }

    // 📞 Зв'язок (меню контактів)
    if (data === 'contact') {
      await ctx.editMessageText(
        '📞 ЗВ\'ЯЗОК ТА ДОПОМОГА\n\nОбери розділ:',
        keyboards.contactMenuInline()
      );
      return true;
    }

    // 📊 Звіти (меню звітів)
    if (data === 'reports_menu') {
      await ctx.editMessageText(
        '📊 ЗВІТИ\n\nОбери тип звіту:',
        keyboards.reportsMenuInline()
      );
      return true;
    }

    // ===== ЗВІТИ =====
    if (data === 'get_weekly_report') {
      await mainFlowController.handleCallback(ctx, 'get_weekly_report');
      return true;
    }

    if (data === 'get_monthly_report') {
      await mainFlowController.handleCallback(ctx, 'get_monthly_report');
      return true;
    }

    if (data === 'my_progress') {
      await mainFlowController.handleCallback(ctx, 'my_progress');
      return true;
    }

    if (data === 'wheel_stats') {
      await wheelController.handleCallback(ctx, 'wheel_stats');
      return true;
    }

    // ===== ДОПОМОГА ТА КОНТАКТИ =====
    if (data === 'instructions') {
      await ctx.editMessageText(MENU_TEXTS.INSTRUCTIONS, keyboards.contactMenuInline());
      return true;
    }

    if (data === 'contact_support') {
      await ctx.editMessageText(MENU_TEXTS.CONTACT, keyboards.contactMenuInline());
      return true;
    }

    if (data === 'show_affirmation') {
      const affirmation = GENERAL_AFFIRMATIONS[Math.floor(Math.random() * GENERAL_AFFIRMATIONS.length)];
      await ctx.editMessageText(`✨ ${affirmation}`, keyboards.contactMenuInline());
      return true;
    }

    if (data === 'help') {
      await ctx.editMessageText(MENU_TEXTS.HELP, keyboards.contactMenuInline());
      return true;
    }

    // ===== ОНБОРДИНГ =====
    if (await startCb(ctx)) return true;

    // ===== ЩОДЕННІ ПИТАННЯ =====
    if (data === 'start_morning') {
      await dailyController.startMorningSession(ctx);
      return true;
    }
    if (data === 'start_evening') {
      await dailyController.startEveningSession(ctx);
      return true;
    }

    // ===== ПІДПИСКИ =====
    if (
      data.startsWith('subscription_') || data.startsWith('subscribe_') ||
      data === 'activate_trial' || data === 'sync_subscription' ||
      data === 'contact_support' || data.startsWith('plan_') ||
      data.startsWith('renew_')
    ) {
      await subscriptionController.handleCallback(ctx);
      return true;
    }

    // ===== КОЛЕСО =====
    if (data.startsWith('wheel_')) {
      await wheelController.handleCallback(ctx, data);
      return true;
    }

    // ===== AI =====
    if (data.startsWith('ai_')) {
      await aiMentorController.handleAIMentorCallback(ctx);
      return true;
    }

    // ===== ІНШІ ЩОДЕННІ ДІЇ =====
    if (
      data.startsWith('continue_morning') || data.startsWith('later_morning') ||
      data.startsWith('continue_evening') || data.startsWith('later_evening') ||
      data === 'exit_morning' || data === 'exit_evening' ||
      data.includes('morning') || data.includes('evening')
    ) {
      await dailyController.handleCallback(ctx, data);
      return true;
    }

    // ===== ГОЛОВНЕ / СЛУЖБОВІ =====
    if (data === 'continue_session') {
      await mainFlowController.handleCallback(ctx, 'continue_session');
      return true;
    }

    console.log(`[callbackHandler] ❓ Невідомий callback: ${data}`);
    await ctx.answerCbQuery('Команда не розпізнана');
    return false;

  } catch (error) {
    console.error('[callbackHandler] Помилка:', error);
    await ctx.reply('❌ Помилка. Спробуй ще раз.');
    return true;
  }
};

export default { handle };