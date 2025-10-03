// src/repositories/userRepository.js - ВИПРАВЛЕНО ФОРМАТ ДАТИ + ФОЛБЕК НАЗВ ПОЛІВ

import { getBase, tables } from '../config/database.js';
import { USER_STATUS, SUBSCRIPTION_STATUS, CURRENT_ACTIVITY } from '../config/constants.js';

const TABLE = 'USERS';

// ✅ ISO без мілісекунд (Airtable любить такий формат для Date/DateTime)
const getAirtableDate = () => new Date().toISOString().split('.')[0] + 'Z';

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
    Last_Activity: now,
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

// допоміжне: прибрати readonly/формульні
const stripReadonly = (fields) => {
  const clean = { ...fields };
  [
    'AT_id',
    'TG_id',
    'Active_Subscription_Status',
    'Last Modified Time'
  ].forEach((k) => delete clean[k]);
  return clean;
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

export const updateUser = async (recordId, fields) => {
  console.log(`[userRepo] Оновлення користувача ${recordId}...`);
  const base = getBase();
  const table = base(tables.USERS);

  // 1) очищаємо
  const initial = stripReadonly(fields);

  // 2) завжди оновлюємо Last_Activity у правильному форматі
  initial.Last_Activity = getAirtableDate();

  // 3) готуємо варіанти з фолбеком назв для поля активності
  const variants = [initial];

  if ('Current_Activity' in initial) {
    const v1 = withFieldRenamed(initial, 'Current_Activity', 'Current Activity');
    const v2 = withFieldRenamed(initial, 'Current_Activity', 'Current_Activity');
    const v3 = withFieldRenamed(initial, 'Current_Activity', 'Answer Step');
    [v1, v2, v3].forEach((v) => v && variants.push(v));
  }

  let lastErr = null;

  // 4) пробуємо варіанти з активністю
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

  // 5) якщо всі впали — оновлюємо без поля активності
  try {
    const safe = { ...initial };
    delete safe.Current_Activity;
    delete safe['Current Activity'];
    delete safe.Current_Activity;
    delete safe['Answer Step'];

    if (Object.keys(safe).length) {
      const started = Date.now();
      const [updated] = await table.update([{ id: recordId, fields: safe }], { typecast: true });
      const elapsed = ((Date.now() - started) / 1000).toFixed(2);
      console.log(`[userRepo] Користувача оновлено (без активності) за ${elapsed}с`);
      return updated;
    }

    // нічого оновлювати — повертаємо поточний запис
    return await table.find(recordId);
  } catch (e) {
    throw lastErr || e;
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
  findActiveUsers
};

console.log('[userRepo] Репозиторій користувачів ініціалізовано');
