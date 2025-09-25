// src/auth/services/userService.js - ЧИСТИЙ БЕЗ REDIS

import { getBase, tables } from '../../config/database.js';
import { ANSWER_STEPS } from '../../config/constants.js';
import NodeCache from 'node-cache';
import pTimeout from 'p-timeout';

// Простий кеш в пам'яті
const userCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
const VERBOSE = process.env.AIRTABLE_VERBOSE === '1';
const TABLE = tables.USERS;

const logErr = (prefix, error) => {
  const payload = {
    message: error?.message,
    statusCode: error?.statusCode,
    type: error?.error?.type,
    requestId: error?.error?.requestId
  };
  console.error(`${prefix} ❌`, JSON.stringify(payload, null, 2));
};

// Поля які не можна писати
const COMPUTED_FIELDS = new Set(['Active_Subscription_Status']);

const sanitizeWritableFields = (obj = {}) => {
  const out = { ...obj };
  for (const key of Object.keys(out)) {
    if (COMPUTED_FIELDS.has(key)) delete out[key];
  }
  return out;
};

// Простий rate limiter без Redis
let requestTimes = [];
const RATE_LIMIT_WINDOW = 1000; // 1 секунда
const MAX_REQUESTS_PER_SECOND = 5;

const simpleRateLimit = async () => {
  const now = Date.now();
  // Очищуємо старі запити
  requestTimes = requestTimes.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (requestTimes.length >= MAX_REQUESTS_PER_SECOND) {
    const waitTime = 200; // Чекаємо 200ms
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  requestTimes.push(now);
};

const rateLimitedOperation = async (operation, tag = 'op') => {
  try {
    await simpleRateLimit();
    return await operation();
  } catch (error) {
    logErr(`[rateLimitedOperation:${tag}]`, error);
    throw error;
  }
};

const retryAirtableOperation = async (operation, maxRetries = 3, delay = 2000, tag = 'op') => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (VERBOSE) console.log(`[${tag}] Спроба ${attempt}/${maxRetries}`);
      return await pTimeout(operation(), { milliseconds: 10000, message: `Timeout ${tag}` });
    } catch (error) {
      logErr(`[${tag}] Спроба ${attempt} не вдалася`, error);
      if (attempt === maxRetries) throw error;
      await new Promise((r) => setTimeout(r, delay * attempt));
    }
  }
};

// Нормалізація полів
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

const mapRecord = (rec) => {
  if (!rec) return null;
  const f = normalizeUserFields(rec.fields);
  if (!f.AT_id) f.AT_id = rec.id;
  return { id: rec.id, ...f };
};

const selectByTgId = async (base, tgId) => {
  const formula = `{TG_id} = '${String(tgId)}'`;
  if (VERBOSE) console.log(`[selectByTgId] formula: ${formula}`);
  try {
    const records = await rateLimitedOperation(() => 
      base(TABLE).select({ filterByFormula: formula, maxRecords: 1 }).firstPage(),
      'selectByTgId'
    );
    if (VERBOSE) console.log(`[selectByTgId] Знайдено ${records.length} для TG_id=${tgId}`);
    return records;
  } catch (error) {
    logErr('[selectByTgId]', error);
    throw error;
  }
};

