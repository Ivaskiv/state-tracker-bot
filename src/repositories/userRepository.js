// src/repositories/userRepository.js - З ДЕТАЛЬНОЮ ДІАГНОСТИКОЮ

import { getBase, tables } from '../config/database.js';
import { USER_STATUS, SUBSCRIPTION_STATUS, ANSWER_STEPS } from '../config/constants.js';

const TABLE = 'USERS';

// Утиліта для форматування часу очікування
const formatWaitTime = (seconds) => {
  if (seconds < 60) return `${seconds} секунд`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} хвилин`;
};

// ===== READ =====
export const findByTgId = async (tgId) => {
  console.log(`[userRepo] Пошук користувача ${tgId}...`);
  
  try {
    const base = getBase();
    const startTime = Date.now();
    
    console.log('[userRepo] Відправка запиту до Airtable API...');
    
    const records = await base(tables.USERS)
      .select({
        filterByFormula: `{TG_id} = '${String(tgId)}'`,
        maxRecords: 1
      })
      .firstPage();
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (records.length > 0) {
      console.log(`[userRepo] Користувача знайдено за ${elapsed}с`);
      return records[0];
    } else {
      console.log(`[userRepo] Користувача НЕ знайдено (${elapsed}с)`);
      return null;
    }
    
  } catch (error) {
    const elapsed = Date.now() - (error.startTime || Date.now());
    
    console.error('\n========================================');
    console.error('ПОМИЛКА ПІДКЛЮЧЕННЯ ДО AIRTABLE');
    console.error('========================================');
    console.error(`Тип помилки: ${error.name || 'Unknown'}`);
    console.error(`Повідомлення: ${error.message}`);
    
    if (error.statusCode) {
      console.error(`HTTP Status: ${error.statusCode}`);
    }
    
    // Аналіз помилок
    if (error.message.includes('timeout') || error.name === 'TimeoutError') {
      console.error('\nПРИЧИНА: Airtable не відповідає (timeout)');
      console.error('ДІАГНОЗ: Rate limit блокування');
      console.error('\nЩО РОБИТИ:');
      console.error('1. Зупиніть бота (Ctrl+C)');
      console.error('2. Зачекайте 30-60 хвилин');
      console.error('3. Запустіть бота знову');
      console.error('\nАльтернатива:');
      console.error('- Перевірте API key: https://airtable.com/account');
      console.error('- Перевірте Base ID в .env файлі');
      
    } else if (error.statusCode === 429) {
      const retryAfter = error.headers?.['retry-after'] || 30;
      console.error(`\nПРИЧИНА: Rate limit перевищено (429 Too Many Requests)`);
      console.error(`ЧЕКАТИ: ${formatWaitTime(retryAfter)}`);
      console.error('\nЩО РОБИТИ:');
      console.error(`1. Зупиніть бота`);
      console.error(`2. Зачекайте ${formatWaitTime(retryAfter)}`);
      console.error(`3. Запустіть бота знову`);
      
    } else if (error.statusCode === 401) {
      console.error('\nПРИЧИНА: Невірний API ключ (401 Unauthorized)');
      console.error('ЩО РОБИТИ:');
      console.error('1. Перевірте AIRTABLE_API_KEY в .env файлі');
      console.error('2. Згенеруйте новий API key: https://airtable.com/account');
      
    } else if (error.statusCode === 404) {
      console.error('\nПРИЧИНА: База або таблиця не знайдена (404 Not Found)');
      console.error('ЩО РОБИТИ:');
      console.error('1. Перевірте AIRTABLE_BASE_ID в .env файлі');
      console.error('2. Перевірте що таблиця "Users" існує в базі');
      
    } else if (error.statusCode === 403) {
      console.error('\nПРИЧИНА: Немає доступу (403 Forbidden)');
      console.error('ЩО РОБИТИ:');
      console.error('1. Перевірте права доступу до бази');
      console.error('2. API key має мати права на читання таблиці Users');
      
    } else {
      console.error('\nПРИЧИНА: Невідома помилка');
      console.error('ЩО РОБИТИ:');
      console.error('1. Перевірте інтернет з\'єднання');
      console.error('2. Перевірте що Airtable доступний: https://status.airtable.com/');
      console.error('3. Спробуйте через 5 хвилин');
    }
    
    console.error('========================================\n');
    
    throw error;
  }
};

// ===== CREATE =====
export const createUser = async (tgId, name, timezone = 'Europe/Kiev (UTC+3)') => {
  const now = new Date().toISOString();
  
  console.log(`[userRepo] Створення користувача ${tgId}...`);
  
  const fields = {
    TG_id: String(tgId),
    'User Name': name,
    'Time Zone': timezone,
    UserRegistered: false,
    Status: USER_STATUS.NEW,
    'Subscription Status': SUBSCRIPTION_STATUS.NEW,
    Answer_Step: ANSWER_STEPS.OB_NAME,
    Created_At: now,
    Last_Activity: now
  };
  
  try {
    const base = getBase();
    const startTime = Date.now();
    
    const [record] = await base(tables.USERS).create(
      [{ fields }],
      { typecast: true }
    );
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[userRepo] Користувача створено за ${elapsed}с, ID: ${record.id}`);
    
    // Встановлюємо AT_id
    if (!record.fields.AT_id) {
      const [updated] = await base(tables.USERS).update([{
        id: record.id,
        fields: { AT_id: record.id }
      }]);
      console.log(`[userRepo] AT_id встановлено`);
      return updated;
    }
    
    return record;
    
  } catch (error) {
    console.error(`[userRepo] ПОМИЛКА створення користувача: ${error.message}`);
    throw error;
  }
};

// ===== UPDATE =====
export const updateUser = async (recordId, fields) => {
  console.log(`[userRepo] Оновлення користувача ${recordId}...`);
  
  try {
    const cleanFields = { ...fields };
    delete cleanFields['Active_Subscription_Status'];
    delete cleanFields['Last Modified Time'];
    cleanFields.Last_Activity = new Date().toISOString();
    
    const base = getBase();
    const startTime = Date.now();
    
    const [updated] = await base(tables.USERS).update([{
      id: recordId,
      fields: cleanFields
    }]);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[userRepo] Користувача оновлено за ${elapsed}с`);
    
    return updated;
    
  } catch (error) {
    console.error(`[userRepo] ПОМИЛКА оновлення: ${error.message}`);
    throw error;
  }
};

// ===== BULK READ =====
export const findActiveUsers = async () => {
  console.log(`[userRepo] Пошук активних користувачів...`);
  
  try {
    const base = getBase();
    
    const records = await base(tables.USERS)
      .select({
        filterByFormula: `FIND('✅ Активна', {Active_Subscription_Status}) > 0`
      })
      .all();
    
    console.log(`[userRepo] Знайдено ${records.length} активних користувачів`);
    return records;
    
  } catch (error) {
    console.error(`[userRepo] ПОМИЛКА пошуку активних: ${error.message}`);
    return [];
  }
};

export default {
  findByTgId,
  createUser,
  updateUser,
  findActiveUsers
};

console.log('[userRepo] Репозиторій користувачів ініціалізовано');