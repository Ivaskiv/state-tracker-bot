// src/auth/services/userService.js — Сервіс роботи з користувачами (оновлено)
import { getBase, tables } from '../../config/database.js';
import { ANSWER_STEPS } from '../../config/constants.js';

const base = getBase();

// Кеш користувачів
const userCache = new Map();
const CACHE_TIMEOUT = 3 * 60 * 1000;

// ---------- утиліти ----------
const escapeFormula = (v) => String(v ?? '').replace(/'/g, "\\'");

const cacheGet = (tgId) => {
  const rec = userCache.get(String(tgId));
  if (rec && Date.now() - rec.ts < CACHE_TIMEOUT) return rec.user;
  if (rec) userCache.delete(String(tgId));
  return null;
};
const cacheSet = (tgId, user) => userCache.set(String(tgId), { user, ts: Date.now() });

const normalize = (record) => {
  if (!record?.fields) return null;
  const f = record.fields;
  return {
    id: record.id,
    TG_id: String(f['TG_id'] || ''),
    'TG_id': String(f['TG_id'] || ''), // лишаємо для сумісності
    'User Name': f['User Name'] || '',
    Email: f['Email'] || '',
    Phone: f['Phone'] || '',
    'Time Zone': f['Time Zone'] || 'Europe/Kyiv',
    UserRegistered: Boolean(f['UserRegistered']),
    'Registration Date': f['Registration Date'] || f['Created_At'],
    Status: f['Status'] || 'New User',
    'Subscription Status': f['Subscription Status'] || 'New',
    'Active Subscription Plan': f['Active Subscription Plan'] || '',
    'Active_Subscription_Status': f['Active_Subscription_Status'] || '❌ Неактивна',
    Start_Date: f['Start_Date'],
    End_Date: f['End_Date'],
    Answer_Step: f['Answer_Step'] || ANSWER_STEPS.COMPLETED,
    Last_Activity: f['Last_Activity'],
    Created_At: f['Created_At'] || new Date().toISOString(),
    AT_id: record.id,
  };
};

// ---------- базові операції ----------
export const getUserByTelegramId = async (tgId) => {
  const id = String(tgId);
  const hit = cacheGet(id);
  if (hit) return hit;

  const filterByFormula = `{TG_id} = '${escapeFormula(id)}'`;
  const records = await base(tables.USERS)
    .select({
      filterByFormula,
      maxRecords: 1,
      fields: [
        'TG_id','User Name','Email','Phone','Time Zone','UserRegistered',
        'Registration Date','Status','Subscription Status',
        'Active Subscription Plan','Active_Subscription_Status',
        'Start_Date','End_Date','Answer_Step','Last_Activity','Created_At'
      ]
    })
    .firstPage();

  if (!records?.length) return null;
  const user = normalize(records[0]);
  cacheSet(id, user);
  return user;
};

// створити пустий рядок з TG_id, якщо його ще немає
export const ensureUserRow = async (tgId) => {
  const id = String(tgId);
  let user = await getUserByTelegramId(id);
  if (user) return user;

  const now = new Date().toISOString();
  const [rec] = await base(tables.USERS).create([{
    fields: {
      TG_id: id,
      Status: 'New User',
      UserRegistered: false,
      'Active_Subscription_Status': '❌ Неактивна',
      Created_At: now,
      'Last_Activity': now,
    }
  }], { typecast: true });

  user = normalize(rec);
  cacheSet(id, user);
  return user;
};

export const updateUser = async (tgId, fields) => {
  const id = String(tgId);
  const filterByFormula = `{TG_id} = '${escapeFormula(id)}'`;
  const sel = await base(tables.USERS).select({ filterByFormula, maxRecords: 1 }).firstPage();
  if (!sel?.length) return null;

  const [upd] = await base(tables.USERS).update([{
    id: sel[0].id,
    fields: { ...fields, 'Last_Activity': new Date().toISOString() }
  }], { typecast: true });

  const user = normalize(upd);
  cacheSet(id, user);
  return user;
};

// ---------- зручні сетери ----------
export const setName = (tgId, name) => updateUser(tgId, { 'User Name': name });
export const setEmail = (tgId, email) => updateUser(tgId, { Email: email });
export const setPhone = (tgId, phone) => updateUser(tgId, { Phone: phone });
export const setTimezone = (tgId, tz) => updateUser(tgId, { 'Time Zone': tz });

// позначити, що онбординг завершено
export const markRegistered = (tgId) =>
  updateUser(tgId, { Status: 'Registered User', UserRegistered: true });

// активувати пробний доступ (7 днів)
export const activateTrial = async (tgId, days = 7) => {
  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return updateUser(tgId, {
    'Active Subscription Plan': '🧪 Пробний 7 днів — 0€',
    'Subscription Status': 'Active',
    'Active_Subscription_Status': '✅ Активна',
    Start_Date: now.toISOString(),
    End_Date: end.toISOString()
  });
};

// ---------- правила доступу ----------
export const hasActiveAccess = (user) => {
  if (!user) return false;
  const status = String(user['Active_Subscription_Status'] || '');
  if (status.includes('✅')) return true;

  const plan = String(user['Active Subscription Plan'] || '').toLowerCase();
  if (plan.includes('пробн') || plan.includes('trial')) {
    if (user.End_Date) return new Date() < new Date(user.End_Date);
  }
  if (user.End_Date) return new Date() < new Date(user.End_Date);
  return false;
};

// ---------- кеш ----------
export const clearCache = (tgId = null) => {
  if (tgId) userCache.delete(String(tgId));
  else userCache.clear();
};
export const getCacheStats = () => ({ size: userCache.size, timeout: CACHE_TIMEOUT });

// ---------- експорт за замовчуванням ----------
const userService = {
  getUserByTelegramId,
  ensureUserRow,
  updateUser,
  setName, setEmail, setPhone, setTimezone,
  markRegistered,
  activateTrial,
  hasActiveAccess,
  clearCache, getCacheStats
};
export default userService;

console.log('✅ [userService] ініціалізовано');
