// src/auth/services/subscriptionService.js - ОПТИМІЗОВАНО

import { getBase, tables } from "../../config/database.js";
import userService from "./userService.js";

const base = getBase();

// ✅ ПЕРЕВІРКА СТАТУСУ ПІДПИСКИ
const checkSubscriptionStatus = async (tgId) => {
  try {
    const user = await userService.getUserByTelegramId(tgId);
    if (!user) return { active: false, expired: true };

    const endDate = user['End_Date'];
    if (!endDate) return { active: false, expired: true };

    const now = new Date();
    const expiry = new Date(endDate);
    
    const isActive = now < expiry;
    const isExpiringSoon = (expiry - now) <= (24 * 60 * 60 * 1000); // 1 день

    return {
      active: isActive,
      expired: !isActive,
      expiringSoon: isExpiringSoon,
      expiryDate: expiry,
      daysLeft: Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
    };
  } catch (error) {
    console.error('[subscriptionService] Помилка перевірки статусу:', error);
    return { active: false, expired: true };
  }
};

// ✅ АВТОМАТИЧНА ДЕАКТИВАЦІЯ ЗАКІНЧЕНИХ ПІДПИСОК
const deactivateExpiredSubscriptions = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const records = await base(tables.USERS)
      .select({
        filterByFormula: `AND(
          FIND('✅ Активна', {Active_Subscription_Status}) > 0,
          IS_BEFORE({End_Date}, TODAY())
        )`
      })
      .all();

    if (records.length === 0) return 0;

    const updates = records.map(record => ({
      id: record.id,
      fields: {
        'Active_Subscription_Status': '❌ Закінчена',
        'Subscription Status': 'Expired'
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

// ✅ ОТРИМАННЯ КОРИСТУВАЧІВ З ПІДПИСКАМИ ЩО ЗАКІНЧУЮТЬСЯ
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

// ✅ НАДСИЛАННЯ НАГАДУВАНЬ
const sendSubscriptionReminders = async (bot) => {
  try {
    console.log('[subscriptionService] Перевірка нагадувань про підписку');
    
    // Нагадування за день до закінчення
    const expiringUsers = await getUsersWithExpiringSubscriptions(1);
    
    for (const user of expiringUsers) {
      const tgId = user.TG_id;
      const planName = user['Active Subscription Plan'] || 'План';
      const endDate = new Date(user.End_Date).toLocaleDateString('uk-UA');
      
      const message = 
        `⚠️ Підписка закінчується завтра!\n\n` +
        `📋 План: ${planName}\n` +
        `📅 Діє до: ${endDate}\n\n` +
        `💰 Поднови підписку, щоб продовжити користування всіма функціями бота.\n\n` +
        `Зв'яжіться з підтримкою: nadyastarway@gmail.com`;

      try {
        await bot.telegram.sendMessage(tgId, message, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💰 Підписка', callback_data: 'subscription_info' }],
              [{ text: '📞 Підтримка', callback_data: 'contact_support' }]
            ]
          }
        });
        
        console.log(`[subscriptionService] ✅ Нагадування відправлено ${tgId}`);
      } catch (sendError) {
        console.error(`[subscriptionService] Помилка відправки для ${tgId}:`, sendError);
      }
      
      await new Promise(r => setTimeout(r, 500));
    }
    
    return expiringUsers.length;
  } catch (error) {
    console.error('[subscriptionService] Помилка надсилання нагадувань:', error);
    return 0;
  }
};

// ✅ АКТИВАЦІЯ ДЕМО ПІДПИСКИ
const activateDemoSubscription = async (tgId, planName, days) => {
  try {
    const user = await userService.getUserByTelegramId(tgId);
    if (!user) return null;

    const startDate = new Date().toISOString();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const fields = {
      "Active Subscription Plan": planName,
      "Active_Subscription_Status": `✅ Активна до ${endDate.toLocaleDateString('uk-UA')}`,
      "Subscription Status": "Active",
      Start_Date: startDate,
      End_Date: endDate.toISOString(),
    };

    const updated = await base(tables.USERS).update(
      [{ id: user.id, fields }],
      { typecast: true }
    );

    console.log(`[subscriptionService] ✅ Демо підписка активована для ${tgId}`);
    return updated[0];
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
  activateDemoSubscription,
};