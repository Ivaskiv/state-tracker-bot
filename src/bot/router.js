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

import subscriptionController from '../features/subscription/controller.js';
import * as dailyController from '../features/dailySessions/controller.js';

import keyboards from '../utils/keyboards.js';
import logger from '../utils/logger.js';

// використовуємо твій features/dashboard (не controllers/)
import dashboard from '../features/dashboard/index.js';

// ──────────────────────────────────────────────────────────────
// helpers: завжди передаємо валідний handler у Telegraf
// ──────────────────────────────────────────────────────────────
const ensureHandler = (fn, fallbackText = '⛔️ Тимчасово недоступно') => {
  if (typeof fn === 'function') return fn;
  return async (ctx) => {
    try { await ctx.reply(fallbackText, keyboards.mainMenuKeyboard()); } catch {}
  };
};

const wrap = (fnName, mod, fallbackText) =>
  ensureHandler(mod?.[fnName], fallbackText);

// ──────────────────────────────────────────────────────────────

const attachRoutes = (bot) => {
  // Onboarding сам реєструє /start
  initOnboarding(bot);

  // ===== Subscription (через safe wrappers)
  bot.action('subscription_info', wrap('handleSubscriptionInfo', subscriptionController));
  bot.action('subscription_plans', wrap('handleSubscriptionPlans', subscriptionController));
  bot.action('renew_subscription', wrap('handleRenewSubscription', subscriptionController));
  bot.action('sync_subscription', wrap('handleSyncSubscription', subscriptionController));
  bot.action('contact_support', wrap('handleContactSupport', subscriptionController));
  bot.action('activate_trial', async (ctx) => {
    const fn = subscriptionController?.handleSubscribe;
    return ensureHandler((c) => fn(c, 'trial'))(ctx);
  });
  bot.action('subscribe_week', async (ctx) => {
    const fn = subscriptionController?.handleSubscribe;
    return ensureHandler((c) => fn(c, 'week'))(ctx);
  });
  bot.action('subscribe_month', async (ctx) => {
    const fn = subscriptionController?.handleSubscribe;
    return ensureHandler((c) => fn(c, 'month'))(ctx);
  });
  bot.action('subscribe_year', async (ctx) => {
    const fn = subscriptionController?.handleSubscribe;
    return ensureHandler((c) => fn(c, 'year'))(ctx);
  });
  bot.action(/^buy_course_(.+)$/, async (ctx) => {
    const fn = subscriptionController?.handleBuyCourse;
    return ensureHandler(async (c) => {
      const [, problemType] = c.match;
      await fn(c, problemType);
    })(ctx);
  });
  bot.action('book_consultation', wrap('handleBookConsultation', subscriptionController));
  bot.action('dismiss_offer', wrap('handleDismissOffer', subscriptionController));

  // ===== Wheel
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

  // ===== Daily sessions (safe)
  bot.action('start_morning', wrap('handleStartMorning', dailyController));
  bot.action('later_morning', wrap('handleLaterMorning', dailyController));
  bot.action('start_evening', wrap('handleStartEvening', dailyController));
  bot.action('later_evening', wrap('handleLaterEvening', dailyController));
  bot.action('exit_session', wrap('handleExitSession', dailyController));
  bot.action('skip_morning_do_evening', wrap('handleSkipMorningDoEvening', dailyController));

  // Резюм-кнопки (щоб продовжити з місця зупинки)
bot.action('continue_morning', dailyController.handleContinueMorning);
bot.action('restart_morning',  dailyController.handleRestartMorning);

bot.action('continue_evening', dailyController.handleContinueEvening);
bot.action('restart_evening',  dailyController.handleRestartEvening);

  // ===== Навігація (dashboard)
  bot.action('main_menu', ensureHandler(dashboard?.showMainMenu));
  bot.action('show_capabilities', ensureHandler(dashboard?.showCapabilities));
  bot.action('instructions', ensureHandler(dashboard?.showInstructions));
  bot.action('help', ensureHandler(dashboard?.showHelp));

  // ===== TEXT — єдиний обробник
  bot.on('text', async (ctx) => {
    const tgId = ctx.from.id;
    const text = (ctx.message?.text || '').trim();

    // 1) daily першим
    try {
      const handledDaily = await dailyController?.handleText?.(ctx, text);
      if (handledDaily) return;
    } catch (e) {
      logger.error('[router] dailyController.handleText:', e.message);
    }

    // 2) wheel — якщо очікуємо нотатку
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

    // 3) AI-Mentor (динамічно)
    try {
      const aiMentorMod = await import('../features/aiMentor/index.js');
      const aiMentor = aiMentorMod?.default || aiMentorMod;
      const handledAi = await aiMentor?.handleText?.(ctx, text);
      if (handledAi) return;
    } catch (e) {
      logger.warn('[router] AI mentor module not found or no handleText:', e.message);
    }

    // 4) Dashboard
    try {
      const handledDash = await dashboard?.handleText?.(ctx, text);
      if (handledDash) return;
    } catch (e) {
      logger.error('[router] dashboard.handleText:', e.message);
    }

    // fallback
    await ctx.reply('Не зовсім зрозумів. Обери дію:', keyboards.mainMenuKeyboard());
  });

  bot.catch((err, ctx) => {
    logger.error(`[router] Global error for ${ctx.updateType}:`, err);
    try { ctx.reply('Сталася помилка. Спробуй ще раз пізніше.', keyboards.mainMenuKeyboard()); } catch {}
  });

  logger.info('✅ [router] Підключено');
};

export const initRouter = attachRoutes;
export default attachRoutes;
