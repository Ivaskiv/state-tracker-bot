// src/auth/services/userService.js - МАКСИМАЛЬНІ ЛОГИ

import { getBase } from '../../config/database.js';
import { ANSWER_STEPS } from '../../config/constants.js';

const VERBOSE = process.env.AIRTABLE_VERBOSE === '1';
const TABLE = 'Users';

const logErr = (prefix, error) => {
  const payload = {
    message: error?.message,
    statusCode: error?.statusCode,
    type: error?.error?.type,
    requestId: error?.error?.requestId,
    details: error?.error
  };
  console.error(`${prefix} ❌`, JSON.stringify(payload, null, 2));
};

const retryAirtableOperation = async (operation, maxRetries = 3, delay = 1000, tag='op') => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (VERBOSE) console.log(`[${tag}] ▶️ Спроба ${attempt}/${maxRetries}`);
      return await operation();
    } catch (error) {
      logErr(`[${tag}]`, error);
      if (attempt === maxRetries) throw error;
      await new Promise((r) => setTimeout(r, delay * attempt));
    }
  }
};

const normalizeUserFields = (fields) => ({
  ...fields,
  TG_id: String(fields?.TG_id ?? ''),
  'User Name': fields?.['User Name'] ?? '',
  'Time Zone': fields?.['Time Zone'] || fields?.TZ || '',
  'Subscription Status': fields?.['Subscription Status'] ?? 'New',
  'Active_Subscription_Status': fields?.['Active_Subscription_Status'] ?? ''
});

const selectByTgId = async (base, tgId) => {
  const formula = `{TG_id} = '${String(tgId)}'`;
  if (VERBOSE) console.log(`[userService.selectByTgId] ▶️ filterByFormula: ${formula}`);
  return base(TABLE)
    .select({ filterByFormula: formula, maxRecords: 1 })
    .firstPage();
};

// READ
const getActiveUsers = async () => {
  try {
    return await retryAirtableOperation(async () => {
      const base = getBase();
      const filter = "FIND('✅ Активна', {Active_Subscription_Status}) > 0";
      if (VERBOSE) console.log(`[getActiveUsers] filter: ${filter}`);
      const records = await base(TABLE).select({ filterByFormula: filter }).all();
      if (VERBOSE) console.log(`[getActiveUsers] Знайдено: ${records.length}`);
      return records.map((r) => normalizeUserFields(r.fields));
    }, 3, 800, 'getActiveUsers');
  } catch (error) {
    logErr('[getActiveUsers]', error);
    return [];
  }
};

const getUserByTelegramId = async (tgId) => {
  try {
    return await retryAirtableOperation(async () => {
      const base = getBase();
      const records = await selectByTgId(base, tgId);
      console.log(`[getUserByTelegramId] ${tgId} → знайдено ${records.length} запис(ів)`);
      if (records.length) {
        if (VERBOSE) console.log('[getUserByTelegramId] fields:', JSON.stringify(records[0].fields, null, 2));
      }
      return records.length > 0 ? normalizeUserFields(records[0].fields) : null;
    }, 3, 800, 'getUserByTelegramId');
  } catch (error) {
    logErr('[getUserByTelegramId]', error);
    return null;
  }
};

// UPDATE
const updateUserStep = async (tgId, step) => {
  try {
    return await retryAirtableOperation(async () => {
      const base = getBase();
      const records = await selectByTgId(base, tgId);
      if (!records.length) {
        console.warn(`[updateUserStep] ⚠️ Юзера ${tgId} не знайдено`);
        return;
      }
      if (VERBOSE) console.log(`[updateUserStep] ▶️ Answer_Step=${step}`);
      await base(TABLE).update(records[0].id, { 
        Answer_Step: step,
        Last_Activity: new Date().toISOString()
      }, { typecast: true });
      console.log(`[updateUserStep] ✅ Оновлено для ${tgId}: ${step}`);
    }, 3, 800, 'updateUserStep');
  } catch (error) {
    logErr('[updateUserStep]', error);
  }
};

