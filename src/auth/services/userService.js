// src/auth/services/userService.js
// ВИПРАВЛЕНО: не пишемо computed-поля, гарантія створення/оновлення Users, trial=повний доступ

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

// Поля, які не можна писати (computed у Airtable)
const COMPUTED_FIELDS = new Set([
  'Active_Subscription_Status',
]);

// Видаляє computed-поля з payload перед create/update
const sanitizeWritableFields = (obj = {}) => {
  const out = { ...obj };
  for (const key of Object.keys(out)) {
    if (COMPUTED_FIELDS.has(key)) delete out[key];
  }
  return out;
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

// нормалізує поля і НЕ втрачає дані
const normalizeUserFields = (fields = {}) => ({
  ...fields,
  TG_id: String(fields?.TG_id ?? ''),
  'User Name': fields?.['User Name'] ?? '',
  'Time Zone': fields?.['Time Zone'] || fields?.TZ || '',
  'Subscription Status': fields?.['Subscription Status'] ?? 'New',
  'Active_Subscription_Status': fields?.['Active_Subscription_Status'] ?? '',
  Email: fields?.Email ?? '',
  Phone: fields?.Phone ?? '',
  UserRegistered: fields?.UserRegistered ?? false,
  Status: fields?.Status ?? 'New User',
  AT_id: fields?.AT_id ?? '' // якщо порожнє — доб’ємо recordId-ом
});

// мапа запису Airtable -> об’єкт { id, ...fields }, гарантовано проставляє AT_id = id (якщо порожньо)
const mapRecord = (rec) => {
  if (!rec) return null;
  const f = normalizeUserFields(rec.fields);
  if (!f.AT_id) f.AT_id = rec.id;
  return { id: rec.id, ...f };
};

const selectByTgId = async (base, tgId) => {
  const formula = `{TG_id} = '${String(tgId)}'`;
  if (VERBOSE) console.log(`[userService.selectByTgId] ▶️ filterByFormula: ${formula}`);
  return base(TABLE)
    .select({ filterByFormula: formula, maxRecords: 1 })
    .firstPage();
};

// ——— READ
const getActiveUsers = async () => {
  try {
    return await retryAirtableOperation(async () => {
      const base = getBase();
      const filter = "FIND('✅ Активна', {Active_Subscription_Status}) > 0";
      if (VERBOSE) console.log(`[getActiveUsers] filter: ${filter}`);
      const records = await base(TABLE).select({ filterByFormula: filter }).all();
      if (VERBOSE) console.log(`[getActiveUsers] Знайдено: ${records.length}`);
      return records.map(mapRecord);
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
        // добиваємо AT_id якщо пусте
        const rec = records[0];
        if (!rec.fields.AT_id) {
          try {
            await base(TABLE).update(rec.id, { AT_id: rec.id }, { typecast: true });
            rec.fields.AT_id = rec.id;
          } catch (e) {
            console.warn('[getUserByTelegramId] ⚠️ Не вдалося записати AT_id:', e?.message);
          }
        }
        return mapRecord(rec);
      }
      return null;
    }, 3, 800, 'getUserByTelegramId');
  } catch (error) {
    logErr('[getUserByTelegramId]', error);
    return null;
  }
};

// ——— UPDATE helpers
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
      const updated = await base(TABLE).update(records[0].id, { 
        Answer_Step: step,
        Last_Activity: new Date().toISOString()
      }, { typecast: true });
      console.log(`[updateUserStep] ✅ Оновлено для ${tgId}: ${step}`);
      return mapRecord(updated);
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
      const updated = await base(TABLE).update(records[0].id, { 
        Answer_Step: ANSWER_STEPS.COMPLETED,
        Last_Activity: new Date().toISOString()
      }, { typecast: true });
      console.log(`[updateUserActivity] ✅ COMPLETED для ${tgId}`);
      return mapRecord(updated);
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
      const updateFields = sanitizeWritableFields({ ...fields, Last_Activity: new Date().toISOString() });
      if (VERBOSE) {
        console.log('[updateUser] ▶️ Fields:', JSON.stringify(updateFields, null, 2));
        console.log('[updateUser] ▶️ Keys:', Object.keys(updateFields));
      }
      const updated = await base(TABLE).update(records[0].id, updateFields, { typecast: true });

      // гарантія: AT_id має бути записаний
      if (!updated.fields.AT_id) {
        try {
          const upd2 = await base(TABLE).update(records[0].id, { AT_id: records[0].id }, { typecast: true });
          updated.fields.AT_id = upd2.fields.AT_id || records[0].id;
        } catch (e) {
          console.warn('[updateUser] ⚠️ Не вдалося догрузити AT_id:', e?.message);
        }
      }

      console.log(`[updateUser] ✅ Оновлено ${tgId}`, Object.keys(updateFields));
      return mapRecord(updated);
    }, 3, 800, 'updateUser');
  } catch (error) {
    logErr('[updateUser]', error);
    return null;
  }
};

