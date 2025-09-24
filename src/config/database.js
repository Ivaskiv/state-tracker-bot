// src/config/database.js - РОЗШИРЕНІ ЛОГИ ДЛЯ ДІАГНОСТИКИ

import Airtable from "airtable";
import dotenv from "dotenv";
import RateLimiter from 'async-ratelimiter'; // Додайте залежність: npm install async-ratelimiter redis
import Redis from 'ioredis'; // Для Redis, або використовуйте вбудований якщо немає Redis
dotenv.config();

// ✅ ПЕРЕВІРКА ENV
if (!process.env.AIRTABLE_API_KEY) {
  console.error('❌ КРИТИЧНА ПОМИЛКА: AIRTABLE_API_KEY не встановлено в .env файлі!');
  process.exit(1);
}
if (!process.env.AIRTABLE_BASE_ID) {
  console.error('❌ КРИТИЧНА ПОМИЛКА: AIRTABLE_BASE_ID не встановлено в .env файлі!');
  process.exit(1);
}

const VERBOSE = process.env.AIRTABLE_VERBOSE === '1';

console.log('🔗 [database] Ініціалізація Airtable з\'єднання...');
console.log(`📋 [database] BASE_ID: ${process.env.AIRTABLE_BASE_ID}`);
console.log(`🔑 [database] API_KEY: ${process.env.AIRTABLE_API_KEY.substring(0, 10)}...`);
if (VERBOSE) console.log('🕵️ [database] VERBOSE режим УВІМКНЕНО (AIRTABLE_VERBOSE=1)');

// Кешуємо інстанс base
let cachedBase = null;

// Rate limiter: 5 запитів/сек (Airtable ліміт)
const redis = new Redis(); // Якщо немає Redis, використовуйте вбудований кеш
const limiter = new RateLimiter({
  db: redis,
  max: 5, // 5 запитів
  duration: 1000, // за 1 секунду
});

