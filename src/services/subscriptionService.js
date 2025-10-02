// src/services/subscriptionService.js - ПОВНА РЕАЛІЗАЦІЯ З СИНХРОНІЗАЦІЄЮ

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
  const plan = SUBSCRIPTION_PLANS.TRIAL;
  const now = new Date();
  const end = addDays(now, plan.duration);
  
  return await subscriptionRepo.createSubscription(tgId, {
    userName,
    planName: plan.name,
    amount: 0,
    startDate: now.toISOString(),
    endDate: end.toISOString(),
    orderReference: `TRIAL_${tgId}_${Date.now()}`,
    paymentStatus: 'Approved',
    status: 'Active'
  });
};

// ===== ПЕРЕВІРКА СТАТУСУ ПІДПИСКИ =====
export const checkSubscriptionStatus = async (tgId) => {
  try {
    console.log(`[subscriptionService] 🔍 Перевірка статусу для ${tgId}`);
    
    const subscription = await subscriptionRepo.findActiveSubscription(tgId);
    
    if (!subscription) {
      console.log(`[subscriptionService] ❌ Активної підписки не знайдено`);
      return { active: false };
    }
    
    const endDate = new Date(subscription.fields.End_Date);
    const now = new Date();
    const isActive = endDate > now;
    
    console.log(`[subscriptionService] ✅ Підписка ${isActive ? 'активна' : 'закінчилась'} до ${endDate.toLocaleDateString('uk-UA')}`);
    
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

// ===== СИНХРОНІЗАЦІЯ ПІДПИСКИ З WAYFORPAY =====
export const syncUserSubscription = async (tgId) => {
  try {
    const id = String(tgId);
    console.log(`[subscriptionService] 🔄 Синхронізація для ${id}`);
    
    // Шукаємо останню схвалену підписку
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

// ===== АКТИВАЦІЯ ПЛАТНОЇ ПІДПИСКИ =====
export const activatePaidSubscription = async (paymentData) => {
  try {
    const { tgId, planKey, planName, amount, duration, orderReference } = paymentData;
    
    console.log(`[subscriptionService] 💳 Активація ${planKey} для ${tgId}`);
    
    const now = new Date();
    const end = addDays(now, duration);
    
    // Створюємо підписку
    await subscriptionRepo.createSubscription(tgId, {
      userName: paymentData.userName || 'Користувач',
      planName,
      amount,
      startDate: now.toISOString(),
      endDate: end.toISOString(),
      orderReference,
      paymentStatus: 'Approved',
      status: 'Active'
    });
    
    // Оновлюємо користувача
    await userService.updateUserFields(tgId, {
      'Subscription Status': 'Active',
      'Active Subscription Plan': planName,
      Start_Date: now.toISOString().split('T')[0],
      End_Date: end.toISOString().split('T')[0]
    });
    
    console.log(`[subscriptionService] ✅ Підписка активована до ${end.toLocaleDateString('uk-UA')}`);
    
    return {
      success: true,
      endDate: end.toISOString(),
      message: `✅ Підписка "${planName}" активована!\nДіє до: ${end.toLocaleDateString('uk-UA')}`
    };
    
  } catch (error) {
    console.error('[subscriptionService] ❌ Помилка активації:', error);
    return {
      success: false,
      message: '❌ Помилка активації підписки'
    };
  }
};

// ===== НАГАДУВАННЯ ПРО ЗАКІНЧЕННЯ =====
export const getUsersWithExpiringSubscriptions = async (daysAhead = 1) => {
  try {
    console.log(`[subscriptionService] 📅 Пошук підписок що закінчуються через ${daysAhead} дн.`);
    
    const subscriptions = await subscriptionRepo.findExpiringSubscriptions(daysAhead);
    
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
    
    console.log(`[subscriptionService] ✅ Знайдено ${users.length} підписок`);
    return users;
    
  } catch (error) {
    console.error('[subscriptionService] ❌ Помилка пошуку:', error);
    return [];
  }
};

// ===== ДЕАКТИВАЦІЯ ПРОСТРОЧЕНИХ =====
export const deactivateExpiredSubscriptions = async () => {
  try {
    console.log('[subscriptionService] 🔍 Деактивація прострочених підписок');
    
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

console.log('✅ [subscriptionService] Subscription service initialized');