// ——— CREATE (онбординг)
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
        const rec = exists[0];
        if (!rec.fields.AT_id) {
          try { await base(TABLE).update(rec.id, { AT_id: rec.id }, { typecast: true }); }
          catch (e) { console.warn('[createUser] ⚠️ Не вдалося проставити AT_id існуючому:', e?.message); }
        }
        return mapRecord((await base(TABLE).find(rec.id)));
      }

      // 1) Підготовка даних
      const userData = {
        TG_id: String(tgId),
        'User Name': name || 'Користувач',
        UserRegistered: false,
        DateUserRegistered: null,
        Status: 'New User',
        'Subscription Status': registrationStatus, // 'New'
        // Active_Subscription_Status — НЕ ПИШЕМО (computed!)
        Answer_Step: ANSWER_STEPS.COMPLETED,
        Last_Activity: new Date().toISOString(),
        Created_At: new Date().toISOString()
      };
      if (email) userData.Email = email;
      if (phone) userData.Phone = phone;
      if (timezone) userData['Time Zone'] = timezone;

      if (VERBOSE) {
        console.log('[createUser] ▶️ Payload fields:', Object.keys(userData));
        console.log('[createUser] ▶️ Payload types:', Object.fromEntries(
          Object.entries(userData).map(([k, v]) => [k, typeof v])
        ));
        console.log('[createUser] ▶️ Payload full:', JSON.stringify(userData, null, 2));
      }

      const payload = sanitizeWritableFields(userData);

      // 3) Створення
      const records = await base(TABLE).create([{ fields: payload }], {
        typecast: true,
        returnFieldsByFieldId: false
      });

      const createdRecord = records[0];
      console.log(`[createUser] ✅ Створено запис ID: ${createdRecord.id}`);

      // проставляємо AT_id = record.id
      if (!createdRecord.fields.AT_id) {
        try {
          const upd = await base(TABLE).update(createdRecord.id, { AT_id: createdRecord.id }, { typecast: true });
          createdRecord.fields.AT_id = upd.fields.AT_id || createdRecord.id;
        } catch (e) {
          console.warn('[createUser] ⚠️ Не вдалося записати AT_id новому юзеру:', e?.message);
        }
      }

      return mapRecord(createdRecord);
    } catch (error) {
      logErr(`[createUser:attempt_${attempt}]`, error);

      if (error?.statusCode === 422 && error?.error?.type === 'INVALID_MULTIPLE_CHOICE_OPTIONS') {
        console.error('💡 Додай опції Single Select: Status → "New User"/"Registered User"; Subscription Status → "New"/"Active"/"Pending".');
      }

      if (attempt === maxRetries) throw error;
      await new Promise((r) => setTimeout(r, 700 * attempt));
    }
  }
};

// ——— ОНБОРДИНГ helpers
export const ensureNewUserStub = async (tgId) => {
  try {
    console.log(`[ensureNewUserStub] 🔰 Створення/перевірка користувача ${tgId}`);
    
    const base = getBase();
    const found = await selectByTgId(base, tgId);
    if (found.length) {
      const rec = found[0];
      if (!rec.fields.AT_id) {
        try { await base(TABLE).update(rec.id, { AT_id: rec.id }, { typecast: true }); }
        catch (e) { console.warn('[ensureNewUserStub] ⚠️ Не вдалося AT_id існуючому:', e?.message); }
      }
      console.log(`[ensureNewUserStub] ✅ Користувач ${tgId} вже існує`);
      return mapRecord((await base(TABLE).find(rec.id)));
    }

    const payload = sanitizeWritableFields({
      TG_id: String(tgId),
      Status: 'New User',
      'Subscription Status': 'New',
      // Active_Subscription_Status — НЕ пишемо
      Answer_Step: ANSWER_STEPS.COMPLETED,
      UserRegistered: false,
      Created_At: new Date().toISOString(),
      Last_Activity: new Date().toISOString()
    });

    const created = await base(TABLE).create([{ fields: payload }], { typecast: true });
    console.log(`[ensureNewUserStub] ✅ Створено користувача ${tgId}, ID: ${created[0].id}`);

    if (!created[0].fields.AT_id) {
      try { 
        const upd = await base(TABLE).update(created[0].id, { AT_id: created[0].id }, { typecast: true });
        created[0].fields.AT_id = upd.fields.AT_id || created[0].id;
      } catch (e) {
        console.warn('[ensureNewUserStub] ⚠️ Не вдалося проставити AT_id болванці:', e?.message);
      }
    }

    return mapRecord(created[0]);
  } catch (error) {
    logErr('[ensureNewUserStub]', error);
    throw error;
  }
};

