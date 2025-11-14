// src/features/subscription/controller.js — БЕЗ REPO

import service from './service.js';
import keyboards from '../../utils/keyboards.js';
import logger from '../../utils/logger.js';
import { getBase, tables } from '../../config/database.js';
import { 
  COURSE_MESSAGES, 
  COURSE_OFFERS, 
  SUBSCRIPTION_MESSAGES, 
  SUBSCRIPTION_PLANS, 
  WAYFORPAY_LINKS 
} from '../../config/constants.js';

const base = getBase();

// ──────────────────────────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────────────────────────

const daysLeftFrom = (isoDate) => {
  if (!isoDate) return null;
  const end = new Date(isoDate);
  const today = new Date();
  const diff = Math.ceil((end.setHours(0,0,0,0) - today.setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
  return diff;
};

const safeSend = async (bot, tgId, text, extra = {}) => {
  try {
    await bot.telegram.sendMessage(tgId, text, { parse_mode: 'Markdown', ...extra });
    return true;
  } catch (e) {
    logger.error(`[subscription] ❌ Send ${tgId}:`, e.message);
    return false;
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// 1) Інфо про підписку
// ──────────────────────────────────────────────────────────────────────────────

export const handleSubscriptionInfo = async (ctx) => {
  const tgId = ctx.from.id;

  try {
    const user = await getUserByTgId(tgId);
    if (!user) {
      await ctx.reply('Спочатку зареєструйся командою /start');
      return;
    }

    const status = await service.checkSubscriptionStatus(tgId);
    const plan = user.fields['Active_Subscription_Plan'] || '—';
    const start = user.fields.Start_Date ? new Date(user.fields.Start_Date).toLocaleDateString('uk-UA') : '—';
    const end = user.fields.End_Date ? new Date(user.fields.End_Date).toLocaleDateString('uk-UA') : '—';

    const daysLeft = status?.endDate ? daysLeftFrom(status.endDate) : daysLeftFrom(user.fields.End_Date);
    const expiringSoon = typeof daysLeft === 'number' && daysLeft >= 0 && daysLeft <= 3;

    let message = '💰 **ПІДПИСКА:**\n\n';

    if (status?.active) {
      message += SUBSCRIPTION_MESSAGES.INFO_ACTIVE(plan, start, end);
      if (expiringSoon) message += SUBSCRIPTION_MESSAGES.INFO_EXPIRING(daysLeft);
      
      await ctx.reply(message, { 
        parse_mode: 'Markdown',
        ...keyboards.subscriptionInfoActiveKeyboard(expiringSoon)
      });
    } else {
      message += SUBSCRIPTION_MESSAGES.INFO_INACTIVE;
      
      await ctx.reply(message, { 
        parse_mode: 'Markdown',
        ...keyboards.subscriptionInfoInactiveKeyboard()
      });
    }
  } catch (error) {
    logger.error('[subscription] ❌ handleSubscriptionInfo:', error.message);
    await ctx.reply('❌ Помилка отримання інформації про підписку', keyboards.mainMenuKeyboard());
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// 2) Плани
// ──────────────────────────────────────────────────────────────────────────────

export const handleSubscriptionPlans = async (ctx) => {
  try {
    await ctx.reply(SUBSCRIPTION_MESSAGES.PLANS_LIST, { 
      parse_mode: 'Markdown',
      ...keyboards.subscriptionPlansKeyboard()
    });
    
    if (ctx.callbackQuery) {
      try { await ctx.answerCbQuery('Оберіть план'); } catch {}
    }
  } catch (e) {
    logger.error('[subscription] ❌ handleSubscriptionPlans:', e.message);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// 3) Оформлення оплати
// ──────────────────────────────────────────────────────────────────────────────

export const handleSubscribe = async (ctx, planKey) => {
  const tgId = ctx.from.id;

  try {
    const user = await getUserByTgId(tgId);
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

    const paymentLink = `${baseLink}?tg_id=${tgId}&orderReference=${orderReference}&productName=${encodeURIComponent(planInfo.userName)}`;
    const message = SUBSCRIPTION_MESSAGES.PAYMENT(planInfo.userName, planInfo.price, planInfo.duration, paymentLink);

    await ctx.reply(message, { 
      parse_mode: 'Markdown',
      ...keyboards.subscriptionPaymentKeyboard(paymentLink)
    });
    
    try { await ctx.answerCbQuery(`Обрано: ${planInfo.userName}`); } catch {}
  } catch (error) {
    logger.error('[subscription] ❌ handleSubscribe:', error.message);
    try { await ctx.answerCbQuery('Помилка створення оплати'); } catch {}
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// 4) Синхронізація статусу
// ──────────────────────────────────────────────────────────────────────────────

export const handleSyncSubscription = async (ctx) => {
  const tgId = ctx.from.id;

  try {
    let progressMsg;
    if (!ctx.callbackQuery) {
      progressMsg = await ctx.reply('🔄 Перевіряю статус оплати...');
    } else {
      await ctx.reply('🔄 Перевіряю статус оплати...');
    }

    const resultText = await service.syncUserSubscription(tgId);

    if (progressMsg) {
      try { await ctx.telegram.deleteMessage(ctx.chat.id, progressMsg.message_id); } catch {}
    }

    await ctx.reply(resultText, keyboards.mainMenuKeyboard());
    try { await ctx.answerCbQuery('Статус оновлено'); } catch {}
  } catch (error) {
    logger.error('[subscription] ❌ handleSyncSubscription:', error.message);
    await ctx.reply('❌ Помилка оновлення статусу підписки', keyboards.mainMenuKeyboard());
    try { await ctx.answerCbQuery('Помилка оновлення'); } catch {}
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// 5) Продовження підписки
// ──────────────────────────────────────────────────────────────────────────────

export const handleRenewSubscription = async (ctx) => {
  try {
    await ctx.reply(SUBSCRIPTION_MESSAGES.PLANS_LIST, { 
      parse_mode: 'Markdown',
      ...keyboards.subscriptionPlansKeyboard()
    });
    try { await ctx.answerCbQuery('Оберіть план для продовження'); } catch {}
  } catch (error) {
    logger.error('[subscription] ❌ handleRenewSubscription:', error.message);
  }
};

export const handleRenewalFromReminder = async (ctx, planKey) => {
  const tgId = ctx.from.id;

  try {
    const planInfo = SUBSCRIPTION_PLANS[planKey];
    if (!planInfo) { 
      try { await ctx.answerCbQuery('Невірний план'); } catch {}
      return;
    }

    const orderReference = `RENEWAL_${planKey}_${tgId}_${Date.now()}`;
    const baseLink = WAYFORPAY_LINKS[planKey];
    if (!baseLink) throw new Error('Невірний план');

    const paymentLink = `${baseLink}?tg_id=${tgId}&orderReference=${orderReference}&productName=${encodeURIComponent(planInfo.userName)}`;
    const message = SUBSCRIPTION_MESSAGES.RENEWAL(planInfo.userName, planInfo.price, planInfo.duration, paymentLink);

    await ctx.reply(message, { 
      parse_mode: 'Markdown',
      ...keyboards.subscriptionRenewalKeyboard(paymentLink)
    });
    
    try { await ctx.answerCbQuery(`Продовження: ${planInfo.userName}`); } catch {}
  } catch (error) {
    logger.error('[subscription] ❌ handleRenewalFromReminder:', error.message);
    try { await ctx.answerCbQuery('Помилка'); } catch {}
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// 6) Підтримка
// ──────────────────────────────────────────────────────────────────────────────

export const handleContactSupport = async (ctx) => {
  try {
    const message = SUBSCRIPTION_MESSAGES.SUPPORT(ctx.from.id);
    
    await ctx.reply(message, { 
      parse_mode: 'Markdown',
      ...keyboards.subscriptionSupportKeyboard()
    });
    
    try { await ctx.answerCbQuery('Контакти надіслано'); } catch {}
  } catch (error) {
    logger.error('[subscription] ❌ handleContactSupport:', error.message);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// 7) КУРСИ / ПРОПОЗИЦІЇ
// ──────────────────────────────────────────────────────────────────────────────

const checkOffersCount = async (tgId) => {
  try {
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
    logger.error('[subscription] ❌ checkOffersCount:', error.message);
    return 0;
  }
};

const logOfferShown = async (tgId, problemType, offerTitle) => {
  try {
    await base(tables.OFFERS_LOG).create([{
      fields: {
        TG_id: String(tgId),
        Problem_Type: problemType,
        Offer_Title: offerTitle,
        Shown_At: new Date().toISOString(),
        Status: 'shown'
      }
    }]);
  } catch (error) {
    logger.error('[subscription] ❌ logOfferShown:', error.message);
  }
};

const logOfferClicked = async (tgId, problemType, offerTitle) => {
  try {
    const records = await base(tables.OFFERS_LOG)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Offer_Title}="${offerTitle}", {Status}="shown")`,
        maxRecords: 1,
        sort: [{ field: 'Shown_At', direction: 'desc' }]
      })
      .firstPage();

    if (records.length > 0) {
      await base(tables.OFFERS_LOG).update([{
        id: records[0].id,
        fields: {
          Status: 'clicked',
          Clicked_At: new Date().toISOString()
        }
      }]);
    }
  } catch (error) {
    logger.error('[subscription] ❌ logOfferClicked:', error.message);
  }
};

export const offerService = async (ctx, problemType, triggerData = null) => {
  const tgId = ctx.from.id;

  try {
    const offersThisMonth = await checkOffersCount(tgId);
    if (offersThisMonth >= ACTIVITY_TRIGGERS.MAX_OFFERS_PER_MONTH) {
      logger.warn(`[subscription] ⚠️ Ліміт пропозицій для ${tgId}`);
      return;
    }

    const offer = COURSE_OFFERS[problemType] || COURSE_OFFERS.no_goals;
    const triggerMessage = triggerData?.message || `Помічаю, що ти застрягла в ${PROBLEM_DESCRIPTIONS[problemType]}.`;

    const message = COURSE_MESSAGES.OFFER(
      offer.title,
      offer.price,
      offer.description,
      offer.benefit,
      triggerMessage
    );

    await ctx.reply(message, { 
      parse_mode: 'Markdown',
      ...keyboards.courseOfferKeyboard(problemType, offer.title, offer.price)
    });
    
    await logOfferShown(tgId, problemType, offer.title);
  } catch (error) {
    logger.error('[subscription] ❌ offerService:', error.message);
  }
};

export const handleBuyCourse = async (ctx, problemType) => {
  const tgId = ctx.from.id;
  const offer = COURSE_OFFERS[problemType];

  if (!offer) { 
    try { await ctx.answerCbQuery('Курс не знайдено'); } catch {}
    return;
  }

  try {
    const message = COURSE_MESSAGES.COURSE_INFO(offer.title, offer.price, tgId);
    
    await ctx.reply(message, { 
      parse_mode: 'Markdown',
      ...keyboards.courseInfoKeyboard()
    });
    
    try { await ctx.answerCbQuery('Інформація надіслана'); } catch {}
    await logOfferClicked(tgId, problemType, offer.title);
  } catch (error) {
    logger.error('[subscription] ❌ handleBuyCourse:', error.message);
  }
};

export const handleBookConsultation = async (ctx) => {
  const tgId = ctx.from.id;

  try {
    const message = COURSE_MESSAGES.CONSULTATION_INFO(tgId);
    
    await ctx.reply(message, { 
      parse_mode: 'Markdown',
      ...keyboards.consultationInfoKeyboard()
    });
    
    try { await ctx.answerCbQuery('Інформація надіслана'); } catch {}
    await logOfferClicked(tgId, 'consultation', 'Consultation 150€');
  } catch (error) {
    logger.error('[subscription] ❌ handleBookConsultation:', error.message);
  }
};

export const handleDismissOffer = async (ctx) => {
  try {
    await ctx.reply(COURSE_MESSAGES.DISMISS, { 
      parse_mode: 'Markdown',
      ...keyboards.dismissOfferKeyboard()
    });
    
    try { await ctx.answerCbQuery('Зрозуміло'); } catch {}
  } catch (error) {
    logger.error('[subscription] ❌ handleDismissOffer:', error.message);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// 8) Нагадування про завершення підписок
// ──────────────────────────────────────────────────────────────────────────────

export const sendExpirationReminders = async (bot) => {
  try {
    logger.info('[subscription] ⏰ Перевірка підписок, що закінчуються…');
    
    const expiring = await service.getUsersWithExpiringSubscriptions?.(1);
    if (!expiring || !expiring.length) {
      logger.info('[subscription] ℹ️ Немає користувачів з підписками, що закінчуються');
      return;
    }

    for (const u of expiring) {
      const tgId = u.TG_id;
      const planName = u['Active_Subscription_Plan'] || 'План';
      const endDate = u.End_Date ? new Date(u.End_Date).toLocaleDateString('uk-UA') : '—';

      const message = SUBSCRIPTION_MESSAGES.EXPIRATION_REMINDER(planName, endDate);

      try {
        await bot.telegram.sendMessage(tgId, message, { 
          parse_mode: 'Markdown',
          ...keyboards.subscriptionExpiringKeyboard()
        });
      } catch (e) {
        logger.warn(`[subscription] ⚠️ Не вдалося надіслати ${tgId}:`, e.message);
      }

      await new Promise(r => setTimeout(r, 700));
    }

    logger.info(`[subscription] ✅ Нагадування надіслано ${expiring.length} користувачам`);
  } catch (e) {
    logger.error('[subscription] ❌ sendExpirationReminders:', e.message);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// EXPORT DEFAULT
// ──────────────────────────────────────────────────────────────────────────────

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