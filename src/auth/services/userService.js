// src/auth/services/userService.js - Сервіс роботи з користувачами

import { getBase, tables } from '../../config/database.js';
import { ANSWER_STEPS } from '../../config/constants.js';

const base = getBase();

// Кеш користувачів для швидкого доступу
const userCache = new Map();
const CACHE_TIMEOUT = 3 * 60 * 1000; // 3 хвилини

// ===== УТИЛІТАРНІ ФУНКЦІЇ =====

/**
 * Безпечне екранування для Airtable формул
 */
const escapeFormula = (value) => {
  return String(value || '').replace(/'/g, "\\'");
};

/**
 * Нормалізація даних користувача
 */
const normalizeUserData = (record) => {
  if (!record || !record.fields) return null;
  
  const fields = record.fields;
  return {
    id: record.id,
    'TG_id': String(fields['TG_id'] || ''),
    'User Name': fields['User Name'] || '',
    'Email': fields['Email'] || '',
    'Phone': fields['Phone'] || '',
    'Time Zone': fields['Time Zone'] || 'Europe/Kyiv',
    'UserRegistered': Boolean(fields['UserRegistered']),
    'Registration Date': fields['Registration Date'] || fields['Created_At'],
    'Status': fields['Status'] || 'New User',
    'Subscription Status': fields['Subscription Status'] || 'New',
    'Active Subscription Plan': fields['Active Subscription Plan'] || '',
    'Active_Subscription_Status': fields['Active_Subscription_Status'] || '❌ Неактивна',
    'Start_Date': fields['Start_Date'],
    'End_Date': fields['End_Date'],
    'Answer_Step': fields['Answer_Step'] || ANSWER_STEPS.COMPLETED,
    'Last_Activity': fields['Last_Activity'],
    'Created_At': fields['Created_At'] || new Date().toISOString(),
    // Додаткові поля
    daily_main_goal: fields['daily_main_goal'],
    daily_state: fields['daily_state'],
    AT_id: record.id,
  };
};

/**
 * Робота з кешем
 */
const getCacheKey = (tgId) => String(tgId);

const getFromCache = (tgId) => {
  const key = getCacheKey(tgId);
  const cached = userCache.get(key);
  
  if (cached && (Date.now() - cached.timestamp < CACHE_TIMEOUT)) {
    console.log(`[userService] 🎯 Користувач ${tgId} з кешу`);
    return cached.user;
  }
  
  if (cached) userCache.delete(key);
  return null;
};

const setToCache = (tgId, user) => {
  const key = getCacheKey(tgId);
  userCache.set(key, {
    user,
    timestamp: Date.now()
  });
};

const clearFromCache = (tgId) => {
  const key = getCacheKey(tgId);
  userCache.delete(key);
};

// ===== ОСНОВНІ ФУНКЦІЇ =====

/**
 * Отримання користувача по Telegram ID
 */
const getUserByTelegramId = async (tgId) => {
  const stringId = String(tgId);
  
  console.log(`[userService] 🔍 getUserByTelegramId ПОЧАТОК для ${stringId}`);
  
  try {
    // 1. Перевіряємо кеш
    const cached = getFromCache(stringId);
    if (cached) {
      console.log(`[userService] 🎯 Користувач ${stringId} ЗНАЙДЕНИЙ В КЕШІ`);
      return cached;
    }
    
    console.log(`[userService] 📂 Кеш пустий, шукаємо в БД для ${stringId}`);
    
    // 2. Запит до бази даних
    const filterByFormula = `{TG_id} = '${escapeFormula(stringId)}'`;
    console.log(`[userService] 🔍 Формула пошуку: ${filterByFormula}`);
    
    console.log(`[userService] 📞 Викликаємо base(${tables.USERS}).select()...`);
    const startTime = Date.now();
    
    const records = await base(tables.USERS)
      .select({
        filterByFormula,
        maxRecords: 1,
        fields: [
          'TG_id', 'User Name', 'Email', 'Phone', 'Time Zone',
          'UserRegistered', 'Registration Date', 'Status', 
          'Subscription Status', 'Active Subscription Plan',
          'Active_Subscription_Status', 'Start_Date', 'End_Date',
          'Answer_Step', 'Last_Activity', 'Created_At'
        ]
      })
      .firstPage();
    
    const duration = Date.now() - startTime;
    console.log(`[userService] ⏱️ Запит до БД завершено за ${duration}ms`);
    console.log(`[userService] 📊 Отримано записів: ${records?.length || 0}`);
    
    if (!records || records.length === 0) {
      console.log(`[userService] ❌ Користувач ${stringId} НЕ ЗНАЙДЕНИЙ в БД`);
      return null;
    }
    
    console.log(`[userService] ✅ Знайдено запис в БД:`, {
      id: records[0].id,
      fields: Object.keys(records[0].fields || {}),
      tgId: records[0].fields?.TG_id,
      name: records[0].fields?.['User Name']
    });
    
    const user = normalizeUserData(records[0]);
    console.log(`[userService] 🔧 Після нормалізації:`, {
      tgId: user?.['TG_id'],
      name: user?.['User Name'],
      registered: user?.UserRegistered,
      status: user?.Status
    });
    
    setToCache(stringId, user);
    console.log(`[userService] 💾 Користувач збережений в кеш`);
    
    console.log(`[userService] ✅ getUserByTelegramId ЗАВЕРШЕНО УСПІШНО для ${stringId}`);
    return user;
    
  } catch (error) {
    console.error(`[userService] ❌ КРИТИЧНА ПОМИЛКА getUserByTelegramId для ${stringId}:`, {
      message: error.message,
      stack: error.stack?.substring(0, 500),
      name: error.name,
      cause: error.cause
    });
    
    console.log(`[userService] 🔄 Повертаємо null через помилку`);
    return null;
  }
};

/**
 * Створення нового користувача
 */
const createUser = async ({ tgId, name, email, phone, timezone, registrationStatus = 'New' }) => {
  const stringId = String(tgId);
  
  try {
    console.log(`[userService] 🆕 Створення користувача ${stringId}`);
    
    // Перевіряємо чи користувач вже існує
    const existing = await getUserByTelegramId(stringId);
    if (existing) {
      console.log(`[userService] ⚠️ Користувач ${stringId} вже існує`);
      return existing;
    }
    
    const nowISO = new Date().toISOString();
    
    const userData = {
      'TG_id': stringId,
      'User Name': name || 'Користувач',
      'Email': email || `user${stringId}@temp.com`,
      'Phone': phone || '+380000000000',
      'Time Zone': timezone || 'Europe/Kyiv',
      'UserRegistered': true,
      'Registration Date': nowISO,
      'Status': 'Registered User',
      'Subscription Status': registrationStatus,
      'Active_Subscription_Status': '❌ Неактивна',
      'Answer_Step': ANSWER_STEPS.COMPLETED,
      'Last_Activity': nowISO,
      'Created_At': nowISO,
    };
    
    const [createdRecord] = await base(tables.USERS).create([{ fields: userData }]);
    const createdUser = normalizeUserData(createdRecord);
    
    setToCache(stringId, createdUser);
    
    console.log(`[userService] ✅ Користувача ${stringId} створено`);
    return createdUser;
    
  } catch (error) {
    console.error(`[userService] ❌ Помилка створення користувача ${stringId}:`, error);
    throw error;
  }
};

/**
 * Оновлення користувача
 */
const updateUser = async (tgId, fields) => {
  const stringId = String(tgId);
  
  if (!fields || typeof fields !== 'object' || Object.keys(fields).length === 0) {
    console.warn(`[userService] ⚠️ Порожні поля для оновлення ${stringId}`);
    return null;
  }
  
  try {
    console.log(`[userService] 🔄 Оновлення користувача ${stringId}`, Object.keys(fields));
    
    // Знаходимо користувача
    const filterByFormula = `{TG_id} = '${escapeFormula(stringId)}'`;
    const records = await base(tables.USERS)
      .select({ filterByFormula, maxRecords: 1 })
      .firstPage();
    
    if (!records || records.length === 0) {
      console.warn(`[userService] ⚠️ Користувача ${stringId} не знайдено для оновлення`);
      return null;
    }
    
    // Оновлюємо
    const updateData = {
      id: records[0].id,
      fields: {
        ...fields,
        'Last_Activity': new Date().toISOString()
      }
    };
    
    const [updatedRecord] = await base(tables.USERS).update([updateData]);
    const updatedUser = normalizeUserData(updatedRecord);
    
    setToCache(stringId, updatedUser);
    
    console.log(`[userService] ✅ Користувача ${stringId} оновлено`);
    return updatedUser;
    
  } catch (error) {
    console.error(`[userService] ❌ Помилка оновлення користувача ${stringId}:`, error);
    return null;
  }
};

/**
 * Оновлення кроку користувача
 */
const updateUserStep = async (tgId, step) => {
  return updateUser(tgId, { Answer_Step: step });
};

/**
 * Позначення активності користувача
 */
const updateUserActivity = async (tgId) => {
  return updateUser(tgId, { Answer_Step: ANSWER_STEPS.COMPLETED });
};

/**
 * Перевірка чи має користувач активний доступ
 */
const hasActiveAccess = (user) => {
  if (!user) {
    console.log('[hasActiveAccess] Користувач відсутній');
    return false;
  }
  
  console.log('[hasActiveAccess] Перевірка доступу для:', {
    subscriptionStatus: user['Active_Subscription_Status'],
    generalStatus: user['Subscription Status'],
    planName: user['Active Subscription Plan'],
    endDate: user['End_Date']
  });
  
  // 1. Перевіряємо статус підписки
  const subscriptionStatus = String(user['Active_Subscription_Status'] || '');
  if (subscriptionStatus.includes('✅ Активна')) {
    console.log('[hasActiveAccess] ✅ Активна підписка за статусом');
    return true;
  }
  
  // 2. Перевіряємо загальний статус
  const generalStatus = String(user['Subscription Status'] || '');
  if (generalStatus === 'Active') {
    console.log('[hasActiveAccess] ✅ Активна підписка за загальним статусом');
    return true;
  }
  
  // 3. Перевіряємо пробний період
  const planName = String(user['Active Subscription Plan'] || '').toLowerCase();
  if (planName.includes('пробн') || planName.includes('trial')) {
    const endDate = user['End_Date'];
    if (endDate) {
      try {
        const isValid = new Date() < new Date(endDate);
        console.log(`[hasActiveAccess] ${isValid ? '✅' : '❌'} Пробний період, дійсний до: ${endDate}`);
        return isValid;
      } catch (error) {
        console.error('[hasActiveAccess] Помилка парсингу дати:', error);
      }
    }
  }
  
  // 4. Перевіряємо дату закінчення для будь-якої підписки
  const endDate = user['End_Date'];
  if (endDate) {
    try {
      const isValid = new Date() < new Date(endDate);
      console.log(`[hasActiveAccess] ${isValid ? '✅' : '❌'} Підписка за датою, дійсна до: ${endDate}`);
      return isValid;
    } catch (error) {
      console.error('[hasActiveAccess] Помилка парсингу дати закінчення:', error);
    }
  }
  
  console.log('[hasActiveAccess] ❌ Немає активної підписки');
  return false;
};

/**
 * Отримання активних користувачів
 */
const getActiveUsers = async () => {
  try {
    console.log('[userService] 🔍 Пошук активних користувачів');
    
    const records = await base(tables.USERS)
      .select({
        filterByFormula: `FIND('✅ Активна', {Active_Subscription_Status}) > 0`,
      })
      .all();
    
    const users = records.map(record => normalizeUserData(record));
    console.log(`[userService] ✅ Знайдено ${users.length} активних користувачів`);
    
    return users;
  } catch (error) {
    console.error('[userService] ❌ Помилка отримання активних користувачів:', error);
    return [];
  }
};

/**
 * Отримання користувачів з підписками що закінчуються
 */
const getUsersWithExpiringSubscriptions = async (daysOffset = 1) => {
  try {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysOffset);
    const targetDateStr = targetDate.toISOString().split('T')[0];
    
    console.log(`[userService] 📅 Пошук підписок що закінчуються ${targetDateStr}`);
    
    const records = await base(tables.USERS)
      .select({
        filterByFormula: `AND(
          FIND('✅ Активна', {Active_Subscription_Status}) > 0,
          DATESTR({End_Date}) = '${targetDateStr}'
        )`,
        fields: ['TG_id', 'User Name', 'Active Subscription Plan', 'End_Date']
      })
      .all();
    
    const users = records.map(record => record.fields);
    console.log(`[userService] 📊 Знайдено ${users.length} підписок що закінчуються`);
    
    return users;
  } catch (error) {
    console.error('[userService] ❌ Помилка пошуку підписок що закінчуються:', error);
    return [];
  }
};

