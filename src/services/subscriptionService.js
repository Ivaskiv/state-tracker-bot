// src/services/subscriptionService.js - ПОКРАЩЕНА ВЕРСІЯ З ЛОГАМИ

import subscriptionRepo from '../repositories/subscriptionRepository.js';
import userService from './userService.js';
import { SUBSCRIPTION_PLANS } from '../config/constants.js';

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

// ===== СТВОРЕННЯ TRIAL ПІДПИСКИ =====
export const createTrialSubscription = async (tgId, userName) => {
  console.log(`[subscriptionService] 🧪 createTrialSubscription(${tgId})`);
  
  const plan = SUBSCRIPTION_PLANS.TRIAL;
  const now = new Date();
  const end = addDays(now, plan.duration);
  
  console.log(`[subscriptionService] Створюємо trial: ${now.toLocaleDateString()} → ${end.toLocaleDateString()}`);
  
  try {
    const subscription = await subscriptionRepo.createSubscription(tgId, {
      userName,
      planName: plan.name,
      amount: 0,
      startDate: now.toISOString(),
      endDate: end.toISOString(),
      orderReference: `TRIAL_${tgId}_${Date.now()}`,
      paymentStatus: 'Approved',
      status: 'Active'
    });
    
    console.log(`[subscriptionService] ✅ Trial підписку створено, ID: ${subscription?.id}`);
    return subscription;
    
  } catch (error) {
    console.error(`[subscriptionService] ❌ Помилка створення trial:`, error);
    throw error;
  }
};

// ===== ПЕРЕВІРКА СТАТУСУ ПІДПИСКИ =====
export const checkSubscriptionStatus = async (tgId) => {
  console.log(`[subscriptionService] 🔍 Перевірка статусу для ${tgId}`);
  
  try {
    const subscription = await subscriptionRepo.findActiveSubscription(tgId);
    
    if (!subscription) {
      console.log(`[subscriptionService] ❌ Активної підписки не знайдено`);
      return { active: false };
    }
    
    const endDate = new Date(subscription.fields.End_Date);
    const now = new Date();
    const isActive = endDate > now;
    
    console.log(`[subscriptionService] ${isActive ? '✅' : '❌'} Підписка ${isActive ? 'активна' : 'закінчилась'} до ${endDate.toLocaleDateString('uk-UA')}`);
    
    return {
      active: isActive,
      planName: subscription.fields.Plan_Name,
      endDate: subscription.fields.End_Date,
      startDate: subscription.fields.Start_Date,
      subscriptionId: subscription.id
    };
    
  } catch (error) {
    console.error('[subscriptionService] ❌ Помилка перевірки:', error);
    return { active: false };
  }
};

// ===== АКТИВАЦІЯ ПЛАТНОЇ ПІДПИСКИ =====
export const activatePaidSubscription = async (paymentData) => {
  const { tgId, planKey, planName, amount, duration, orderReference, userName } = paymentData;
  
  console.log(`[subscriptionService] 💳 activatePaidSubscription(${tgId}, ${planKey})`);
  console.log(`[subscriptionService] План: ${planName}, сума: ${amount}€, тривалість: ${duration} днів`);
  
  try {
    const now = new Date();
    const end = addDays(now, duration);
    
    console.log(`[subscriptionService] Період: ${now.toLocaleDateString()} → ${end.toLocaleDateString()}`);
    
    // 1️⃣ СТВОРЮЄМО ПІДПИСКУ
    console.log(`[subscriptionService] 1️⃣ Створення запису в Subscriptions...`);
    const subscription = await subscriptionRepo.createSubscription(tgId, {
      userName: userName || 'Користувач',
      planName,
      amount,
      startDate: now.toISOString(),
      endDate: end.toISOString(),
      orderReference,
      paymentStatus: 'Approved',
      status: 'Active'
    });
    
    console.log(`[subscriptionService] ✅ Підписку створено, ID: ${subscription?.id}`);
    
    // 2️⃣ ОНОВЛЮЄМО КОРИСТУВАЧА
    console.log(`[subscriptionService] 2️⃣ Оновлення користувача в Users...`);
    await userService.updateUserFields(tgId, {
      'Subscription Status': 'Active',
      'Active Subscription Plan': planName,
      Start_Date: now.toISOString().split('T')[0],
      End_Date: end.toISOString().split('T')[0]
    });
    
    console.log(`[subscriptionService] ✅ Користувача оновлено`);
    console.log(`[subscriptionService] 🎉 ПЛАТНУ ПІДПИСКУ АКТИВОВАНО УСПІШНО`);
    
    return {
      success: true,
      endDate: end.toISOString(),
      message: `✅ Підписка "${planName}" активована!\nДіє до: ${end.toLocaleDateString('uk-UA')}`
    };
    
  } catch (error) {
    console.error('[subscriptionService] ❌ Критична помилка активації:', error);
    console.error('[subscriptionService] Stack:', error.stack);
    
    return {
      success: false,
      message: '❌ Помилка активації підписки'
    };
  }
};

