// src/config/database.js — СПРОЩЕНО ТА ОПТИМІЗОВАНО

import Airtable from 'airtable';
import dotenv from 'dotenv';
dotenv.config();

// ---- Перевірка ENV
if (!process.env.AIRTABLE_API_KEY) {
  console.error('❌ AIRTABLE_API_KEY відсутній у .env');
  process.exit(1);
}
if (!process.env.AIRTABLE_BASE_ID) {
  console.error('❌ AIRTABLE_BASE_ID відсутній у .env');
  process.exit(1);
}

console.log('🔗 [database] Ініціалізація Airtable…');

let cachedBase = null;

// ---- Один інстанс base на весь процес
export const getBase = () => {
  if (!cachedBase) {
    Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
    cachedBase = new Airtable().base(process.env.AIRTABLE_BASE_ID);
  }
  return cachedBase;
};

// ---- Мапа таблиць (для зручності)
export const tables = Object.freeze({
  USERS: 'Users',
  SUBSCRIPTIONS: 'Subscriptions',
  RESPONSES: 'Responses',
  USER_REFLECTIONS: 'User Reflections',
  MORNING_RESPONSES: 'Morning_Responses',
  EVENING_RESPONSES: 'Evening_Responses',
  AFFIRMATIONS: 'Affirmations',
  USER_AFFIRMATIONS: 'User Affirmations',
  USER_REPORTS: 'User Reports',
  USER_GOALS: 'User_Goals',
  DAILY_MICRO_ACTIONS: 'Daily_Micro_Actions',
  AI_CONVERSATIONS: 'AI_Conversations',
  WHEEL_BALANCE: 'WheelBalance',
});

// ---- Утиліти
const tableKeyOf = (name) => tables[name] || name;
const chunk = (arr, n = 10) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

const logAirtableError = (prefix, err) => {
  console.error(`${prefix} ❌`, {
    message: err?.message,
    statusCode: err?.statusCode,
    type: err?.error?.type,
    requestId: err?.error?.requestId,
  });
};

// ---- SELECT: завжди повертаємо масив записів
export const selectFromTable = async (tableName, opts = {}) => {
  const key = tableKeyOf(tableName);
  try {
    const base = getBase();
    const query = base(key).select(opts);
    const page = await query.firstPage(); // завжди масив
    return page;
  } catch (err) {
    logAirtableError(`[database.selectFromTable:${key}]`, err);
    throw err;
  }
};

// ---- Зручний геттер одного запису за формулою
export const getOneByFormula = async (tableName, filterByFormula, fields = undefined) => {
  const rows = await selectFromTable(tableName, {
    filterByFormula,
    maxRecords: 1,
    ...(fields ? { fields } : {}),
  });
  return rows[0] || null;
};

// ---- CREATE (батчами по 10)
export const createRows = async (tableName, rows) => {
  const key = tableKeyOf(tableName);
  try {
    const base = getBase();
    const batches = chunk(rows, 10);
    const results = [];
    for (const batch of batches) {
      const res = await base(key).create(batch, { typecast: true });
      results.push(...res);
    }
    console.log(`[database.createRows] ✅ ${key}: ${results.length} запис(и)`);
    return results;
  } catch (err) {
    logAirtableError(`[database.createRows:${key}]`, err);
    throw err;
  }
};

// ---- UPDATE (батчами по 10)
export const updateRows = async (tableName, rows) => {
  const key = tableKeyOf(tableName);
  try {
    const base = getBase();
    const batches = chunk(rows, 10);
    const results = [];
    for (const batch of batches) {
      const res = await base(key).update(batch, { typecast: true });
      results.push(...res);
    }
    console.log(`[database.updateRows] ✅ ${key}: ${results.length} запис(и)`);
    return results;
  } catch (err) {
    logAirtableError(`[database.updateRows:${key}]`, err);
    throw err;
  }
};

// ---- Швидка перевірка користувача (без будь-яких гонок/таймаутів)
export const quickUserCheck = async (tgId) => {
  try {
    const rec = await getOneByFormula(
      'USERS',
      `{TG_id} = '${String(tgId)}'`,
      ['TG_id', 'User Name', 'UserRegistered', 'Email', 'Status', 'Active_Subscription_Status', 'End_Date']
    );
    if (!rec) return null;
    return {
      id: rec.id,
      ...rec.fields,
      TG_id: String(rec.fields.TG_id || ''),
      UserRegistered: Boolean(rec.fields.UserRegistered),
      AT_id: rec.id,
    };
  } catch (err) {
    logAirtableError('[database.quickUserCheck]', err);
    return null;
  }
};

// ---- Healthcheck
export const testConnection = async () => {
  try {
    const page = await selectFromTable('USERS', { maxRecords: 1 });
    console.log('[database.testConnection] ✅ OK');
    return { success: true, records: page.length };
  } catch (err) {
    logAirtableError('[database.testConnection]', err);
    return { success: false, error: err?.message || 'unknown' };
  }
};

// (для зворотної сумісності, якщо десь робили import default)
export default getBase();
