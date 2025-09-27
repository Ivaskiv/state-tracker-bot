// src/auth/services/paymentService.js - Базовий сервіс платежів

import { getBase, tables } from '../../config/database.js';

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
    const updated = await userService.updateUser(tgId, {
      'Subscription Status': 'Active',
      'Active Subscription Plan': '🧪 Пробний період',
      'Active_Subscription_Status': `✅ Активна до ${endUA}`,
      'Start_Date': now.toISOString(),
      'End_Date': endISO,
      'Last_Activity': new Date().toISOString(),
      'Answer_Step': 'completed'
    });

    if (!updated) {
      console.error(`[paymentService] ❌ Не вдалося оновити користувача ${tgId}`);
      return false;
    }

    // Логуємо в Subscriptions
    try {
      await base(tables.SUBSCRIPTIONS).create({
        'TG_id': String(tgId),
        'User Name': userName,
        'Order_Reference': `TRIAL_${tgId}_${Date.now()}`,
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
    } catch (subscriptionError) {
      console.warn(`[paymentService] ⚠️ Не вдалося створити запис підписки:`, subscriptionError.message);
      // Не кидаємо помилку, основне оновлення пройшло успішно
    }

    console.log(`[paymentService] ✅ Пробна підписка активована для ${tgId} до ${endUA}`);
    return true;

  } catch (error) {
    console.error(`[paymentService] ❌ Помилка активації trial (${tgId}):`, error);
    return false;
  }
};

// ===== ПЕРЕВІРКА ПІДПИСОК ЩО ЗАКІНЧУЮТЬСЯ =====
export const checkExpiringSubscriptions = async () => {
  try {
    console.log('[paymentService] 🔍 Пошук підписок, що закінчуються завтра');
    
    const expiringUsers = await userService.getUsersWithExpiringSubscriptions(1);
    if (!expiringUsers.length) {
      console.log('[paymentService] ℹ️ Немає підписок, що закінчуються завтра');
      return 0;
    }

    // Тут буде логіка надсилання нагадувань (поки що тільки лог)
    console.log(`[paymentService] 📊 Знайдено ${expiringUsers.length} підписок що закінчуються`);
    return expiringUsers.length;

  } catch (error) {
    console.error('[paymentService] ❌ Помилка перевірки підписок:', error);
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
      const endISO = user['End_Date'];
      const isActive = String(user['Active_Subscription_Status'] || '').includes('✅ Активна');
      
      if (!isActive || !endISO) continue;

      const expiry = new Date(endISO).toISOString().split('T')[0];
      if (expiry < todayStr) {
        await userService.updateUser(user['TG_id'], {
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

// ===== ЗАГЛУШКА ДЛЯ WEBHOOK (поки що) =====
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
  checkExpiringSubscriptions,
  deactivateExpiredSubscriptions,
  handleWayForPayWebhook
};

export default paymentService;

console.log('✅ [paymentService] Базовий сервіс платежів ініціалізовано');