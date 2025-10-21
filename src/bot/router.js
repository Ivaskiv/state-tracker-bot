// src/bot/router.js

import initOnboarding from '../features/onboarding/index.js';
import {
  startWheelBalance,
  continueActiveWheel,
  goBackWheelStep,
  processWheelAnswer,
  saveWheelNoteAndGoNext,
  cancelWheelBalance,
  isAwaitingNote,
  startNewWheelIgnoreOld,
} from '../features/wheelBalance/flow.js';
import * as dailyController from '../features/dailySessions/controller.js';
import subscriptionController from '../features/subscription/controller.js';

import keyboards from '../utils/keyboards.js';
import logger from '../utils/logger.js';
import * as dashboard from '../features/dashboard/index.js';

const attachRoutes = (bot) => {
  // Onboarding реєструє /start
  initOnboarding(bot);

  // Subscription callbacks
  bot.action('subscription_info', subscriptionController.handleSubscriptionInfo);
  bot.action('subscription_plans', subscriptionController.handleSubscriptionPlans);
  bot.action('renew_subscription', subscriptionController.handleRenewSubscription);
  bot.action('sync_subscription', subscriptionController.handleSyncSubscription);
  bot.action('contact_support', subscriptionController.handleContactSupport);
  bot.action('activate_trial', (ctx) => subscriptionController.handleSubscribe(ctx, 'trial'));
  bot.action('subscribe_week', (ctx) => subscriptionController.handleSubscribe(ctx, 'week'));
  bot.action('subscribe_month', (ctx) => subscriptionController.handleSubscribe(ctx, 'month'));
  bot.action('subscribe_year', (ctx) => subscriptionController.handleSubscribe(ctx, 'year'));
  bot.action(/^buy_course_(.+)$/, async (ctx) => {
    const [, problemType] = ctx.match;
    await subscriptionController.handleBuyCourse(ctx, problemType);
  });
  bot.action('book_consultation', subscriptionController.handleBookConsultation);
  bot.action('dismiss_offer', subscriptionController.handleDismissOffer);

  // Wheel
  bot.action('wheel_start', async (ctx) => {
    const res = await startWheelBalance(ctx.from.id, ctx.from.first_name || '');
    await ctx.reply(res.message, res.keyboard || keyboards.wheelScoreKeyboard());
  });
  bot.action('wheel_continue', async (ctx) => {
    const res = await continueActiveWheel(ctx.from.id, ctx);
    await ctx.reply(res.message, res.keyboard || keyboards.wheelScoreKeyboard());
  });
  bot.action('wheel_restart', async (ctx) => {
    await ctx.reply(
      'Почати колесо заново? Поточний прогрес буде збережено в історії.',
      keyboards.buildRestartWarningKeyboard('wheel')
    );
  });
  bot.action('wheel_restart_confirmed', async (ctx) => {
    const res = await startNewWheelIgnoreOld(ctx.from.id, ctx.from.first_name || '', true);
    await ctx.reply(res.message, res.keyboard || keyboards.wheelScoreKeyboard());
  });
  bot.action('wheel_go_back', async (ctx) => {
    await goBackWheelStep(ctx.from.id, ctx);
  });
  bot.action(/^wheel_skip_note_(\d+)$/, async (ctx) => {
    const res = await saveWheelNoteAndGoNext(ctx, '(пропущено)');
    await ctx.reply(res.message, res.keyboard || keyboards.wheelScoreKeyboard());
  });
  bot.action(/^wheel_score_(\d{1,2})$/, async (ctx) => {
    const score = Math.max(0, Math.min(10, Number(ctx.match[1])));
    await processWheelAnswer(ctx.from.id, score, ctx);
  });
  bot.action('wheel_exit', async (ctx) => {
    await cancelWheelBalance(ctx.from.id);
    await ctx.reply('Сесію колеса завершено.', keyboards.mainMenuKeyboard());
  });

  // Daily sessions
  bot.action('start_morning', dailyController.handleStartMorning);
  bot.action('later_morning', dailyController.handleLaterMorning);
  bot.action('start_evening', dailyController.handleStartEvening);
  bot.action('later_evening', dailyController.handleLaterEvening);
  bot.action('exit_session', dailyController.handleExitSession);
  bot.action('skip_morning_do_evening', dailyController.handleSkipMorningDoEvening);

  // Навігація (через dashboard)
  bot.action('main_menu', (ctx) => dashboard.showMainMenu);
  bot.action('show_capabilities', dashboard.showCapabilities);
  bot.action('instructions', dashboard.showInstructions);
  bot.action('help', dashboard.showHelp);

  // TEXT — один обробник
  bot.on('text', async (ctx) => {
    const tgId = ctx.from.id;
    const text = (ctx.message?.text || '').trim();

    // 1) daily
    try {
      const handledDaily = await dailyController.handleText?.(ctx, text);
      if (handledDaily) return;
    } catch (e) {
      logger.error('[router] dailyController.handleText:', e.message);
    }

    // 2) wheel note очікування
    try {
      const awaiting = await isAwaitingNote(tgId);
      if (awaiting && text) {
        const res = await saveWheelNoteAndGoNext(ctx, text);
        await ctx.reply(res.message, res.keyboard || keyboards.wheelScoreKeyboard());
        return;
      }
    } catch (e) {
      logger.error('[router] wheel note flow:', e.message);
    }

    // 3) AI mentor (lazy)
    try {
      const aiMentorMod = await import('../features/aiMentor/index.js');
      const aiMentor = aiMentorMod?.default || aiMentorMod;
      const handledAi = await aiMentor?.handleText?.(ctx, text);
      if (handledAi) return;
    } catch (e) {
      logger.warn('[router] AI mentor module not found or no handleText:', e.message);
    }

    // 4) dashboard
    try {
      const handledDash = await dashboard.handleText?.(ctx, text);
      if (handledDash) return;
    } catch (e) {
      logger.error('[router] dashboard.handleText:', e.message);
    }

    await ctx.reply('Не зовсім зрозумів. Обери дію:', keyboards.mainMenuKeyboard());
  });

  bot.catch((err, ctx) => {
    logger.error(`[router] Global error for ${ctx.updateType}:`, err);
    try { ctx.reply('Сталася помилка. Спробуй ще раз пізніше.', keyboards.mainMenuKeyboard()); } catch {}
  });
};

export const initRouter = attachRoutes;
export default attachRoutes;
