// src/auth/services/userService.js
import { getBase, tables } from '../../config/database.js';

const base = getBase();
console.log('✅ [userService] ініціалізовано');

const userCache = new Map();
const CACHE_TTL = 3 * 60 * 1000;

const cacheGet = (id) => {
  const k = String(id);
  const v = userCache.get(k);
  if (v && Date.now() - v.ts < CACHE_TTL) return v.user;
  if (v) userCache.delete(k);
  return null;
};
const cacheSet = (id, user) => userCache.set(String(id), { user, ts: Date.now() });

const normalize = (record) => {
  const f = record?.fields || {};
  return {
    id: record.id,
    'TG_id': String(f['TG_id'] || ''),
    'User Name': f['User Name'] || '',
    Email: f['Email'] || '',
    Phone: f['Phone'] || '',
    'Time Zone': f['Time Zone'] || '',
    UserRegistered: Boolean(f['UserRegistered']),
    'Registration Date': f['Registration Date'] || f['Created_At'],
    Status: f['Status'] || 'New User',
    'Subscription Status': f['Subscription Status'] || 'New',
    'Active Subscription Plan': f['Active Subscription Plan'] || '',
    'Active_Subscription_Status': f['Active_Subscription_Status'] || '❌ Неактивна',
    Start_Date: f['Start_Date'],
    End_Date: f['End_Date'],
    Answer_Step: f['Answer_Step'] || 'completed',
    Last_Activity: f['Last_Activity'],
    Created_At: f['Created_At'],
  };
};

const escapeFormula = (v) => String(v ?? '').replace(/'/g, "\\'");

// ------ SAFE SELECT (повертає null при проблемах) ------
const getUserByTelegramId = async (tgId) => {
  const id = String(tgId);

  const cached = cacheGet(id);
  if (cached) return cached;

  try {
    const filterByFormula = `{TG_id} = '${escapeFormula(id)}'`;

    const select = base(tables.USERS)
      .select({ filterByFormula, maxRecords: 1 })
      .firstPage();

    const timeout = new Promise((_, rej) =>
      setTimeout(() => rej(new Error('getUserByTelegramId/select timeout after 12000ms')), 12000)
    );

    const records = await Promise.race([select, timeout]);
    if (!records?.length) return null;

    const user = normalize(records[0]);
    cacheSet(id, user);
    return user;
  } catch {
    // ВАЖЛИВО: не кидаємо, щоб не ламати /start
    return null;
  }
};

// ------ Гарантуємо наявність рядка ------
const ensureUserRow = async (tgId, { name } = {}) => {
  const id = String(tgId);
  console.log(`[userService] 🧾 ensureUserRow(${id})`);

  // Якщо вже є — ок
  const existing = await getUserByTelegramId(id);
  if (existing) return { ok: true, created: false, user: existing, id: existing.id };

  // Створюємо мінімальний
  try {
    const now = new Date().toISOString();
    const fields = {
      'TG_id': id,
      'User Name': name || '',
      'Status': 'New User',
      'UserRegistered': false,
      'Subscription Status': 'New',
      'Active_Subscription_Status': '❌ Неактивна',
      'Created_At': now,
      'Last_Activity': now
    };

    const create = base(tables.USERS).create([{ fields }], { typecast: true });
    const timeout = new Promise((_, rej) =>
      setTimeout(() => rej(new Error('ensureUserRow/create timeout after 8000ms')), 8000)
    );

    const [record] = await Promise.race([create, timeout]);
    const user = normalize(record);
    cacheSet(id, user);
    return { ok: true, created: true, user, id: record.id };
  } catch (e) {
    console.warn('[userService] ⚠️ ensureUserRow create err:', e.message);
    // Не ламаємо UX — повертаємо graceful-фейл
    return { ok: false, created: false, user: null, id: null, error: e.message };
  }
};

// ------ Оновлення по recordId (без select) ------
const updateUserById = async (recordId, fields) => {
  if (!recordId) throw new Error('updateUserById: recordId required');
  const [updated] = await base(tables.USERS).update([{
    id: recordId,
    fields: { ...fields, 'Last_Activity': new Date().toISOString() }
  }], { typecast: true });
  const user = normalize(updated);
  cacheSet(user['TG_id'], user);
  return user;
};

// ------ Fallback оновлення по TG ------
const updateUser = async (tgId, fields) => {
  const id = String(tgId);
  try {
    const filterByFormula = `{TG_id} = '${escapeFormula(id)}'`;
    const select = base(tables.USERS).select({ filterByFormula, maxRecords: 1 }).firstPage();
    const timeout = new Promise((_, rej) =>
      setTimeout(() => rej(new Error('updateUser/select timeout after 10000ms')), 10000)
    );
    const records = await Promise.race([select, timeout]);
    if (!records?.length) return null;
    return await updateUserById(records[0].id, fields);
  } catch {
    return null;
  }
};

// ------ Створення повного користувача ------
const createUser = async ({ tgId, name, email, phone, timezone, registrationStatus }) => {
  const id = String(tgId);
  const now = new Date().toISOString();
  const fields = {
    'TG_id': id,
    'User Name': name || 'Користувач',
    'Email': email || `user${id}@temp.com`,
    'Phone': phone || '+380000000000',
    'Time Zone': timezone || '', // ВАЖЛИВО: сюди летить LABEL з constants.js
    'UserRegistered': true,
    'Registration Date': now,
    'Status': 'Registered User',
    'Subscription Status': registrationStatus || 'Active',
    'Active_Subscription_Status': '❌ Неактивна',
    'Created_At': now,
    'Last_Activity': now
  };
  const [rec] = await base(tables.USERS).create([{ fields }], { typecast: true });
  const user = normalize(rec);
  cacheSet(id, user);
  return user;
};

// ------ Активуємо TRIAL (з пріоритетом recordId) ------
const activateTrial = async (tgId, days = 7, { recordId } = {}) => {
  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const endUA = end.toLocaleDateString('uk-UA');
  const fields = {
    'Active Subscription Plan': '🧪 Пробний період — 0€',
    'Subscription Status': 'Active',
    'Active_Subscription_Status': `✅ Активна до ${endUA}`,
    'Start_Date': now.toISOString(),
    'End_Date': end.toISOString()
  };

  if (recordId) {
    try { return await updateUserById(recordId, fields); }
    catch (e) { console.warn('[activateTrial] updateById fail:', e.message); }
  }
  return await updateUser(tgId, fields);
};

// ------ Хелпер доступу ------
const hasActiveAccess = (user) => {
  if (!user) return false;
  const s = String(user['Active_Subscription_Status'] || '');
  if (s.includes('✅')) return true;
  if (user.End_Date) return new Date(user.End_Date) > new Date();
  return false;
};

export default {
  getUserByTelegramId,
  ensureUserRow,
  createUser,
  updateUser,
  updateUserById,
  activateTrial,
  hasActiveAccess
};
