import { getBase, tables } from '../../config/database.js';
import { ANSWER_STEPS } from '../../config/constants.js';
import NodeCache from 'node-cache';
import pTimeout from 'p-timeout';
import RateLimiter from 'async-ratelimiter';
import Redis from 'ioredis';

const userCache = new NodeCache({ stdTTL: 300, checkperiod: 60 }); // Кеш на 5 хвилин
const VERBOSE = process.env.AIRTABLE_VERBOSE === '1';
const TABLE = tables.USERS;

// Rate limiter: 5 запитів/сек (Airtable ліміт)
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const limiter = new RateLimiter({
  db: redis,
  max: 5, // 5 запитів
  duration: 1000, // за 1 секунду
});

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
const COMPUTED_FIELDS = new Set(['Active_Subscription_Status']);

// Видаляє computed-поля з payload перед create/update
const sanitizeWritableFields = (obj = {}) => {
  const out = { ...obj };
  for (const key of Object.keys(out)) {
    if (COMPUTED_FIELDS.has(key)) delete out[key];
  }
  return out;
};

// Функція для обмеження швидкості запитів
const rateLimitedOperation = async (operation, tag = 'op') => {
  try {
    await new Promise(r => setTimeout(r, 200)); 
    return await operation();
  } catch (error) {
    logErr(`[rateLimitedOperation:${tag}]`, error);
    throw error;
  }
};
const retryAirtableOperation = async (operation, maxRetries = 3, delay = 2000, tag = 'op') => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (VERBOSE) console.log(`[${tag}] ▶️ Спроба ${attempt}/${maxRetries}`);
      return await pTimeout(operation(), { milliseconds: 10000, message: `Timeout after 10s for ${tag}` });
    } catch (error) {
      logErr(`[${tag}] Спроба ${attempt} не вдалася`, error);
      if (attempt === maxRetries) throw error;
      await new Promise((r) => setTimeout(r, delay * attempt));
    }
  }
};

// Нормалізує поля і НЕ втрачає дані
const normalizeUserFields = (fields = {}) => ({
  ...fields,
  TG_id: String(fields?.TG_id ?? ''),
  'User Name': fields?.['User Name'] ?? '',
  'Time Zone': fields?.['Time Zone'] || fields?.TZ || 'Europe/Kyiv',
  'Subscription Status': fields?.['Subscription Status'] ?? 'New',
  'Active_Subscription_Status': fields?.['Active_Subscription_Status'] ?? '',
  Email: fields?.Email ?? '',
  Phone: fields?.Phone ?? '',
  UserRegistered: fields?.UserRegistered ?? false,
  Status: fields?.Status ?? 'New User',
  AT_id: fields?.AT_id ?? ''
});

// Мапа запису Airtable -> об’єкт { id, ...fields }
const mapRecord = (rec) => {
  if (!rec) return null;
  const f = normalizeUserFields(rec.fields);
  if (!f.AT_id) f.AT_id = rec.id;
  return { id: rec.id, ...f };
};

const selectByTgId = async (base, tgId) => {
  const formula = `{TG_id} = '${String(tgId)}'`;
  if (VERBOSE) console.log(`[userService.selectByTgId] ▶️ filterByFormula: ${formula}`);
  try {
    const records = await rateLimitedOperation(() => base(TABLE).select({ filterByFormula: formula, maxRecords: 1 }).firstPage(), 'selectByTgId');
    if (VERBOSE) console.log(`[userService.selectByTgId] Знайдено ${records.length} записів для TG_id=${tgId}`);
    return records;
  } catch (error) {
    logErr('[userService.selectByTgId]', error);
    throw error;
  }
};

// ——— READ
const getActiveUsers = async () => {
  try {
    return await retryAirtableOperation(async () => {
      const base = getBase();
      const filter = "FIND('✅ Активна', {Active_Subscription_Status}) > 0";
      if (VERBOSE) console.log(`[getActiveUsers] filter: ${filter}`);
      const records = await rateLimitedOperation(() => base(TABLE).select({ filterByFormula: filter }).all(), 'getActiveUsers');
      if (VERBOSE) console.log(`[getActiveUsers] Знайдено: ${records.length}`);
      return records.map(mapRecord);
    }, 3, 2000, 'getActiveUsers');
  } catch (error) {
    logErr('[getActiveUsers]', error);
    return [];
  }
};

