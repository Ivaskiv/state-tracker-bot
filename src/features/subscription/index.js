// src/features/subscription/index.js

import controller from './controller.js';

const wrap = (fn) => async (ctx, ...args) => {
  try {
    await fn(ctx, ...args);
  } catch (e) {
    console.error('[subscription] ❌ Handler error:', e?.message || e);
    try { await ctx.answerCbQuery?.('Помилка'); } catch {}
    try { await ctx.reply?.('Сталася помилка. Спробуй ще раз пізніше.'); } catch {}
  }
};

export default function initSubscription(bot) {
  console.log('💰 [subscription] Ініціалізація…');

  // ── Команди (короткі ярлики) ────────────────────────────────────────────────
  bot.command('subscription', wrap(controller.handleSubscriptionInfo));
  bot.command('subscriptions', wrap(controller.handleSubscriptionInfo));
  bot.command('sub', wrap(controller.handleSubscriptionInfo));
  bot.command('renew', wrap(controller.handleRenewSubscription));
  bot.command('syncsub', wrap(controller.handleSyncSubscription));

  // ── Підписки: інфо/плани/оплата/синк ────────────────────────────────────────
  bot.action('subscription_info', wrap(controller.handleSubscriptionInfo));
  bot.action('subscription_plans', wrap(controller.handleSubscriptionPlans));
  bot.action('renew_subscription', wrap(controller.handleRenewSubscription));
  bot.action('sync_subscription', wrap(controller.handleSyncSubscription));
  bot.action('contact_support', wrap(controller.handleContactSupport));

  // Оплата/активація за планами
  bot.action('subscribe_week', (ctx) => wrap(controller.handleSubscribe)(ctx, 'WEEK'));
  bot.action('subscribe_month', (ctx) => wrap(controller.handleSubscribe)(ctx, 'MONTH'));
  bot.action('subscribe_year', (ctx) => wrap(controller.handleSubscribe)(ctx, 'YEAR'));

  // Продовження за нагадуванням
  bot.action('renew_week', (ctx) => wrap(controller.handleRenewalFromReminder)(ctx, 'WEEK'));
  bot.action('renew_month', (ctx) => wrap(controller.handleRenewalFromReminder)(ctx, 'MONTH'));
  bot.action('renew_year', (ctx) => wrap(controller.handleRenewalFromReminder)(ctx, 'YEAR'));

  // ── Курси / послуги ─────────────────────────────────────────────────────────
  bot.action('buy_course_low_activity', wrap((ctx) => controller.handleBuyCourse(ctx, 'low_activity')));
  bot.action('buy_course_fear', wrap((ctx) => controller.handleBuyCourse(ctx, 'fear')));
  bot.action('buy_course_no_goals', wrap((ctx) => controller.handleBuyCourse(ctx, 'no_goals')));
  bot.action('buy_course_state_mastery', wrap((ctx) => controller.handleBuyCourse(ctx, 'state_mastery')));
  bot.action('book_consultation', wrap(controller.handleBookConsultation));
  bot.action('dismiss_offer', wrap(controller.handleDismissOffer));

  // ── Службові логування ─────────────────────────────────────────────────────
  console.log('✅ [features/subscription] Callbacks підписані');
}

/**
 * Опціонально: утиліта для ручного запуску нагадувань про завершення підписок
 * Використання: import { runExpirationReminders } ... і викликати з вашого cron чи адмін-команди
 */
export const runExpirationReminders = async (bot) => {
  try {
    await controller.sendExpirationReminders(bot);
  } catch (e) {
    console.error('[subscription] ❌ sendExpirationReminders:', e?.message || e);
  }
};
export const handleCallback = async (ctx) => {
  const data = ctx.callbackQuery?.data;
  
  const subscriptionCallbacks = [
    'subscription_info', 'subscription_plans', 'subscribe_week', 'subscribe_month',
    'subscribe_year', 'sync_subscription', 'renew_subscription', 'contact_support',
    'buy_course_low_activity', 'buy_course_fear', 'buy_course_no_goals',
    'buy_course_state_mastery', 'book_consultation', 'dismiss_offer',
    'renew_week', 'renew_month', 'renew_year'
  ];

  if (!subscriptionCallbacks.includes(data)) return false;

  try {
    // Маршрутизуємо до контролера
    const { 
      handleSubscriptionInfo, 
      handleSubscriptionPlans, 
      handleSubscribe,
      handleSyncSubscription,
      handleRenewSubscription,
      handleRenewalFromReminder,
      handleContactSupport,
      handleBuyCourse,
      handleBookConsultation,
      handleDismissOffer
    } = await import('./controller.js').then(m => m.default);

    switch (data) {
      case 'subscription_info':
        await handleSubscriptionInfo(ctx);
        break;
      case 'subscription_plans':
        await handleSubscriptionPlans(ctx);
        break;
      case 'subscribe_week':
        await handleSubscribe(ctx, 'WEEK');
        break;
      case 'subscribe_month':
        await handleSubscribe(ctx, 'MONTH');
        break;
      case 'subscribe_year':
        await handleSubscribe(ctx, 'YEAR');
        break;
      case 'sync_subscription':
        await handleSyncSubscription(ctx);
        break;
      case 'renew_subscription':
        await handleRenewSubscription(ctx);
        break;
      case 'contact_support':
        await handleContactSupport(ctx);
        break;
      case 'buy_course_low_activity':
        await handleBuyCourse(ctx, 'low_activity');
        break;
      case 'buy_course_fear':
        await handleBuyCourse(ctx, 'fear');
        break;
      case 'buy_course_no_goals':
        await handleBuyCourse(ctx, 'no_goals');
        break;
      case 'buy_course_state_mastery':
        await handleBuyCourse(ctx, 'state_mastery');
        break;
      case 'book_consultation':
        await handleBookConsultation(ctx);
        break;
      case 'dismiss_offer':
        await handleDismissOffer(ctx);
        break;
      case 'renew_week':
        await handleRenewalFromReminder(ctx, 'WEEK');
        break;
      case 'renew_month':
        await handleRenewalFromReminder(ctx, 'MONTH');
        break;
      case 'renew_year':
        await handleRenewalFromReminder(ctx, 'YEAR');
        break;
    }

    return true;
  } catch (error) {
    console.error('[subscription/handleCallback] ❌ Помилка:', error);
    return false;
  }
};
console.log('✅ [features/subscription] Модуль завантажено');
