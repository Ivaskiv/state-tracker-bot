// src/config/database.js - ВИПРАВЛЕНО ПІДКЛЮЧЕННЯ ДО AIRTABLE

import Airtable from "airtable";
import dotenv from "dotenv";

dotenv.config();

// ✅ ПЕРЕВІРКА НАЯВНОСТІ ОБОВ'ЯЗКОВИХ ЗМІННИХ
if (!process.env.AIRTABLE_API_KEY) {
  console.error('❌ КРИТИЧНА ПОМИЛКА: AIRTABLE_API_KEY не встановлено в .env файлі!');
  process.exit(1);
}

if (!process.env.AIRTABLE_BASE_ID) {
  console.error('❌ КРИТИЧНА ПОМИЛКА: AIRTABLE_BASE_ID не встановлено в .env файлі!');
  process.exit(1);
}

// ✅ ЛОГУВАННЯ КОНФІГУРАЦІЇ (БЕЗ РОЗКРИТТЯ ПОВНОГО КЛЮЧА)
console.log('🔗 [database] Ініціалізація Airtable з\'єднання...');
console.log(`📋 [database] BASE_ID: ${process.env.AIRTABLE_BASE_ID}`);
console.log(`🔑 [database] API_KEY: ${process.env.AIRTABLE_API_KEY.substring(0, 10)}...`);

// ✅ СТВОРЕННЯ БАЗОВОГО З'ЄДНАННЯ
const base = new Airtable({ 
  apiKey: process.env.AIRTABLE_API_KEY,
  endpointUrl: 'https://api.airtable.com', // явно вказуємо endpoint
  requestTimeout: 5000 // 5 секунд timeout
}).base(process.env.AIRTABLE_BASE_ID);

// ✅ ФУНКЦІЯ ДЛЯ ОТРИМАННЯ БАЗОВОГО З'ЄДНАННЯ
export const getBase = () => {
  return new Airtable({ 
    apiKey: process.env.AIRTABLE_API_KEY,
    endpointUrl: 'https://api.airtable.com',
    requestTimeout: 5000
  }).base(process.env.AIRTABLE_BASE_ID);
};

// ✅ НАЗВИ ТАБЛИЦЬ ВІДПОВІДНО ДО AIRTABLE СХЕМИ
export const tables = Object.freeze({
  // Основні таблиці
  USERS: 'Users',
  SUBSCRIPTIONS: 'Subscriptions',
  
  // Таблиці відповідей
  RESPONSES: 'Responses', // Загальна таблиця відповідей
  USER_REFLECTIONS: 'User Reflections',
  MORNING_RESPONSES: 'Morning_Responses',
  EVENING_RESPONSES: 'Evening_Responses',
  
  // Афірмації
  AFFIRMATIONS: 'Affirmations',
  USER_AFFIRMATIONS: 'User Affirmations',
  
  // Звіти та аналітика
  USER_REPORTS: 'User Reports',
  
  // AI та цілі
  USER_GOALS: 'User_Goals',
  DAILY_MICRO_ACTIONS: 'Daily_Micro_Actions',
  AI_CONVERSATIONS: 'AI_Conversations',
  
  // Колесо балансу
  WHEEL_BALANCE: 'WheelBalance'
});

// ✅ ДОПОМІЖНІ ФУНКЦІЇ ДЛЯ РОБОТИ З ТАБЛИЦЯМИ
export const selectFromTable = (tableName, opts = {}) => {
  try {
    const tableKey = tables[tableName] || tableName;
    console.log(`[database.selectFromTable] Запит до таблиці: ${tableKey}`);
    return base(tableKey).select(opts);
  } catch (error) {
    console.error(`[database.selectFromTable] Помилка запиту до ${tableName}:`, error);
    throw error;
  }
};

export const createRows = (tableName, rows) => {
  try {
    const tableKey = tables[tableName] || tableName;
    console.log(`[database.createRows] Створення ${rows.length} записів в ${tableKey}`);
    
    // ✅ ДОДАЄМО typecast: true для всіх операцій створення
    return base(tableKey).create(rows, { 
      typecast: true  // Дозволяє створювати нові опції в Single Select полях
    });
  } catch (error) {
    console.error(`[database.createRows] Помилка створення в ${tableName}:`, error);
    throw error;
  }
};

