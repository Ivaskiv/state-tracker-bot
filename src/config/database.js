// src/config/database.js
import Airtable from 'airtable';
import dotenv from 'dotenv';
dotenv.config();

const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_VERBOSE } = process.env;
const VERBOSE = AIRTABLE_VERBOSE === '1';

// ---- Перевірка ENV
if (!AIRTABLE_API_KEY) {
  console.error('❌ AIRTABLE_API_KEY не встановлено в .env');
  process.exit(1);
}
if (!AIRTABLE_BASE_ID) {
  console.error('❌ AIRTABLE_BASE_ID не встановлено в .env');
  process.exit(1);
}

console.log('🔗 [database] Ініціалізація Airtable…');
console.log(`📋 [database] BASE_ID: ${AIRTABLE_BASE_ID}`);
console.log(`🔑 [database] API_KEY: ${AIRTABLE_API_KEY.slice(0, 10)}...`);
if (VERBOSE) console.log('🕵️ [database] VERBOSE=1');

// ---- Один інстанс base на весь процес
let baseSingleton = null;
export const getBase = () => {
  if (baseSingleton) return baseSingleton;
  Airtable.configure({ apiKey: AIRTABLE_API_KEY });
  baseSingleton = new Airtable().base(AIRTABLE_BASE_ID);
  if (VERBOSE) console.log('[database.getBase] ✅ Створено єдиний інстанс Airtable base');
  return baseSingleton;
};

// ---- Мапа таблиць (ВИПРАВЛЕНІ НАЗВИ ЗГІДНО З AIRTABLE СТРУКТУРОЮ)
export const tables = Object.freeze({
  // ===== ОСНОВНІ ТАБЛИЦІ =====
  USERS: 'Users',
  SUBSCRIPTIONS: 'Subscriptions',
  RESPONSES: 'Responses',
  
  // ===== AI НАСТАВНИК =====
  AI_CONVERSATIONS: 'AI_Conversations', 
  AI_CONVERSATIONS_FEEDBACK: 'AI_Conversations_Feedback_Advice', 
  
  // ===== МІКРО-ДІЇ =====
  MICRO_ACTIONS: 'MICRO_ACTIONS', 
  
  // ===== СТАТИСТИКА =====
  ACTIVITY_STATS: 'ACTIVITY_STATS', 
  
  // ===== ІНШІ ТАБЛИЦІ =====
  USER_REFLECTIONS: 'User Reflections',
  MORNING_RESPONSES: 'Morning_Responses',
  EVENING_RESPONSES: 'Evening_Responses',
  AFFIRMATIONS: 'Affirmations',
  USER_AFFIRMATIONS: 'User Affirmations',
  USER_REPORTS: 'User_Reports',
  USER_GOALS: 'User_Goals',
  WHEEL_BALANCE: 'WheelBalance',
  OFFERS_LOG: 'Offers_Log',
  
  // ===== DEPRECATED (для зворотної сумісності) =====
  DAILY_MICRO_ACTIONS: 'MICRO_ACTIONS' 
});

// ---- Утиліти
const keyOf = (name) => tables[name] || name;

const chunk = (arr, n = 10) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

const logAirtableError = (prefix, err) => {
  const payload = {
    message: err?.message,
    statusCode: err?.statusCode,
    type: err?.error?.type,
    requestId: err?.error?.requestId,
    details: err?.error,
  };
  console.error(`${prefix} ❌`, JSON.stringify(payload, null, 2));
};

// ---- SELECT: повертаємо query (ланцюжиш .firstPage() або .all())
export const selectFromTable = (tableName, opts = {}) => {
  const key = keyOf(tableName);
  if (VERBOSE) {
    console.log(`[database.selectFromTable] ▶️ ${key}`);
    console.log(`[database.selectFromTable] ▶️ opts:`, JSON.stringify(opts, null, 2));
  }
  try {
    return getBase()(key).select(opts);
  } catch (err) {
    logAirtableError(`[database.selectFromTable:${key}]`, err);
    throw err;
  }
};

