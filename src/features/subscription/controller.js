// src/features/subscription/controller.js

import service from './service.js';
import keyboards from '../../utils/keyboards.js';
import { 
  SUBSCRIPTION_PLANS, 
  WAYFORPAY_LINKS,
  COURSE_OFFERS,
  CONSULTATION_OFFER,
  PROBLEM_DESCRIPTIONS,
  ACTIVITY_TRIGGERS,
  SUBSCRIPTION_MESSAGES,
  COURSE_MESSAGES
} from '../../config/index.js';
import users from '../../services/users.js';

// ──────────────────────────────────────────────────────────────────────────────
// helpers (локальні)
// ──────────────────────────────────────────────────────────────────────────────

const safeEditOrReply = async (ctx, text, extra) => {
  try {
    // у callback'ах простіше одразу reply (щоб не ловити message_id)
    await ctx.reply(text, extra);
  } catch {
    try { await ctx.reply(text, extra); } catch {}
  }
};

const daysLeftFrom = (isoDate) => {
  if (!isoDate) return null;
  const end = new Date(isoDate);
  const today = new Date();
  const diff = Math.ceil((end.setHours(0,0,0,0) - today.setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
  return diff;
};

// ──────────────────────────────────────────────────────────────────────────────
// 1) Інфо про підписку
// ──────────────────────────────────────────────────────────────────────────────

const handleSubscriptionInfo = async (ctx) => {
  const tgId = ctx.from.id;

  try {
    const user = await users.getUserByTgId(tgId);
    if (!user) {
      await ctx.reply('Спочатку зареєструйся командою /start');
      return;
    }

    const status = await service.checkSubscriptionStatus(tgId);
    const plan = user['Active Subscription Plan'] || '—';
    const start = user.Start_Date ? new Date(user.Start_Date).toLocaleDateString('uk-UA') : '—';
    const end = user.End_Date ? new Date(user.End_Date).toLocaleDateString('uk-UA') : '—';

    const daysLeft = status?.endDate ? daysLeftFrom(status.endDate) : daysLeftFrom(user.End_Date);
    const expiringSoon = typeof daysLeft === 'number' && daysLeft >= 0 && daysLeft <= 3;

    let message = '💰 ПІДПИСКА:\n\n';

    if (status?.active) {
      message += SUBSCRIPTION_MESSAGES.INFO_ACTIVE(plan, start, end);
      if (expiringSoon) message += SUBSCRIPTION_MESSAGES.INFO_EXPIRING(daysLeft);
      await safeEditOrReply(ctx, message, keyboards.subscriptionInfoActiveKeyboard(expiringSoon));
    } else {
      message += SUBSCRIPTION_MESSAGES.INFO_INACTIVE;
      await safeEditOrReply(ctx, message, keyboards.subscriptionInfoInactiveKeyboard());
    }
  } catch (error) {
    console.error('❌ [subscription/controller] Інфо помилка:', error);
    await ctx.reply('Помилка отримання інформації про підписку', keyboards.mainMenuKeyboard());
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// 2) Плани
// ──────────────────────────────────────────────────────────────────────────────

const handleSubscriptionPlans = async (ctx) => {
  try {
    await safeEditOrReply(ctx, SUBSCRIPTION_MESSAGES.PLANS_LIST, keyboards.subscriptionPlansKeyboard());
    if (ctx.callbackQuery) { try { await ctx.answerCbQuery('Оберіть план'); } catch {} }
  } catch (e) {
    console.error('❌ [subscription/controller] Plans:', e?.message || e);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// 3) Оформлення оплати
// ──────────────────────────────────────────────────────────────────────────────

const handleSubscribe = async (ctx, planKey) => {
  const tgId = ctx.from.id;

  try {
    const user = await users.getUserByTgId(tgId);
    if (!user) {
      try { await ctx.answerCbQuery(); } catch {}
      await ctx.reply('Спочатку зареєструйся командою /start');
      return;
    }

    const planInfo = SUBSCRIPTION_PLANS[planKey];
    if (!planInfo) {
      try { await ctx.answerCbQuery('Невірний план'); } catch {}
      return;
    }

    const orderReference = `AIMENTOR_${planKey}_${tgId}_${Date.now()}`;
    const baseLink = WAYFORPAY_LINKS[planKey];
    if (!baseLink) throw new Error('Невірний план');

    const paymentLink = `${baseLink}?tg_id=${tgId}&orderReference=${orderReference}&productName=${encodeURIComponent(planInfo.name)}`;
    const message = SUBSCRIPTION_MESSAGES.PAYMENT(planInfo.name, planInfo.price, planInfo.duration, paymentLink);

    await safeEditOrReply(ctx, message, keyboards.subscriptionPaymentKeyboard(paymentLink));
    try { await ctx.answerCbQuery(`Обрано: ${planInfo.name}`); } catch {}
  } catch (error) {
    console.error('❌ [subscription/controller] Subscribe:', error);
    try { await ctx.answerCbQuery('Помилка створення оплати'); } catch {}
  }
};

// ──────────────────────────────────────────────────────────────────────────────
const handleSyncSubscription = async (ctx) => {
  const tgId = ctx.from.id;

  try {
    let progressMsg;
    if (!ctx.callbackQuery) {
      progressMsg = await ctx.reply('🔄 Перевіряю статус оплати...');
    } else {
      await safeEditOrReply(ctx, '🔄 Перевіряю статус оплати...');
    }

    const resultText = await service.syncUserSubscription(tgId);

    if (progressMsg) {
      try { await ctx.telegram.deleteMessage(ctx.chat.id, progressMsg.message_id); } catch {}
    }

    await ctx.reply(resultText, keyboards.mainMenuKeyboard());
    try { await ctx.answerCbQuery('Статус оновлено'); } catch {}
  } catch (error) {
    console.error('❌ [subscription/controller] Sync:', error);
    await ctx.reply('Помилка оновлення статусу підписки', keyboards.mainMenuKeyboard());
    try { await ctx.answerCbQuery('Помилка оновлення'); } catch {}
  }
};

// ──────────────────────────────────────────────────────────────────────────────
const handleRenewSubscription = async (ctx) => {
  await handleSubscriptionPlans(ctx);
  try { await ctx.answerCbQuery('Оберіть план для продовження'); } catch {}
};

const handleRenewalFromReminder = async (ctx, planKey) => {
  const tgId = ctx.from.id;

  try {
    const planInfo = SUBSCRIPTION_PLANS[planKey];
    if (!planInfo) { try { await ctx.answerCbQuery('Невірний план'); } catch {}; return; }

    const orderReference = `RENEWAL_${planKey}_${tgId}_${Date.now()}`;
    const baseLink = WAYFORPAY_LINKS[planKey];
    if (!baseLink) throw new Error('Невірний план');

    const paymentLink = `${baseLink}?tg_id=${tgId}&orderReference=${orderReference}&productName=${encodeURIComponent(planInfo.name)}`;
    const message = SUBSCRIPTION_MESSAGES.RENEWAL(planInfo.name, planInfo.price, planInfo.duration, paymentLink);

    await safeEditOrReply(ctx, message, keyboards.subscriptionRenewalKeyboard(paymentLink));
    try { await ctx.answerCbQuery(`Продовження: ${planInfo.name}`); } catch {}
  } catch (error) {
    console.error('❌ [subscription/controller] Renewal:', error);
    try { await ctx.answerCbQuery('Помилка'); } catch {}
  }
};

// ──────────────────────────────────────────────────────────────────────────────
const handleContactSupport = async (ctx) => {
  const message = SUBSCRIPTION_MESSAGES.SUPPORT(ctx.from.id);
  await safeEditOrReply(ctx, message, keyboards.subscriptionSupportKeyboard());
  try { await ctx.answerCbQuery('Контакти надіслано'); } catch {}
};

// ──────────────────────────────────────────────────────────────────────────────
// Курси / пропозиції
// ──────────────────────────────────────────────────────────────────────────────

const checkOffersCount = async (tgId) => {
  try {
    const { getBase, tables } = await import('../../config/database.js');
    const base = getBase();

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const records = await base(tables.OFFERS_LOG)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", IS_AFTER({Shown_At}, "${startOfMonth.toISOString()}"))`
      })
      .firstPage();

    return records.length;
  } catch (error) {
    console.error('[checkOffersCount] ❌', error);
    return 0;
  }
};

const logOfferShown = async (tgId, problemType, offerTitle) => {
  try {
    const { getBase, tables } = await import('../../config/database.js');
    const base = getBase();

    await base(tables.OFFERS_LOG).create({
      TG_id: String(tgId),
      Problem_Type: problemType,
      Offer_Title: offerTitle,
      Shown_At: new Date().toISOString(),
      Status: 'shown'
    });
  } catch (error) {
    console.error('[logOfferShown] ❌', error);
  }
};

const logOfferClicked = async (tgId, problemType, offerTitle) => {
  try {
    const { getBase, tables } = await import('../../config/database.js');
    const base = getBase();

    const records = await base(tables.OFFERS_LOG)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Offer_Title}="${offerTitle}", {Status}="shown")`,
        maxRecords: 1,
        sort: [{ field: 'Shown_At', direction: 'desc' }]
      })
      .firstPage();

    if (records.length > 0) {
      await base(tables.OFFERS_LOG).update(records[0].id, {
        Status: 'clicked',
        Clicked_At: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('[logOfferClicked] ❌', error);
  }
};

const offerService = async (ctx, problemType, triggerData = null) => {
  const tgId = ctx.from.id;

  const offersThisMonth = await checkOffersCount(tgId);
  if (offersThisMonth >= ACTIVITY_TRIGGERS.MAX_OFFERS_PER_MONTH) return;

  const offer = COURSE_OFFERS[problemType] || COURSE_OFFERS.no_goals;
  const triggerMessage = triggerData?.message || `Помічаю, що ти застрягла в ${PROBLEM_DESCRIPTIONS[problemType]}.`;

  const message = COURSE_MESSAGES.OFFER(
    offer.title,
    offer.price,
    offer.description,
    offer.benefit,
    triggerMessage
  );

  await ctx.reply(message, keyboards.courseOfferKeyboard(problemType, offer.title, offer.price));
  await logOfferShown(tgId, problemType, offer.title);
};

const handleBuyCourse = async (ctx, problemType) => {
  const tgId = ctx.from.id;
  const offer = COURSE_OFFERS[problemType];

  if (!offer) { await ctx.answerCbQuery('Курс не знайдено'); return; }

  const message = COURSE_MESSAGES.COURSE_INFO(offer.title, offer.price, tgId);
  await ctx.reply(message, keyboards.courseInfoKeyboard());
  await ctx.answerCbQuery('Інформація надіслана');
  await logOfferClicked(tgId, problemType, offer.title);
};

const handleBookConsultation = async (ctx) => {
  const tgId = ctx.from.id;
  const message = COURSE_MESSAGES.CONSULTATION_INFO(tgId);
  await ctx.reply(message, keyboards.consultationInfoKeyboard());
  await ctx.answerCbQuery('Інформація надіслана');
  await logOfferClicked(tgId, 'consultation', 'Consultation 150€');
};

const handleDismissOffer = async (ctx) => {
  await ctx.reply(COURSE_MESSAGES.DISMISS, keyboards.dismissOfferKeyboard());
  await ctx.answerCbQuery('Зрозуміло');
};

// ──────────────────────────────────────────────────────────────────────────────
// Нагадування про завершення підписок
// ──────────────────────────────────────────────────────────────────────────────

const sendExpirationReminders = async (bot) => {
  try {
    console.log('[subscription/controller] Перевірка підписок, що закінчуються…');
    const list = await service.getUsersWithExpiringSubscriptions?.(1);
    if (!list || !list.length) return;

    for (const u of list) {
      const tgId = u.TG_id;
      const planName = u['Active Subscription Plan'] || 'План';
      const endDate = u.End_Date ? new Date(u.End_Date).toLocaleDateString('uk-UA') : '—';
      const message = SUBSCRIPTION_MESSAGES.EXPIRATION_REMINDER(planName, endDate);

      try {
        await bot.telegram.sendMessage(tgId, message, keyboards.subscriptionExpiringKeyboard());
      } catch (e) {
        console.error(`[subscription/controller] ❌ Надсилання ${tgId}:`, e?.message || e);
      }

      // невелика пауза щоб не спамити API
      await new Promise((r) => setTimeout(r, 700));
    }
  } catch (e) {
    console.error('[subscription/controller] ❌ Reminders:', e?.message || e);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Експорт
// ──────────────────────────────────────────────────────────────────────────────

export {
  // підписки
  handleSubscriptionInfo,
  handleSubscriptionPlans,
  handleSubscribe,
  handleSyncSubscription,
  handleRenewSubscription,
  handleRenewalFromReminder,
  handleContactSupport,

  // курси
  offerService,
  handleBuyCourse,
  handleBookConsultation,
  handleDismissOffer,

  // нагадування
  sendExpirationReminders,
};

// default для зручного імпорту в index.js
export default {
  handleSubscriptionInfo,
  handleSubscriptionPlans,
  handleSubscribe,
  handleSyncSubscription,
  handleRenewSubscription,
  handleRenewalFromReminder,
  handleContactSupport,
  offerService,
  handleBuyCourse,
  handleBookConsultation,
  handleDismissOffer,
  sendExpirationReminders,
};

console.log('✅ [features/subscription/controller] Контролер завантажено');
