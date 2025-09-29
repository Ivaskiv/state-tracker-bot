// src/controllers/subscriptionController.js
// ВИПРАВЛЕНО: WayForPay-лінки, узгоджені назви методів userService,
// надійні фолбеки editMessageText → reply, правильний sync, обробка keyboard

import userService from '../services/userService.js';
import subscriptionService from '../services/subscriptionService.js';
import keyboards from '../utils/keyboards.js';
import typing from '../utils/typing.js';
import { SUBSCRIPTION_PLANS } from '../config/constants.js';

// ✅ Лінки WayForPay (кнопки з Make/WayForPay)
const WAYFORPAY_LINKS = {
  WEEK:  'https://secure.wayforpay.com/button/b96923b913d29',
  MONTH: 'https://secure.wayforpay.com/button/b8df87678cd43',
  YEAR:  'https://secure.wayforpay.com/button/bf28701123683'
};

// ───────────────────────────────────────────────────────────────────────────────
// Допоміжні
// ───────────────────────────────────────────────────────────────────────────────

const safeEditOrReply = async (ctx, text, extra) => {
  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, extra);
    } else {
      await ctx.reply(text, extra);
    }
  } catch (e) {
    // якщо повідомлення не вдалося редагувати (старе/видалене) — шлемо нове
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

// ───────────────────────────────────────────────────────────────────────────────
// Інфо про підписку
// ───────────────────────────────────────────────────────────────────────────────

const handleSubscriptionInfo = async (ctx) => {
  const tgId = ctx.from.id;

  try {
    const user = await userService.getUserByTgId(tgId);
    if (!user) {
      await typing(ctx);
      await ctx.reply('Спочатку зареєструйся командою /start');
      return;
    }

    const status = await subscriptionService.checkSubscriptionStatus(tgId); // {active, raw, expired?, endDate?}
    const activeLine = user['Active_Subscription_Status'] || '';
    const plan = user['Active Subscription Plan'] || '—';
    const start = user.Start_Date ? new Date(user.Start_Date).toLocaleDateString('uk-UA') : '—';
    const end = user.End_Date ? new Date(user.End_Date).toLocaleDateString('uk-UA') : '—';

    // обчислимо daysLeft локально, якщо сервіс не повернув
    const daysLeft = status?.endDate ? daysLeftFrom(status.endDate) : daysLeftFrom(user.End_Date);
    const expiringSoon = typeof daysLeft === 'number' && daysLeft >= 0 && daysLeft <= 3;

    let message = '💰 ПІДПИСКА:\n\n';
    const kb = { reply_markup: { inline_keyboard: [] } };

    if (status?.active) {
      message += `✅ Активна\n📋 План: ${plan}\n🚀 Початок: ${start}\n📅 Діє до: ${end}`;
      if (expiringSoon) {
        message += `\n\n⚠️ Підписка закінчується через ${daysLeft} дн${daysLeft === 1 ? 'ь' : (daysLeft >= 2 && daysLeft <= 4 ? 'і' : 'ів')}!`;
        kb.reply_markup.inline_keyboard.push([{ text: '🔄 Продовжити підписку', callback_data: 'renew_subscription' }]);
      }
      kb.reply_markup.inline_keyboard.push([{ text: '🔄 Оновити статус', callback_data: 'sync_subscription' }]);
    } else {
      message += '❌ Неактивна\n\n💰 ДОСТУПНІ ПЛАНИ:\n';
      message += '🔹 Тиждень фокусу — 7€\n';
      message += '🔹 Місяць дії — 30€\n';
      message += '🔹 Рік трансформації — 300€\n\n';
      message += '💳 Оплата через WayForPay. Натисни, щоб обрати план:';

      kb.reply_markup.inline_keyboard.push(
        [{ text: '💳 Оформити підписку', callback_data: 'subscription_plans' }],
        [{ text: '🔄 Я вже оплатив', callback_data: 'sync_subscription' }]
      );
    }

    kb.reply_markup.inline_keyboard.push([{ text: '📞 Звʼязатися з підтримкою', callback_data: 'contact_support' }]);

    await typing(ctx);
    await safeEditOrReply(ctx, message, kb);
  } catch (error) {
    console.error('❌ [subscriptionController] Помилка інформації:', error);
    await typing(ctx);
    await ctx.reply('Помилка отримання інформації про підписку', keyboards.mainMenuKeyboard());
  }
};

// ───────────────────────────────────────────────────────────────────────────────
// Плани
// ───────────────────────────────────────────────────────────────────────────────

const handleSubscriptionPlans = async (ctx) => {
  const message =
    '💰 ОБЕРИ ПЛАН ПІДПИСКИ:\n\n' +
    '🔹 Тиждень фокусу — 7€\n' +
    'Ідеально для короткого фокусу або тесту системи\n\n' +
    '🔹 Місяць дії — 30€\n' +
    'Глибинна робота з твоїми цілями та стратегією\n\n' +
    '🔹 Рік трансформації — 300€\n' +
    'Максимальна економія та підтримка протягом року\n\n' +
    '✅ Безпечна оплата через WayForPay';

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '7€ — Тиждень', callback_data: 'subscribe_week' }],
        [{ text: '30€ — Місяць', callback_data: 'subscribe_month' }],
        [{ text: '300€ — Рік', callback_data: 'subscribe_year' }],
        [{ text: '📞 Підтримка', callback_data: 'contact_support' }],
        [{ text: '🔙 Назад', callback_data: 'subscription_info' }]
      ]
    }
  };

  await safeEditOrReply(ctx, message, keyboard);
  if (ctx.callbackQuery) {
    try { await ctx.answerCbQuery('Оберіть план'); } catch {}
  }
};