export const updateRows = (tableName, rows) => {
  try {
    const tableKey = tables[tableName] || tableName;
    console.log(`[database.updateRows] Оновлення ${rows.length} записів в ${tableKey}`);
    
    return base(tableKey).update(rows, { 
      typecast: true  // Дозволяє створювати нові опції в Single Select полях
    });
  } catch (error) {
    console.error(`[database.updateRows] Помилка оновлення в ${tableName}:`, error);
    throw error;
  }
};

// ✅ ФУНКЦІЯ ТЕСТУВАННЯ З'ЄДНАННЯ
export const testConnection = async () => {
  try {
    console.log('[database.testConnection] 🧪 Тестування з\'єднання з Airtable...');
    
    // Спробуємо отримати 1 запис з таблиці Users
    const testBase = getBase();
    const records = await testBase('Users')
      .select({
        maxRecords: 1
      })
      .firstPage();
    
    console.log('[database.testConnection] ✅ З\'єднання успішне!');
    console.log(`[database.testConnection] 📊 Таблиця Users: ${records.length > 0 ? 'містить записи' : 'порожня'}`);
    
    if (records.length > 0) {
      const availableFields = Object.keys(records[0].fields);
      console.log('[database.testConnection] 🏷️ Доступні поля в Users:', availableFields);
      
      // Перевіряємо обов'язкові поля
      const requiredFields = ['TG_id', 'User Name'];
      const missingFields = requiredFields.filter(field => !availableFields.includes(field));
      
      if (missingFields.length > 0) {
        console.warn('[database.testConnection] ⚠️ Відсутні обов\'язкові поля:', missingFields);
        return { success: false, error: 'missing_required_fields', missingFields };
      } else {
        console.log('[database.testConnection] ✅ Всі обов\'язкові поля присутні');
      }
    }
    
    return { success: true, records: records.length, message: 'З\'єднання працює' };
    
  } catch (error) {
    console.error('[database.testConnection] ❌ Помилка з\'єднання:', {
      message: error.message,
      statusCode: error.statusCode,
      type: error.type
    });
    
    // Детальна діагностика помилок
    if (error.statusCode === 401) {
      console.error('[database.testConnection] 🔐 Невірний API ключ');
      return { success: false, error: 'invalid_api_key' };
    }
    
    if (error.statusCode === 404) {
      console.error('[database.testConnection] 📋 База або таблиця не знайдена');
      console.error('💡 Можливі причини:');
      console.error('   - Невірний AIRTABLE_BASE_ID');
      console.error('   - Таблиця "Users" не існує');
      console.error('   - Немає доступу до бази');
      return { success: false, error: 'not_found' };
    }
    
    if (error.statusCode === 403) {
      console.error('[database.testConnection] 🚫 Немає прав доступу');
      return { success: false, error: 'access_denied' };
    }
    
    return { success: false, error: error.message };
  }
};

// ✅ ІНІЦІАЛІЗАЦІЯ ТА ТЕСТУВАННЯ ПРИ ЗАПУСКУ
const initializeDatabase = async () => {
  console.log('🚀 [database] Ініціалізація бази даних...');
  
  try {
    const testResult = await testConnection();
    
    if (testResult.success) {
      console.log('✅ [database] База даних готова до роботи');
    } else {
      console.error('❌ [database] Проблема з базою даних:', testResult.error);
      
      // Не виходимо з процесу, але попереджаємо
      console.warn('⚠️ [database] Продовжуємо роботу, але функції бази можуть не працювати');
    }
  } catch (error) {
    console.error('❌ [database] Критична помилка ініціалізації:', error);
    console.warn('⚠️ [database] Продовжуємо роботу без тестування бази');
  }
};

// Запускаємо ініціалізацію
initializeDatabase();

// ✅ ЕКСПОРТ ДЛЯ ЗВОРОТНОЇ СУМІСНОСТІ
export default base;