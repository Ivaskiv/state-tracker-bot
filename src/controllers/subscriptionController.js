// src/controllers/subscriptionController.js

import userService from '../auth/services/userService.js';
import subscriptionService from '../auth/services/subscriptionService.js';
import subscriptionSync from '../auth/services/subscriptionSync.js';
import wayforpayService from '../services/wayforpayService.js';
import keyboards from '../utils/keyboards.js';
import typing from '../utils/typing.js';
import { SUBSCRIPTION_PLANS } from '../config/constants.js';

const handleSubscriptionInfo = async (ctx) => {
  const tgId = ctx.from.id;
  
  try {
    const user = await userService.getUserByTelegramId(tgId);
    if (!user) {
      await typing(ctx);
      await ctx.reply('Спочатку зареєструйся /start');
      return;
    }

    const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(tgId);
    const active = user['Active_Subscription_Status'] || '❌ Неактивна';
    const plan = user['Active Subscription Plan'] || '—';
    const start = user['Start_Date'] ? new Date(user['Start_Date']).toLocaleDateString('uk-UA') : '—';
    const end = user['End_Date'] ? new Date(user['End_Date']).toLocaleDateString('uk-UA') : '—';

    let message = '💰 ПІДПИСКА:\n\n';
    
    if (subscriptionStatus.active) {
      message += `✅ Активна\n📋 План: ${plan}\n🚀 Початок: ${start}\n📅 Діє до: ${end}`;
      
      if (subscriptionStatus.expiringSoon) {
        message += `\n\n⚠️ Підписка закінчується через ${subscriptionStatus.daysLeft} днів!`;
      }
    } else {
      message += '❌ Неактивна\n\n💰 ДОСТУПНІ ПЛАНИ:\n';
      message += '🔹 Тиждень фокусу — 7€\n';
      message += '🔹 Місяць дії — 30€\n';  
      message += '🔹 Рік трансформації — 300€\n\n';
      message += '📧 Для швидкого оформлення натисни кнопку нижче';
    }

    const keyboard = {
      reply_markup: {
        inline_keyboard: []
      }
    };

    if (subscriptionStatus.active) {
      if (subscriptionStatus.expiringSoon) {
        keyboard.reply_markup.inline_keyboard.push(
          [{ text: '🔄 Продовжити підписку', callback_data: 'renew_subscription' }]
        );
      }
      keyboard.reply_markup.inline_keyboard.push(
        [{ text: '🔄 Оновити статус', callback_data: 'sync_subscription' }]
      );
    } else {
      keyboard.reply_markup.inline_keyboard.push(
        [{ text: '💳 Оформити підписку', callback_data: 'subscription_plans' }],
        [{ text: '🔄 Я вже оплатив', callback_data: 'sync_subscription' }]
      );
    }
    
    keyboard.reply_markup.inline_keyboard.push(
      [{ text: '📞 Зв\'язатися з підтримкою', callback_data: 'contact_support' }]
    );

    await typing(ctx);
    await ctx.reply(message, keyboard);
    
  } catch (error) {
    console.error('❌ [subscriptionController] Помилка інформації:', error);
    await typing(ctx);
    await ctx.reply('Помилка отримання інформації про підписку', keyboards.mainMenuKeyboard());
  }
};

const handleSubscriptionPlans = async (ctx) => {
  const message = 
    '💰 ОБЕРІТЬ ПЛАН ПІДПИСКИ:\n\n' +
    '🔹 **Тиждень фокусу — 7€**\n' +
    'Ідеально для короткого фокусу або тесту системи\n\n' +
    '🔹 **Місяць дії — 30€**\n' +
    'Глибинна робота з твоїми цілями та стратегією\n\n' +
    '🔹 **Рік трансформації — 300€**\n' +
    'Максимальна економія та підтримка протягом року\n\n' +
    '✅ Безпечна оплата через WayForPay';

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '7€ - Тиждень', callback_data: 'subscribe_week' }],
        [{ text: '30€ - Місяць', callback_data: 'subscribe_month' }],
        [{ text: '300€ - Рік', callback_data: 'subscribe_year' }],
        [{ text: '📞 Підтримка', callback_data: 'contact_support' }],
        [{ text: '🔙 Назад', callback_data: 'subscription_info' }]
      ]
    }
  };

  if (ctx.callbackQuery) {
    await ctx.editMessageText(message, keyboard);
    await ctx.answerCbQuery('Оберіть план');
  } else {
    await ctx.reply(message, keyboard);
  }
};