/**
 * Отримання всіх користувачів з пагінацією
 */
const getAllUsers = async (offset = null, limit = 100) => {
  try {
    console.log(`[userService] 📋 Отримання всіх користувачів (offset: ${offset}, limit: ${limit})`);
    
    const selectConfig = {
      maxRecords: limit,
      pageSize: limit,
      fields: [
        'TG_id', 'User Name', 'Email', 'Phone', 'Time Zone',
        'UserRegistered', 'Registration Date', 'Status', 
        'Subscription Status', 'Active Subscription Plan',
        'Active_Subscription_Status', 'Start_Date', 'End_Date',
        'Answer_Step', 'Last_Activity', 'Created_At'
      ]
    };
    
    if (offset) {
      selectConfig.offset = offset;
    }
    
    const records = await base(tables.USERS)
      .select(selectConfig)
      .firstPage();
    
    const users = records.map(record => normalizeUserData(record));
    console.log(`[userService] ✅ Отримано ${users.length} користувачів`);
    
    return {
      users,
      hasMore: records.length === limit,
      nextOffset: records.length === limit ? records[records.length - 1].id : null
    };
  } catch (error) {
    console.error('[userService] ❌ Помилка отримання всіх користувачів:', error);
    return { users: [], hasMore: false, nextOffset: null };
  }
};

