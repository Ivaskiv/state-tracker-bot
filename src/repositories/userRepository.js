// src/repositories/userRepository.js - ВИПРАВЛЕНО ФОРМАТ ДАТИ + ФОЛБЕК НАЗВ ПОЛІВ

import { getBase, tables } from '../config/database.js';
import { USER_STATUS, SUBSCRIPTION_STATUS, CURRENT_ACTIVITY } from '../config/constants.js';

const TABLE = 'USERS';

// формат ISO без мілісекунд
const getAirtableDate = () => new Date().toISOString().split('.')[0] + 'Z';

// видалити readonly/формульні поля
const stripReadonly = (fields) => {
  const f = { ...fields };
  // ✅ Answer_Step МОЖНА писати, Current_Activity в Responses
  ['AT_id', 'TG_id', 'Active_Subscription_Status', 'Last Modified Time'].forEach(k => delete f[k]);
  return f;
};

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
    console.error('[userRepo] ❌:', error.message);
    throw error;
  }
};
// повертає масив кандидатів для оновлення Current_Activity
const buildVariants = (fields) => {
  const variants = [fields];
  const names = ['Current_Activity', 'Current Activity', 'Answer Step'];
  names.forEach(name => {
    if (fields.Current_Activity) {
      const v = { ...fields, [name]: fields.Current_Activity };
      delete v.Current_Activity;
      variants.push(v);
    }
  });
  return variants;
};
export const createUser = async (tgId, name, timezone = 'Europe/Kiev (UTC+3)') => {
  const now = getAirtableDate();
  const base = getBase();

  const fields = {
    TG_id: String(tgId),
    'User Name': name,
    'Time Zone': timezone,
    UserRegistered: false,
    Status: USER_STATUS.NEW,
    'Subscription Status': SUBSCRIPTION_STATUS.NEW,
    Created_At: now,
    Last_Activity: now,
    Answer_Step: CURRENT_ACTIVITY.IDLE 
  };

  try {
    const [record] = await base(tables.USERS).create([{ fields }], { typecast: true });
    console.log(`[userRepo] Створено: ${record.id}`);
    return record;
  } catch (error) {
    console.error('[userRepo] ❌:', error.message);
    throw error;
  }
};
// ===== READ =====
export const findByTgId = async (tgId) => {
  console.log(`[userRepo] Пошук користувача ${tgId}...`);
  const base = getBase();
  const started = Date.now();

  try {
    console.log('[userRepo] Відправка запиту до Airtable API...');
    const records = await base(tables.USERS)
      .select({
        filterByFormula: `{TG_id} = '${String(tgId)}'`,
        maxRecords: 1
      })
      .firstPage();

    const elapsed = ((Date.now() - started) / 1000).toFixed(2);
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


// допоміжне: перейменувати ключ у клоні об’єкта
const withFieldRenamed = (fields, from, to) => {
  if (!(from in fields)) return null;
  const f = { ...fields };
  const val = f[from];
  delete f[from];
  f[to] = val;
  return f;
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
  withFieldRenamed,
  findActiveUsers
};

console.log('[userRepo] Репозиторій користувачів ініціалізовано');
