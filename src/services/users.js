// src/services/user.js
// Сервіс для роботи з користувачами (спрощена версія)

import { getBase, tables, updateRows } from '../config/database.js';
import { USER_STATUS, ANSWER_STEPS, CONFIG } from '../config/index.js';

const base = getBase();

/**
 * Отримати користувача за TG_id
 */
export const getUserByTgId = async (tgId) => {
  try {
    const formula = `{TG_id} = "${tgId}"`;
    
    const records = await base(tables.USERS)
      .select({
        filterByFormula: formula,
        maxRecords: 1
      })
      .firstPage();

    if (records.length === 0) {
      console.log(`[user] ❌ Користувач ${tgId} не знайдений`);
      return null;
    }

    console.log(`[user] ✅ Користувач ${tgId} знайдено`);
    return records[0];
  } catch (error) {
    console.error('[user] ❌ Помилка getUserByTgId:', error);
    throw error;
  }
};

/**
 * Створити нового користувача
 */
export const createUser = async (tgId, userName) => {
  try {
    console.log(`[user] 📝 Створення користувача ${tgId}`);

    const newUser = await base(tables.USERS).create([{
      fields: {
        TG_id: String(tgId),
        'User Name': userName || `User_${tgId}`,
        Status: USER_STATUS.NEW,
        Answer_Step: ANSWER_STEPS.OB_PITCH,
        Created_At: new Date().toISOString()
      }
    }], { typecast: true });

    console.log(`[user] ✅ Користувача створено: ${newUser[0].id}`);
    return newUser[0];
  } catch (error) {
    console.error('[user] ❌ Помилка createUser:', error);
    throw error;
  }
};

/**
 * Оновити поля користувача
 */
export const updateUserFields = async (tgId, fields) => {
  try {
    console.log(`[user] 🔄 Оновлення полів для ${tgId}:`, Object.keys(fields));

    // Знаходимо користувача
    const user = await getUserByTgId(tgId);
    
    if (!user) {
      console.error(`[user] ❌ Користувач ${tgId} не знайдений для оновлення`);
      throw new Error('User not found');
    }

    // Оновлюємо
    await updateRows(tables.USERS, [{
      id: user.id,
      fields: fields
    }]);

    console.log(`[user] ✅ Поля оновлено для ${tgId}`);
    
    // Повертаємо оновленого користувача
    return await getUserByTgId(tgId);
  } catch (error) {
    console.error('[user] ❌ Помилка updateUserFields:', error);
    throw error;
  }
};

/**
 * Оновити Answer_Step
 */
export const updateUserStep = async (tgId, step) => {
  console.log(`[user] 📍 Оновлення Answer_Step для ${tgId}: ${step}`);
  return updateUserFields(tgId, { Answer_Step: step });
};

/**
 * Оновити Last_Activity
 */
export const updateUserActivity = async (tgId) => {
  const now = new Date();
  now.setSeconds(0, 0); // Без секунд
  
  return updateUserFields(tgId, { 
    Last_Activity: now.toISOString(),
    Last_Answer_Date: new Date().toISOString().split('T')[0]
  });
};

/**
 * Фіналізувати реєстрацію
 */
export const finalizeRegistration = async (tgId, data) => {
  console.log(`[user] 🎉 Фіналізація реєстрації для ${tgId}`);

  const now = new Date();
  now.setSeconds(0, 0);
  
  return updateUserFields(tgId, {
    'User Name': data.name,
    Email: data.email || null,
    Phone: data.phone || null,
    'Time Zone': data.timezone || CONFIG.DEFAULT_TIMEZONE,
    UserRegistered: true,
    Status: USER_STATUS.REGISTERED,
    Answer_Step: ANSWER_STEPS.COMPLETED,
    Last_Activity: now.toISOString(),
    Last_Answer_Date: new Date().toISOString().split('T')[0]
  });
};

/**
 * Активувати trial підписку
 */
export const activateTrial = async (tgId, days = 7) => {
  const start = new Date();
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  
  console.log(`[user] 🧪 Активація trial для ${tgId} на ${days} днів`);
  
  return updateUserFields(tgId, {
    'Active Subscription Plan': '🧪 Пробний період — 0€',
    'Subscription_Status': 'Active',
    Start_Date: start.toISOString().split('T')[0],
    End_Date: end.toISOString().split('T')[0]
  });
};

/**
 * Перевірити чи має активний доступ
 */
export const hasActiveAccess = (user) => {
  if (!user || !user.fields) return false;
  
  const fields = user.fields;
  const subStatus = (fields['Subscription_Status'] || '').trim().toLowerCase();
  const plan = fields['Active Subscription Plan'] || '';

  // Перевірка статусу
  if (subStatus === 'active' || plan.includes('Пробний')) {
    return true;
  }

  // Перевірка дат
  const endDate = fields.End_Date;
  if (!endDate) return false;

  const end = new Date(endDate + 'T23:59:59');
  const now = new Date();
  
  return now <= end;
};

/**
 * Отримати всіх активних користувачів
 */
export const getActiveUsers = async () => {
  try {
    const formula = `{Status} = "Active User"`;
    
    const records = await base(tables.USERS)
      .select({
        filterByFormula: formula,
        fields: ['TG_id', 'User Name', 'Subscription_Status', 'End_Date']
      })
      .all();

    console.log(`[user] 📊 Знайдено ${records.length} активних користувачів`);
    return records;
  } catch (error) {
    console.error('[user] ❌ Помилка getActiveUsers:', error);
    return [];
  }
};

export default {
  getUserByTgId,
  createUser,
  updateUserFields,
  updateUserStep,
  updateUserActivity,
  finalizeRegistration,
  activateTrial,
  hasActiveAccess,
  getActiveUsers
};

console.log('✅ [services/user] User сервіс завантажено');