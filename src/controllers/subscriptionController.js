// src/controllers/subscriptionController.js - КОНТРОЛЕР ПІДПИСКИ

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
      message += '📧 Для оплати напиши: nadyastarway@gmail.com';
    }

    const keyboard = {
      reply_markup: {
        inline_keyboard: []
      }
    };

    // Кнопки залежно від статусу
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
        [{ text: '🔄 Оновити статус', callback_data: 'sync_subscription' }]
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
    '🔹 **Тиждень фокусу — 7€**\nІдеально для короткого фокусу або тесту системи\n\n' +
    '🔹 **Місяць дії — 30€**\nГлибинна робота з твоїми цілями та стратегією\n\n' +
    '🔹 **Рік трансформації — 300€**\nМаксимальна економія та підтримка протягом року';

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '7€ - Тиждень', callback_data: 'subscribe_week' }],
        [{ text: '30€ - Місяць', callback_data: 'subscribe_month' }],
        [{ text: '300€ - Рік', callback_data: 'subscribe_year' }],
        [{ text: '📞 Підтримка', callback_data: 'contact_support' }]
      ]
    }
  };

  await ctx.editMessageText(message, keyboard);
  await ctx.answerCbQuery('Оберіть план');
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

    // Генеруємо посилання на оплату
    const paymentUrl = wayforpayService.generatePaymentUrl(tgId, planKey, user?.Email);
    
    const message = 
      `💳 ОПЛАТА ПІДПИСКИ\n\n` +
      `📋 План: ${planInfo.name}\n` +
      `💰 Вартість: ${planInfo.price}€\n` +
      `⏰ Тривалість: ${planInfo.duration} днів\n\n` +
      `🔗 Посилання для оплати:\n${paymentUrl}\n\n` +
      `✅ Після успішної оплати підписка активується автоматично!\n` +
      `📧 Проблеми з оплатою? Пиши: nadyastarway@gmail.com`;

    await ctx.editMessageText(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Перевірити оплату', callback_data: 'sync_subscription' }],
          [{ text: '📞 Підтримка', callback_data: 'contact_support' }],
          [{ text: '🔙 Назад', callback_data: 'subscription_plans' }]
        ]
      }
    });
    
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
    const result = await subscriptionSync.syncUserSubscription(tgId);
    
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
    '💬 **ТЕХНІЧНА ПІДТРИМКА:**\n' +
    'Email: nadyastarway@gmail.com\n' +
    'Telegram: @Nadya2316 (ментор)\n' +
    'Telegram: @vira_333 (техпідтримка)\n\n' +
    '📋 **ПИТАННЯ ПРО ПІДПИСКУ:**\n' +
    'Пишіть ментору з деталями проблеми.\n\n' +
    '⏰ **ЧАС ВІДПОВІДІ:**\n' +
    'Протягом 24 годин.\n\n' +
    '🎯 **ПЕРСОНАЛЬНА КОНСУЛЬТАЦІЯ:**\n' +
    'Email з темою "Персональна консультація".';

  if (ctx.callbackQuery) {
    await ctx.editMessageText(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Назад до підписки', callback_data: 'subscription_info' }]
        ]
      }
    });
    await ctx.answerCbQuery('Контакти надіслано');
  } else {
    await ctx.reply(message, keyboards.mainMenuKeyboard());
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
  handleCallback
};