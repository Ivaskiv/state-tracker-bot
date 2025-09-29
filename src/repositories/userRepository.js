// src/repositories/userRepository.js - ВИПРАВЛЕНО ФОРМАТ ДАТИ

import { getBase, tables } from '../config/database.js';
import { USER_STATUS, SUBSCRIPTION_STATUS, ANSWER_STEPS } from '../config/constants.js';

const TABLE = 'USERS';

// ✅ УТИЛІТА ДЛЯ ПРАВИЛЬНОГО ФОРМАТУ ДАТИ
const getAirtableDate = () => {
  return new Date().toISOString().split('.')[0] + 'Z'; // Видаляємо мілісекунди
};

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
    console.error('\n========================================');
    console.error('ПОМИЛКА ПІДКЛЮЧЕННЯ ДО AIRTABLE');
    console.error('========================================');
    console.error(`Тип помилки: ${error.name || 'Unknown'}`);
    console.error(`Повідомлення: ${error.message}`);
    console.error('========================================\n');
    
    throw error;
  }
};

// ===== CREATE =====
export const createUser = async (tgId, name, timezone = 'Europe/Kiev (UTC+3)') => {
  const now = getAirtableDate(); // ✅ ВИПРАВЛЕНИЙ ФОРМАТ
  
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
    
    // ✅ ВИДАЛЯЄМО READONLY ПОЛЯ
    delete cleanFields['Active_Subscription_Status'];
    delete cleanFields['Last Modified Time'];
    
    // ✅ ЗАВЖДИ ОНОВЛЮЄМО Last_Activity З ПРАВИЛЬНИМ ФОРМАТОМ
    cleanFields.Last_Activity = getAirtableDate();
    
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