// ───────────────────────────────────────────────────────────────────────────────
// Почати оплату
// ───────────────────────────────────────────────────────────────────────────────

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

    // Унікальний orderReference
    const orderReference = `AIMENTOR_${planKey}_${tgId}_${Date.now()}`;

    // Вибір правильного WayForPay-лінка
    let baseLink = '';
    switch (planKey) {
      case 'WEEK':  baseLink = WAYFORPAY_LINKS.WEEK; break;
      case 'MONTH': baseLink = WAYFORPAY_LINKS.MONTH; break;
      case 'YEAR':  baseLink = WAYFORPAY_LINKS.YEAR; break;
      default: throw new Error('Невірний план');
    }

    const paymentLink = `${baseLink}?tg_id=${tgId}&orderReference=${orderReference}&productName=${encodeURIComponent(planInfo.name)}`;

    const message =
      `💳 ОПЛАТА ПІДПИСКИ\n\n` +
      `📋 План: ${planInfo.name}\n` +
      `💰 Вартість: ${planInfo.price}€\n` +
      `⏰ Тривалість: ${planInfo.duration} днів\n\n` +
      `🔗 Посилання для оплати:\n${paymentLink}\n\n` +
      `💡 Після оплати натисни «🔄 Я вже оплатив» для автоматичної активації.`;

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔗 Перейти до оплати', url: paymentLink }],
          [{ text: '🔄 Я вже оплатив', callback_data: 'sync_subscription' }],
          [{ text: '📞 Підтримка', callback_data: 'contact_support' }],
          [{ text: '🔙 Назад', callback_data: 'subscription_plans' }]
        ]
      }
    };

    await safeEditOrReply(ctx, message, keyboard);
    try { await ctx.answerCbQuery(`Обрано: ${planInfo.name}`); } catch {}
  } catch (error) {
    console.error('❌ [subscriptionController] Помилка підписки:', error);
    try { await ctx.answerCbQuery('Помилка створення оплати'); } catch {}
  }
};

// ───────────────────────────────────────────────────────────────────────────────
// Синхронізація статусу (після оплати)
// ───────────────────────────────────────────────────────────────────────────────

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

    // Викликаємо сервіс синхронізації
    const resultText = await subscriptionService.syncUserSubscription(tgId);

    // прибираємо проміжне повідомлення
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

// ───────────────────────────────────────────────────────────────────────────────
// Продовження (кнопка "Продовжити підписку")
// ───────────────────────────────────────────────────────────────────────────────

const handleRenewSubscription = async (ctx) => {
  await handleSubscriptionPlans(ctx);
  try { await ctx.answerCbQuery('Оберіть план для продовження'); } catch {}
};

// ───────────────────────────────────────────────────────────────────────────────
// Підтримка
// ───────────────────────────────────────────────────────────────────────────────

const handleContactSupport = async (ctx) => {
  const message =
`📞 ЗВʼЯЗОК З ПІДТРИМКОЮ

💬 *Про підписку:*
• Email: nadyastarway@gmail.com
• Telegram: @Nadya2316 (ментор)
• Telegram: @vira_333 (техпідтримка)

📋 *Що написати:*
• Твій Telegram ID: ${ctx.from.id}
• Проблема з оплатою або активацією
• Скрін чеку (якщо є)

⏰ *Час відповіді:* 2–4 години у робочі дні

💡 *Швидке рішення:*
Натисни «🔄 Я вже оплатив» для автоматичної перевірки`;

  const kb = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 Я вже оплатив', callback_data: 'sync_subscription' }],
        [{ text: '🔙 Назад до підписки', callback_data: 'subscription_info' }]
      ]
    }
  };

  await safeEditOrReply(ctx, message, kb);
  try { await ctx.answerCbQuery('Контакти надіслано'); } catch {}
};

// ───────────────────────────────────────────────────────────────────────────────
// Ремайндер у приват (через bot.telegram)
// ───────────────────────────────────────────────────────────────────────────────

