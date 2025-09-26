// src/auth/services/userService.js - ПОКРАЩЕНО З ШВИДКОЮ ПЕРЕВІРКОЮ

import { getBase, tables, selectFromTable, createRows, updateRows, quickUserCheck } from '../../config/database.js';
import { ANSWER_STEPS } from '../../config/constants.js';

const DB_TIMEOUT_MS = 3000; // Зменшено до 3 секунд
const userCache = new Map();
const cacheTimeout = 3 * 60 * 1000; // 3 хв кеш

// ===== УТИЛІТИ =====
const escapeFormula = (value = '') => String(value).replace(/'/g, "\\'");

const cacheGet = (key) => {
  const hit = userCache.get(key);
  if (hit && (Date.now() - hit.timestamp < cacheTimeout)) return hit.user;
  if (hit) userCache.delete(key);
  return null;
};

const cacheSet = (key, user) => {
  userCache.set(key, { user, timestamp: Date.now() });
};

// Нормалізація даних користувача
const normalizeUserData = (record) => {
  if (!record || !record.fields) return null;
  const f = record.fields;
  return {
    id: record.id,
    'TG_id': String(f['TG_id'] || ''),
    'User Name': f['User Name'] || '',
    'Email': f['Email'] || '',
    'Phone': f['Phone'] || '',
    'Time Zone': f['Time Zone'] || 'Europe/Kyiv',
    'UserRegistered': Boolean(f['UserRegistered']),
    'Registration Date': f['Registration Date'] || f['Created_At'],
    'Status': f['Status'] || 'New User',
    'Subscription Status': f['Subscription Status'] || 'New',
    'Active Subscription Plan': f['Active Subscription Plan'] || '',
    'Active_Subscription_Status': f['Active_Subscription_Status'] || '❌ Неактивна',
    'Start_Date': f['Start_Date'],
    'End_Date': f['End_Date'],
    'Answer_Step': f['Answer_Step'] || ANSWER_STEPS.COMPLETED,
    'Last_Activity': f['Last_Activity'],
    'Created_At': f['Created_At'],
    daily_main_goal: f['daily_main_goal'],
    daily_state: f['daily_state'],
    AT_id: record.id,
  };
};

// ===== ОСНОВНІ ОПЕРАЦІЇ =====
const getUserByTelegramId = async (tgId) => {
  const stringId = String(tgId);

  // 1. Перевіряємо кеш
  const cached = cacheGet(stringId);
  if (cached) {
    console.log(`[USER SERVICE] 🎯 Користувач ${stringId} з кешу`);
    return cached;
  }

  console.log(`[USER SERVICE] 🔍 Пошук користувача ${stringId}`);

  // 2. СПОЧАТКУ ШВИДКА ПЕРЕВІРКА (3 сек)
  try {
    const quickResult = await quickUserCheck(stringId);
    if (quickResult) {
      const user = normalizeUserData({ id: quickResult.AT_id, fields: quickResult });
      cacheSet(stringId, user);
      
      console.log(`[USER SERVICE] ⚡ Користувач ${stringId} знайдений швидко:`, {
        name: user['User Name'],
        registered: user.UserRegistered,
        subscription: (user['Active_Subscription_Status'] || '').slice(0, 30),
      });
      return user;
    }
  } catch (quickError) {
    console.warn(`[USER SERVICE] ⚠️ Швидка перевірка не вдалася: ${quickError.message}`);
  }

  // 3. ЯКЩО ШВИДКА ПЕРЕВІРКА НЕ ВДАЛАСЯ - СТАНДАРТНИЙ ПОШУК
  const filterByFormula = `{TG_id} = '${escapeFormula(stringId)}'`;

  try {
    console.log(`[USER SERVICE] 🔄 Використовую стандартний пошук для ${stringId}`);
    
    const raw = await selectFromTable('USERS', { 
      filterByFormula, 
      maxRecords: 1,
      fields: ['TG_id', 'User Name', 'UserRegistered', 'Email', 'Phone', 'Status', 'Active_Subscription_Status', 'End_Date', 'Answer_Step']
    });
    
    const records = Array.isArray(raw) ? raw : await raw.firstPage();

    if (!records || records.length === 0) {
      console.log(`[USER SERVICE] ❌ Користувач ${stringId} не знайдений`);
      return null;
    }

    const user = normalizeUserData(records[0]);
    cacheSet(stringId, user);

    console.log(`[USER SERVICE] ✅ Користувач ${stringId} знайдений стандартно:`, {
      name: user['User Name'],
      registered: user.UserRegistered,
      subscription: (user['Active_Subscription_Status'] || '').slice(0, 30),
    });
    return user;

  } catch (standardError) {
    console.error(`[USER SERVICE] ❌ Стандартний пошук теж збійнув: ${standardError.message}`);
    
    // 4. RAW FALLBACK (останній шанс)
    try {
      console.log(`[USER SERVICE] 🚨 RAW fallback для ${stringId}`);
      const base = getBase();
      const query = base(tables.USERS).select({ filterByFormula, maxRecords: 1 });
      const page = await Promise.race([
        query.firstPage(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('RAW_TIMEOUT:2000ms')), 2000)
        )
      ]);
      
      if (!page || page.length === 0) {
        console.log(`[USER SERVICE] ❌ (raw) Користувач ${stringId} не знайдений`);
        return null;
      }
      
      const user = normalizeUserData(page[0]);
      cacheSet(stringId, user);
      console.log(`[USER SERVICE] ✅ (raw) Користувач ${stringId} знайдений`);
      return user;
      
    } catch (rawError) {
      console.error(`[USER SERVICE] ❌ RAW fallback теж впав: ${rawError.message}`);
      return null; // Повертаємо null замість зависання
    }
  }
};