const handleSubscribe = async (ctx, planKey) => {
  const tgId = ctx.from.id;
  
  try {
    const user = await userService.getUserByTelegramId(tgId);
    const planInfo = SUBSCRIPTION_PLANS[planKey];
    
    if (!planInfo) {
      await ctx.answerCbQuery('Невірний план');
      return;
    }

    const paymentUrl = wayforpayService.generatePaymentUrl(tgId, planKey, user?.Email);
    
    const message = 
      `💳 ОПЛАТА ПІДПИСКИ\n\n` +
      `📋 План: ${planInfo.name}\n` +
      `💰 Вартість: ${planInfo.price}€\n` +
      `⏰ Тривалість: ${planInfo.duration} днів\n\n` +
      `🔗 Натисни кнопку для оплати:\n\n` +
      `✅ Після успішної оплати підписка активується автоматично!\n\n` +
      `❓ Проблеми з оплатою? Натисни "Підтримка"`;

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: `💳 Оплатити ${planInfo.price}€`, url: paymentUrl }],
          [{ text: '🔄 Я вже оплатив', callback_data: 'sync_subscription' }],
          [{ text: '📞 Підтримка', callback_data: 'contact_support' }],
          [{ text: '🔙 Назад', callback_data: 'subscription_plans' }]
        ]
      }
    };

    await ctx.editMessageText(message, keyboard);
    await ctx.answerCbQuery(`Обрано: ${planInfo.name}`);
    
  } catch (error) {
    console.error('❌ [subscriptionController] Помилка підписки:', error);
    await ctx.answerCbQuery('Помилка створення оплати');
  }
};

const handleSyncSubscription = async (ctx) => {
  const tgId = ctx.from.id;
  
  try {
    await typing(ctx);
    
    const progressMsg = await ctx.reply('🔄 Перевіряю статус оплати...');
    
    const result = await subscriptionSync.syncUserSubscription(tgId);
    
    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, progressMsg.message_id);
    } catch {}
    
    await ctx.reply(result, keyboards.mainMenuKeyboard());
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('Статус оновлено');
    }
    
  } catch (error) {
    console.error('❌ [subscriptionController] Помилка синхронізації:', error);
    await ctx.reply('Помилка оновлення статусу підписки', keyboards.mainMenuKeyboard());
    
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('Помилка оновлення');
    }
  }
};

const handleRenewSubscription = async (ctx) => {
  await handleSubscriptionPlans(ctx);
  await ctx.answerCbQuery('Оберіть план для продовження');
};

const handleContactSupport = async (ctx) => {
  const message = 
    '📞 ЗВ\'ЯЗОК З ПІДТРИМКОЮ\n\n' +
    '💬 **ПРО ПІДПИСКУ:**\n' +
    '• Email: nadyastarway@gmail.com\n' +
    '• Telegram: @Nadya2316 (ментор)\n' +
    '• Telegram: @vira_333 (техпідтримка)\n\n' +
    '📋 **ЩО НАПИСАТИ:**\n' +
    '• Твій Telegram ID: ' + ctx.from.id + '\n' +
    '• Проблема з оплатою або активацією\n' +
    '• Скрін чеку (якщо є)\n\n' +
    '⏰ **ЧАС ВІДПОВІДІ:**\n' +
    'Протягом 2-4 годин у робочі дні\n\n' +
    '💡 **ШВИДКЕ РІШЕННЯ:**\n' +
    'Натисни "🔄 Я вже оплатив" для автоматичної перевірки';

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📧 Написати на Email', url: 'mailto:nadyastarway@gmail.com' }],
        [{ text: '💬 Написати в Telegram', url: 'https://t.me/Nadya2316' }],
        [{ text: '🔄 Я вже оплатив', callback_data: 'sync_subscription' }],
        [{ text: '🔙 Назад до підписки', callback_data: 'subscription_info' }]
      ]
    }
  };

  if (ctx.callbackQuery) {
    await ctx.editMessageText(message, keyboard);
    await ctx.answerCbQuery('Контакти надіслано');
  } else {
    await ctx.reply(message, keyboard);
  }
};

