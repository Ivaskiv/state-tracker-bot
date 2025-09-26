// src/auth/services/paymentService.js - ЄДИНИЙ СЕРВІС ПЛАТЕЖІВ/ПІДПИСОК

import { getBase, tables } from '../../config/database.js';
import userService from './userService.js';

const base = getBase();

// ==== НОТИФІКАЦІЇ (без прямого імпорту bot, щоб не було циклу) ====
let notifier = null;
/**
 * Виклич у server.js після ініціалізації бота:
 *   import paymentService, { setNotifier } from './src/auth/services/paymentService.js';
 *   setNotifier((tgId, text, extra) => bot.telegram.sendMessage(tgId, text, extra));
 */
export const setNotifier = (fn) => { notifier = fn; };
const notify = async (tgId, text, extra) => {
  if (!notifier) {
    console.warn('[paymentService.notify] notifier не встановлено — пропускаю відправку');
    return;
  }
  try {
    await notifier(tgId, text, extra);
  } catch (e) {
    console.error('[paymentService.notify] ❌ Помилка відправки повідомлення:', e?.message || e);
  }
};

// ==== УТИЛІТИ ====
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function toUA(dateISO) {
  try { return new Date(dateISO).toLocaleDateString('uk-UA'); } catch { return dateISO; }
}

// ==== WEBHOOK WAYFORPAY ====
export const handleWayForPayWebhook = async (processedData) => {
  try {
    console.log('[paymentService] 🔄 Webhook:', JSON.stringify(processedData, null, 2));
    
    const {
      tgId,
      orderReference,
      transactionStatus,
      amount,
      currency,
      email,
      phone,
      planName,
      planKey,
      planDuration,
      startDate,
      endDate,
      createdDate,
      processingDate
    } = processedData;

    // 1) Логуємо платіж у Subscriptions
    const subscriptionRecord = await base(tables.SUBSCRIPTIONS).create({
      TG_id: String(tgId || ''),
      'User Name': email || `User_${tgId || 'unknown'}`,
      Order_Reference: orderReference,
      Payment_Status: transactionStatus,
      Status: transactionStatus === 'Approved' ? 'Active' : transactionStatus,
      Plan_Name: planName,
      Amount: amount,
      Currency: currency,
      Start_Date: startDate || null,
      End_Date: endDate || null,
      Is_Active: transactionStatus === 'Approved' ? '✅ Активна' : '❌ Неактивна',
      Created_At: createdDate || new Date().toISOString(),
      Processing_Date: processingDate || null
    });
    console.log('[paymentService] ✅ Збережено в Subscriptions:', subscriptionRecord.id);

    // 2) Якщо успішно — активуємо підписку
    if (transactionStatus === 'Approved' && tgId) {
      await activateUserSubscription(tgId, {
        planName,
        planKey,
        amount,
        orderReference,
        startDate,
        endDate,
        planDuration
      });
    } else {
      console.log(`[paymentService] ℹ️ Не активую підписку: status=${transactionStatus}, tgId=${tgId}`);
    }

    return {
      success: true,
      message: `Webhook оброблено для ${orderReference}`,
      subscriptionId: subscriptionRecord.id,
      activated: transactionStatus === 'Approved'
    };
  } catch (error) {
    console.error('[paymentService] ❌ Помилка webhook:', error);
    throw error;
  }
};

// ==== АКТИВАЦІЯ ПІСЛЯ УСПІШНОЇ ОПЛАТИ ====
const activateUserSubscription = async (tgId, { planName, amount, startDate, endDate }) => {
  try {
    const user = await userService.getUserByTelegramId(tgId);
    if (!user) {
      console.error(`[paymentService] ❌ Користувача ${tgId} не знайдено`);
      return;
    }

    const endFmt = toUA(endDate);
    const userName = user['User Name'] || 'Користувач';

    await userService.updateUser(tgId, {
      'Subscription Status': 'Active',
      'Active Subscription Plan': planName || 'paid',
      'Active_Subscription_Status': `✅ Активна до ${endFmt}`,
      'Start_Date': startDate || new Date().toISOString(),
      'End_Date': endDate,
      'Last_Activity': new Date().toISOString(),
      'Answer_Step': 'completed'
    });

    // Повідомлення юзеру
    const msg = 
      `🎉 Підписка успішно активована!\n\n` +
      `👋 Привіт, ${userName}!\n\n` +
      `📋 План: ${planName}\n` +
      `💰 Сплачено: ${amount}€\n` +
      `📅 Діє до: ${endFmt}\n\n` +
      `✅ Тепер доступні всі функції:\n` +
      `• 🌞 Ранкові питання (08:00)\n` +
      `• 🌙 Вечірні питання (21:30)\n` +
      `• 🤖 AI наставник\n` +
      `• 🎯 Колесо балансу\n` +
      `• 📊 Персональні звіти\n\n` +
      `🚀 Почнемо з колеса балансу?`;
    await notify(tgId, msg, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎯 Запустити колесо балансу', callback_data: 'wheel_start' }],
          [{ text: '🤖 Запитати AI наставника', callback_data: 'ai_continue' }]
        ]
      }
    });
  } catch (error) {
    console.error(`[paymentService] ❌ Помилка активації платної підписки (${tgId}):`, error);
    throw error;
  }
};

