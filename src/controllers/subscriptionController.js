// src/controllers/subscriptionController.js
// ФІНАЛЬНА ВЕРСІЯ: підписки + курси з винесеними константами та клавіатурами

import userService from '../services/userService.js';
import subscriptionService from '../services/subscriptionService.js';
import keyboards from '../utils/keyboards.js';
import typing from '../utils/typing.js';
import { 
  SUBSCRIPTION_PLANS, 
  WAYFORPAY_LINKS,
  COURSE_OFFERS,
  CONSULTATION_OFFER,
  PROBLEM_DESCRIPTIONS,
  ACTIVITY_TRIGGERS,
  SUBSCRIPTION_MESSAGES,
  COURSE_MESSAGES
} from '../config/constants.js';

// ═══════════════════════════════════════════════════════════════════════════════
// ДОПОМІЖНІ ФУНКЦІЇ
// ═══════════════════════════════════════════════════════════════════════════════

const safeEditOrReply = async (ctx, text, extra) => {
  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, extra);
    } else {
      await ctx.reply(text, extra);
    }
  } catch (e) {
    await ctx.reply(text, extra);
  }
};

const daysLeftFrom = (isoDate) => {
  if (!isoDate) return null;
  const end = new Date(isoDate);
  const today = new Date();
  const diff = Math.ceil((end.setHours(0,0,0,0) - today.setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
  return diff;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. ПІДПИСКИ - ІНФОРМАЦІЯ
// ═══════════════════════════════════════════════════════════════════════════════

const handleSubscriptionInfo = async (ctx) => {
  const tgId = ctx.from.id;

  try {
    const user = await userService.getUserByTgId(tgId);
    if (!user) {
      await typing(ctx);
      await ctx.reply('Спочатку зареєструйся командою /start');
      return;
    }

    const status = await subscriptionService.checkSubscriptionStatus(tgId);
    const plan = user['Active Subscription Plan'] || '—';
    const start = user.Start_Date ? new Date(user.Start_Date).toLocaleDateString('uk-UA') : '—';
    const end = user.End_Date ? new Date(user.End_Date).toLocaleDateString('uk-UA') : '—';

    const daysLeft = status?.endDate ? daysLeftFrom(status.endDate) : daysLeftFrom(user.End_Date);
    const expiringSoon = typeof daysLeft === 'number' && daysLeft >= 0 && daysLeft <= 3;

    let message = '💰 ПІДПИСКА:\n\n';

    if (status?.active) {
      message += SUBSCRIPTION_MESSAGES.INFO_ACTIVE(plan, start, end);
      if (expiringSoon) {
        message += SUBSCRIPTION_MESSAGES.INFO_EXPIRING(daysLeft);
      }
      await typing(ctx);
      await safeEditOrReply(ctx, message, keyboards.subscriptionInfoActiveKeyboard(expiringSoon));
    } else {
      message += SUBSCRIPTION_MESSAGES.INFO_INACTIVE;
      await typing(ctx);
      await safeEditOrReply(ctx, message, keyboards.subscriptionInfoInactiveKeyboard());
    }
  } catch (error) {
    console.error('❌ [subscriptionController] Помилка інформації:', error);
    await typing(ctx);
    await ctx.reply('Помилка отримання інформації про підписку', keyboards.mainMenuKeyboard());
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ПІДПИСКИ - ПЛАНИ
// ═══════════════════════════════════════════════════════════════════════════════

const handleSubscriptionPlans = async (ctx) => {
  await safeEditOrReply(ctx, SUBSCRIPTION_MESSAGES.PLANS_LIST, keyboards.subscriptionPlansKeyboard());
  if (ctx.callbackQuery) {
    try { await ctx.answerCbQuery('Оберіть план'); } catch {}
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ПІДПИСКИ - ОФОРМЛЕННЯ
// ═══════════════════════════════════════════════════════════════════════════════

const handleSubscribe = async (ctx, planKey) => {
  const tgId = ctx.from.id;

  try {
    const user = await userService.getUserByTgId(tgId);
    if (!user) {
      await ctx.answerCbQuery().catch(() => {});
      await ctx.reply('Спочатку зареєструйся командою /start');
      return;
    }

    const planInfo = SUBSCRIPTION_PLANS[planKey];
    if (!planInfo) {
      await ctx.answerCbQuery('Невірний план').catch(() => {});
      return;
    }

    const orderReference = `AIMENTOR_${planKey}_${tgId}_${Date.now()}`;
    const baseLink = WAYFORPAY_LINKS[planKey];
    
    if (!baseLink) {
      throw new Error('Невірний план');
    }

    const paymentLink = `${baseLink}?tg_id=${tgId}&orderReference=${orderReference}&productName=${encodeURIComponent(planInfo.name)}`;
    const message = SUBSCRIPTION_MESSAGES.PAYMENT(planInfo.name, planInfo.price, planInfo.duration, paymentLink);

    await safeEditOrReply(ctx, message, keyboards.subscriptionPaymentKeyboard(paymentLink));
    try { await ctx.answerCbQuery(`Обрано: ${planInfo.name}`); } catch {}
  } catch (error) {
    console.error('❌ [subscriptionController] Помилка підписки:', error);
    try { await ctx.answerCbQuery('Помилка створення оплати'); } catch {}
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ПІДПИСКИ - СИНХРОНІЗАЦІЯ
// ═══════════════════════════════════════════════════════════════════════════════

const handleSyncSubscription = async (ctx) => {
  const tgId = ctx.from.id;

  try {
    await typing(ctx);

    let progressMsg;
    if (!ctx.callbackQuery) {
      progressMsg = await ctx.reply('🔄 Перевіряю статус оплати...');
    } else {
      await safeEditOrReply(ctx, '🔄 Перевіряю статус оплати...');
    }

    const resultText = await subscriptionService.syncUserSubscription(tgId);

    if (progressMsg) {
      try { await ctx.telegram.deleteMessage(ctx.chat.id, progressMsg.message_id); } catch {}
    }

    await ctx.reply(resultText, keyboards.mainMenuKeyboard());
    try { await ctx.answerCbQuery('Статус оновлено'); } catch {}
  } catch (error) {
    console.error('❌ [subscriptionController] Помилка синхронізації:', error);
    await ctx.reply('Помилка оновлення статусу підписки', keyboards.mainMenuKeyboard());
    try { await ctx.answerCbQuery('Помилка оновлення'); } catch {}
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 5. ПІДПИСКИ - ПРОДОВЖЕННЯ
// ═══════════════════════════════════════════════════════════════════════════════

const handleRenewSubscription = async (ctx) => {
  await handleSubscriptionPlans(ctx);
  try { await ctx.answerCbQuery('Оберіть план для продовження'); } catch {}
};

const handleRenewalFromReminder = async (ctx, planKey) => {
  const tgId = ctx.from.id;

  try {
    const planInfo = SUBSCRIPTION_PLANS[planKey];
    if (!planInfo) {
      try { await ctx.answerCbQuery('Невірний план'); } catch {}
      return;
    }

    const orderReference = `RENEWAL_${planKey}_${tgId}_${Date.now()}`;
    const baseLink = WAYFORPAY_LINKS[planKey];
    
    if (!baseLink) {
      throw new Error('Невірний план');
    }

    const paymentLink = `${baseLink}?tg_id=${tgId}&orderReference=${orderReference}&productName=${encodeURIComponent(planInfo.name)}`;
    const message = SUBSCRIPTION_MESSAGES.RENEWAL(planInfo.name, planInfo.price, planInfo.duration, paymentLink);

    await safeEditOrReply(ctx, message, keyboards.subscriptionRenewalKeyboard(paymentLink));
    try { await ctx.answerCbQuery(`Продовження: ${planInfo.name}`); } catch {}
  } catch (error) {
    console.error('❌ [subscriptionController] Помилка продовження:', error);
    try { await ctx.answerCbQuery('Помилка'); } catch {}
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 6. ПІДТРИМКА
// ═══════════════════════════════════════════════════════════════════════════════

const handleContactSupport = async (ctx) => {
  const message = SUBSCRIPTION_MESSAGES.SUPPORT(ctx.from.id);
  await safeEditOrReply(ctx, message, keyboards.subscriptionSupportKeyboard());
  try { await ctx.answerCbQuery('Контакти надіслано'); } catch {}
};

// ═══════════════════════════════════════════════════════════════════════════════
// 7. КУРСИ - ПРОПОЗИЦІЇ ПОСЛУГ
// ═══════════════════════════════════════════════════════════════════════════════

const offerService = async (ctx, problemType, triggerData = null) => {
  const tgId = ctx.from.id;
  
  console.log(`[subscriptionController] 💡 Пропозиція послуги: ${problemType} для ${tgId}`);
  
  const offersThisMonth = await checkOffersCount(tgId);
  
  if (offersThisMonth >= ACTIVITY_TRIGGERS.MAX_OFFERS_PER_MONTH) {
    console.log(`[subscriptionController] ⚠️ Ліміт пропозицій досягнуто: ${offersThisMonth}/${ACTIVITY_TRIGGERS.MAX_OFFERS_PER_MONTH}`);
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
  
  await ctx.reply(message, keyboards.courseOfferKeyboard(problemType, offer.title, offer.price));
  await logOfferShown(tgId, problemType, offer.title);
};

// ═══════════════════════════════════════════════════════════════════════════════
// 8. КУРСИ - ПОКУПКА
// ═══════════════════════════════════════════════════════════════════════════════

const handleBuyCourse = async (ctx, problemType) => {
  const tgId = ctx.from.id;
  const offer = COURSE_OFFERS[problemType];
  
  if (!offer) {
    await ctx.answerCbQuery('Курс не знайдено');
    return;
  }
  
  const message = COURSE_MESSAGES.COURSE_INFO(offer.title, offer.price, tgId);
  
  await ctx.editMessageText(message, keyboards.courseInfoKeyboard());
  await ctx.answerCbQuery('Інформація надіслана');
  await logOfferClicked(tgId, problemType, offer.title);
};

// ═══════════════════════════════════════════════════════════════════════════════
// 9. КУРСИ - КОНСУЛЬТАЦІЯ
// ═══════════════════════════════════════════════════════════════════════════════

const handleBookConsultation = async (ctx) => {
  const tgId = ctx.from.id;
  const message = COURSE_MESSAGES.CONSULTATION_INFO(tgId);
  await ctx.editMessageText(message, keyboards.consultationInfoKeyboard());
  await ctx.answerCbQuery('Інформація надіслана');
  await logOfferClicked(tgId, 'consultation', 'Consultation 150€');
};

// ═══════════════════════════════════════════════════════════════════════════════
// 10. КУРСИ - ВІДХИЛЕННЯ ПРОПОЗИЦІЇ
// ═══════════════════════════════════════════════════════════════════════════════

const handleDismissOffer = async (ctx) => {
  await ctx.editMessageText(COURSE_MESSAGES.DISMISS, keyboards.dismissOfferKeyboard());
  await ctx.answerCbQuery('Зрозуміло');
};

// ═══════════════════════════════════════════════════════════════════════════════
// 11. ЛОГУВАННЯ ПРОПОЗИЦІЙ
// ═══════════════════════════════════════════════════════════════════════════════

const checkOffersCount = async (tgId) => {
  try {
    const { getBase, tables } = await import('../config/database.js');
    const base = getBase();
    
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const records = await base(tables.OFFERS_LOG || 'Offers_Log')
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", IS_AFTER({Shown_At}, "${startOfMonth.toISOString()}"))`
      })
      .firstPage();
    
    return records.length;
  } catch (error) {
    console.error('[checkOffersCount] Помилка:', error);
    return 0;
  }
};

const logOfferShown = async (tgId, problemType, offerTitle) => {
  try {
    const { getBase, tables } = await import('../config/database.js');
    const base = getBase();
    
    await base(tables.OFFERS_LOG || 'Offers_Log').create({
      TG_id: String(tgId),
      Problem_Type: problemType,
      Offer_Title: offerTitle,
      Shown_At: new Date().toISOString(),
      Status: 'shown'
    });
    
    console.log(`[logOfferShown] ✅ Пропозицію зафіксовано для ${tgId}`);
  } catch (error) {
    console.error('[logOfferShown] Помилка:', error);
  }
};

const logOfferClicked = async (tgId, problemType, offerTitle) => {
  try {
    const { getBase, tables } = await import('../config/database.js');
    const base = getBase();
    
    const records = await base(tables.OFFERS_LOG || 'Offers_Log')
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Offer_Title}="${offerTitle}", {Status}="shown")`,
        maxRecords: 1,
        sort: [{ field: 'Shown_At', direction: 'desc' }]
      })
      .firstPage();
    
    if (records.length > 0) {
      await base(tables.OFFERS_LOG || 'Offers_Log').update(records[0].id, {
        Status: 'clicked',
        Clicked_At: new Date().toISOString()
      });
      
      console.log(`[logOfferClicked] ✅ Клік зафіксовано для ${tgId}`);
    }
  } catch (error) {
    console.error('[logOfferClicked] Помилка:', error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 12. НАГАДУВАННЯ ПРО ЗАКІНЧЕННЯ ПІДПИСОК
// ═══════════════════════════════════════════════════════════════════════════════

const sendExpirationReminders = async (bot) => {
  try {
    console.log('[subscriptionController] 📅 Перевірка підписок, що закінчуються');
    const users = await userService.getUsersWithExpiringSubscriptions?.(1);
    if (!users || users.length === 0) return;

    for (const user of users) {
      const tgId = user.TG_id;
      const planName = user['Active Subscription Plan'] || 'План';
      const endDate = user.End_Date ? new Date(user.End_Date).toLocaleDateString('uk-UA') : '—';

      const message = SUBSCRIPTION_MESSAGES.EXPIRATION_REMINDER(planName, endDate);

      try {
        await bot.telegram.sendMessage(tgId, message, keyboards.subscriptionExpiringKeyboard());
        console.log(`[subscriptionController] ✅ Нагадування надіслано ${tgId}`);
      } catch (e) {
        console.error(`[subscriptionController] ❌ Помилка надсилання для ${tgId}:`, e.message);
      }

      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (error) {
    console.error('[subscriptionController] ❌ Помилка нагадувань:', error.message);
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 13. CALLBACK-РОУТЕР
// ═══════════════════════════════════════════════════════════════════════════════

const handleCallback = async (ctx) => {
  const data = ctx.callbackQuery?.data || '';
  const tgId = ctx.from.id;
  console.log(`📱 [subscriptionController] callback="${data}" від ${tgId}`);

  try {
    switch (data) {
      // ПІДПИСКИ
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

      case 'renew_subscription':
        await handleRenewSubscription(ctx);
        break;

      case 'sync_subscription':
        await handleSyncSubscription(ctx);
        break;

      case 'contact_support':
        await handleContactSupport(ctx);
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

      // КУРСИ
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

      default:
        console.log(`❓ [subscriptionController] Невідома команда: ${data}`);
        try { await ctx.answerCbQuery('Невідома команда'); } catch {}
    }
  } catch (error) {
    console.error('❌ [subscriptionController] Помилка callback:', { data, error: error.message, tgId });
    try { await ctx.answerCbQuery('Виникла помилка'); } catch {}
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ЕКСПОРТ
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  // Підписки
  handleSubscriptionInfo,
  handleSubscriptionPlans,
  handleSubscribe,
  handleSyncSubscription,
  handleRenewSubscription,
  handleContactSupport,
  handleRenewalFromReminder,
  handleCallback,
  sendExpirationReminders,
  
  // Курси та пропозиції
  offerService,
  handleBuyCourse,
  handleBookConsultation,
  handleDismissOffer
};