const getUserByTelegramId = async (tgId) => {
  const cacheKey = `user_${tgId}`;
  let user = userCache.get(cacheKey);
  if (user) {
    if (VERBOSE) console.log(`[getUserByTelegramId] ✅ Кешовано для ${tgId}`);
    return user;
  }

  try {
    return await retryAirtableOperation(async () => {
      const base = getBase();
      const records = await selectByTgId(base, tgId);
      console.log(`[getUserByTelegramId] ${tgId} → знайдено ${records.length} запис(ів)`);
      if (records.length) {
        if (VERBOSE) console.log('[getUserByTelegramId] fields:', JSON.stringify(records[0].fields, null, 2));
        const rec = records[0];
        if (!rec.fields.AT_id) {
          try {
            await rateLimitedOperation(() => base(TABLE).update(rec.id, { AT_id: rec.id }, { typecast: true }), 'updateAT_id');
            rec.fields.AT_id = rec.id;
          } catch (e) {
            console.warn('[getUserByTelegramId] ⚠️ Не вдалося записати AT_id:', e?.message);
          }
        }
        user = mapRecord(rec);
        userCache.set(cacheKey, user);
        return user;
      }
      return null;
    }, 3, 2000, 'getUserByTelegramId');
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
        return null;
      }
      if (VERBOSE) console.log(`[updateUserStep] ▶️ Answer_Step=${step}`);
      const updated = await rateLimitedOperation(() => base(TABLE).update(records[0].id, { 
        Answer_Step: step,
        Last_Activity: new Date().toISOString()
      }, { typecast: true }), 'updateUserStep');
      console.log(`[updateUserStep] ✅ Оновлено для ${tgId}: ${step}`);
      userCache.del(cacheKey); // Інвалідуємо кеш
      return mapRecord(updated);
    }, 3, 2000, 'updateUserStep');
  } catch (error) {
    logErr('[updateUserStep]', error);
    return null;
  }
};

