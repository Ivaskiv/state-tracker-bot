// src/auth/services/paymentService.js - ОПТИМІЗОВАНО

import { getBase, tables } from '../../config/database.js';
import userService from '../../services/userService.js';

const base = getBase();

// ===== УТИЛІТИ =====
const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const toUA = (dateISO) => {
  try { 
    return new Date(dateISO).toLocaleDateString('uk-UA'); 
  } catch { 
    return dateISO; 
  }
};

// ===== АКТИВАЦІЯ ПРОБНОЇ ПІДПИСКИ =====
export const activateTrialSubscription = async (tgId, days = 7) => {
  try {
    const id = String(tgId);
    console.log(`[paymentService] 🧪 АКТИВАЦІЯ TRIAL для ${id} на ${days} днів`);
    
    const user = await userService.getUserByTelegramId(id);
    if (!user) {
      console.error(`[paymentService] ❌ Користувача ${id} не знайдено`);
      return false;
    }

    const now = new Date();
    const end = addDays(now, days);
    const endISO = end.toISOString();
    const endUA = toUA(endISO);
    const userName = user['User Name'] || 'Користувач';

    console.log(`[paymentService] 📅 Trial період: ${now.toISOString()} → ${endISO}`);

    // ✅ ОНОВЛЮЄМО Users через userService
    const trialData = {
      'Subscription Status': 'Active',
      'Active Subscription Plan': '🧪 Пробний період',
      'Start_Date': now.toISOString(),
      'End_Date': endISO,
      Answer_Step: 'completed'
    };

    console.log(`[paymentService] 🔄 Оновлюємо користувача:`, Object.keys(trialData));

    const updated = await userService.updateUser(id, trialData);
    if (!updated) {
      console.error(`[paymentService] ❌ Не вдалося оновити користувача ${id}`);
      return false;
    }

    console.log(`[paymentService] ✅ Trial підписка активована для ${id}`);

    // ✅ Логуємо в Subscriptions (опціонально)
    try {
      await base(tables.SUBSCRIPTIONS).create({
        'TG_id': id,
        'User Name': userName,
        'Order_Reference': `TRIAL_${id}_${Date.now()}`,
        'Payment_Status': 'Approved',
        'Status': 'Active',
        'Plan_Name': '🧪 Пробний період',
        'Amount': 0,
        'Currency': 'EUR',
        'Start_Date': now.toISOString(),
        'End_Date': endISO,
        'Is_Active': '✅ Активна',
        'Created_At': new Date().toISOString()
      });
      console.log(`[paymentService] ✅ Запис в Subscriptions створено`);
    } catch (subscriptionError) {
      console.warn(`[paymentService] ⚠️ Не вдалося створити запис підписки:`, subscriptionError.message);
    }

    return updated;

  } catch (error) {
    console.error(`[paymentService] ❌ Помилка активації trial для ${tgId}:`, error);
    return false;
  }
};

// ===== АКТИВАЦІЯ ПЛАТНОЇ ПІДПИСКИ =====
export const activatePaidSubscription = async (tgId, planKey, planName, amount, duration) => {
  try {
    const id = String(tgId);
    console.log(`[paymentService] 💳 Активація платної підписки ${planKey} для ${id}`);
    
    const user = await userService.getUserByTelegramId(id);
    if (!user) {
      console.error(`[paymentService] ❌ Користувача ${id} не знайдено`);
      return false;
    }

    const now = new Date();
    const end = addDays(now, duration);
    const endUA = toUA(end.toISOString());

    const subscriptionData = {
      'Subscription Status': 'Active',
      'Active Subscription Plan': planName,
      'Start_Date': now.toISOString(),
      'End_Date': end.toISOString(),
      Answer_Step: 'completed'
    };

    const updated = await userService.updateUser(id, subscriptionData);
    if (!updated) {
      console.error(`[paymentService] ❌ Не вдалося оновити користувача ${id}`);
      return false;
    }

    // Логуємо в Subscriptions
    try {
      await base(tables.SUBSCRIPTIONS).create({
        'TG_id': id,
        'User Name': user['User Name'] || 'Користувач',
        'Order_Reference': `PAID_${planKey}_${id}_${Date.now()}`,
        'Payment_Status': 'Approved',
        'Status': 'Active',
        'Plan_Name': planName,
        'Amount': amount,
        'Currency': 'EUR',
        'Start_Date': now.toISOString(),
        'End_Date': end.toISOString(),
        'Is_Active': '✅ Активна',
        'Created_At': new Date().toISOString()
      });
    } catch (subscriptionError) {
      console.warn(`[paymentService] ⚠️ Не вдалося створити запис підписки:`, subscriptionError.message);
    }

    console.log(`[paymentService] ✅ Платна підписка ${planKey} активована для ${id}`);
    return updated;

  } catch (error) {
    console.error(`[paymentService] ❌ Помилка активації платної підписки:`, error);
    return false;
  }
};

