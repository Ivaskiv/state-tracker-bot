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

console.log('✅ [features/subscription] Модуль завантажено');