const handleRenewalFromReminder = async (ctx, planKey) => {
  const tgId = ctx.from.id;
  
  try {
    const user = await userService.getUserByTelegramId(tgId);
    const planInfo = SUBSCRIPTION_PLANS[planKey];
    
    if (!planInfo) {
      await ctx.answerCbQuery('Невірний план');
      return;
    }

    const paymentUrl = wayforpayService.generatePaymentUrl(tgId, planKey, user?.Email);
    
    const message = 
      `🔄 ПРОДОВЖЕННЯ ПІДПИСКИ\n\n` +
      `📋 План: ${planInfo.name}\n` +
      `💰 Вартість: ${planInfo.price}€\n` +
      `⏰ Тривалість: ${planInfo.duration} днів\n\n` +
      `✅ Твоя підписка буде продовжена після оплати`;

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: `💳 Продовжити за ${planInfo.price}€`, url: paymentUrl }],
          [{ text: '🔄 Перевірити оплату', callback_data: 'sync_subscription' }],
          [{ text: '📞 Підтримка', callback_data: 'contact_support' }]
        ]
      }
    };

    await ctx.editMessageText(message, keyboard);
    await ctx.answerCbQuery(`Продовження: ${planInfo.name}`);
    
  } catch (error) {
    console.error('❌ [subscriptionController] Помилка продовження:', error);
    await ctx.answerCbQuery('Помилка');
  }
};

const blockAccessForInactiveSubscription = async (ctx, featureName) => {
  const message = 
    `🚫 ${featureName} недоступний\n\n` +
    `❌ Твоя підписка неактивна або закінчилася.\n\n` +
    `💰 Поднови підписку зараз, щоб продовжити користування всіма функціями бота!\n\n` +
    `📞 Питання? Зв'яжися з підтримкою: nadyastarway@gmail.com`;

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💰 Подновити підписку', callback_data: 'subscription_plans' }],
        [{ text: '🔄 Я вже оплатив', callback_data: 'sync_subscription' }],
        [{ text: '📞 Зв\'язатися з підтримкою', callback_data: 'contact_support' }]
      ]
    }
  };

  await ctx.reply(message, keyboard);
};

const sendExpirationReminders = async (bot) => {
  try {
    console.log('[subscriptionService] 📅 Перевірка підписок що закінчуються');
    
    const expiringUsers = await userService.getUsersWithExpiringSubscriptions(1);
    
    for (const user of expiringUsers) {
      const tgId = user.TG_id;
      const planName = user['Active Subscription Plan'] || 'План';
      const endDate = new Date(user.End_Date).toLocaleDateString('uk-UA');
      
      const message = 
        `⚠️ Підписка закінчується завтра!\n\n` +
        `📋 План: ${planName}\n` +
        `📅 Діє до: ${endDate}\n\n` +
        `💰 Продовж підписку зараз, щоб не втратити доступ до всіх функцій!`;

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Продовжити на тиждень — 7€', callback_data: 'renew_week' }],
            [{ text: '🔄 Продовжити на місяць — 30€', callback_data: 'renew_month' }],
            [{ text: '🔄 Продовжити на рік — 300€', callback_data: 'renew_year' }],
            [{ text: '📞 Зв\'язатися з підтримкою', callback_data: 'contact_support' }]
          ]
        }
      };

      try {
        await bot.telegram.sendMessage(tgId, message, keyboard);
        console.log(`[subscriptionController] ✅ Нагадування надіслано ${tgId}`);
      } catch (sendError) {
        console.error(`[subscriptionController] ❌ Помилка надсилання для ${tgId}:`, sendError);
      }
      
      await new Promise(r => setTimeout(r, 1000));
    }
    
  } catch (error) {
    console.error('[subscriptionController] ❌ Помилка нагадувань:', error);
  }
};

const handleCallback = async (ctx) => {
  const data = ctx.callbackQuery.data;
  
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
        await ctx.answerCbQuery('Невідома команда');
    }
  } catch (error) {
    console.error('❌ [subscriptionController] Помилка callback:', error);
    await ctx.answerCbQuery('Виникла помилка');
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
  sendExpirationReminders,
  blockAccessForInactiveSubscription
};