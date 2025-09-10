// src/services/subscriptionReminderService.js
import { getBase, tables } from '../config/database.js'; // правильний шлях
import { SUBSCRIPTION_REMINDER_MESSAGES, SUBSCRIPTION_PLANS } from '../config/constants.js';
import keyboards from '../utils/keyboards.js';

const base = getBase();

// Отримання користувачів з підписками, що закінчуються
const getUsersWithExpiringSubscriptions = async (daysOffset) => {
  try {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysOffset);
    const targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

    const records = await base(tables.USERS)
      .select({
        filterByFormula: `AND(
          {Active_Subscription_Status} = '✅ Активна',
          DATESTR({End_Date}) = '${targetDateStr}'
        )`,
        fields: ['TG_id', 'User Name', 'Active Subscription Plan', 'End_Date']
      })
      .all();

    return records.map(r => r.fields);
  } catch (error) {
    console.error('[subscriptionReminderService.getUsersWithExpiringSubscriptions] Помилка:', error);
    return [];
  }
};

// Надсилання нагадування про закінчення підписки
const sendSubscriptionReminder = async (bot, user, daysOffset) => {
  try {
    const tgId = user.TG_id;
    const planName = user['Active Subscription Plan'] || 'План';
    const endDate = new Date(user.End_Date).toLocaleDateString('uk-UA');

    let message;
    if (daysOffset === -3) {
      message = SUBSCRIPTION_REMINDER_MESSAGES.REMINDER_3_DAYS(planName, endDate);
    } else if (daysOffset === -1) {
      message = SUBSCRIPTION_REMINDER_MESSAGES.REMINDER_1_DAY(planName, endDate);
    } else if (daysOffset === 0) {
      message = SUBSCRIPTION_REMINDER_MESSAGES.REMINDER_TODAY(planName);
    } else {
      return; // неочікуваний offset
    }

    // Створюємо клавіатуру з кнопками поновлення
    const renewKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔄 Поновити тиждень — 7€', callback_data: 'renew_week' },
            { text: '🔄 Поновити місяць — 30€', callback_data: 'renew_month' }
          ],
          [
            { text: '🔄 Поновити рік — 300€', callback_data: 'renew_year' }
          ],
          [
            { text: '💬 Зв\'язатися з підтримкою', callback_data: 'contact_support' }
          ]
        ]
      }
    };

    await bot.telegram.sendMessage(tgId, message, renewKeyboard);
    console.log(`[subscriptionReminderService] Надіслано нагадування ${daysOffset} для ${tgId}`);
  } catch (error) {
    console.error('[subscriptionReminderService.sendSubscriptionReminder] Помилка:', error);
  }
};

// Основна функція для перевірки і відправки нагадувань
const checkAndSendReminders = async (bot, daysOffset) => {
  try {
    console.log(`[subscriptionReminderService] Перевірка нагадувань на ${daysOffset} днів`);
    const users = await getUsersWithExpiringSubscriptions(daysOffset);
    
    if (!users.length) {
      console.log(`[subscriptionReminderService] Немає користувачів для нагадування ${daysOffset}`);
      return;
    }

    console.log(`[subscriptionReminderService] Знайдено ${users.length} користувачів для нагадування ${daysOffset}`);
    
    for (const user of users) {
      await sendSubscriptionReminder(bot, user, daysOffset);
      await new Promise(r => setTimeout(r, 500)); // затримка між повідомленнями
    }
  } catch (error) {
    console.error('[subscriptionReminderService.checkAndSendReminders] Помилка:', error);
  }
};

// Деактивація закінчених підписок
const deactivateExpiredSubscriptions = async () => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    const records = await base(tables.USERS)
      .select({
        filterByFormula: `AND(
          {Active_Subscription_Status} = '✅ Активна',
          DATESTR({End_Date}) < '${today}'
        )`,
        fields: ['TG_id', 'User Name', 'Active Subscription Plan']
      })
      .all();

    if (!records.length) {
      console.log('[subscriptionReminderService] Немає закінчених підписок для деактивації');
      return;
    }

    const updates = records.map(record => ({
      id: record.id,
      fields: {
        'Active_Subscription_Status': '❌ Закінчена',
        'Subscription Status': 'Expired',
        Answer_Step: 'completed'
      }
    }));

    await base(tables.USERS).update(updates);
    console.log(`[subscriptionReminderService] Деактивовано ${updates.length} закінчених підписок`);
  } catch (error) {
    console.error('[subscriptionReminderService.deactivateExpiredSubscriptions] Помилка:', error);
  }
};

// Обробка callback для кнопок поновлення
const handleRenewalCallback = async (ctx) => {
  const data = ctx.callbackQuery.data;
  const tgId = ctx.from.id;
  
  try {
    let planKey, planInfo;
    
    if (data === 'renew_week') {
      planKey = 'WEEK';
      planInfo = SUBSCRIPTION_PLANS.WEEK;
    } else if (data === 'renew_month') {
      planKey = 'MONTH'; 
      planInfo = SUBSCRIPTION_PLANS.MONTH;
    } else if (data === 'renew_year') {
      planKey = 'YEAR';
      planInfo = SUBSCRIPTION_PLANS.YEAR;
    } else if (data === 'contact_support') {
      await ctx.reply(
        '📞 ЗВ\'ЯЗОК З ПІДТРИМКОЮ\n\nEmail: nadyastarway@gmail.com\nTelegram: @Nadya2316\n\nОпишіть ситуацію з підпискою, і ми допоможемо!',
        keyboards.mainMenuKeyboard()
      );
      await ctx.answerCbQuery('Контакти надіслано');
      return;
    } else {
      await ctx.answerCbQuery('Невідома дія');
      return;
    }

    // Генеруємо посилання на оплату (плейсхолдер)
    const paymentUrl = generatePaymentUrl(tgId, planKey, planInfo);
    
    await ctx.reply(
      `💳 ПОНОВЛЕННЯ ПІДПИСКИ\n\n📋 План: ${planInfo.name}\n💰 Вартість: ${planInfo.price}€\n⏰ Тривалість: ${planInfo.duration} днів\n\n🔗 Посилання для оплати:\n${paymentUrl}\n\n✅ Після оплати підписка продовжиться автоматично!`,
      keyboards.mainMenuKeyboard()
    );
    
    await ctx.answerCbQuery(`Обрано: ${planInfo.name}`);
  } catch (error) {
    console.error('[subscriptionReminderService.handleRenewalCallback] Помилка:', error);
    await ctx.answerCbQuery('Помилка обробки');
  }
};

// Плейсхолдер для генерації посилання WayForPay
const generatePaymentUrl = (tgId, planKey, planInfo) => {
  // TODO: Реалізувати інтеграцію з WayForPay
  // Поки що повертаємо плейсхолдер
  return `https://secure.wayforpay.com/payment/s${planKey.toLowerCase()}_${tgId}_${planInfo.price}`;
};

export default {
  checkAndSendReminders,
  deactivateExpiredSubscriptions,
  handleRenewalCallback,
  getUsersWithExpiringSubscriptions,
  sendSubscriptionReminder
};