// ===== ПЕРЕВІРКА ПІДПИСОК ЩО ЗАКІНЧУЮТЬСЯ =====
export const checkExpiringSubscriptions = async (bot) => {
  try {
    console.log('[paymentService] 🔍 Пошук підписок, що закінчуються завтра');
    
    const expiringUsers = await userService.getUsersWithExpiringSubscriptions(1);
    if (!expiringUsers.length) {
      console.log('[paymentService] ℹ️ Немає підписок, що закінчуються завтра');
      return 0;
    }

    let remindersSent = 0;
    for (const user of expiringUsers) {
      const tgId = user.TG_id;
      const planName = user['Active Subscription Plan'] || 'План';
      const endDate = new Date(user.End_Date).toLocaleDateString('uk-UA');
      
      const message = 
        `⚠️ Підписка закінчується завтра!\n\n` +
        `📋 Plan: ${planName}\n` +
        `📅 Діє до: ${endDate}\n\n` +
        `💰 Поднови підписку, щоб продовжити користування всіма функціями бота!\n\n` +
        `📞 Зв'яжися з підтримкою: nadyastarway@gmail.com`;

      try {
        await bot.telegram.sendMessage(tgId, message, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💰 Продовжити підписку', callback_data: 'subscription_plans' }],
              [{ text: '📞 Підтримка', callback_data: 'contact_support' }]
            ]
          }
        });
        remindersSent++;
        console.log(`[paymentService] ✅ Нагадування відправлено ${tgId}`);
      } catch (sendError) {
        console.error(`[paymentService] Помилка відправки для ${tgId}:`, sendError);
      }
      
      await new Promise(r => setTimeout(r, 500));
    }
    
    console.log(`[paymentService] 📊 Відправлено ${remindersSent} нагадувань`);
    return remindersSent;

  } catch (error) {
    console.error('[paymentService] Помилка перевірки підписок:', error);
    return 0;
  }
};

// ===== ДЕАКТИВАЦІЯ ПРОСТРОЧЕНИХ ПІДПИСОК =====
export const deactivateExpiredSubscriptions = async () => {
  try {
    console.log('[paymentService] 🔍 Деактивація прострочених підписок');
    
    const users = await userService.getActiveUsers();
    const todayStr = new Date().toISOString().split('T')[0];

    let deactivated = 0;
    for (const user of users) {
      const tgId = user['TG_id'];
      const endISO = user['End_Date'];
      const isActive = String(user['Active_Subscription_Status'] || '').includes('✅ Активна');
      
      if (!isActive || !endISO || !tgId) continue;

      const expiry = new Date(endISO).toISOString().split('T')[0];
      if (expiry < todayStr) {
        console.log(`[paymentService] ⏰ Деактивуємо підписку для ${tgId}`);
        
        await userService.updateUser(tgId, {
          'Subscription Status': 'Expired',
          Answer_Step: 'completed'
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

// ===== СИНХРОНІЗАЦІЯ ПІДПИСКИ КОРИСТУВАЧА =====
export const syncUserSubscription = async (tgId) => {
  try {
    const id = String(tgId);
    if (!id) return '⚠️ Не вдалося визначити користувача.';

    console.log(`[paymentService] 🔄 Синхронізація підписки для ${id}`);

    // Шукаємо останню активну підписку в таблиці Subscriptions
    const subs = await base(tables.SUBSCRIPTIONS)
      .select({
        filterByFormula: `AND({TG_id}='${id}', {Payment_Status}='Approved')`,
        sort: [{ field: 'End_Date', direction: 'desc' }],
        maxRecords: 1,
      })
      .firstPage();

    if (!subs.length) {
      console.log(`[paymentService] ❌ Активних оплат не знайдено для ${id}`);
      
      // Скидаємо статус у Users
      await userService.updateUser(id, {
        'Subscription Status': 'Inactive',
        'Active Subscription Plan': '',
        'Start_Date': null,
        'End_Date': null,
      });
      
      return '❌ Активних оплат не знайдено. Якщо ти щойно оплатила — зачекай 1–2 хв або натисни ще раз «🔄 Оновити підписку».';
    }

    const s = subs[0].fields || {};
    const endDate = s.End_Date ? new Date(s.End_Date) : null;
    const endDateUA = endDate ? endDate.toLocaleDateString('uk-UA') : 'не відомо';
    const plan = s.Plan_Name || 'План';

    // Перевіряємо чи підписка ще активна
    const now = new Date();
    const isStillActive = endDate && now < endDate;

    // Оновлюємо користувача
    const updateData = {
      'Active Subscription Plan': plan,
      'Subscription Status': isStillActive ? 'Active' : 'Expired',
      'Start_Date': s.Start_Date || null,
      'End_Date': s.End_Date || null,
    };

    await userService.updateUser(id, updateData);

    console.log(`[paymentService] ✅ Підписка синхронізована для ${id}: ${plan} (активна: ${isStillActive})`);

    return isStillActive 
      ? `✅ Підписка активна: ${plan}\nДіє до: ${endDateUA}`
      : `⚠️ Підписка закінчилася: ${plan}\nЗакінчилася: ${endDateUA}\n\n💰 Поднови підписку для продовження роботи з ботом.`;
      
  } catch (error) {
    console.error('[paymentService] Помилка синхронізації:', error);
    return '❌ Помилка синхронізації підписки.';
  }
};

// ===== ЗАГЛУШКА ДЛЯ WEBHOOK =====
export const handleWayForPayWebhook = async (processedData) => {
  console.log('[paymentService] 🔔 WayForPay webhook (заглушка):', processedData);
  return {
    success: true,
    message: 'Webhook заглушка'
  };
};

// ===== ЕКСПОРТ =====
const paymentService = {
  activateTrialSubscription,
  activatePaidSubscription,
  checkExpiringSubscriptions,
  deactivateExpiredSubscriptions,
  syncUserSubscription,
  handleWayForPayWebhook
};

export default paymentService;

console.log('✅ [paymentService] Оптимізований платіжний сервіс ініціалізовано');