const updateUserActivity = async (tgId) => {
  try {
    return await retryAirtableOperation(async () => {
      const base = getBase();
      const records = await selectByTgId(base, tgId);
      if (!records.length) {
        console.warn(`[updateUserActivity] ⚠️ Юзера ${tgId} не знайдено`);
        return;
      }
      await base(TABLE).update(records[0].id, { 
        Answer_Step: ANSWER_STEPS.COMPLETED,
        Last_Activity: new Date().toISOString()
      }, { typecast: true });
      console.log(`[updateUserActivity] ✅ COMPLETED для ${tgId}`);
    }, 3, 800, 'updateUserActivity');
  } catch (error) {
    logErr('[updateUserActivity]', error);
  }
};

const updateUser = async (tgId, fields) => {
  if (!fields || typeof fields !== 'object') return null;
  try {
    return await retryAirtableOperation(async () => {
      const base = getBase();
      const records = await selectByTgId(base, tgId);
      if (!records.length) {
        console.warn(`[updateUser] ⚠️ Юзера ${tgId} не знайдено`);
        return null;
      }
      const updateFields = { ...fields, Last_Activity: new Date().toISOString() };
      if (VERBOSE) {
        console.log('[updateUser] ▶️ Fields:', JSON.stringify(updateFields, null, 2));
        console.log('[updateUser] ▶️ Keys:', Object.keys(updateFields));
      }
      const updated = await base(TABLE).update(records[0].id, updateFields, { typecast: true });
      console.log(`[updateUser] ✅ Оновлено ${tgId}`);
      return normalizeUserFields(updated.fields);
    }, 3, 800, 'updateUser');
  } catch (error) {
    logErr('[updateUser]', error);
    return null;
  }
};

// CREATE (з антидублем і тотальними логами)
const createUser = async ({
  tgId,
  name,
  email,
  phone,
  timezone,
  registrationStatus = 'New'
}) => {
  const maxRetries = 5;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`\n[userService.createUser] 🆕 СПРОБА ${attempt}/${maxRetries} створення користувача ${tgId}`);

      const base = getBase();

      // 0) Перевірка дубля
      const exists = await selectByTgId(base, tgId);
      if (exists.length) {
        console.warn('[createUser] ⚠️ Запис з таким TG_id вже існує → повертаю існуючого');
        return normalizeUserFields(exists[0].fields);
      }

      // 1) Підготовка даних
      const userData = {
        TG_id: String(tgId),
        'User Name': name || 'Користувач',
        UserRegistered: false,
        DateUserRegistered: null,
        Status: 'New User',
        'Subscription Status': registrationStatus,
        Active_Subscription_Status: '❌ Немає активної підписки',
        Answer_Step: ANSWER_STEPS.COMPLETED,
        Last_Activity: new Date().toISOString(),
        Created_At: new Date().toISOString()
      };
      if (email) userData.Email = email;
      if (phone) userData.Phone = phone;
      if (timezone) userData['Time Zone'] = timezone;

      // 2) Діагностика payload
      if (VERBOSE) {
        console.log('[createUser] ▶️ Payload fields:', Object.keys(userData));
        console.log('[createUser] ▶️ Payload types:', Object.fromEntries(
          Object.entries(userData).map(([k, v]) => [k, typeof v])
        ));
        console.log('[createUser] ▶️ Payload full:', JSON.stringify(userData, null, 2));
      }

      // 3) Створення
      const records = await base(TABLE).create([{ fields: userData }], {
        typecast: true,
        returnFieldsByFieldId: false
      });

      const createdRecord = records[0];
      console.log(`[createUser] ✅ Створено запис ID: ${createdRecord.id}`);
      if (VERBOSE) console.log('[createUser] ✅ Fields:', JSON.stringify(createdRecord.fields, null, 2));

      return normalizeUserFields(createdRecord.fields);
    } catch (error) {
      logErr(`[createUser:attempt_${attempt}]`, error);

      // підказки
      if (error?.statusCode === 422 && error?.error?.type === 'INVALID_MULTIPLE_CHOICE_OPTIONS') {
        console.error('💡 Додай опції Single Select: Status → "New User"/"Registered User"; Subscription Status → "New"/"Active"/"Pending".');
      }

      if (attempt === maxRetries) throw error;
      await new Promise((r) => setTimeout(r, 700 * attempt));
    }
  }
};