const updateUserActivity = async (tgId) => {
  try {
    return await retryAirtableOperation(async () => {
      const base = getBase();
      const records = await selectByTgId(base, tgId);
      if (!records.length) {
        console.warn(`[updateUserActivity] ⚠️ Юзера ${tgId} не знайдено`);
        return null;
      }
      const updated = await rateLimitedOperation(() => base(TABLE).update(records[0].id, { 
        Answer_Step: ANSWER_STEPS.COMPLETED,
        Last_Activity: new Date().toISOString()
      }, { typecast: true }), 'updateUserActivity');
      console.log(`[updateUserActivity] ✅ COMPLETED для ${tgId}`);
      userCache.del(`user_${tgId}`); // Інвалідуємо кеш
      return mapRecord(updated);
    }, 3, 2000, 'updateUserActivity');
  } catch (error) {
    logErr('[updateUserActivity]', error);
    return null;
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
      const updated = await rateLimitedOperation(() => base(TABLE).update(records[0].id, updateFields, { typecast: true }), 'updateUser');
      if (!updated.fields.AT_id) {
        try {
          const upd2 = await rateLimitedOperation(() => base(TABLE).update(records[0].id, { AT_id: records[0].id }, { typecast: true }), 'updateAT_id');
          updated.fields.AT_id = upd2.fields.AT_id || records[0].id;
        } catch (e) {
          console.warn('[updateUser] ⚠️ Не вдалося догрузити AT_id:', e?.message);
        }
      }
      console.log(`[updateUser] ✅ Оновлено ${tgId}`, Object.keys(updateFields));
      userCache.del(`user_${tgId}`); // Інвалідуємо кеш
      return mapRecord(updated);
    }, 3, 2000, 'updateUser');
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
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[createUser] 🆕 СПРОБА ${attempt}/${maxRetries} створення користувача ${tgId}`);
      const base = getBase();
      const exists = await selectByTgId(base, tgId);
      if (exists.length) {
        console.warn('[createUser] ⚠️ Запис з таким TG_id вже існує → повертаю існуючого');
        const rec = exists[0];
        if (!rec.fields.AT_id) {
          try {
            await rateLimitedOperation(() => base(TABLE).update(rec.id, { AT_id: rec.id }, { typecast: true }), 'updateAT_id');
          } catch (e) {
            console.warn('[createUser] ⚠️ Не вдалося проставити AT_id існуючому:', e?.message);
          }
        }
        return mapRecord(await base(TABLE).find(rec.id));
      }
      const userData = {
        TG_id: String(tgId),
        'User Name': name || 'Користувач',
        UserRegistered: false,
        DateUserRegistered: null,
        Status: 'New User',
        'Subscription Status': registrationStatus,
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
      }
      const payload = sanitizeWritableFields(userData);
      const records = await rateLimitedOperation(() => base(TABLE).create([{ fields: payload }], { typecast: true }), 'createUser');
      const createdRecord = records[0];
      console.log(`[createUser] ✅ Створено запис ID: ${createdRecord.id}`);
      if (!createdRecord.fields.AT_id) {
        try {
          const upd = await rateLimitedOperation(() => base(TABLE).update(createdRecord.id, { AT_id: createdRecord.id }, { typecast: true }), 'updateAT_id');
          createdRecord.fields.AT_id = upd.fields.AT_id || createdRecord.id;
        } catch (e) {
          console.warn('[createUser] ⚠️ Не вдалося записати AT_id новому юзеру:', e?.message);
        }
      }
      userCache.set(`user_${tgId}`, mapRecord(createdRecord));
      return mapRecord(createdRecord);
    } catch (error) {
      logErr(`[createUser:attempt_${attempt}]`, error);
      if (error?.statusCode === 422 && error?.error?.type === 'INVALID_MULTIPLE_CHOICE_OPTIONS') {
        console.error('💡 Додай опції Single Select: Status → "New User"/"Registered User"; Subscription Status → "New"/"Active"/"Pending".');
      }
      if (attempt === maxRetries) throw error;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
};

// ——— ОНБОРДИНГ helpers
const ensureNewUserStub = async (tgId) => {
  try {
    console.log(`[ensureNewUserStub] 🔰 Створення/перевірка користувача ${tgId}`);
    const base = getBase();
    const found = await selectByTgId(base, tgId);
    if (found.length) {
      const rec = found[0];
      if (!rec.fields.AT_id) {
        try {
          await rateLimitedOperation(() => base(TABLE).update(rec.id, { AT_id: rec.id }, { typecast: true }), 'updateAT_id');
        } catch (e) {
          console.warn('[ensureNewUserStub] ⚠️ Не вдалося AT_id існуючому:', e?.message);
        }
      }
      console.log(`[ensureNewUserStub] ✅ Користувач ${tgId} вже існує`);
      const user = mapRecord(await base(TABLE).find(rec.id));
      userCache.set(`user_${tgId}`, user);
      return user;
    }
    const payload = sanitizeWritableFields({
      TG_id: String(tgId),
      Status: 'New User',
      'Subscription Status': 'New',
      Answer_Step: ANSWER_STEPS.COMPLETED,
      UserRegistered: false,
      Created_At: new Date().toISOString(),
      Last_Activity: new Date().toISOString()
    });
    const created = await rateLimitedOperation(() => base(TABLE).create([{ fields: payload }], { typecast: true }), 'createUserStub');
    console.log(`[ensureNewUserStub] ✅ Створено користувача ${tgId}, ID: ${created[0].id}`);
    if (!created[0].fields.AT_id) {
      try {
        const upd = await rateLimitedOperation(() => base(TABLE).update(created[0].id, { AT_id: created[0].id }, { typecast: true }), 'updateAT_id');
        created[0].fields.AT_id = upd.fields.AT_id || created[0].id;
      } catch (e) {
        console.warn('[ensureNewUserStub] ⚠️ Не вдалося проставити AT_id болванці:', e?.message);
      }
    }
    const user = mapRecord(created[0]);
    userCache.set(`user_${tgId}`, user);
    return user;
  } catch (error) {
    logErr('[ensureNewUserStub]', error);
    throw error;
  }
};

const finalizeRegistration = async (tgId, { name, email, phone, timezone }) => {
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
    const updated = await rateLimitedOperation(() => base(TABLE).update(id, fields, { typecast: true }), 'finalizeRegistration');
    console.log(`[finalizeRegistration] ✅ Реєстрацію завершено для ${tgId}`);
    userCache.del(`user_${tgId}`); // Інвалідуємо кеш
    return mapRecord(updated);
  } catch (error) {
    logErr('[finalizeRegistration]', error);
    throw error;
  }
};

const upsertUser = async (payload) => {
  const { tgId, ...fields } = payload;
  const fieldsToWrite = { ...fields };
  const existing = await getUserByTelegramId(tgId);
  if (existing) {
    return await updateUser(tgId, fieldsToWrite);
  }
  const created = await createUser({
    tgId,
    name: fields['User Name'] || payload.name,
    email: fields.Email || payload.email,
    phone: fields.Phone || payload.phone,
    timezone: fields['Time Zone'] || payload.timezone,
    registrationStatus: fields['Subscription Status'] || payload.registrationStatus || 'New'
  });
  const extraKeys = Object.keys(fieldsToWrite).filter(
    k => !['User Name', 'Email', 'Phone', 'Time Zone', 'Subscription Status'].includes(k)
  );
  if (extraKeys.length === 0) return created;
  return await updateUser(tgId, fieldsToWrite);
};

const setRegistrationDone = async (tgId, timezone, name) => {
  return updateUser(tgId, sanitizeWritableFields({
    UserRegistered: true,
    DateUserRegistered: new Date().toISOString(),
    Status: 'Registered User',
    'User Name': name,
    'Time Zone': timezone
  }));
};

export const hasActiveAccess = (user) => {
  if (!user) return false;
  const activeLine = String(user['Active_Subscription_Status'] || '');
  const subStatus = String(user['Subscription Status'] || '');
  const plan = String(user['Active Subscription Plan'] || '');
  const endIso = user['End_Date'];
  if (activeLine.includes('✅ Активна')) return true;
  if (subStatus === 'Active') return true;
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
    const records = await rateLimitedOperation(() => base(TABLE).select({
      filterByFormula: filter,
      fields: ['TG_id', 'User Name', 'Active Subscription Plan', 'End_Date']
    }).all(), 'getUsersWithExpiringSubscriptions');
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