const handleRenewalFromReminder = async (ctx, planKey) => {
  const tgId = ctx.from.id;

  try {
    const planInfo = SUBSCRIPTION_PLANS[planKey];
    if (!planInfo) {
      try { await ctx.answerCbQuery('Невірний план'); } catch {}
      return;
    }

    const orderReference = `RENEWAL_${planKey}_${tgId}_${Date.now()}`;

    let baseLink = '';
    switch (planKey) {
      case 'WEEK':  baseLink = WAYFORPAY_LINKS.WEEK; break;
      case 'MONTH': baseLink = WAYFORPAY_LINKS.MONTH; break;
      case 'YEAR':  baseLink = WAYFORPAY_LINKS.YEAR; break;
      default: throw new Error('Невірний план');
    }

    const paymentLink = `${baseLink}?tg_id=${tgId}&orderReference=${orderReference}&productName=${encodeURIComponent(planInfo.name)}`;

    const message =
      `🔄 ПРОДОВЖЕННЯ ПІДПИСКИ\n\n` +
      `📋 План: ${planInfo.name}\n` +
      `💰 Вартість: ${planInfo.price}€\n` +
      `⏰ Тривалість: ${planInfo.duration} днів\n\n` +
      `✅ Після оплати натисни «🔄 Перевірити оплату»\n\n` +
      `🔗 Посилання для оплати:\n${paymentLink}`;

    const kb = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔗 Перейти до оплати', url: paymentLink }],
          [{ text: '🔄 Перевірити оплату', callback_data: 'sync_subscription' }],
          [{ text: '📞 Підтримка', callback_data: 'contact_support' }]
        ]
      }
    };

    await safeEditOrReply(ctx, message, kb);
    try { await ctx.answerCbQuery(`Продовження: ${planInfo.name}`); } catch {}
  } catch (error) {
    console.error('❌ [subscriptionController] Помилка продовження:', error);
    try { await ctx.answerCbQuery('Помилка'); } catch {}
  }
};

// ───────────────────────────────────────────────────────────────────────────────
// Callback-роутер
// ───────────────────────────────────────────────────────────────────────────────

const handleCallback = async (ctx) => {
  const data = ctx.callbackQuery?.data || '';
  const tgId = ctx.from.id;
  console.log(`📱 [subscriptionController] callback="${data}" від ${tgId}`);

  try {
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

      default:
        console.log(`❓ [subscriptionController] Невідома команда: ${data}`);
        try { await ctx.answerCbQuery('Невідома команда'); } catch {}
    }
  } catch (error) {
    console.error('❌ [subscriptionController] Помилка callback:', { data, error: error.message, tgId });
    try { await ctx.answerCbQuery('Виникла помилка'); } catch {}
  }
};

// ───────────────────────────────────────────────────────────────────────────────
// Нагадування про закінчення
// ───────────────────────────────────────────────────────────────────────────────

const sendExpirationReminders = async (bot) => {
  try {
    console.log('[subscriptionController] 📅 Перевірка підписок, що закінчуються');
    // якщо у тебе є userService.getUsersWithExpiringSubscriptions — лишаємо як є:
    const users = await userService.getUsersWithExpiringSubscriptions?.(1);
    if (!users || users.length === 0) return;

    for (const user of users) {
      const tgId = user.TG_id;
      const planName = user['Active Subscription Plan'] || 'План';
      const endDate = user.End_Date ? new Date(user.End_Date).toLocaleDateString('uk-UA') : '—';

      const message =
        `⚠️ Підписка закінчується завтра!\n\n` +
        `📋 План: ${planName}\n` +
        `📅 Діє до: ${endDate}\n\n` +
        `💰 Продовж підписку зараз, щоб не втратити доступ до всіх функцій!`;

      const kb = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Продовжити на тиждень — 7€', callback_data: 'renew_week' }],
            [{ text: '🔄 Продовжити на місяць — 30€', callback_data: 'renew_month' }],
            [{ text: '🔄 Продовжити на рік — 300€', callback_data: 'renew_year' }],
            [{ text: '📞 Звʼязатися з підтримкою', callback_data: 'contact_support' }]
          ]
        }
      };

      try {
        await bot.telegram.sendMessage(tgId, message, kb);
        console.log(`[subscriptionController] ✅ Нагадування надіслано ${tgId}`);
      } catch (e) {
        console.error(`[subscriptionController] ❌ Помилка надсилання для ${tgId}:`, e.message);
      }

      // щоб не потрапляти у flood control
      await new Promise((r) => setTimeout(r, 1000));
    }
  } catch (error) {
    console.error('[subscriptionController] ❌ Помилка нагадувань:', error.message);
  }
};

export default {
  handleSubscriptionInfo,
  handleSubscriptionPlans,
  handleSubscribe,
  handleSyncSubscription,
  handleRenewSubscription,
  handleContactSupport,
  handleRenewalFromReminder,
  handleCallback,
  sendExpirationReminders
};