// ===== СИНХРОНІЗАЦІЯ ПІДПИСКИ =====
export const syncUserSubscription = async (tgId) => {
  console.log(`[subscriptionService] 🔄 syncUserSubscription(${tgId})`);
  
  try {
    const id = String(tgId);
    
    // Шукаємо останню схвалену підписку
    console.log(`[subscriptionService] Пошук активної підписки...`);
    const subscription = await subscriptionRepo.findActiveSubscription(id);
    
    if (!subscription) {
      console.log(`[subscriptionService] ❌ Оплат не знайдено`);
      
      // Скидаємо статус в Users
      await userService.updateUserFields(id, {
        'Subscription Status': 'Inactive',
        'Active Subscription Plan': '',
        Start_Date: null,
        End_Date: null
      });
      
      return '❌ Активних оплат не знайдено.\n\n' +
             '💡 Якщо ти щойно оплатила — зачекай 1-2 хв і натисни «🔄 Оновити».';
    }
    
    const fields = subscription.fields;
    const endDate = new Date(fields.End_Date);
    const now = new Date();
    const isStillActive = endDate > now;
    
    console.log(`[subscriptionService] Знайдено підписку: ${fields.Plan_Name}`);
    console.log(`[subscriptionService] Статус: ${isStillActive ? 'Активна' : 'Закінчилась'}`);
    
    // Оновлюємо користувача
    await userService.updateUserFields(id, {
      'Subscription Status': isStillActive ? 'Active' : 'Expired',
      'Active Subscription Plan': fields.Plan_Name || '',
      Start_Date: fields.Start_Date,
      End_Date: fields.End_Date
    });
    
    console.log(`[subscriptionService] ✅ Синхронізовано: ${isStillActive ? 'Active' : 'Expired'}`);
    
    return isStillActive
      ? `✅ Підписка активна: ${fields.Plan_Name}\nДіє до: ${endDate.toLocaleDateString('uk-UA')}`
      : `⚠️ Підписка закінчилась: ${fields.Plan_Name}\nЗакінчилась: ${endDate.toLocaleDateString('uk-UA')}\n\n💰 Поднови підписку для продовження.`;
      
  } catch (error) {
    console.error('[subscriptionService] ❌ Помилка синхронізації:', error);
    return '❌ Помилка синхронізації. Спробуй пізніше або звернися до підтримки.';
  }
};

// ===== НАГАДУВАННЯ ПРО ЗАКІНЧЕННЯ =====
export const getUsersWithExpiringSubscriptions = async (daysAhead = 1) => {
  console.log(`[subscriptionService] 📅 Пошук підписок що закінчуються через ${daysAhead} дн.`);
  
  try {
    const subscriptions = await subscriptionRepo.findExpiringSubscriptions(daysAhead);
    
    console.log(`[subscriptionService] Знайдено ${subscriptions.length} підписок`);
    
    const users = [];
    for (const sub of subscriptions) {
      const tgId = sub.fields.TG_id;
      const user = await userService.getUserByTgId(tgId);
      
      if (user) {
        users.push({
          TG_id: tgId,
          'User Name': user['User Name'],
          'Active Subscription Plan': sub.fields.Plan_Name,
          End_Date: sub.fields.End_Date
        });
      }
    }
    
    console.log(`[subscriptionService] ✅ Підготовлено ${users.length} користувачів для нагадування`);
    return users;
    
  } catch (error) {
    console.error('[subscriptionService] ❌ Помилка пошуку:', error);
    return [];
  }
};

// ===== ДЕАКТИВАЦІЯ ПРОСТРОЧЕНИХ =====
export const deactivateExpiredSubscriptions = async () => {
  console.log('[subscriptionService] 🔍 Деактивація прострочених підписок');
  
  try {
    const deactivated = await subscriptionRepo.deactivateExpiredSubscriptions();
    
    console.log(`[subscriptionService] ✅ Деактивовано: ${deactivated}`);
    return deactivated;
    
  } catch (error) {
    console.error('[subscriptionService] ❌ Помилка деактивації:', error);
    return 0;
  }
};

export default {
  createTrialSubscription,
  checkSubscriptionStatus,
  syncUserSubscription,
  activatePaidSubscription,
  getUsersWithExpiringSubscriptions,
  deactivateExpiredSubscriptions
};

console.log('✅ [subscriptionService] Покращений subscription service ініціалізовано');