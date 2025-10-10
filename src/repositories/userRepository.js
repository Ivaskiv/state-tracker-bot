// src/repositories/userRepository.js

import { getBase, tables } from '../config/database.js';
import { USER_STATUS, SUBSCRIPTION_STATUS, ANSWER_STEPS, CONFIG } from '../config/constants.js';

const TABLE = 'USERS';

// формат ISO без мілісекунд
const getAirtableDate = () => new Date().toISOString().split('.')[0] + 'Z';

// видалити readonly/формульні поля
const stripReadonly = (fields) => {
  const f = { ...fields };
  ['AT_id', 'TG_id', 'Active_Subscription_Status', 'Last Modified Time'].forEach(k => delete f[k]);
  return f;
};

// ===== UPDATE BY RECORD ID =====
export const updateUser = async (recordId, fields) => {
  const base = getBase();
  const table = base(tables.USERS);
  const clean = stripReadonly(fields);

  if (!clean.Last_Activity) {
    clean.Last_Activity = getAirtableDate();
  }

  try {
    const started = Date.now();
    const [updated] = await table.update([
      { id: recordId, fields: clean }
    ], { typecast: true });
    
    const elapsed = ((Date.now() - started) / 1000).toFixed(2);
    console.log(`[userRepo] Оновлено за ${elapsed}с, Answer_Step: ${updated.fields.Answer_Step || 'none'}`);
    
    return updated;
  } catch (error) {
    console.error('[userRepo] ❌ updateUser:', error.message);
    throw error;
  }
};

// ===== UPDATE BY TG_ID (спочатку знаходимо record, потім оновлюємо) =====
export const updateUserByTgId = async (tgId, fields) => {
  try {
    console.log(`[userRepo] Оновлення користувача ${tgId}...`);
    
    // Спочатку знаходимо запис
    const record = await findByTgId(tgId);
    
    if (!record) {
      throw new Error(`Користувача з TG_id ${tgId} не знайдено`);
    }
    
    // Потім оновлюємо за record.id
    return await updateUser(record.id, fields);
  } catch (error) {
    console.error(`[userRepo] ❌ updateUserByTgId: ${error.message}`);
    throw error;
  }
};

// ===== CREATE =====
export const createUser = async (tgId, name) => {
  const now = getAirtableDate();
  const base = getBase();

  const fields = {
    TG_id: String(tgId),
    'User Name': name,
    'Time Zone': CONFIG.DEFAULT_TIMEZONE,
    UserRegistered: false,
    Status: USER_STATUS.NEW,
    'Subscription_Status': SUBSCRIPTION_STATUS.NEW,
    Created_At: now,
    Last_Activity: now,
    Answer_Step: ANSWER_STEPS.OB_NAME // ✅ Одразу ставимо перший крок онбордингу
  };

  try {
    const [record] = await base(tables.USERS).create([{ fields }], { typecast: true });
    console.log(`[userRepo] ✅ Створено користувача: ${record.id}, Answer_Step: ${ANSWER_STEPS.OB_NAME}`);
    return record;
  } catch (error) {
    console.error('[userRepo] ❌ createUser:', error.message);
    throw error;
  }
};

// ===== READ =====
export const findByTgId = async (tgId) => {
  console.log(`[userRepo] Пошук користувача ${tgId}...`);
  const base = getBase();
  const started = Date.now();

  try {
    const records = await base(tables.USERS)
      .select({
        filterByFormula: `{TG_id} = '${String(tgId)}'`,
        maxRecords: 1
      })
      .firstPage();

    const elapsed = ((Date.now() - started) / 1000).toFixed(2);
    
    if (records.length > 0) {
      console.log(`[userRepo] ✅ Користувача знайдено за ${elapsed}с, Answer_Step: ${records[0].fields.Answer_Step || 'none'}`);
      return records[0];
    } else {
      console.log(`[userRepo] ⚠️ Користувача НЕ знайдено (${elapsed}с)`);
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

// ===== BULK READ =====
export const findActiveUsers = async () => {
  console.log(`[userRepo] Пошук активних користувачів...`);
  const base = getBase();

  try {
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
  updateUserByTgId, // ✅ ДОДАНО
  findActiveUsers
};

console.log('[userRepo] Репозиторій користувачів ініціалізовано');