/**
 * Пошук користувачів за критеріями
 */
const searchUsers = async (criteria) => {
  try {
    const { name, email, status, subscriptionStatus, tgId } = criteria;
    console.log(`[userService] 🔍 Пошук користувачів за критеріями:`, criteria);
    
    let filters = [];
    
    if (tgId) {
      filters.push(`{TG_id} = '${escapeFormula(String(tgId))}'`);
    }
    
    if (name) {
      filters.push(`FIND('${escapeFormula(name)}', LOWER({User Name})) > 0`);
    }
    
    if (email) {
      filters.push(`FIND('${escapeFormula(email)}', LOWER({Email})) > 0`);
    }
    
    if (status) {
      filters.push(`{Status} = '${escapeFormula(status)}'`);
    }
    
    if (subscriptionStatus) {
      filters.push(`{Subscription Status} = '${escapeFormula(subscriptionStatus)}'`);
    }
    
    if (filters.length === 0) {
      console.warn('[userService] ⚠️ Немає критеріїв для пошуку');
      return [];
    }
    
    const filterByFormula = filters.length > 1 
      ? `AND(${filters.join(', ')})` 
      : filters[0];
    
    console.log(`[userService] 🔍 Формула пошуку: ${filterByFormula}`);
    
    const records = await base(tables.USERS)
      .select({
        filterByFormula,
        maxRecords: 100,
        fields: [
          'TG_id', 'User Name', 'Email', 'Phone', 'Time Zone',
          'UserRegistered', 'Registration Date', 'Status', 
          'Subscription Status', 'Active Subscription Plan',
          'Active_Subscription_Status', 'Start_Date', 'End_Date',
          'Answer_Step', 'Last_Activity', 'Created_At'
        ]
      })
      .all();
    
    const users = records.map(record => normalizeUserData(record));
    console.log(`[userService] ✅ Знайдено ${users.length} користувачів`);
    
    return users;
  } catch (error) {
    console.error('[userService] ❌ Помилка пошуку користувачів:', error);
    return [];
  }
};

