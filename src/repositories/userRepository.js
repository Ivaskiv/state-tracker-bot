// src/repositories/userRepository.js - ВИПРАВЛЕНО ФОРМАТ ДАТИ + ФОЛБЕК НАЗВ ПОЛІВ

import { getBase, tables } from '../config/database.js';
import { USER_STATUS, SUBSCRIPTION_STATUS, CURRENT_ACTIVITY } from '../config/constants.js';

const TABLE = 'USERS';

// формат ISO без мілісекунд
const getAirtableDate = () => new Date().toISOString().split('.')[0] + 'Z';

// видалити readonly/формульні поля
const stripReadonly = (fields) => {
  const f = { ...fields };
  ['AT_id', 'TG_id', 'Active_Subscription_Status', 'Last Modified Time'].forEach(k => delete f[k]);
  return f;
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
export const updateUser = async (recordId, fields) => {
  const base = getBase();
  const table = base(tables.USERS);
  const initial = stripReadonly(fields);

  // завжди оновлюємо Current_Activity
  initial.Current_Activity = getAirtableDate();

  const variants = buildVariants(initial);

  let lastErr = null;
  for (const candidate of variants) {
    try {
      const started = Date.now();
      const [updated] = await table.update([{ id: recordId, fields: candidate }], { typecast: true });
      const elapsed = ((Date.now() - started) / 1000).toFixed(2);
      console.log(`[userRepo] Користувача оновлено за ${elapsed}с`);
      return updated;
    } catch (e) {
      if (e?.statusCode === 422 && /Unknown field name/i.test(e?.message || '')) {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }

  // fallback: оновлюємо без Current_Activity
  try {
    const safe = { ...initial };
    delete safe.Current_Activity;
    delete safe['Current Activity'];
    delete safe['Answer Step'];

    if (Object.keys(safe).length === 0) {
      // нічого оновлювати — повертаємо запис
      return await table.find(recordId);
    }

    const started = Date.now();
    const [updated] = await table.update([{ id: recordId, fields: safe }], { typecast: true });
    const elapsed = ((Date.now() - started) / 1000).toFixed(2);
    console.log(`[userRepo] Користувача оновлено (без активності) за ${elapsed}с`);
    return updated;
  } catch (e) {
    throw lastErr || e;
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

// ===== CREATE =====
export const createUser = async (tgId, name, timezone = 'Europe/Kiev (UTC+3)') => {
  const now = getAirtableDate();
  console.log(`[userRepo] Створення користувача ${tgId}...`);

  const base = getBase();

  // Базові (безпечні) поля
  const baseFields = {
    TG_id: String(tgId),
    'User Name': name,
    'Time Zone': timezone,
    UserRegistered: false,
    Status: USER_STATUS.NEW,
    'Subscription Status': SUBSCRIPTION_STATUS.NEW,
    Created_At: now,
    Current_Activity: now,
    Current_Activity: CURRENT_ACTIVITY.IDLE
  };

  // Прагнемо зберегти початковий статус кроку, якщо в таблиці є поле Current_Activity
  const tryFields = [
    { ...baseFields, Current_Activity: CURRENT_ACTIVITY.OB_NAME }, // варіант 1: з Current_Activity
    { ...baseFields }                                     // варіант 2: без нього
  ];

  let lastErr = null;
  for (const fields of tryFields) {
    try {
      const started = Date.now();
      const [record] = await base(tables.USERS).create([{ fields }], { typecast: true });
      const elapsed = ((Date.now() - started) / 1000).toFixed(2);
      console.log(`[userRepo] Користувача створено за ${elapsed}с, ID: ${record.id}`);

      // Встановлюємо AT_id (зручно мати прямий ідентифікатор запису)
      if (!record.fields.AT_id) {
        const [updated] = await base(tables.USERS).update([{
          id: record.id,
          fields: { AT_id: record.id }
        }], { typecast: true });
        console.log(`[userRepo] AT_id встановлено`);
        return updated;
      }
      return record;
    } catch (e) {
      // Якщо невідоме поле (наприклад, Current_Activity), пробуємо наступний варіант без нього
      if (e?.statusCode === 422 && /Unknown field name/i.test(e?.message || '')) {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }

  // Якщо всі варіанти впали
  throw lastErr || new Error('Не вдалося створити користувача');
};

// ===== UPDATE =====


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
