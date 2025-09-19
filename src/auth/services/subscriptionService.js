// src/auth/services/subscriptionService.js - ДОДАНО БЛОКУВАННЯ ТА НАГАДУВАННЯ

import { getBase, tables } from "../../config/database.js";
import userService from "./userService.js";
import keyboards from "../../utils/keyboards.js";

const base = getBase();

// ВИПРАВЛЕНО: перевірка статусу підписки
const checkSubscriptionStatus = async (tgId) => {
  try {
    const user = await userService.getUserByTelegramId(tgId);
    if (!user) return { active: false, expired: true };

    const endDate = user['End_Date'];
    const subscriptionStatus = user['Active_Subscription_Status'] || '';
    
    // Перевіряємо за статусом і датою
    const isActiveByStatus = subscriptionStatus.includes('✅ Активна');
    
    if (!endDate || !isActiveByStatus) {
      return { active: false, expired: true };
    }

    const now = new Date();
    const expiry = new Date(endDate);
    
    const isActive = now < expiry && isActiveByStatus;
    const isExpiringSoon = (expiry - now) <= (24 * 60 * 60 * 1000); // менше 24 годин
    const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

    return {
      active: isActive,
      expired: !isActive,
      expiringSoon: isExpiringSoon && isActive,
      expiryDate: expiry,
      daysLeft: Math.max(0, daysLeft)
    };
  } catch (error) {
    console.error('[subscriptionService] Помилка перевірки статусу:', error);
    return { active: false, expired: true };
  }
};

// ДОДАНО: деактивація закінчених підписок
const deactivateExpiredSubscriptions = async () => {
  try {
    console.log('[subscriptionService] 🔍 Пошук закінчених підписок');
    
    const today = new Date().toISOString().split('T')[0];
    
    const records = await base(tables.USERS)
      .select({
        filterByFormula: `AND(
          FIND('✅ Активна', {Active_Subscription_Status}) > 0,
          IS_BEFORE({End_Date}, TODAY())
        )`
      })
      .all();

    if (records.length === 0) {
      console.log('[subscriptionService] ✅ Немає закінчених підписок');
      return 0;
    }

    const updates = records.map(record => ({
      id: record.id,
      fields: {
        'Active_Subscription_Status': '❌ Закінчена',
        'Active_Subscription_Status': 'Expired',
        Answer_Step: 'completed' // Скидаємо стан
      }
    }));

    await base(tables.USERS).update(updates);
    console.log(`[subscriptionService] ✅ Деактивовано ${updates.length} підписок`);
    
    return updates.length;
  } catch (error) {
    console.error('[subscriptionService] Помилка деактивації:', error);
    return 0;
  }
};

// ДОДАНО: отримання користувачів з підписками що закінчуються
const getUsersWithExpiringSubscriptions = async (daysOffset = 1) => {
  try {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysOffset);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    const records = await base(tables.USERS)
      .select({
        filterByFormula: `AND(
          FIND('✅ Активна', {Active_Subscription_Status}) > 0,
          DATESTR({End_Date}) = '${targetDateStr}'
        )`,
        fields: ['TG_id', 'User Name', 'Active Subscription Plan', 'End_Date']
      })
      .all();

    return records.map(r => r.fields);
  } catch (error) {
    console.error('[subscriptionService] Помилка отримання користувачів:', error);
    return [];
  }
};

// ДОДАНО: надсилання нагадувань про закінчення підписки
const sendSubscriptionReminders = async (bot) => {
  try {
    console.log('[subscriptionService] 💰 Перевірка нагадувань про підписку');
    
    // Нагадування за день до закінчення
    const expiringUsers = await getUsersWithExpiringSubscriptions(1);
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
        console.log(`[subscriptionService] ✅ Нагадування відправлено ${tgId}`);
      } catch (sendError) {
        console.error(`[subscriptionService] Помилка відправки для ${tgId}:`, sendError);
      }
      
      await new Promise(r => setTimeout(r, 500));
    }
    
    console.log(`[subscriptionService] 📊 Відправлено ${remindersSent} нагадувань`);
    return remindersSent;
  } catch (error) {
    console.error('[subscriptionService] Помилка надсилання нагадувань:', error);
    return 0;
  }
};

