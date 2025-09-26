// src/config/database.js - ОПТИМІЗОВАНО ДЛЯ СТАБІЛЬНОСТІ

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
      requestTimeout: 60000, // Збільшуємо до 60 секунд
      // Додаємо retry логіку
      retry: {
        attempts: 3,
        delay: 1000,
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

// Оптимізований rate limiter
let requestQueue = [];
let isProcessing = false;

const RATE_LIMIT = {
  requests: 5,        // Зменшуємо до 5 запитів
  window: 1000,       // за 1 секунду  
  delay: 300          // Збільшуємо затримку між запитами
};

const processQueue = async () => {
  if (isProcessing || requestQueue.length === 0) return;
  
  isProcessing = true;
  
  while (requestQueue.length > 0) {
    const { operation, resolve, reject, timestamp } = requestQueue.shift();
    
    try {
      // Перевіряємо чи не застарів запит (більше 2 хвилин)
      if (Date.now() - timestamp > 120000) {
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

// Операція з rate limiting та чергою
const rateLimitedOperation = async (operation, tag = 'op') => {
  try {
    return await queueOperation(async () => {
      try {
        return await operation();
      } catch (error) {
        logAirtableError(`[rateLimitedOperation:${tag}]`, error);
        throw error;
      }
    });
  } catch (error) {
    logAirtableError(`[queueOperation:${tag}]`, error);
    throw error;
  }
};

export const selectFromTable = (tableName, opts = {}) => {
  const tableKey = tables[tableName] || tableName;
  if (VERBOSE) {
    console.log(`[database.selectFromTable] Таблиця: ${tableKey}`);
    console.log(`[database.selectFromTable] Опції:`, JSON.stringify(opts, null, 2));
  }
  
  return rateLimitedOperation(() => getBase()(tableKey).select(opts), `select_${tableKey}`);
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
      const res = await rateLimitedOperation(
        () => getBase()(tableKey).create(batch, { typecast: true }),
        `create_${tableKey}`
      );
      results.push(...res);
      
      // Затримка між батчами
      if (batches.length > 1 && batch !== batches[batches.length - 1]) {
        await new Promise(r => setTimeout(r, 500));
      }
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
      const res = await rateLimitedOperation(
        () => getBase()(tableKey).update(batch, { typecast: true }),
        `update_${tableKey}`
      );
      results.push(...res);
      
      if (batches.length > 1 && batch !== batches[batches.length - 1]) {
        await new Promise(r => setTimeout(r, 500));
      }
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
    
    const testOperation = async () => {
      const testBase = getBase();
      return await testBase('Users')
        .select({ maxRecords: 1 })
        .firstPage();
    };

    const page = await rateLimitedOperation(testOperation, 'test_connection');

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

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[database] 🛑 Зупинка обробки черги...');
  requestQueue = [];
  isProcessing = false;
});

const initializeDatabase = async () => {
  console.log('🚀 [database] Ініціалізація бази даних...');
  try {
    const testResult = await testConnection();
    if (testResult.success) {
      console.log('✅ [database] База даних готова до роботи');
      console.log(`📊 [database] Rate limit: ${RATE_LIMIT.requests}/${RATE_LIMIT.window}ms, затримка: ${RATE_LIMIT.delay}ms`);
    } else {
      console.error('❌ [database] Проблема з базою:', testResult.error);
      console.warn('⚠️ [database] Продовжуємо роботу з обмеженим функціоналом');
    }
  } catch (error) {
    console.error('❌ [database] Критична помилка ініціалізації:', error);
    console.warn('⚠️ [database] Продовжуємо без тестування - база може бути недоступна');
  }
};

// Ініціалізуємо при завантаженні модуля
initializeDatabase();

export default getBase();