/**
 * Видалення користувача
 */
const deleteUser = async (tgId) => {
  const stringId = String(tgId);
  
  try {
    console.log(`[userService] 🗑️ Видалення користувача ${stringId}`);
    
    // Знаходимо користувача
    const filterByFormula = `{TG_id} = '${escapeFormula(stringId)}'`;
    const records = await base(tables.USERS)
      .select({ filterByFormula, maxRecords: 1 })
      .firstPage();
    
    if (!records || records.length === 0) {
      console.warn(`[userService] ⚠️ Користувача ${stringId} не знайдено для видалення`);
      return false;
    }
    
    // Видаляємо
    await base(tables.USERS).destroy([records[0].id]);
    
    // Очищуємо кеш
    clearFromCache(stringId);
    
    console.log(`[userService] ✅ Користувача ${stringId} видалено`);
    return true;
    
  } catch (error) {
    console.error(`[userService] ❌ Помилка видалення користувача ${stringId}:`, error);
    return false;
  }
};

/**
 * Очищення кешу
 */
const clearCache = (tgId = null) => {
  if (tgId) {
    clearFromCache(tgId);
    console.log(`[userService] 🧹 Кеш користувача ${tgId} очищено`);
  } else {
    userCache.clear();
    console.log('[userService] 🧹 Весь кеш користувачів очищено');
  }
};