// ДОДАНО: синхронізація підписки користувача з таблиці Subscriptions
const syncUserSubscription = async (tgId) => {
  try {
    if (!tgId) return '⚠️ Не вдалося визначити користувача.';

    console.log(`[subscriptionService] 🔄 Синхронізація підписки для ${tgId}`);

    // Шукаємо останню активну підписку в таблиці Subscriptions
    const subs = await base(tables.SUBSCRIPTIONS)
      .select({
        filterByFormula: `AND({TG_id}='${tgId}', {Payment_Status}='Approved')`,
        sort: [{ field: 'End_Date', direction: 'desc' }],
        maxRecords: 1,
      })
      .firstPage();

    if (!subs.length) {
      console.log(`[subscriptionService] ❌ Активних оплат не знайдено для ${tgId}`);
      
      // Скидаємо статус у Users
      const users = await base(tables.USERS)
        .select({ filterByFormula: `{TG_id}='${tgId}'`, maxRecords: 1 })
        .firstPage();

      if (users.length) {
        await base(tables.USERS).update([
          {
            id: users[0].id,
            fields: {
              Active_Subscription_Status: '❌ Неактивна',
              'Active Subscription Plan': null,
              'Active_Subscription_Status': 'Inactive',
              Start_Date: null,
              End_Date: null,
            },
          },
        ]);
      }
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
    const users = await base(tables.USERS)
      .select({ filterByFormula: `{TG_id}='${tgId}'`, maxRecords: 1 })
      .firstPage();

    if (users.length) {
      await base(tables.USERS).update([
        {
          id: users[0].id,
          fields: {
            Active_Subscription_Status: isStillActive ? `✅ Активна до ${endDateUA}` : '❌ Закінчена',
            'Active Subscription Plan': plan,
            'Active_Subscription_Status': isStillActive ? 'Active' : 'Expired',
            Start_Date: s.Start_Date || users[0].fields.Start_Date || null,
            End_Date: s.End_Date || users[0].fields.End_Date || null,
          },
        },
      ]);
    }

    console.log(`[subscriptionService] ✅ Підписка синхронізована для ${tgId}: ${plan} (активна: ${isStillActive})`);

    return isStillActive 
      ? `✅ Підписка активна: ${plan}\nДіє до: ${endDateUA}`
      : `⚠️ Підписка закінчилася: ${plan}\nЗакінчилася: ${endDateUA}\n\n💰 Поднови підписку для продовження роботи з ботом.`;
  } catch (error) {
    console.error('[subscriptionService] Помилка синхронізації:', error);
    return '❌ Помилка синхронізації підписки.';
  }
};

// ДОДАНО: блокування функціоналу для неактивних користувачів
const blockInactiveUser = async (ctx, featureName) => {
  const message = 
    `🚫 ${featureName} недоступний\n\n` +
    `❌ Твоя підписка неактивна або закінчилася.\n\n` +
    `💰 Поднови підписку, щоб користуватися всіма функціями бота.\n\n` +
    `📞 Питання? Пиши: nadyastarway@gmail.com`;

  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💰 Подновити підписку', callback_data: 'subscription_plans' }],
        [{ text: '📞 Зв\'язатися з підтримкою', callback_data: 'contact_support' }]
      ]
    }
  });
};

// ДОДАНО: активація демо підписки
const activateDemoSubscription = async (tgId, planName = 'Демо', days = 7) => {
  try {
    const user = await userService.getUserByTelegramId(tgId);
    if (!user) return null;

    const startDate = new Date().toISOString();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const fields = {
      "Active Subscription Plan": planName,
      "Active_Subscription_Status": `✅ Активна до ${endDate.toLocaleDateString('uk-UA')}`,
      "Active_Subscription_Status": "Active",
      Start_Date: startDate,
      End_Date: endDate.toISOString(),
    };

    const records = await base(tables.USERS)
      .select({ filterByFormula: `{TG_id}="${tgId}"` })
      .firstPage();

    if (records.length > 0) {
      const updated = await base(tables.USERS).update([
        { id: records[0].id, fields }
      ]);

      console.log(`[subscriptionService] ✅ Демо підписка активована для ${tgId}`);
      return updated[0];
    }

    return null;
  } catch (error) {
    console.error('[subscriptionService] Помилка активації демо:', error);
    return null;
  }
};

export default {
  checkSubscriptionStatus,
  deactivateExpiredSubscriptions,
  getUsersWithExpiringSubscriptions,
  sendSubscriptionReminders,
  syncUserSubscription,
  blockInactiveUser,
  activateDemoSubscription
};