const createUser = async ({ tgId, name, email, phone, timezone, registrationStatus = 'New' }) => {
  const stringId = String(tgId);
  try {
    console.log(`[USER SERVICE] 🆕 Створення користувача ${stringId}`);

    const existing = await getUserByTelegramId(stringId);
    if (existing) {
      console.log(`[USER SERVICE] ⚠️ Користувач ${stringId} вже існує`);
      return existing;
    }

    const nowISO = new Date().toISOString();
    const userData = {
      fields: {
        'TG_id': stringId,
        'User Name': name || 'Користувач',
        'Email': email || `user${stringId}@temp.com`,
        'Phone': phone || '+380000000000',
        'Time Zone': timezone || 'Europe/Kyiv',
        'UserRegistered': true,
        'Registration Date': nowISO,
        'Status': 'Registered User',
        'Subscription Status': registrationStatus,
        'Answer_Step': ANSWER_STEPS.COMPLETED,
        'Last_Activity': nowISO,
        'Created_At': nowISO,
      },
    };

    const created = await createRows('USERS', [userData]);
    const records = Array.isArray(created) ? created : [created];
    if (!records || records.length === 0) throw new Error('Не вдалося створити користувача');

    const createdUser = normalizeUserData(records[0]);
    cacheSet(stringId, createdUser);

    console.log(`[USER SERVICE] ✅ Користувача ${stringId} створено`);
    return createdUser;
    
  } catch (error) {
    console.error(`[USER SERVICE] ❌ Помилка створення користувача ${stringId}:`, error);
    throw error;
  }
};

