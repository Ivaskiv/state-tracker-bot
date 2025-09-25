// src/config/database.js - ВИПРАВЛЕНО: БЕЗ REDIS

import Airtable from "airtable";
import dotenv from "dotenv";
dotenv.config();

// Перевірка ENV
if (!process.env.AIRTABLE_API_KEY) {
  console.error('❌ AIRTABLE_API_KEY не встановлено в .env файлі!');
  process.exit(1);
}
if (!process.env.AIRTABLE_BASE_ID) {
  console.error('❌ AIRTABLE_BASE_ID не встановлено в .env файлі!');
  process.exit(1);
}

const VERBOSE = process.env.AIRTABLE_VERBOSE === '1';

console.log('🔗 [database] Ініціалізація Airtable...');
console.log(`📋 [database] BASE_ID: ${process.env.AIRTABLE_BASE_ID}`);
console.log(`🔑 [database] API_KEY: ${process.env.AIRTABLE_API_KEY.substring(0, 10)}...`);

// Кешуємо інстанс base
let cachedBase = null;

export const getBase = () => {
  if (!cachedBase) {
    if (VERBOSE) console.log('[database.getBase] Створюємо новий інстанс Airtable');
    cachedBase = new Airtable({ 
      apiKey: process.env.AIRTABLE_API_KEY,
      endpointUrl: 'https://api.airtable.com',
      requestTimeout: 10000
    }).base(process.env.AIRTABLE_BASE_ID);
  }
  return cachedBase;
};

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
  WHEEL_BALANCE: 'WheelBalance'
});

// Простий rate limiter без Redis
let requestTimes = [];
const rateLimitWindow = 1000; // 1 секунда
const maxRequestsPerSecond = 5;

const simpleRateLimit = async () => {
  const now = Date.now();
  // Очищуємо старі запити
  requestTimes = requestTimes.filter(time => now - time < rateLimitWindow);
  
  if (requestTimes.length >= maxRequestsPerSecond) {
    const oldestRequest = Math.min(...requestTimes);
    const waitTime = rateLimitWindow - (now - oldestRequest);
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  requestTimes.push(now);
};

// Логування помилок Airtable
const logAirtableError = (prefix, error) => {
  const payload = {
    message: error?.message,
    statusCode: error?.statusCode,
    type: error?.error?.type,
    requestId: error?.error?.requestId
  };
  console.error(`${prefix} ❌`, JSON.stringify(payload, null, 2));
};

// Операція з rate limiting
const rateLimitedOperation = async (operation, tag = 'op') => {
  try {
    await simpleRateLimit();
    return await operation();
  } catch (error) {
    logAirtableError(`[rateLimitedOperation:${tag}]`, error);
    throw error;
  }
};

export const selectFromTable = (tableName, opts = {}) => {
  const tableKey = tables[tableName] || tableName;
  if (VERBOSE) {
    console.log(`[database.selectFromTable] Таблиця: ${tableKey}`);
    console.log(`[database.selectFromTable] Опції:`, JSON.stringify(opts, null, 2));
  }
  try {
    return rateLimitedOperation(() => getBase()(tableKey).select(opts));
  } catch (error) {
    logAirtableError(`[database.selectFromTable:${tableKey}]`, error);
    throw error;
  }
};

export const createRows = async (tableName, rows) => {
  const tableKey = tables[tableName] || tableName;
  if (VERBOSE) {
    console.log(`[database.createRows] Таблиця: ${tableKey}, Рядків: ${rows.length}`);
  }
  try {
    // Батчинг: до 10 рядків за запит
    const batches = [];
    for (let i = 0; i < rows.length; i += 10) {
      batches.push(rows.slice(i, i + 10));
    }
    const results = [];
    for (const batch of batches) {
      const res = await rateLimitedOperation(() => getBase()(tableKey).create(batch, { typecast: true }));
      results.push(...res);
      if (batches.length > 1) await new Promise(r => setTimeout(r, 200));
    }
    if (VERBOSE) {
      console.log(`[database.createRows] ✅ Створено ${results.length} запис(и)`);
    }
    return results;
  } catch (error) {
    logAirtableError(`[database.createRows:${tableKey}]`, error);
    throw error;
  }
};

export const updateRows = async (tableName, rows) => {
  const tableKey = tables[tableName] || tableName;
  if (VERBOSE) {
    console.log(`[database.updateRows] Таблиця: ${tableKey}, Рядків: ${rows.length}`);
  }
  try {
    const batches = [];
    for (let i = 0; i < rows.length; i += 10) {
      batches.push(rows.slice(i, i + 10));
    }
    const results = [];
    for (const batch of batches) {
      const res = await rateLimitedOperation(() => getBase()(tableKey).update(batch, { typecast: true }));
      results.push(...res);
      if (batches.length > 1) await new Promise(r => setTimeout(r, 200));
    }
    if (VERBOSE) {
      console.log(`[database.updateRows] ✅ Оновлено ${results.length} запис(и)`);
    }
    return results;
  } catch (error) {
    logAirtableError(`[database.updateRows:${tableKey}]`, error);
    throw error;
  }
};

export const testConnection = async () => {
  try {
    console.log('[database.testConnection] 🧪 Тестування з\'єднання з Airtable...');
    const testBase = getBase();

    const page = await testBase('Users')
      .select({ maxRecords: 1 })
      .firstPage();

    console.log('[database.testConnection] ✅ З\'єднання успішне!');
    console.log(`[database.testConnection] 📊 Таблиця Users: ${page.length > 0 ? 'містить записи' : 'порожня'}`);

    return { success: true, records: page.length, message: 'OK' };
  } catch (error) {
    console.error('[database.testConnection] ❌ Помилка з\'єднання:', {
      message: error.message,
      statusCode: error.statusCode,
      type: error.type
    });
    if (error.statusCode === 401) return { success: false, error: 'invalid_api_key' };
    if (error.statusCode === 404) return { success: false, error: 'not_found' };
    if (error.statusCode === 403) return { success: false, error: 'access_denied' };
    return { success: false, error: error.message };
  }
};

const initializeDatabase = async () => {
  console.log('🚀 [database] Ініціалізація бази даних...');
  try {
    const testResult = await testConnection();
    if (testResult.success) {
      console.log('✅ [database] База даних готова до роботи');
    } else {
      console.error('❌ [database] Проблема з базою:', testResult.error);
      console.warn('⚠️ [database] Продовжуємо роботу');
    }
  } catch (error) {
    console.error('❌ [database] Критична помилка ініціалізації:', error);
    console.warn('⚠️ [database] Продовжуємо без тестування');
  }
};

initializeDatabase();

export default getBase();