export const getBase = () => {
  if (!cachedBase) {
    if (VERBOSE) console.log('[database.getBase] Створюємо новий інстанс Airtable base');
    cachedBase = new Airtable({ 
      apiKey: process.env.AIRTABLE_API_KEY,
      endpointUrl: 'https://api.airtable.com',
      requestTimeout: 10000 // Збільшено до 10 секунд
    }).base(process.env.AIRTABLE_BASE_ID);
  } else if (VERBOSE) {
    console.log('[database.getBase] Використовуємо кешований інстанс Airtable base');
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

// Внутрішній логер помилок Airtable
const logAirtableError = (prefix, error) => {
  const payload = {
    message: error?.message,
    statusCode: error?.statusCode,
    type: error?.error?.type,
    requestId: error?.error?.requestId,
    details: error?.error,
  };
  console.error(`${prefix} ❌`, JSON.stringify(payload, null, 2));
};

// Функція для обмеження швидкості запитів
const rateLimitedOperation = async (operation) => {
  await limiter.get({ id: 'airtable' }); // Чекає, якщо ліміт перевищено
  return operation();
};

export const selectFromTable = (tableName, opts = {}) => {
  const tableKey = tables[tableName] || tableName;
  if (VERBOSE) {
    console.log(`[database.selectFromTable] ▶️ Таблиця: ${tableKey}`);
    console.log(`[database.selectFromTable] ▶️ Опції:`, JSON.stringify(opts, null, 2));
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
    console.log(`[database.createRows] ▶️ Таблиця: ${tableKey}`);
    console.log(`[database.createRows] ▶️ Рядків: ${rows.length}`);
    if (rows.length) {
      console.log(`[database.createRows] ▶️ Перший запис fields:`, JSON.stringify(rows[0]?.fields, null, 2));
      console.log(`[database.createRows] ▶️ Ключі:`, Object.keys(rows[0]?.fields || {}));
      console.log(`[database.createRows] ▶️ Типи:`,
        Object.fromEntries(Object.entries(rows[0]?.fields || {}).map(([k,v]) => [k, typeof v]))
      );
    }
  }
  try {
    // Батчинг: Airtable дозволяє до 10 рядків за запит
    const batches = [];
    for (let i = 0; i < rows.length; i += 10) {
      batches.push(rows.slice(i, i + 10));
    }
    const results = [];
    for (const batch of batches) {
      const res = await rateLimitedOperation(() => getBase()(tableKey).create(batch, { typecast: true }));
      results.push(...res);
      await new Promise(r => setTimeout(r, 200)); // Затримка між батчами
    }
    if (VERBOSE) {
      console.log(`[database.createRows] ✅ Створено ${results.length} запис(и). IDs:`, results.map(r => r.id));
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
    console.log(`[database.updateRows] ▶️ Таблиця: ${tableKey}`);
    console.log(`[database.updateRows] ▶️ Рядків: ${rows.length}`);
    if (rows.length) {
      console.log(`[database.updateRows] ▶️ Перший update:`, JSON.stringify(rows[0], null, 2));
    }
  }
  try {
    // Батчинг: до 10 рядків за запит
    const batches = [];
    for (let i = 0; i < rows.length; i += 10) {
      batches.push(rows.slice(i, i + 10));
    }
    const results = [];
    for (const batch of batches) {
      const res = await rateLimitedOperation(() => getBase()(tableKey).update(batch, { typecast: true }));
      results.push(...res);
      await new Promise(r => setTimeout(r, 200));
    }
    if (VERBOSE) {
      console.log(`[database.updateRows] ✅ Оновлено ${results.length} запис(и). IDs:`, results.map(r => r.id));
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

    // 1) Проста перевірка читання
    const page = await testBase('Users')
      .select({ maxRecords: 1 })  // без view, якщо можливо
      .firstPage();

    console.log('[database.testConnection] ✅ З\'єднання успішне!');
    console.log(`[database.testConnection] 📊 Таблиця Users: ${page.length > 0 ? 'містить записи' : 'порожня'}`);

    // 2) Перевірка, що поля ІСНУЮТЬ у схемі (через звернення в formula)
    const required = ['TG_id', 'User Name'];

    const assertFieldExists = async (fieldName) => {
      try {
        // Якщо поле не існує, Airtable поверне 422 (INVALID_FILTER_BY_FORMULA)
        await testBase('Users')
          .select({
            maxRecords: 1,
            filterByFormula: `OR({${fieldName}} = '', {${fieldName}} != '')`
          })
          .firstPage();
        return { field: fieldName, ok: true };
      } catch (err) {
        return { field: fieldName, ok: false, error: { message: err?.message, statusCode: err?.statusCode, type: err?.error?.type } };
      }
    };

    const checks = [];
    for (const f of required) {
      // eslint-disable-next-line no-await-in-loop
      const res = await assertFieldExists(f);
      checks.push(res);
    }

    const missing = checks.filter(c => !c.ok);
    if (missing.length) {
      console.error('[database.testConnection] ❌ Поля НЕ знайдено у схемі (або помилка формули):');
      missing.forEach(m => console.error(`  - ${m.field}: ${m.error?.type || m.error?.message || 'unknown'}`));
      return { success: false, error: 'required_fields_not_found', missing: missing.map(m => m.field) };
    }

    console.log('[database.testConnection] ✅ Поля існують у схемі: ', required);

    // 3) Додатково спробуємо знайти запис, де TG_id або User Name **заповнені**
    const withValues = await testBase('Users')
      .select({
        maxRecords: 1,
        filterByFormula: "OR({TG_id} != '', {User Name} != '')"
      })
      .firstPage();

    if (!withValues.length) {
      console.warn('[database.testConnection] ⚠️ У вибірці не знайшлось записів із TG_id або User Name. Ймовірно, поля існують, але або порожні, або поточна view фільтрує їх.');
    } else {
      console.log('[database.testConnection] ✅ Знайдено запис з TG_id/User Name заповненим.');
    }

    return { success: true, records: page.length, message: 'Ок' };
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
      console.error('❌ [database] Проблема з базою даних:', testResult.error);
      console.warn('⚠️ [database] Продовжуємо роботу, але функції бази можуть не працювати');
    }
  } catch (error) {
    console.error('❌ [database] Критична помилка ініціалізації:', error);
    console.warn('⚠️ [database] Продовжуємо роботу без тестування бази');
  }
};

initializeDatabase();

export default getBase();