// ==== ПРОБНИЙ ДОСТУП ====
export const activateTrialSubscription = async (tgId, days = 7) => {
  try {
    console.log(`[paymentService] 🧪 Trial для ${tgId} на ${days} днів`);
    const user = await userService.getUserByTelegramId(tgId);
    if (!user) {
      console.error(`[paymentService] ❌ Користувача ${tgId} не знайдено`);
      return false;
    }

    const now = new Date();
    const end = addDays(now, days);
    const endISO = end.toISOString();
    const endUA = toUA(endISO);
    const userName = user['User Name'] || 'Користувач';

    // Оновлюємо Users
    await userService.updateUser(tgId, {
      'Subscription Status': 'Active',
      'Active Subscription Plan': '🧪 Пробний період',
      'Active_Subscription_Status': `✅ Активна до ${endUA}`,
      'Start_Date': now.toISOString(),
      'End_Date': endISO,
      'Last_Activity': new Date().toISOString(),
      'Answer_Step': 'completed'
    });

    // Лог у Subscriptions
    await base(tables.SUBSCRIPTIONS).create({
      TG_id: String(tgId),
      'User Name': userName,
      Order_Reference: `TRIAL_${tgId}_${Date.now()}`,
      Payment_Status: 'Approved',
      Status: 'Active',
      Plan_Name: '🧪 Пробний період',
      Amount: 0,
      Currency: 'EUR',
      Start_Date: now.toISOString(),
      End_Date: endISO,
      Is_Active: '✅ Активна',
      Created_At: new Date().toISOString()
    });

    // Нотиф
    await notify(tgId,
      `🧪 Пробний період активовано!\n\n` +
      `👋 ${userName}, вітаємо!\n\n` +
      `📅 Діє до: ${endUA}\n` +
      `🎁 Усі функції безкоштовно ${days} днiв!\n\n` +
      `✅ Доступно:\n` +
      `• 🌞 Ранкові питання\n` +
      `• 🌙 Вечірні питання\n` +
      `• 🤖 AI наставник\n` +
      `• 🎯 Колесо балансу\n` +
      `• 📊 Персональні звіти\n\n` +
      `🚀 Почнемо з колеса балансу?`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎯 Запустити колесо балансу', callback_data: 'wheel_start' }],
            [{ text: '🏠 Головне меню', callback_data: 'main_menu' }]
          ]
        }
      }
    );

    return true;
  } catch (error) {
    console.error(`[paymentService] ❌ Помилка активації trial (${tgId}):`, error);
    return false;
  }
};

// ==== Нагадування про завершення ====
export const checkExpiringSubscriptions = async () => {
  try {
    console.log('[paymentService] 🔍 Пошук підписок, що закінчуються завтра');
    const expiringUsers = await userService.getUsersWithExpiringSubscriptions(1);
    if (!expiringUsers.length) {
      console.log('[paymentService] ℹ️ Немає підписок, що закінчуються завтра');
      return 0;
    }

    let sent = 0;
    for (const user of expiringUsers) {
      const tgId = user.TG_id;
      const planName = user['Active Subscription Plan'] || 'План';
      const endDateUA = toUA(user.End_Date);
      const userName = user['User Name'] || 'Користувач';

      const message =
        `⚠️ Підписка закінчується завтра!\n\n` +
        `👋 ${userName}, твоя підписка на завершенні.\n\n` +
        `📋 План: ${planName}\n` +
        `📅 Діє до: ${endDateUA}\n\n` +
        `💰 Продовж підписку зараз, щоб не втратити доступ!`;

      await notify(tgId, message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💰 Продовжити підписку', callback_data: 'subscription_plans' }],
            [{ text: '📞 Звʼязатися з підтримкою', callback_data: 'contact_support' }]
          ]
        }
      });
      sent++;
      await new Promise(r => setTimeout(r, 800)); // анти-флуд
    }
    console.log(`[paymentService] ✅ Нагадувань відправлено: ${sent}/${expiringUsers.length}`);
    return sent;
  } catch (error) {
    console.error('[paymentService] ❌ Помилка нагадувань:', error);
    return 0;
  }
};

// ==== Деактивація прострочених ====
export const deactivateExpiredSubscriptions = async () => {
  try {
    console.log('[paymentService] 🔍 Деактивація прострочених підписок');
    const users = await userService.getActiveUsers();
    const todayStr = new Date().toISOString().split('T')[0];

    let deactivated = 0;
    for (const user of users) {
      const endISO = user['End_Date'];
      const isActive = String(user['Active_Subscription_Status'] || '').includes('✅ Активна');
      if (!isActive || !endISO) continue;

      const expiry = new Date(endISO).toISOString().split('T')[0];
      if (expiry < todayStr) {
        await userService.updateUser(user.TG_id, {
          'Active_Subscription_Status': '❌ Закінчена',
          'Subscription Status': 'Expired',
          'Answer_Step': 'completed'
        });
        deactivated++;
      }
    }
    console.log(`[paymentService] ✅ Деактивовано: ${deactivated}`);
    return deactivated;
  } catch (error) {
    console.error('[paymentService] ❌ Помилка деактивації:', error);
    return 0;
  }
};

// ==== DEFAULT ЕКСПОРТ У ФОРМАТІ ОБʼЄКТА ====
const paymentService = {
  handleWayForPayWebhook,
  checkExpiringSubscriptions,
  deactivateExpiredSubscriptions,
  activateTrialSubscription
};

export default paymentService;
