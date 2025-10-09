// src/auth/services/paymentService.js - ОПТИМІЗОВАНО

import { getBase, tables } from '../config/database.js';
import userService from './userService.js';

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
    
    const user = await userService.getUserByTgId(id);
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
      Current_Activity: 'completed'
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
    
    const user = await userService.getUserByTgId(id);
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
      Current_Activity: 'completed'
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
    console.log('[paymentService] 🔍 Перевірка підписок, що закінчуються завтра');

    const expiringUsers = await userService.getUsersWithExpiringSubscriptions(1); // має включати trial
    if (!expiringUsers.length) {
      console.log('[paymentService] ℹ️ Немає підписок, що закінчуються завтра');
      return 0;
    }

    let remindersSent = 0;
    const now = new Date();

    for (const user of expiringUsers) {
      const tgId = user.TG_id;
      const planName = user['Active Subscription Plan'] || 'План';
      const endDate = new Date(user.End_Date);
      const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

      // Надсилаємо нагадування тільки якщо trial або підписка закінчується завтра
      if (daysLeft <= 1) {
        const message = 
          `⚠️ Підписка закінчується ${daysLeft === 0 ? 'сьогодні' : 'завтра'}!\n\n` +
          `📋 План: ${planName}\n` +
          `📅 Діє до: ${endDate.toLocaleDateString('uk-UA')}\n\n` +
          `💰 Продовжити підписку: натисни кнопку нижче\n\n` +
          `📞 Підтримка: nadyastarway@gmail.com`;

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
          console.error(`[paymentService] ❌ Помилка відправки для ${tgId}:`, sendError);
        }

        await new Promise(r => setTimeout(r, 500));
      }
    }

    console.log(`[paymentService] 📊 Відправлено ${remindersSent} нагадувань`);
    return remindersSent;

  } catch (error) {
    console.error('[paymentService] ❌ Помилка перевірки підписок:', error);
    return 0;
  }
};
// ===== ДЕАКТИВАЦІЯ ПРОСТРОЧЕНИХ ПІДПИСОК =====
export const deactivateExpiredSubscriptions = async () => {
  try {
    console.log('[paymentService] 🔍 Деактивація прострочених підписок (Users table)');

    // Отримаємо сьогоднішню дату у форматі YYYY-MM-DD
    const todayStr = new Date().toISOString().split('T')[0];

    // Запитуємо користувачів, які в Users мають Subscription Status = 'Active' або Active_Subscription_Status містить 'Актив'
    const activeUsers = await base(tables.USERS)
      .select({
        filterByFormula: `OR({Subscription Status}='Active', FIND('Актив', {Active_Subscription_Status}))`,
        maxRecords: 500
      })
      .all();

    let deactivated = 0;
    for (const rec of activeUsers) {
      const fields = rec.fields || {};
      const tgId = fields.TG_id || fields['TG_id'] || fields['TG id'];
      const rawEnd = fields.End_Date || fields['End_Date'] || fields.EndDate;

      if (!tgId || !rawEnd) continue;

      const expiry = new Date(rawEnd).toISOString().split('T')[0];
      if (expiry < todayStr) {
        console.log(`[paymentService] ⏰ Деактивуємо підписку для ${tgId} (закінчилась ${expiry})`);
        try {
          await userService.updateUser(tgId, {
            'Subscription Status': 'Expired',
            Current_Activity: 'completed',
            'Active Subscription Plan': ''
          });
          deactivated++;
        } catch (e) {
          console.error(`[paymentService] ❌ Не вдалося деактивувати ${tgId}:`, e.message || e);
        }
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
export const syncUserSubscription = async (tgId, bot) => {
  try {
    const id = String(tgId);
    if (!id) return '⚠️ Не вдалося визначити користувача.';

    console.log(`[paymentService] 🔄 Синхронізація підписки для ${id}`);

    // Отримуємо останню активну підписку
    const subs = await base(tables.SUBSCRIPTIONS)
      .select({
        filterByFormula: `AND({TG_id}='${id}', {Payment_Status}='Approved')`,
        sort: [{ field: 'End_Date', direction: 'desc' }],
        maxRecords: 1,
      })
      .firstPage();

    if (!subs.length) {
      console.log(`[paymentService] ❌ Активних оплат не знайдено для ${id}`);
      
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

    // Якщо підписка закінчилася, надсилаємо повідомлення через бота
    if (!isStillActive && bot) {
      try {
        await bot.telegram.sendMessage(id,
          `⚠️ Підписка закінчилася: ${plan}\nЗакінчилася: ${endDateUA}\n\n💰 Поднови підписку для продовження роботи з ботом.`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '💰 Продовжити підписку', callback_data: 'subscription_plans' }],
                [{ text: '📞 Підтримка', callback_data: 'contact_support' }]
              ]
            }
          }
        );
        console.log(`[paymentService] ✅ Надіслано повідомлення про закінчення підписки для ${id}`);
      } catch (err) {
        console.error(`[paymentService] ❌ Помилка відправки повідомлення:`, err);
      }
    }

    return isStillActive 
      ? `✅ Підписка активна: ${plan}\nДіє до: ${endDateUA}`
      : `⚠️ Підписка закінчилася: ${plan}\nЗакінчилася: ${endDateUA}`;
      
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
// ===== ОБРОБКА ПІДПИСОК (нагадування + деактивація) =====
export const processSubscriptions = async (bot) => {
  try {
    console.log('[paymentService] 🔄 Перевірка та обробка підписок користувачів');

    const users = await userService.getUsersWithActiveSubscriptions(); // Active / Trial
    if (!users.length) {
      console.log('[paymentService] ℹ️ Активних підписок не знайдено');
      return 0;
    }

    const now = new Date();
    let remindersSent = 0;
    let deactivatedCount = 0;

    for (const user of users) {
      const tgId = user.TG_id;
      const planName = user['Active Subscription Plan'] || 'План';
      const endDateStr = user.End_Date;
      if (!tgId || !endDateStr) continue;

      const endDate = new Date(endDateStr);
      const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

      // 🔔 Надсилаємо нагадування за 1-2 дні до закінчення
      if (daysLeft > 0 && daysLeft <= 2 && bot) {
        try {
          await bot.telegram.sendMessage(tgId,
            `⚠️ Підписка закінчується ${daysLeft === 1 ? 'завтра' : 'сьогодні'}!\n\n` +
            `📋 План: ${planName}\n` +
            `📅 Діє до: ${endDate.toLocaleDateString('uk-UA')}\n\n` +
            `💰 Продовжити підписку: натисни кнопку нижче\n\n` +
            `📞 Підтримка: nadyastarway@gmail.com`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '💰 Продовжити підписку', callback_data: 'subscription_plans' }],
                  [{ text: '📞 Підтримка', callback_data: 'contact_support' }]
                ]
              }
            }
          );
          remindersSent++;
          console.log(`[paymentService] ✅ Нагадування надіслано ${tgId}`);
        } catch (err) {
          console.error(`[paymentService] ❌ Помилка надсилання нагадування ${tgId}:`, err);
        }
      }

      // ⏰ Деактивація прострочених підписок
      if (endDate < now) {
        try {
          await userService.updateUser(tgId, {
            'Subscription Status': 'Expired',
            'Active Subscription Plan': '',
            Current_Activity: 'completed'
          });
          deactivatedCount++;
          console.log(`[paymentService] ⏰ Підписка деактивована для ${tgId}`);
        } catch (err) {
          console.error(`[paymentService] ❌ Не вдалося деактивувати ${tgId}:`, err);
        }
      }
    }

    console.log(`[paymentService] 📊 Підсумок: ${remindersSent} нагадувань, ${deactivatedCount} деактивацій`);
    return { remindersSent, deactivatedCount };

  } catch (error) {
    console.error('[paymentService] ❌ Помилка processSubscriptions:', error);
    return { remindersSent: 0, deactivatedCount: 0 };
  }
};

// ===== ЕКСПОРТ =====
const paymentService = {
  activateTrialSubscription,
  activatePaidSubscription,
  checkExpiringSubscriptions,
  deactivateExpiredSubscriptions,
  syncUserSubscription,
  handleWayForPayWebhook,
  processSubscriptions
};

export default paymentService;

console.log('✅ [paymentService] Оптимізований платіжний сервіс ініціалізовано');