const updateUser = async (tgId, fields) => {
  const stringId = String(tgId);
  if (!fields || typeof fields !== 'object' || Object.keys(fields).length === 0) {
    console.warn(`[USER SERVICE] ⚠️ Порожні поля для оновлення ${stringId}`);
    return null;
  }

  try {
    console.log(`[USER SERVICE] 🔄 Оновлення користувача ${stringId}`, Object.keys(fields));

    const filterByFormula = `{TG_id} = '${escapeFormula(stringId)}'`;
    const rawSel = await selectFromTable('USERS', { filterByFormula, maxRecords: 1 });
    const sel = Array.isArray(rawSel) ? rawSel : await rawSel.firstPage();

    if (!sel || sel.length === 0) {
      console.warn(`[USER SERVICE] ⚠️ Користувача ${stringId} не знайдено для оновлення`);
      return null;
    }

    const updateData = {
      id: sel[0].id,
      fields: { ...fields, 'Last_Activity': new Date().toISOString() },
    };

    const rawUpd = await updateRows('USERS', [updateData]);
    const upd = Array.isArray(rawUpd) ? rawUpd : [rawUpd];
    if (!upd || upd.length === 0) throw new Error('Не вдалося оновити користувача');

    const updatedUser = normalizeUserData(upd[0]);
    cacheSet(stringId, updatedUser);

    console.log(`[USER SERVICE] ✅ Користувача ${stringId} оновлено`);
    return updatedUser;
    
  } catch (error) {
    console.error(`[USER SERVICE] ❌ Помилка оновлення користувача ${stringId}:`, error);
    return null;
  }
};

// ===== СКОРОЧЕНІ ХЕЛПЕРИ =====
const updateUserStep = async (tgId, step) => updateUser(tgId, { Answer_Step: step });
const updateUserActivity = async (tgId) => updateUser(tgId, { Answer_Step: ANSWER_STEPS.COMPLETED });

// ===== ВИБІРКИ =====
const getActiveUsers = async () => {
  try {
    console.log('[USER SERVICE] 🔍 Пошук активних користувачів');
    const raw = await selectFromTable('USERS', {
      filterByFormula: `FIND('✅ Активна', {Active_Subscription_Status}) > 0`,
    });
    const records = Array.isArray(raw) ? raw : await raw.all();
    const users = (records || []).map(r => normalizeUserData(r));
    console.log(`[USER SERVICE] ✅ Знайдено ${users.length} активних користувачів`);
    return users;
  } catch (error) {
    console.error('[USER SERVICE] ❌ Помилка отримання активних користувачів:', error);
    return [];
  }
};

const getUsersWithExpiringSubscriptions = async (daysOffset = 1) => {
  try {
    const target = new Date();
    target.setDate(target.getDate() + daysOffset);
    const targetStr = target.toISOString().split('T')[0];

    console.log(`[USER SERVICE] 📅 Пошук підписок що закінчуються ${targetStr}`);

    const raw = await selectFromTable('USERS', {
      filterByFormula: `AND(
        FIND('✅ Активна', {Active_Subscription_Status}) > 0,
        DATESTR({End_Date}) = '${targetStr}'
      )`,
      fields: ['TG_id', 'User Name', 'Active Subscription Plan', 'End_Date'],
    });
    const records = Array.isArray(raw) ? raw : await raw.all();
    const users = (records || []).map(r => r.fields);
    console.log(`[USER SERVICE] 📊 Знайдено ${users.length} підписок що закінчуються`);
    return users;
  } catch (error) {
    console.error('[USER SERVICE] ❌ Помилка пошуку підписок що закінчуються:', error);
    return [];
  }
};

// ===== ПЕРЕВІРКА ДОСТУПУ =====
const hasActiveAccess = (user) => {
  if (!user) {
    console.log('[hasActiveAccess] Користувач відсутній');
    return false;
  }

  console.log('[hasActiveAccess] Перевірка доступу:', {
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

// ===== КЕРУВАННЯ КЕШЕМ =====
const clearCache = (tgId = null) => {
  if (tgId) {
    userCache.delete(String(tgId));
    console.log(`[USER SERVICE] 🧹 Кеш користувача ${tgId} очищено`);
  } else {
    userCache.clear();
    console.log('[USER SERVICE] 🧹 Весь кеш користувачів очищено');
  }
};

const getCacheStats = () => ({ size: userCache.size, timeout: cacheTimeout });

// ===== ЕКСПОРТ =====
const userService = {
  // основні
  getUserByTelegramId,
  createUser,
  updateUser,
  updateUserStep,
  updateUserActivity,
  // вибірки
  getActiveUsers,
  getUsersWithExpiringSubscriptions,
  // правила доступу
  hasActiveAccess,
  // утиліти
  clearCache,
  getCacheStats,
};

export default userService;