// src/repositories/subscriptionRepository.js - ПОВНА ВЕРСІЯ

import { selectFromTable, createRows, updateRows } from '../config/database.js';

const TABLE = 'SUBSCRIPTIONS';

// ===== CREATE =====
export const createSubscription = async (tgId, planData) => {
  console.log(`[subscriptionRepo] 🆕 Створення підписки для ${tgId}...`);
  
  const now = new Date().toISOString();
  
  const fields = {
    TG_id: String(tgId),
    'User Name': planData.userName || 'Користувач',
    'Order_Reference': planData.orderReference || `SUB_${tgId}_${Date.now()}`,
    'Payment_Status': planData.paymentStatus || 'Approved',
    Status: 'Active',
    'Plan_Name': planData.planName,
    Amount: planData.amount || 0,
    Currency: 'EUR',
    'Start_Date': planData.startDate || now,
    'End_Date': planData.endDate,
    'Is_Active': '✅ Активна',
    'Created_At': now
  };
  
  try {
    // createRows приймає масив
    const [record] = await createRows(TABLE, [{ fields }]);
    console.log(`[subscriptionRepo] ✅ Підписку створено, ID: ${record.id}`);
    return record;
  } catch (error) {
    console.error(`[subscriptionRepo] ❌ Помилка createSubscription:`, error.message);
    throw error;
  }
};

// ===== READ =====
export const findSubscriptionByTgId = async (tgId) => {
  console.log(`[subscriptionRepo] 🔍 Пошук підписки для ${tgId}...`);
  
  try {
    const records = await selectFromTable(TABLE, {
      filterByFormula: `{TG_id} = '${String(tgId)}'`,
      sort: [{ field: 'Created_At', direction: 'desc' }],
      maxRecords: 1
    }).firstPage();
    
    const found = records.length > 0 ? records[0] : null;
    console.log(`[subscriptionRepo] ${found ? '✅ Знайдено' : '❌ Не знайдено'}`);
    
    return found;
  } catch (error) {
    console.error(`[subscriptionRepo] ❌ Помилка findSubscriptionByTgId:`, error.message);
    throw error;
  }
};

export const findActiveSubscription = async (tgId) => {
  console.log(`[subscriptionRepo] 🔍 Пошук активної підписки для ${tgId}...`);
  
  try {
    const records = await selectFromTable(TABLE, {
      filterByFormula: `AND({TG_id} = '${String(tgId)}', {Status} = 'Active')`,
      sort: [{ field: 'End_Date', direction: 'desc' }],
      maxRecords: 1
    }).firstPage();
    
    const found = records.length > 0 ? records[0] : null;
    console.log(`[subscriptionRepo] ${found ? '✅ Активна підписка знайдена' : '❌ Активної підписки немає'}`);
    
    return found;
  } catch (error) {
    console.error(`[subscriptionRepo] ❌ Помилка findActiveSubscription:`, error.message);
    throw error;
  }
};

export const findSubscriptionsByStatus = async (status = 'Active') => {
  console.log(`[subscriptionRepo] 📋 Пошук підписок зі статусом: ${status}...`);
  
  try {
    const records = await selectFromTable(TABLE, {
      filterByFormula: `{Status} = '${status}'`,
      sort: [{ field: 'End_Date', direction: 'asc' }]
    }).all();
    
    console.log(`[subscriptionRepo] ✅ Знайдено ${records.length} підписок`);
    return records;
  } catch (error) {
    console.error(`[subscriptionRepo] ❌ Помилка findSubscriptionsByStatus:`, error.message);
    return [];
  }
};

export const findExpiringSubscriptions = async (daysAhead = 1) => {
  console.log(`[subscriptionRepo] ⏰ Пошук підписок що закінчуються через ${daysAhead} днів...`);
  
  const today = new Date();
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysAhead);
  
  const todayStr = today.toISOString().split('T')[0];
  const targetStr = targetDate.toISOString().split('T')[0];
  
  try {
    const records = await selectFromTable(TABLE, {
      filterByFormula: `AND(
        {Status} = 'Active',
        IS_AFTER({End_Date}, '${todayStr}'),
        IS_BEFORE({End_Date}, '${targetStr}')
      )`
    }).all();
    
    console.log(`[subscriptionRepo] ✅ Знайдено ${records.length} підписок що закінчуються`);
    return records;
  } catch (error) {
    console.error(`[subscriptionRepo] ❌ Помилка findExpiringSubscriptions:`, error.message);
    return [];
  }
};