const upsertUser = async (payload) => {
  const existing = await getUserByTelegramId(payload.tgId);
  if (existing) {
    if (VERBOSE) console.log('[upsertUser] ▶️ існує → update');
    return await updateUser(payload.tgId, {
      'User Name': payload.name ?? existing['User Name'],
      Email: payload.email ?? existing.Email,
      Phone: payload.phone ?? existing.Phone,
      'Time Zone': payload.timezone ?? existing['Time Zone']
    });
  }
  if (VERBOSE) console.log('[upsertUser] ▶️ не існує → create');
  return await createUser(payload);
};

// BUSINESS HELPERS
const setRegistrationDone = async (tgId, timezone, name) => {
  return updateUser(tgId, {
    UserRegistered: true,
    DateUserRegistered: new Date().toISOString(),
    Status: 'Registered User',
    'User Name': name,
    'Time Zone': timezone
  });
};

const checkSubscriptionStatus = async (tgId) => {
  const user = await getUserByTelegramId(tgId);
  const status = user?.['Subscription Status'] || 'New';
  const active = status === 'Active';
  return { active, raw: status };
};

const getUsersWithExpiringSubscriptions = async (daysOffset) => {
  try {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysOffset);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    const base = getBase();
    const filter = `AND(
      {Subscription Status} = 'Active',
      DATESTR({End_Date}) = '${targetDateStr}'
    )`;
    if (VERBOSE) console.log(`[getUsersWithExpiringSubscriptions] filter: ${filter}`);

    const records = await base(TABLE)
      .select({
        filterByFormula: filter,
        fields: ['TG_id', 'User Name', 'Active Subscription Plan', 'End_Date']
      })
      .all();

    if (VERBOSE) console.log(`[getUsersWithExpiringSubscriptions] знайдено: ${records.length}`);
    return records.map(r => r.fields);
  } catch (error) {
    logErr('[getUsersWithExpiringSubscriptions]', error);
    return [];
  }
};
// ДОДАЙ у src/auth/services/userService.js
export const ensureNewUserStub = async (tgId) => {
  const base = getBase();
  // 0) шукаємо — може вже є
  const found = await base('Users')
    .select({ filterByFormula: `{TG_id} = '${String(tgId)}'`, maxRecords: 1 })
    .firstPage();

  if (found.length) {
    return found[0].fields; // вже існує
  }

  // 1) створюємо мінімальний запис, щоб з’явився у "Subscribers - New Users"
  const payload = {
    TG_id: String(tgId),
    Status: 'New User',                 // ⟵ ключове для в’юхи "New Users"
    'Subscription Status': 'New',
    Active_Subscription_Status: '❌ Немає активної підписки',
    Answer_Step: 'reg_name',            // зручно тримати крок
    Created_At: new Date().toISOString(),
    Last_Activity: new Date().toISOString()
  };

  const created = await base('Users').create([{ fields: payload }], { typecast: true });
  return created[0].fields;
};

// ДОДАЙ у src/auth/services/userService.js
export const finalizeRegistration = async (tgId, { name, email, phone, timezone }) => {
  const base = getBase();
  const recs = await base('Users')
    .select({ filterByFormula: `{TG_id} = '${String(tgId)}'`, maxRecords: 1 })
    .firstPage();

  if (!recs.length) {
    // якщо з якоїсь причини не було “болванки” — створимо
    await ensureNewUserStub(tgId);
    // і знову знайдемо
    const recs2 = await base('Users')
      .select({ filterByFormula: `{TG_id} = '${String(tgId)}'`, maxRecords: 1 })
      .firstPage();
    if (!recs2.length) throw new Error('Не вдалося створити/знайти запис користувача');
    recs[0] = recs2[0];
  }

  const fields = {
    'User Name': name,
    Email: email || null,
    Phone: phone || null,
    'Time Zone': timezone || null,
    UserRegistered: true,
    DateUserRegistered: new Date().toISOString(),
    Status: 'Registered User',               // ⟵ ключове для "Subscribers - Form Submited"
    Answer_Step: 'completed',
    Last_Activity: new Date().toISOString()
  };

  await base('Users').update(recs[0].id, fields, { typecast: true });
  return { id: recs[0].id, ...recs[0].fields, ...fields };
};


export default {
  getActiveUsers,
  getUserByTelegramId,
  updateUserStep,
  updateUserActivity,
  updateUser,
  createUser,
  upsertUser,
  setRegistrationDone,
  checkSubscriptionStatus,
  getUsersWithExpiringSubscriptions,
  ensureNewUserStub,
  finalizeRegistration
};
