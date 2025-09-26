// src/config/database.js - ОПТИМІЗОВАНА КОНФІГУРАЦІЯ БАЗИ ДАНИХ

import Airtable from "airtable";
import NodeCache from 'node-cache';

// Перевірка ENV
const requiredEnvVars = {
  'AIRTABLE_API_KEY': process.env.AIRTABLE_API_KEY,
  'AIRTABLE_BASE_ID': process.env.AIRTABLE_BASE_ID
};

for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    console.error(`❌ ${key} не встановлено в .env файлі!`);
    process.exit(1);
  }
}

const VERBOSE = process.env.AIRTABLE_VERBOSE === '1';

console.log('🔗 [DATABASE] Ініціалізація Airtable...');
console.log(`📋 [DATABASE] BASE_ID: ${process.env.AIRTABLE_BASE_ID}`);
console.log(`🔑 [DATABASE] API_KEY: ${process.env.AIRTABLE_API_KEY.substring(0, 10)}...`);

// ===== КЕШ =====
const requestCache = new NodeCache({ 
  stdTTL: 300, // 5 хвилин
  checkperiod: 60,
  maxKeys: 1000 
});

// ===== ТАБЛИЦІ =====
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

// ===== RATE LIMITER =====
class SimpleRateLimiter {
  constructor(requestsPerSecond = 4) {
    this.requestsPerSecond = requestsPerSecond;
    this.requestTimes = [];
    this.queue = [];
    this.isProcessing = false;
  }

  async execute(operation, tag = 'operation') {
    return new Promise((resolve, reject) => {
      this.queue.push({ operation, resolve, reject, tag, timestamp: Date.now() });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const { operation, resolve, reject, tag, timestamp } = this.queue.shift();
      
      // Видаляємо застарілі запити (більше 2 хвилин)
      if (Date.now() - timestamp > 120000) {
        reject(new Error('Request timeout - removed from queue'));
        continue;
      }

      try {
        // Rate limiting
        await this.waitForSlot();
        
        // Виконуємо операцію
        const result = await operation();
        resolve(result);
        
        if (VERBOSE) console.log(`[DATABASE] ✅ ${tag} completed`);
        
      } catch (error) {
        console.error(`[DATABASE] ❌ ${tag} failed:`, {
          message: error.message,
          statusCode: error.statusCode
        });
        reject(error);
      }
    }

    this.isProcessing = false;
  }

  async waitForSlot() {
    const now = Date.now();
    const windowMs = 1000; // 1 секунда
    
    // Очищаємо старі запити
    this.requestTimes = this.requestTimes.filter(time => now - time < windowMs);
    
    // Чекаємо якщо перевищено ліміт
    if (this.requestTimes.length >= this.requestsPerSecond) {
      const waitTime = Math.max(0, windowMs - (now - this.requestTimes[0])) + 100;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.waitForSlot(); // Рекурсивно перевіряємо знову
    }
    
    this.requestTimes.push(now);
  }
}

// ===== ГОЛОВНИЙ КЛАС БАЗИ ДАНИХ =====
class Database {
  constructor() {
    this.base = null;
    this.rateLimiter = new SimpleRateLimiter(4); // 4 запити/сек
    this.connectionTested = false;
    this.initializeBase();
  }

  initializeBase() {
    try {
      this.base = new Airtable({ 
        apiKey: process.env.AIRTABLE_API_KEY,
        endpointUrl: 'https://api.airtable.com',
        requestTimeout: 30000, // 30 секунд
      }).base(process.env.AIRTABLE_BASE_ID);
      
      console.log('✅ [DATABASE] Airtable base ініціалізовано');
    } catch (error) {
      console.error('❌ [DATABASE] Помилка ініціалізації:', error);
      throw error;
    }
  }

  getBase() {
    if (!this.base) {
      this.initializeBase();
    }
    return this.base;
  }

  // Виконання операції з rate limiting
  async execute(operation, tag = 'operation') {
    return await this.rateLimiter.execute(operation, tag);
  }

  // SELECT операція з кешуванням
  async select(tableName, options = {}, useCache = true) {
    const cacheKey = `select_${tableName}_${JSON.stringify(options)}`;
    
    if (useCache && requestCache.has(cacheKey)) {
      if (VERBOSE) console.log(`[DATABASE] 🎯 Cache hit: ${cacheKey}`);
      return requestCache.get(cacheKey);
    }

    const tableKey = tables[tableName] || tableName;
    
    const operation = async () => {
      return await this.getBase()(tableKey).select(options).all();
    };

    const result = await this.execute(operation, `select_${tableKey}`);
    
    if (useCache && result.length > 0) {
      requestCache.set(cacheKey, result, 300); // 5 хвилин кеш
    }
    
    return result;
  }

