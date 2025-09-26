// src/config/database.js - ПОКРАЩЕНО ДЛЯ СТАБІЛЬНОСТІ

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

console.log('🔗 [database] Ініціалізація Airtable...');
console.log(`📋 [database] BASE_ID: ${process.env.AIRTABLE_BASE_ID}`);

// ✅ ЗМЕНШУЄМО ТАЙМАУТИ ТА ПОКРАЩУЄМО RETRY
let cachedBase = null;

export const getBase = () => {
  if (!cachedBase) {
    cachedBase = new Airtable({ 
      apiKey: process.env.AIRTABLE_API_KEY,
      endpointUrl: 'https://api.airtable.com',
      requestTimeout: 8000, // Збільшено до 8 секунд
      retry: {
        attempts: 2, // Зменшено до 2 спроб
        delay: 500,
        exponentialDelay: true
      }
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

// ✅ ОПТИМІЗОВАНИЙ RATE LIMITER
let requestQueue = [];
let isProcessing = false;

const RATE_LIMIT = {
  requests: 3,        // Зменшено до 3 запитів
  window: 1000,       // за 1 секунду  
  delay: 500          // Збільшено затримку
};

const processQueue = async () => {
  if (isProcessing || requestQueue.length === 0) return;
  
  isProcessing = true;
  
  while (requestQueue.length > 0) {
    const { operation, resolve, reject, timestamp } = requestQueue.shift();
    
    try {
      // Видаляємо застарілі запити (більше 30 секунд)
      if (Date.now() - timestamp > 30000) {
        reject(new Error('Request timeout - removed from queue'));
        continue;
      }
      
      const result = await operation();
      resolve(result);
      
      // Затримка між запитами
      if (requestQueue.length > 0) {
        await new Promise(r => setTimeout(r, RATE_LIMIT.delay));
      }
      
    } catch (error) {
      reject(error);
    }
  }
  
  isProcessing = false;
};

const queueOperation = (operation) => {
  return new Promise((resolve, reject) => {
    requestQueue.push({
      operation,
      resolve,
      reject,
      timestamp: Date.now()
    });
    
    processQueue();
  });
};

// ✅ ПОКРАЩЕНА ОБРОБКА ПОМИЛОК
const logAirtableError = (prefix, error) => {
  const payload = {
    message: error?.message,
    statusCode: error?.statusCode,
    type: error?.error?.type,
    requestId: error?.error?.requestId
  };
  console.error(`${prefix} ❌`, JSON.stringify(payload, null, 2));
};

// ✅ ОПЕРАЦІЯ З ШВИДКИМ ФЕЙЛОМ
const rateLimitedOperation = async (operation, tag = 'op', timeout = 6000) => {
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error(`TIMEOUT:${tag}:${timeout}ms`)), timeout)
  );

  try {
    return await Promise.race([
      queueOperation(operation),
      timeoutPromise
    ]);
  } catch (error) {
    logAirtableError(`[rateLimitedOperation:${tag}]`, error);
    throw error;
  }
};

// ✅ ОСНОВНІ ФУНКЦІЇ З КОРОТШИМИ ТАЙМАУТАМИ
export const selectFromTable = (tableName, opts = {}) => {
  const tableKey = tables[tableName] || tableName;
  
  return rateLimitedOperation(
    () => getBase()(tableKey).select(opts), 
    `select_${tableKey}`,
    5000 // 5 секунд таймаут
  );
};

export const createRows = async (tableName, rows) => {
  const tableKey = tables[tableName] || tableName;
  
  try {
    // Батчинг: до 10 рядків за запит
    const batches = [];
    for (let i = 0; i < rows.length; i += 10) {
      batches.push(rows.slice(i, i + 10));
    }
    
    const results = [];
    for (const batch of batches) {
      const res = await rateLimitedOperation(
        () => getBase()(tableKey).create(batch, { typecast: true }),
        `create_${tableKey}`,
        8000 // 8 секунд для створення
      );
      results.push(...res);
      
      if (batches.length > 1 && batch !== batches[batches.length - 1]) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    
    console.log(`[database.createRows] ✅ Створено ${results.length} запис(и)`);
    return results;
    
  } catch (error) {
    logAirtableError(`[database.createRows:${tableKey}]`, error);
    throw error;
  }
};

export const updateRows = async (tableName, rows) => {
  const tableKey = tables[tableName] || tableName;
  
  try {
    const batches = [];
    for (let i = 0; i < rows.length; i += 10) {
      batches.push(rows.slice(i, i + 10));
    }
    
    const results = [];
    for (const batch of batches) {
      const res = await rateLimitedOperation(
        () => getBase()(tableKey).update(batch, { typecast: true }),
        `update_${tableKey}`,
        8000 // 8 секунд для оновлення
      );
      results.push(...res);
      
      if (batches.length > 1 && batch !== batches[batches.length - 1]) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    
    console.log(`[database.updateRows] ✅ Оновлено ${results.length} запис(и)`);
    return results;
    
  } catch (error) {
    logAirtableError(`[database.updateRows:${tableKey}]`, error);
    throw error;
  }
};

// ✅ ПОКРАЩЕНЕ ТЕСТУВАННЯ З FALLBACK
export const testConnection = async () => {
  try {
    console.log('[database.testConnection] 🧪 Тестування з\'єднання з Airtable...');
    
    const testOperation = async () => {
      const testBase = getBase();
      return await testBase('Users')
        .select({ maxRecords: 1 })
        .firstPage();
    };

    const page = await rateLimitedOperation(testOperation, 'test_connection', 5000);

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
    if (error.message?.includes('TIMEOUT')) return { success: false, error: 'timeout' };
    return { success: false, error: error.message };
  }
};

// ✅ ШВИДКА ПЕРЕВІРКА КОРИСТУВАЧА (БЕЗ ЧЕРГИ)
export const quickUserCheck = async (tgId) => {
  try {
    console.log(`[database.quickUserCheck] 🔍 Швидка перевірка користувача ${tgId}`);
    
    const base = getBase();
    const records = await Promise.race([
      base('Users').select({
        filterByFormula: `{TG_id} = '${String(tgId)}'`,
        maxRecords: 1,
        fields: ['TG_id', 'User Name', 'UserRegistered', 'Email', 'Status', 'Active_Subscription_Status', 'End_Date']
      }).firstPage(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('QUICK_TIMEOUT:3000ms')), 3000)
      )
    ]);
    
    if (records.length === 0) {
      console.log(`[database.quickUserCheck] ❌ Користувач ${tgId} не знайдений`);
      return null;
    }
    
    const user = records[0].fields;
    console.log(`[database.quickUserCheck] ✅ Користувач ${tgId} знайдений швидко`);
    return {
      id: records[0].id,
      ...user,
      TG_id: String(user.TG_id || ''),
      UserRegistered: Boolean(user.UserRegistered),
      AT_id: records[0].id
    };
    
  } catch (error) {
    console.error(`[database.quickUserCheck] ❌ Помилка швидкої перевірки:`, error.message);
    return null;
  }
};

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[database] 🛑 Зупинка обробки черги...');
  requestQueue = [];
  isProcessing = false;
});

console.log('✅ [database] База даних готова до роботи');

export default getBase();