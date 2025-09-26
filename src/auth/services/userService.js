// src/auth/services/userService.js - ОПТИМІЗОВАНО

import { getBase, tables } from '../../config/database.js';
import { ANSWER_STEPS } from '../../config/constants.js';
import NodeCache from 'node-cache';
import pTimeout from 'p-timeout';

// Кеш в пам'яті з TTL 5 хвилин
const userCache = new NodeCache({ 
  stdTTL: 300, // 5 хвилин
  checkperiod: 60,
  maxKeys: 1000 
});

const VERBOSE = process.env.AIRTABLE_VERBOSE === '1';
const TABLE = tables.USERS;

// Збільшуємо таймаут та додаємо retry логіку
const TIMEOUT_MS = 30000; // 30 секунд
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 секунда

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

// Простий rate limiter
let requestTimes = [];
const RATE_LIMIT_WINDOW = 1000; // 1 секунда
const MAX_REQUESTS_PER_SECOND = 3; // Зменшуємо до 3 запитів/сек

const simpleRateLimit = async () => {
  const now = Date.now();
  requestTimes = requestTimes.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (requestTimes.length >= MAX_REQUESTS_PER_SECOND) {
    const waitTime = 500; // Збільшуємо затримку
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

const retryAirtableOperation = async (operation, maxRetries = MAX_RETRIES, delay = RETRY_DELAY, tag = 'op') => {
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      if (VERBOSE) console.log(`[${tag}] Спроба ${attempt}/${maxRetries + 1}`);
      
      return await pTimeout(operation(), { 
        milliseconds: TIMEOUT_MS, 
        message: `Timeout ${tag} після ${TIMEOUT_MS}ms` 
      });
      
    } catch (error) {
      logErr(`[${tag}] Спроба ${attempt} не вдалася`, error);
      
      if (attempt === maxRetries + 1) {
        console.error(`[${tag}] ❌ КРИТИЧНО: Всі ${maxRetries + 1} спроб не вдалися`);
        throw error;
      }
      
      // Експоненційна затримка
      const waitTime = delay * Math.pow(2, attempt - 1);
      console.log(`[${tag}] ⏳ Чекаємо ${waitTime}ms перед спробою ${attempt + 1}`);
      await new Promise((r) => setTimeout(r, waitTime));
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
      base(TABLE).select({ 
        filterByFormula: formula, 
        maxRecords: 1 
      }).firstPage(),
      'selectByTgId'
    );
    
    if (VERBOSE) console.log(`[selectByTgId] Знайдено ${records.length} для TG_id=${tgId}`);
    return records;
  } catch (error) {
    logErr('[selectByTgId]', error);
    throw error;
  }
};

// ===== ПУБЛІЧНІ МЕТОДИ =====

const getUserByTelegramId = async (tgId) => {
  const cacheKey = `user_${tgId}`;
  
  // Перевіряємо кеш
  let user = userCache.get(cacheKey);
  if (user) {
    if (VERBOSE) console.log(`[getUserByTelegramId] ✅ Кеш хіт для ${tgId}`);
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
        
        // Оновлюємо AT_id якщо потрібно
        if (!rec.fields.AT_id) {
          try {
            await rateLimitedOperation(() => 
              base(TABLE).update(rec.id, { AT_id: rec.id }, { typecast: true }),
              'updateAT_id'
            );
            rec.fields.AT_id = rec.id;
          } catch (e) {
            console.warn('[getUserByTelegramId] Не вдалося оновити AT_id:', e?.message);
          }
        }
        
        user = mapRecord(rec);
        
        // Кешуємо на 5 хвилин
        userCache.set(cacheKey, user);
        return user;
      }
      return null;
      
    }, MAX_RETRIES, RETRY_DELAY, 'getUserByTelegramId');
    
  } catch (error) {
    logErr('[getUserByTelegramId]', error);
    
    // Якщо це перша спроба і помилка timeout - повертаємо null
    if (error.message?.includes('Timeout')) {
      console.warn(`[getUserByTelegramId] ⚠️ Timeout для ${tgId} - повертаємо null`);
      return null;
    }
    
    throw error;
  }
};

const createUser = async ({
  tgId,
  name,
  email,
  phone,
  timezone,
  registrationStatus = 'New'
}) => {
  try {
    console.log(`[createUser] 🆕 Створення користувача ${tgId}`);
    
    return await retryAirtableOperation(async () => {
      const base = getBase();
      
      // Перевіряємо чи не існує
      const exists = await selectByTgId(base, tgId);
      if (exists.length) {
        console.warn('[createUser] Користувач вже існує → повертаємо існуючий');
        const rec = exists[0];
        const user = mapRecord(rec);
        userCache.set(`user_${tgId}`, user);
        return user;
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
        Created_At: new Date().toISOString(),
        'Registration Date': new Date().toISOString()
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
      console.log(`[createUser] ✅ Створено користувача ID: ${createdRecord.id}`);
      
      const user = mapRecord(createdRecord);
      userCache.set(`user_${tgId}`, user);
      return user;
      
    }, MAX_RETRIES, RETRY_DELAY, 'createUser');
    
  } catch (error) {
    logErr('[createUser]', error);
    throw error;
  }
};

const updateUser = async (tgId, fields) => {
  if (!fields || typeof fields !== 'object') return null;
  
  try {
    return await retryAirtableOperation(async () => {
      const base = getBase();
      const records = await selectByTgId(base, tgId);
      
      if (!records.length) {
        console.warn(`[updateUser] Користувача ${tgId} не знайдено`);
        return null;
      }
      
      const updateFields = sanitizeWritableFields({ 
        ...fields, 
        Last_Activity: new Date().toISOString() 
      });
      
      if (VERBOSE) {
        console.log('[updateUser] Оновлення полів:', JSON.stringify(updateFields, null, 2));
      }
      
      const updated = await rateLimitedOperation(() => 
        base(TABLE).update(records[0].id, updateFields, { typecast: true }),
        'updateUser'
      );
      
      console.log(`[updateUser] ✅ Оновлено користувача ${tgId}`, Object.keys(updateFields));
      
      // Очищаємо кеш
      userCache.del(`user_${tgId}`);
      
      const user = mapRecord(updated);
      userCache.set(`user_${tgId}`, user);
      return user;
      
    }, MAX_RETRIES, RETRY_DELAY, 'updateUser');
    
  } catch (error) {
    logErr('[updateUser]', error);
    return null;
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
      
    }, MAX_RETRIES, RETRY_DELAY, 'getActiveUsers');
    
  } catch (error) {
    logErr('[getActiveUsers]', error);
    return [];
  }
};

const updateUserStep = async (tgId, step) => {
  return await updateUser(tgId, { Answer_Step: step });
};

const updateUserActivity = async (tgId) => {
  return await updateUser(tgId, { Answer_Step: ANSWER_STEPS.COMPLETED });
};

export default {
  getUserByTelegramId,
  createUser,
  updateUser,
  updateUserStep, 
  updateUserActivity,
  getActiveUsers,
  hasActiveAccess
};