/**
 * Статистика кешу
 */
const getCacheStats = () => ({
  size: userCache.size,
  timeout: CACHE_TIMEOUT,
  entries: Array.from(userCache.keys())
});

/**
 * Отримання статистики користувачів
 */
const getUserStats = async () => {
  try {
    console.log('[userService] 📊 Отримання статистики користувачів');
    
    const allRecords = await base(tables.USERS)
      .select({
        fields: ['Status', 'Subscription Status', 'Active_Subscription_Status']
      })
      .all();
    
    const stats = {
      total: allRecords.length,
      registered: 0,
      active: 0,
      inactive: 0,
      trial: 0,
      paid: 0
    };
    
    allRecords.forEach(record => {
      const fields = record.fields;
      
      if (fields['Status'] === 'Registered User') {
        stats.registered++;
      }
      
      const subscriptionStatus = String(fields['Active_Subscription_Status'] || '');
      if (subscriptionStatus.includes('✅ Активна')) {
        stats.active++;
      } else {
        stats.inactive++;
      }
      
      const planName = String(fields['Active Subscription Plan'] || '').toLowerCase();
      if (planName.includes('пробн') || planName.includes('trial')) {
        stats.trial++;
      } else if (subscriptionStatus.includes('✅ Активна')) {
        stats.paid++;
      }
    });
    
    console.log('[userService] ✅ Статистика отримана:', stats);
    return stats;
    
  } catch (error) {
    console.error('[userService] ❌ Помилка отримання статистики:', error);
    return {
      total: 0,
      registered: 0,
      active: 0,
      inactive: 0,
      trial: 0,
      paid: 0
    };
  }
};

// ===== ЕКСПОРТ =====
const userService = {
  // Основні операції
  getUserByTelegramId,
  createUser,
  updateUser,
  updateUserStep,
  updateUserActivity,
  deleteUser,
  
  // Вибірки та пошук
  getAllUsers,
  searchUsers,
  getActiveUsers,
  getUsersWithExpiringSubscriptions,
  
  // Правила доступу
  hasActiveAccess,
  
  // Статистика
  getUserStats,
  
  // Утиліти
  clearCache,
  getCacheStats,
};

export default userService;

console.log('✅ [userService] Сервіс користувачів повністю ініціалізовано');