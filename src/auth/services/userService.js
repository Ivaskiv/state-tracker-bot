// src/auth/services/userService.js
// ОПТИМІЗОВАНИЙ СЕРВІС КОРИСТУВАЧІВ (без класів/this) + анти-зависання БД (таймаут 4с + raw fallback)

import { getBase, tables, selectFromTable, createRows, updateRows } from '../../config/database.js';
import { ANSWER_STEPS } from '../../config/constants.js';

const DB_TIMEOUT_MS = 4000;
const userCache = new Map();
const cacheTimeout = 5 * 60 * 1000; // 5 хв

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

const withTimeout = async (promise, ms = DB_TIMEOUT_MS, label = 'db') =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`TIMEOUT:${label}:${ms}ms`)), ms)
    ),
  ]);

// Приводимо будь-що до масиву записів Airtable
const ensureRecordsArray = async (maybe, label = 'select') => {
  if (Array.isArray(maybe)) return maybe;

  if (maybe && typeof maybe.firstPage === 'function') {
    return await withTimeout(maybe.firstPage(), DB_TIMEOUT_MS, `${label}.firstPage`);
  }
  if (maybe && typeof maybe.all === 'function') {
    return await withTimeout(maybe.all(), DB_TIMEOUT_MS, `${label}.all`);
  }
  if (maybe && typeof maybe.then === 'function') {
    return await withTimeout(maybe, DB_TIMEOUT_MS, `${label}.promise`);
  }
  return [];
};

// ===== НОРМАЛІЗАЦІЯ =====
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
    // сумісність
    daily_main_goal: f['daily_main_goal'],
    daily_state: f['daily_state'],
    AT_id: record.id,
  };
};

// ===== ОСНОВНІ ОПЕРАЦІЇ =====
const getUserByTelegramId = async (tgId) => {
  const stringId = String(tgId);

  // кеш
  const cached = cacheGet(stringId);
  if (cached) return cached;

  console.log(`[USER SERVICE] 🔍 Пошук користувача ${stringId}`);
  const filterByFormula = `{TG_id} = '${escapeFormula(stringId)}'`;

  // 1) основна спроба через обгортку selectFromTable
  try {
    const raw = await withTimeout(
      Promise.resolve(selectFromTable('USERS', { filterByFormula, maxRecords: 1 })),
      DB_TIMEOUT_MS,
      'selectFromTable.call'
    );
    const records = await ensureRecordsArray(raw, 'selectFromTable');

    if (!records || records.length === 0) {
      console.log(`[USER SERVICE] ❌ Користувач ${stringId} не знайдений`);
      userCache.delete(stringId);
      return null;
    }

    const user = normalizeUserData(records[0]);
    cacheSet(stringId, user);

    console.log(`[USER SERVICE] ✅ Користувач ${stringId} знайдений:`, {
      name: user['User Name'],
      registered: user.UserRegistered,
      subscription: (user['Active_Subscription_Status'] || '').slice(0, 30),
    });
    return user;
  } catch (err) {
    console.warn(`[USER SERVICE] ⚠️ selectFromTable збій: ${err?.message || err}. Пробую raw-fallback`);
  }

  // 2) RAW fallback напряму через Airtable SDK
  try {
    const base = getBase();
    const query = base(tables.USERS).select({ filterByFormula, maxRecords: 1 });
    const page = await withTimeout(query.firstPage(), DB_TIMEOUT_MS, 'raw.firstPage');
    if (!page || page.length === 0) {
      console.log(`[USER SERVICE] ❌ (raw) Користувач ${stringId} не знайдений`);
      return null;
    }
    const user = normalizeUserData(page[0]);
    cacheSet(stringId, user);
    console.log(`[USER SERVICE] ✅ (raw) Користувач ${stringId} знайдений`);
    return user;
  } catch (rawErr) {
    console.error(`[USER SERVICE] ❌ RAW fallback теж впав: ${rawErr?.message || rawErr}`);
    return null; // важливо: не зависати
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

    const created = await withTimeout(
      Promise.resolve(createRows('USERS', [userData])),
      DB_TIMEOUT_MS,
      'createRows'
    );
    const records = await ensureRecordsArray(created, 'createRows.result');
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
    const rawSel = await withTimeout(
      Promise.resolve(selectFromTable('USERS', { filterByFormula, maxRecords: 1 })),
      DB_TIMEOUT_MS,
      'selectForUpdate.call'
    );
    const sel = await ensureRecordsArray(rawSel, 'selectForUpdate');

    if (!sel || sel.length === 0) {
      console.warn(`[USER SERVICE] ⚠️ Користувача ${stringId} не знайдено для оновлення`);
      return null;
    }

    const updateData = {
      id: sel[0].id,
      fields: { ...fields, 'Last_Activity': new Date().toISOString() },
    };

    const rawUpd = await withTimeout(
      Promise.resolve(updateRows('USERS', [updateData])),
      DB_TIMEOUT_MS,
      'updateRows'
    );
    const upd = await ensureRecordsArray(rawUpd, 'updateRows.result');
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
    const raw = await withTimeout(
      Promise.resolve(selectFromTable('USERS', {
        filterByFormula: `FIND('✅ Активна', {Active_Subscription_Status}) > 0`,
      })),
      DB_TIMEOUT_MS,
      'selectActive'
    );
    const records = await ensureRecordsArray(raw, 'selectActive.result');
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

    const raw = await withTimeout(
      Promise.resolve(selectFromTable('USERS', {
        filterByFormula: `AND(
          FIND('✅ Активна', {Active_Subscription_Status}) > 0,
          DATESTR({End_Date}) = '${targetStr}'
        )`,
        fields: ['TG_id', 'User Name', 'Active Subscription Plan', 'End_Date'],
      })),
      DB_TIMEOUT_MS,
      'selectExpiring'
    );
    const records = await ensureRecordsArray(raw, 'selectExpiring.result');
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
  if (!user) return false;

  const subscriptionStatus = String(user['Active_Subscription_Status'] || '');
  const generalStatus = String(user['Subscription Status'] || '');
  const planName = String(user['Active Subscription Plan'] || '');
  const endDate = user['End_Date'];

  if (subscriptionStatus.includes('✅ Активна')) return true;
  if (generalStatus === 'Active') return true;

  if (planName.toLowerCase().includes('пробн') || planName.toLowerCase().includes('trial')) {
    if (endDate) {
      try { return new Date() < new Date(endDate); } catch {}
    }
  }
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