// ---- Зручний геттер одного запису
export const getOneByFormula = async (tableName, filterByFormula, fields) => {
  try {
    const rows = await selectFromTable(tableName, {
      filterByFormula,
      maxRecords: 1,
      ...(fields ? { fields } : {}),
    }).firstPage();
    return rows?.[0] || null;
  } catch (err) {
    logAirtableError('[database.getOneByFormula]', err);
    throw err;
  }
};

// ---- CREATE (батчами по 10)
export const createRows = async (tableName, rows) => {
  const key = keyOf(tableName);
  if (VERBOSE) {
    console.log(`[database.createRows] ▶️ ${key} (${rows.length})`);
    if (rows.length) console.log(`[database.createRows] ▶️ first fields:`, JSON.stringify(rows[0]?.fields, null, 2));
  }
  try {
    const base = getBase();
    const batches = chunk(rows, 10);
    const out = [];
    for (const b of batches) {
      const res = await base(key).create(b, { typecast: true });
      out.push(...res);
    }
    if (VERBOSE) console.log(`[database.createRows] ✅ Створено ${out.length}`);
    return out;
  } catch (err) {
    logAirtableError(`[database.createRows:${key}]`, err);
    throw err;
  }
};

// ---- UPDATE (батчами по 10)
export const updateRows = async (tableName, rows) => {
  const key = keyOf(tableName);
  if (VERBOSE) {
    console.log(`[database.updateRows] ▶️ ${key} (${rows.length})`);
    if (rows.length) console.log(`[database.updateRows] ▶️ first update:`, JSON.stringify(rows[0], null, 2));
  }
  try {
    const base = getBase();
    const batches = chunk(rows, 10);
    const out = [];
    for (const b of batches) {
      const res = await base(key).update(b, { typecast: true });
      out.push(...res);
    }
    if (VERBOSE) console.log(`[database.updateRows] ✅ Оновлено ${out.length}`);
    return out;
  } catch (err) {
    logAirtableError(`[database.updateRows:${key}]`, err);
    throw err;
  }
};

// ---- Healthcheck (викликати ОДИН раз на старті з server.js)
export const testConnection = async () => {
  try {
    console.log('[database.testConnection] 🧪 Перевірка…');
    const page = await selectFromTable('USERS', { maxRecords: 1 }).firstPage();
    console.log('[database.testConnection] ✅ OK (Users:', page.length, ')');
    return { success: true };
  } catch (err) {
    logAirtableError('[database.testConnection]', err);
    return { success: false, error: err?.message || 'unknown' };
  }
};

// ---- Валідація таблиць при старті (опціонально)
export const validateTables = async () => {
  console.log('[database] 🔍 Валідація таблиць...');
  
  const criticalTables = [
    'USERS',
    'AI_CONVERSATIONS', 
    'MICRO_ACTIONS',
    'ACTIVITY_STATS'
  ];
  
  const results = [];
  
  for (const tableKey of criticalTables) {
    try {
      const tableName = tables[tableKey];
      await getBase()(tableName).select({ maxRecords: 1 }).firstPage();
      results.push({ table: tableName, status: '✅' });
      console.log(`[database] ✅ ${tableName}`);
    } catch (error) {
      results.push({ table: tables[tableKey], status: '❌', error: error.message });
      console.error(`[database] ❌ ${tables[tableKey]}: ${error.message}`);
    }
  }
  
  const allValid = results.every(r => r.status === '✅');
  
  if (allValid) {
    console.log('[database] ✅ Всі критичні таблиці доступні');
  } else {
    console.warn('[database] ⚠️ Деякі таблиці недоступні');
  }
  
  return { valid: allValid, results };
};

console.log('[database] ✅ Конфігурація завантажена');
console.log('[database] 📊 Доступні таблиці:', Object.keys(tables).length);