  // CREATE операція
  async create(tableName, records) {
    const tableKey = tables[tableName] || tableName;
    
    // Батчинг: до 10 записів за раз
    const batches = [];
    const recordsArray = Array.isArray(records) ? records : [records];
    
    for (let i = 0; i < recordsArray.length; i += 10) {
      batches.push(recordsArray.slice(i, i + 10));
    }

    const results = [];
    
    for (const batch of batches) {
      const operation = async () => {
        return await this.getBase()(tableKey).create(batch, { typecast: true });
      };

      const batchResults = await this.execute(operation, `create_${tableKey}`);
      results.push(...batchResults);
      
      // Затримка між батчами
      if (batches.length > 1) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // Очищаємо кеш для цієї таблиці
    this.clearTableCache(tableName);
    
    return results;
  }

  // UPDATE операція
  async update(tableName, updates) {
    const tableKey = tables[tableName] || tableName;
    
    const batches = [];
    const updatesArray = Array.isArray(updates) ? updates : [updates];
    
    for (let i = 0; i < updatesArray.length; i += 10) {
      batches.push(updatesArray.slice(i, i + 10));
    }

    const results = [];
    
    for (const batch of batches) {
      const operation = async () => {
        return await this.getBase()(tableKey).update(batch, { typecast: true });
      };

      const batchResults = await this.execute(operation, `update_${tableKey}`);
      results.push(...batchResults);
      
      if (batches.length > 1) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // Очищаємо кеш
    this.clearTableCache(tableName);
    
    return results;
  }

  // Знайти запис за ID
  async find(tableName, recordId) {
    const tableKey = tables[tableName] || tableName;
    
    const operation = async () => {
      return await this.getBase()(tableKey).find(recordId);
    };

    return await this.execute(operation, `find_${tableKey}`);
  }

  // Очистити кеш для таблиці
  clearTableCache(tableName) {
    const keys = requestCache.keys();
    const tableKeys = keys.filter(key => key.startsWith(`select_${tableName}`));
    
    for (const key of tableKeys) {
      requestCache.del(key);
    }
    
    if (VERBOSE && tableKeys.length > 0) {
      console.log(`[DATABASE] 🧹 Очищено ${tableKeys.length} кеш записів для ${tableName}`);
    }
  }

  // Очистити весь кеш
  clearCache() {
    requestCache.flushAll();
    console.log('[DATABASE] 🧹 Весь кеш очищено');
  }

  // Тестування з'єднання
  async testConnection() {
    try {
      console.log('[DATABASE] 🧪 Тестування з\'єднання...');
      
      const operation = async () => {
        return await this.getBase()('Users')
          .select({ maxRecords: 1 })
          .firstPage();
      };

      const records = await this.execute(operation, 'test_connection');

      this.connectionTested = true;
      console.log('[DATABASE] ✅ З\'єднання успішне!');
      console.log(`[DATABASE] 📊 Таблиця Users: ${records.length > 0 ? 'містить записи' : 'порожня'}`);

      return { 
        success: true, 
        records: records.length, 
        message: 'Connection successful' 
      };
      
    } catch (error) {
      console.error('[DATABASE] ❌ Помилка з\'єднання:', {
        message: error.message,
        statusCode: error.statusCode
      });
      
      const errorMap = {
        401: 'invalid_api_key',
        404: 'table_not_found', 
        403: 'access_denied',
        422: 'invalid_request'
      };
      
      return { 
        success: false, 
        error: errorMap[error.statusCode] || error.message 
      };
    }
  }

  // Статистика
  getStats() {
    return {
      cacheStats: requestCache.getStats(),
      queueLength: this.rateLimiter.queue.length,
      connectionTested: this.connectionTested
    };
  }
}

// ===== ЕКСПОРТ =====
const database = new Database();

export const getBase = () => database.getBase();
export const testConnection = () => database.testConnection();
export const clearCache = () => database.clearCache();
export const getDatabaseStats = () => database.getStats();

// Простіші функції для зручності
export const selectFromTable = async (tableName, options = {}) => {
  return await database.select(tableName, options);
};

export const createRows = async (tableName, records) => {
  return await database.create(tableName, records);
};

export const updateRows = async (tableName, updates) => {
  return await database.update(tableName, updates);
};

export const findRecord = async (tableName, recordId) => {
  return await database.find(tableName, recordId);
};

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[DATABASE] 🛑 Зупинка обробки черги...');
  database.rateLimiter.queue = [];
});

// Автоматичне тестування при ініціалізації
setTimeout(async () => {
  try {
    await database.testConnection();
  } catch (error) {
    console.warn('[DATABASE] ⚠️ Автоматичне тестування не вдалося');
  }
}, 2000);

console.log('[DATABASE] ✅ Database модуль готовий');

export default database;