// READ операції
const getActiveUsers = async () => {
  try {
    return await retryAirtableOperation(async () => {
      const base = getBase();
      const filter = "FIND('✅ Активна', {Active_Subscription_Status}) > 0";
      if (VERBOSE) console.log(`[getActiveUsers] filter: ${filter}`);
      const records = await rateLimitedOperation(() => 
        base(TABLE).select({ filterByFormula: filter }).all(),
        'getActiveUsers'
      );
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
    if (VERBOSE) console.log(`[getUserByTelegramId] ✅ Кеш для ${tgId}`);
    return user;
  }

  try {
    return await retryAirtableOperation(async () => {
      const base = getBase();
      const records = await selectByTgId(base, tgId);
      console.log(`[getUserByTelegramId] ${tgId} → ${records.length} запис(ів)`);
      if (records.length) {
        if (VERBOSE) console.log('[getUserByTelegramId] fields:', JSON.stringify(records[0].fields, null, 2));
        const rec = records[0];
        if (!rec.fields.AT_id) {
          try {
            await rateLimitedOperation(() => 
              base(TABLE).update(rec.id, { AT_id: rec.id }, { typecast: true }),
              'updateAT_id'
            );
            rec.fields.AT_id = rec.id;
          } catch (e) {
            console.warn('[getUserByTelegramId] Не вдалося AT_id:', e?.message);
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

// UPDATE операції
const updateUserStep = async (tgId, step) => {
  try {
    return await retryAirtableOperation(async () => {
      const base = getBase();
      const records = await selectByTgId(base, tgId);
      if (!records.length) {
        console.warn(`[updateUserStep] Юзера ${tgId} не знайдено`);
        return null;
      }
      if (VERBOSE) console.log(`[updateUserStep] Answer_Step=${step}`);
      const updated = await rateLimitedOperation(() => 
        base(TABLE).update(records[0].id, { 
          Answer_Step: step,
          Last_Activity: new Date().toISOString()
        }, { typecast: true }),
        'updateUserStep'
      );
      console.log(`[updateUserStep] ✅ Оновлено для ${tgId}: ${step}`);
      userCache.del(`user_${tgId}`);
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
        console.warn(`[updateUserActivity] Юзера ${tgId} не знайдено`);
        return null;
      }
      const updated = await rateLimitedOperation(() => 
        base(TABLE).update(records[0].id, { 
          Answer_Step: ANSWER_STEPS.COMPLETED,
          Last_Activity: new Date().toISOString()
        }, { typecast: true }),
        'updateUserActivity'
      );
      console.log(`[updateUserActivity] ✅ COMPLETED для ${tgId}`);
      userCache.del(`user_${tgId}`);
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
        console.warn(`[updateUser] Юзера ${tgId} не знайдено`);
        return null;
      }
      const updateFields = sanitizeWritableFields({ 
        ...fields, 
        Last_Activity: new Date().toISOString() 
      });
      if (VERBOSE) {
        console.log('[updateUser] Fields:', JSON.stringify(updateFields, null, 2));
      }
      const updated = await rateLimitedOperation(() => 
        base(TABLE).update(records[0].id, updateFields, { typecast: true }),
        'updateUser'
      );
      console.log(`[updateUser] ✅ Оновлено ${tgId}`, Object.keys(updateFields));
      userCache.del(`user_${tgId}`);
      return mapRecord(updated);
    }, 3, 2000, 'updateUser');
  } catch (error) {
    logErr('[updateUser]', error);
    return null;
  }
};

// CREATE операції
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
      console.log(`[createUser] 🆕 СПРОБА ${attempt}/${maxRetries} створення ${tgId}`);
      const base = getBase();
      const exists = await selectByTgId(base, tgId);
      if (exists.length) {
        console.warn('[createUser] Запис вже існує → повертаю');
        const rec = exists[0];
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
      
      const payload = sanitizeWritableFields(userData);
      const records = await rateLimitedOperation(() => 
        base(TABLE).create([{ fields: payload }], { typecast: true }),
        'createUser'
      );
      const createdRecord = records[0];
      console.log(`[createUser] ✅ Створено ID: ${createdRecord.id}`);
      
      userCache.set(`user_${tgId}`, mapRecord(createdRecord));
      return mapRecord(createdRecord);
    } catch (error) {
      logErr(`[createUser:attempt_${attempt}]`, error);
      if (attempt === maxRetries) throw error;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
};

// Допоміжні функції
const hasActiveAccess = (user) => {
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
    return { 
      active: true, 
      raw: user['Active_Subscription_Status'] || user['Subscription Status'] 
    };
  }
  return { 
    active: false, 
    raw: user['Active_Subscription_Status'] || user['Subscription Status'] || '' 
  };
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
    const records = await rateLimitedOperation(() => 
      base(TABLE).select({
        filterByFormula: filter,
        fields: ['TG_id', 'User Name', 'Active Subscription Plan', 'End_Date']
      }).all(),
      'getUsersWithExpiringSubscriptions'
    );
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
  checkSubscriptionStatus,
  getUsersWithExpiringSubscriptions,
  hasActiveAccess
};