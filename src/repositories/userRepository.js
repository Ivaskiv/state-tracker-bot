// src/repositories/userRepository.js - ДОДАЙ ІМПОРТ НА ПОЧАТКУ

import { getBase, tables } from '../config/database.js'; // ✅ ДОДАЙ ЦЕЙ РЯДОК
import { USER_STATUS, SUBSCRIPTION_STATUS, CURRENT_ACTIVITY } from '../config/constants.js';

const getAirtableDate = () => new Date().toISOString().split('.')[0] + 'Z';

const stripReadonly = (fields) => {
  const f = { ...fields };
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
    console.log(`[userRepo] Оновлено за ${elapsed}с, Current_Activity: ${updated.fields.Current_Activity}`);
    
    return updated;
  } catch (error) {
    console.error('[userRepo] ❌:', error.message);
    throw error;
  }
};

export const findByTgId = async (tgId) => {
  console.log(`[userRepo] Пошук користувача ${tgId}...`);
  const base = getBase();

  try {
    const records = await base(tables.USERS)
      .select({
        filterByFormula: `{TG_id} = '${String(tgId)}'`,
        maxRecords: 1
      })
      .firstPage();

    if (records.length > 0) {
      console.log(`[userRepo] Знайдено`);
      return records[0];
    }
    return null;
  } catch (error) {
    console.error('[userRepo] ❌:', error.message);
    throw error;
  }
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
    Current_Activity: CURRENT_ACTIVITY.IDLE
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

export const findActiveUsers = async () => {
  console.log(`[userRepo] Пошук активних користувачів...`);
  const base = getBase();

  try {
    const records = await base(tables.USERS)
      .select({
        filterByFormula: `FIND('✅ Активна', {Active_Subscription_Status}) > 0`
      })
      .all();

    console.log(`[userRepo] Знайдено ${records.length} активних`);
    return records;
  } catch (error) {
    console.error('[userRepo] ❌:', error.message);
    return [];
  }
};

export default {
  findByTgId,
  createUser,
  updateUser,
  findActiveUsers
};

console.log('[userRepo] Репозиторій ініціалізовано');