export const finalizeRegistration = async (tgId, { name, email, phone, timezone }) => {
  try {
    console.log(`[finalizeRegistration] 🎯 Завершення реєстрації для ${tgId}`);
    
    const base = getBase();
    let recs = await selectByTgId(base, tgId);

    if (!recs.length) {
      console.log(`[finalizeRegistration] ⚠️ Користувача не знайдено, створюємо...`);
      await ensureNewUserStub(tgId);
      recs = await selectByTgId(base, tgId);
      if (!recs.length) throw new Error('Не вдалося створити/знайти запис користувача');
    }

    const id = recs[0].id;
    const fields = sanitizeWritableFields({
      'User Name': name,
      Email: email || null,
      Phone: phone || null,
      'Time Zone': timezone || 'Europe/Kyiv',
      UserRegistered: true,
      DateUserRegistered: new Date().toISOString(),
      Status: 'Registered User',
      Answer_Step: ANSWER_STEPS.COMPLETED,
      Last_Activity: new Date().toISOString(),
      AT_id: id
    });

    const updated = await base(TABLE).update(id, fields, { typecast: true });
    console.log(`[finalizeRegistration] ✅ Реєстрацію завершено для ${tgId}`);

    return mapRecord(updated);
  } catch (error) {
    logErr('[finalizeRegistration]', error);
    throw error;
  }
};

// src/auth/services/userService.js

const upsertUser = async (payload) => {
  // payload: { tgId, ...fieldsForAirtable }
  const { tgId, ...fields } = payload;

  // НІКОЛИ не намагаємось писати TG_id іншим користувачам
  // TG_id вже є в записі; якщо створюємо — createUser поставить TG_id сам
  const fieldsToWrite = { ...fields };

  const existing = await getUserByTelegramId(tgId);

  if (existing) {
    // ✅ Просто оновлюємо ВСІ передані поля
    return await updateUser(tgId, fieldsToWrite);
  }

  // ❗ Якщо користувача ще немає — спершу створимо мінімальний запис,
  // потім докинемо решту полів другим апдейтом (щоб дозволити довільні поля)
  const created = await createUser({
    tgId,
    name: fields['User Name'] || payload.name,
    email: fields.Email || payload.email,
    phone: fields.Phone || payload.phone,
    timezone: fields['Time Zone'] || payload.timezone,
    registrationStatus: fields['Subscription Status'] || payload.registrationStatus || 'New'
  });

  // Якщо нема додаткових полів — готово
  const extraKeys = Object.keys(fieldsToWrite).filter(
    k => !['User Name', 'Email', 'Phone', 'Time Zone', 'Subscription Status'].includes(k)
  );
  if (extraKeys.length === 0) return created;

  // ✅ Другим кроком — оновлюємо решту (в т.ч. 'Active Subscription Plan', 'Start_Date', 'End_Date', Answer_Step тощо)
  return await updateUser(tgId, fieldsToWrite);
};

// ——— BUSINESS HELPERS
const setRegistrationDone = async (tgId, timezone, name) => {
  return updateUser(tgId, sanitizeWritableFields({
    UserRegistered: true,
    DateUserRegistered: new Date().toISOString(),
    Status: 'Registered User',
    'User Name': name,
    'Time Zone': timezone
  }));
};

// trial = повний доступ — використовуємо у контролерах теж
export const hasActiveAccess = (user) => {
  if (!user) return false;
  const activeLine = String(user['Active_Subscription_Status'] || '');
  const subStatus  = String(user['Subscription Status'] || '');
  const plan       = String(user['Active Subscription Plan'] || '');
  const endIso     = user['End_Date'];

  if (activeLine.includes('✅ Активна')) return true;
  if (subStatus === 'Active') return true;

  // якщо план пробний/trial і дата ще не вийшла — це активка
  if (/пробн|trial/i.test(plan)) {
    try {
      const now = Date.now();
      const end = endIso ? Date.parse(endIso) : 0;
      if (end && end > now) return true;
    } catch {}
  }
  return false;
};

const checkSubscriptionStatus = async (tgId) => {
  const user = await getUserByTelegramId(tgId);
  if (!user) return { active: false, raw: 'Not Found' };
  
  if (hasActiveAccess(user)) {
    if (user['End_Date']) {
      const now = Date.now();
      const end = Date.parse(user['End_Date']);
      const actuallyActive = end > now;
      return {
        active: actuallyActive,
        raw: user['Active_Subscription_Status'] || user['Subscription Status'],
        expired: !actuallyActive,
        endDate: user['End_Date']
      };
    }
    return { active: true, raw: user['Active_Subscription_Status'] || user['Subscription Status'] };
  }

  return { active: false, raw: user['Active_Subscription_Status'] || user['Subscription Status'] || '' };
};

const getUsersWithExpiringSubscriptions = async (daysOffset) => {
  try {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysOffset);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    const base = getBase();
    const filter = `AND(
      FIND('✅ Активна', {Active_Subscription_Status}) > 0,
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
    return records.map(r => mapRecord(r));
  } catch (error) {
    logErr('[getUsersWithExpiringSubscriptions]', error);
    return [];
  }
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
  finalizeRegistration,
  hasActiveAccess
};