// ===== UPDATE =====
export const updateSubscription = async (recordId, fields) => {
  console.log(`[subscriptionRepo] 🔄 Оновлення підписки ${recordId}...`);
  
  try {
    const [updated] = await updateRows(TABLE, [{
      id: recordId,
      fields
    }]);
    
    console.log(`[subscriptionRepo] ✅ Підписку оновлено`);
    return updated;
  } catch (error) {
    console.error(`[subscriptionRepo] ❌ Помилка updateSubscription:`, error.message);
    throw error;
  }
};

export const deactivateSubscription = async (recordId) => {
  console.log(`[subscriptionRepo] 🔴 Деактивація підписки ${recordId}...`);
  
  try {
    const [updated] = await updateRows(TABLE, [{
      id: recordId,
      fields: {
        Status: 'Expired',
        'Is_Active': '❌ Неактивна'
      }
    }]);
    
    console.log(`[subscriptionRepo] ✅ Підписку деактивовано`);
    return updated;
  } catch (error) {
    console.error(`[subscriptionRepo] ❌ Помилка deactivateSubscription:`, error.message);
    throw error;
  }
};

export const renewSubscription = async (recordId, endDate) => {
  console.log(`[subscriptionRepo] 🔄 Продовження підписки ${recordId}...`);
  
  try {
    const [updated] = await updateRows(TABLE, [{
      id: recordId,
      fields: {
        Status: 'Active',
        'Is_Active': '✅ Активна',
        'End_Date': endDate,
        'Renewal_Date': new Date().toISOString()
      }
    }]);
    
    console.log(`[subscriptionRepo] ✅ Підписку продовжено до ${endDate}`);
    return updated;
  } catch (error) {
    console.error(`[subscriptionRepo] ❌ Помилка renewSubscription:`, error.message);
    throw error;
  }
};

// ===== BULK OPERATIONS =====
export const deactivateExpiredSubscriptions = async () => {
  console.log(`[subscriptionRepo] 🔍 Пошук прострочених підписок...`);
  
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // Знаходимо прострочені
    const records = await selectFromTable(TABLE, {
      filterByFormula: `AND(
        {Status} = 'Active',
        IS_BEFORE({End_Date}, '${today}')
      )`
    }).all();
    
    if (records.length === 0) {
      console.log(`[subscriptionRepo] ℹ️ Прострочених підписок не знайдено`);
      return 0;
    }
    
    console.log(`[subscriptionRepo] ⚠️ Знайдено ${records.length} прострочених підписок`);
    
    // Деактивуємо всі
    const updates = records.map(record => ({
      id: record.id,
      fields: {
        Status: 'Expired',
        'Is_Active': '❌ Неактивна'
      }
    }));
    
    await updateRows(TABLE, updates);
    
    console.log(`[subscriptionRepo] ✅ Деактивовано ${records.length} підписок`);
    return records.length;
    
  } catch (error) {
    console.error(`[subscriptionRepo] ❌ Помилка deactivateExpiredSubscriptions:`, error.message);
    return 0;
  }
};

// ===== STATISTICS =====
export const getSubscriptionStats = async () => {
  console.log(`[subscriptionRepo] 📊 Збір статистики підписок...`);
  
  try {
    const [active, expired, trial] = await Promise.all([
      selectFromTable(TABLE, {
        filterByFormula: `{Status} = 'Active'`
      }).all(),
      
      selectFromTable(TABLE, {
        filterByFormula: `{Status} = 'Expired'`
      }).all(),
      
      selectFromTable(TABLE, {
        filterByFormula: `FIND('Пробний', {Plan_Name}) > 0`
      }).all()
    ]);
    
    const stats = {
      active: active.length,
      expired: expired.length,
      trial: trial.length,
      total: active.length + expired.length
    };
    
    console.log(`[subscriptionRepo] 📊 Статистика:`, stats);
    return stats;
    
  } catch (error) {
    console.error(`[subscriptionRepo] ❌ Помилка getSubscriptionStats:`, error.message);
    return { active: 0, expired: 0, trial: 0, total: 0 };
  }
};

export default {
  // Create
  createSubscription,
  
  // Read
  findSubscriptionByTgId,
  findActiveSubscription,
  findSubscriptionsByStatus,
  findExpiringSubscriptions,
  
  // Update
  updateSubscription,
  deactivateSubscription,
  renewSubscription,
  
  // Bulk
  deactivateExpiredSubscriptions,
  
  // Stats
  getSubscriptionStats
};

console.log('✅ [subscriptionRepo] Репозиторій підписок ініціалізовано');