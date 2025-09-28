// src/auth/services/userService.js
// ПЕРЕПИСАНО: максимально асинхронно без блокуючих промісів

import { getBase } from '../../config/database.js';
import { ANSWER_STEPS } from '../../config/constants.js';

const VERBOSE = process.env.AIRTABLE_VERBOSE === '1';
const TABLE = 'Users';

// Кеш користувачів для миттєвого доступу
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 хвилин

// Черга фонових операцій
const backgroundQueue = [];
let processingQueue = false;

const logErr = (prefix, error) => {
  const payload = {
    message: error?.message,
    statusCode: error?.statusCode,
    type: error?.error?.type,
    requestId: error?.error?.requestId
  };
  console.error(`${prefix} ❌`, JSON.stringify(payload, null, 2));
};

// Computed поля які не можна писати в Airtable
const COMPUTED_FIELDS = new Set([
  'Active_Subscription_Status',
]);

const sanitizeWritableFields = (obj = {}) => {
  const out = { ...obj };
  for (const key of Object.keys(out)) {
    if (COMPUTED_FIELDS.has(key)) delete out[key];
  }
  return out;
};

// Кеш функції
const cacheGet = (tgId) => {
  const cached = userCache.get(String(tgId));
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.user;
  }
  if (cached) userCache.delete(String(tgId));
  return null;
};

const cacheSet = (tgId, user) => {
  userCache.set(String(tgId), {
    user,
    timestamp: Date.now()
  });
};

// Нормалізація полів користувача
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
  AT_id: fields?.AT_id ?? ''
});

// Мапінг запису Airtable
const mapRecord = (rec) => {
  if (!rec) return null;
  const f = normalizeUserFields(rec.fields);
  if (!f.AT_id) f.AT_id = rec.id;
  return { id: rec.id, ...f };
};

// Фонова черга операцій
const addToBackgroundQueue = (operation) => {
  backgroundQueue.push(operation);
  
  // Запускаємо обробку в наступному тікі
  if (!processingQueue) {
    setImmediate(() => {
      processBackgroundQueue();
    });
  }
};

const processBackgroundQueue = () => {
  if (processingQueue || backgroundQueue.length === 0) return;
  
  processingQueue = true;
  
  const processNext = () => {
    if (backgroundQueue.length === 0) {
      processingQueue = false;
      return;
    }
    
    const operation = backgroundQueue.shift();
    
    operation()
      .then(() => {
        if (VERBOSE) console.log('[processBackgroundQueue] ✅ Операція виконана');
      })
      .catch(error => {
        console.error('[processBackgroundQueue] ❌ Помилка операції:', error.message);
      })
      .finally(() => {
        // Продовжуємо обробку в наступному тікі
        setImmediate(processNext);
      });
  };
  
  processNext();
};

// Швидкий SELECT по TG_id
const selectByTgId = (base, tgId) => {
  const formula = `{TG_id} = '${String(tgId)}'`;
  if (VERBOSE) console.log(`[selectByTgId] formula: ${formula}`);
  return base(TABLE)
    .select({ filterByFormula: formula, maxRecords: 1 })
    .firstPage();
};

// ===== МИТТЄВІ ЧИТАННЯ (з кешу) =====

const getUserByTelegramId = (tgId) => {
  const id = String(tgId);
  
  // Спочатку кеш
  const cached = cacheGet(id);
  if (cached) {
    if (VERBOSE) console.log(`[getUserByTelegramId] ⚡ З кешу: ${id}`);
    return Promise.resolve(cached);
  }
  
  // Читання з бази без блокування
  return new Promise((resolve) => {
    const base = getBase();
    
    selectByTgId(base, id)
      .then(records => {
        console.log(`[getUserByTelegramId] ${id} → знайдено ${records.length} запис(ів)`);
        
        if (records.length) {
          const rec = records[0];
          
          // Фонове оновлення AT_id якщо потрібно
          if (!rec.fields.AT_id) {
            addToBackgroundQueue(() => 
              base(TABLE).update(rec.id, { AT_id: rec.id }, { typecast: true })
                .catch(e => console.warn('[getUserByTelegramId] ⚠️ AT_id update failed:', e?.message))
            );
            rec.fields.AT_id = rec.id;
          }
          
          const user = mapRecord(rec);
          cacheSet(id, user);
          resolve(user);
        } else {
          resolve(null);
        }
      })
      .catch(error => {
        logErr('[getUserByTelegramId]', error);
        resolve(null);
      });
  });
};

// ===== МИТТЄВЕ СТВОРЕННЯ (кеш + фонове збереження) =====

const createUserInstant = (tgId, options = {}) => {
  const id = String(tgId);
  const now = new Date().toISOString();
  
  // Миттєво створюємо об'єкт в кеші
  const tempUser = {
    id: `temp_${id}`,
    TG_id: id,
    'User Name': options.name || 'Користувач',
    'Time Zone': options.timezone || 'Europe/Kyiv',
    Email: options.email || '',
    Phone: options.phone || '',
    UserRegistered: false,
    Status: 'New User',
    'Subscription Status': 'New',
    'Active_Subscription_Status': '',
    Answer_Step: ANSWER_STEPS.COMPLETED,
    Created_At: now,
    Last_Activity: now,
    AT_id: `temp_${id}`,
    _isTemp: true
  };
  
  cacheSet(id, tempUser);
  console.log(`[createUserInstant] ⚡ Тимчасовий користувач створений: ${id}`);
  
  // Фонове створення в Airtable
  addToBackgroundQueue(async () => {
    console.log(`[createUserInstant] 🚀 Фонове створення в Airtable: ${id}`);
    
    try {
      const base = getBase();
      
      // Перевірка на дублювання
      const existing = await selectByTgId(base, id);
      if (existing.length) {
        console.warn(`[createUserInstant] ⚠️ Користувач ${id} вже існує, оновлюємо кеш`);
        const realUser = mapRecord(existing[0]);
        cacheSet(id, realUser);
        return;
      }
      
      const userData = sanitizeWritableFields({
        TG_id: id,
        'User Name': options.name || 'Користувач',
        UserRegistered: false,
        Status: 'New User',
        'Subscription Status': 'New',
        Answer_Step: ANSWER_STEPS.COMPLETED,
        Last_Activity: now,
        Created_At: now,
        ...(options.email && { Email: options.email }),
        ...(options.phone && { Phone: options.phone }),
        ...(options.timezone && { 'Time Zone': options.timezone })
      });
      
      if (VERBOSE) console.log('[createUserInstant] Створюємо з полями:', Object.keys(userData));
      
      const records = await base(TABLE).create([{ fields: userData }], { typecast: true });
      const createdRecord = records[0];
      
      // Додаємо AT_id
      if (!createdRecord.fields.AT_id) {
        await base(TABLE).update(createdRecord.id, { AT_id: createdRecord.id }, { typecast: true });
        createdRecord.fields.AT_id = createdRecord.id;
      }
      
      const realUser = mapRecord(createdRecord);
      cacheSet(id, realUser);
      
      console.log(`[createUserInstant] ✅ Реальний користувач створений: ${createdRecord.id}`);
      
    } catch (error) {
      console.error(`[createUserInstant] ❌ Фонове створення не вдалося:`, error.message);
    }
  });
  
  return Promise.resolve(tempUser);
};

// ===== МИТТЄВЕ ОНОВЛЕННЯ (кеш + фонове збереження) =====

const updateUserInstant = (tgId, fields) => {
  const id = String(tgId);
  console.log(`[updateUserInstant] ⚡ Миттєве оновлення ${id}:`, Object.keys(fields));
  
  // Миттєво оновлюємо кеш
  const cached = cacheGet(id);
  let updatedUser = null;
  
  if (cached) {
    updatedUser = { 
      ...cached, 
      ...fields, 
      Last_Activity: new Date().toISOString() 
    };
    cacheSet(id, updatedUser);
    console.log(`[updateUserInstant] ⚡ Кеш оновлено миттєво`);
  }
  
  // Фонове оновлення в Airtable
  addToBackgroundQueue(async () => {
    console.log(`[updateUserInstant] 🚀 Фонове оновлення в Airtable: ${id}`);
    
    try {
      const base = getBase();
      const records = await selectByTgId(base, id);
      
      if (!records.length) {
        console.warn(`[updateUserInstant] ⚠️ Користувач ${id} не знайдений для оновлення`);
        return;
      }
      
      const updateFields = sanitizeWritableFields({ 
        ...fields, 
        Last_Activity: new Date().toISOString() 
      });
      
      if (VERBOSE) console.log('[updateUserInstant] Оновлюємо поля:', Object.keys(updateFields));
      
      const updated = await base(TABLE).update(records[0].id, updateFields, { typecast: true });
      
      // Гарантія AT_id
      if (!updated.fields.AT_id) {
        await base(TABLE).update(records[0].id, { AT_id: records[0].id }, { typecast: true });
        updated.fields.AT_id = records[0].id;
      }
      
      const realUser = mapRecord(updated);
      cacheSet(id, realUser);
      
      console.log(`[updateUserInstant] ✅ Фонове оновлення завершено: ${id}`);
      
    } catch (error) {
      console.error(`[updateUserInstant] ❌ Фонове оновлення не вдалося:`, error.message);
    }
  });
  
  return Promise.resolve(updatedUser || { TG_id: id, ...fields });
};

// ===== LEGACY COMPATIBILITY =====

const createUser = (options) => {
  return createUserInstant(options.tgId, {
    name: options.name,
    email: options.email,
    phone: options.phone,
    timezone: options.timezone
  });
};

const updateUser = (tgId, fields) => {
  return updateUserInstant(tgId, fields);
};

const ensureNewUserStub = (tgId) => {
  console.log(`[ensureNewUserStub] 🔰 Забезпечення користувача ${tgId}`);
  
  // Спочатку перевіряємо кеш
  const cached = cacheGet(tgId);
  if (cached) {
    console.log(`[ensureNewUserStub] ✅ Користувач ${tgId} є в кеші`);
    return Promise.resolve(cached);
  }
  
  // Швидке читання з бази
  return getUserByTelegramId(tgId)
    .then(existing => {
      if (existing) {
        console.log(`[ensureNewUserStub] ✅ Користувач ${tgId} знайдений в базі`);
        return existing;
      }
      
      // Створюємо нового
      console.log(`[ensureNewUserStub] 🆕 Створення нового користувача ${tgId}`);
      return createUserInstant(tgId);
    });
};

const finalizeRegistration = (tgId, options) => {
  console.log(`[finalizeRegistration] 🎯 Завершення реєстрації для ${tgId}`);
  
  const fields = sanitizeWritableFields({
    'User Name': options.name,
    Email: options.email || null,
    Phone: options.phone || null,
    'Time Zone': options.timezone || 'Europe/Kyiv',
    UserRegistered: true,
    DateUserRegistered: new Date().toISOString(),
    Status: 'Registered User',
    Answer_Step: ANSWER_STEPS.COMPLETED
  });
  
  return updateUserInstant(tgId, fields);
};

const upsertUser = (payload) => {
  const { tgId, ...fields } = payload;
  
  return getUserByTelegramId(tgId)
    .then(existing => {
      if (existing) {
        return updateUserInstant(tgId, fields);
      } else {
        return createUserInstant(tgId, {
          name: fields['User Name'] || fields.name,
          email: fields.Email || fields.email,
          phone: fields.Phone || fields.phone,
          timezone: fields['Time Zone'] || fields.timezone
        });
      }
    });
};

// ===== ДОПОМІЖНІ ФУНКЦІЇ =====

const updateUserStep = (tgId, step) => {
  return updateUserInstant(tgId, { 
    Answer_Step: step,
    Last_Activity: new Date().toISOString()
  });
};

const updateUserActivity = (tgId) => {
  return updateUserInstant(tgId, { 
    Answer_Step: ANSWER_STEPS.COMPLETED,
    Last_Activity: new Date().toISOString()
  });
};

const setRegistrationDone = (tgId, timezone, name) => {
  return updateUserInstant(tgId, sanitizeWritableFields({
    UserRegistered: true,
    DateUserRegistered: new Date().toISOString(),
    Status: 'Registered User',
    'User Name': name,
    'Time Zone': timezone
  }));
};

// Перевірка активного доступу
const hasActiveAccess = (user) => {
  if (!user) return false;
  const activeLine = String(user['Active_Subscription_Status'] || '');
  const subStatus = String(user['Subscription Status'] || '');
  const plan = String(user['Active Subscription Plan'] || '');
  const endIso = user['End_Date'];

  if (activeLine.includes('✅ Активна')) return true;
  if (subStatus === 'Active') return true;

  // Пробний план
  if (/пробн|trial/i.test(plan)) {
    try {
      const now = Date.now();
      const end = endIso ? Date.parse(endIso) : 0;
      if (end && end > now) return true;
    } catch {}
  }
  return false;
};

const checkSubscriptionStatus = (tgId) => {
  return getUserByTelegramId(tgId)
    .then(user => {
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
    });
};

// ===== СИНХРОННІ ОПЕРАЦІЇ (для compatibility) =====

const getActiveUsers = () => {
  return new Promise((resolve) => {
    const base = getBase();
    const filter = "FIND('✅ Активна', {Active_Subscription_Status}) > 0";
    
    base(TABLE)
      .select({ filterByFormula: filter })
      .all()
      .then(records => {
        if (VERBOSE) console.log(`[getActiveUsers] Знайдено: ${records.length}`);
        resolve(records.map(mapRecord));
      })
      .catch(error => {
        logErr('[getActiveUsers]', error);
        resolve([]);
      });
  });
};

const getUsersWithExpiringSubscriptions = (daysOffset) => {
  return new Promise((resolve) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysOffset);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    const base = getBase();
    const filter = `AND(
      FIND('✅ Активна', {Active_Subscription_Status}) > 0,
      DATESTR({End_Date}) = '${targetDateStr}'
    )`;

    base(TABLE)
      .select({
        filterByFormula: filter,
        fields: ['TG_id', 'User Name', 'Active Subscription Plan', 'End_Date']
      })
      .all()
      .then(records => {
        if (VERBOSE) console.log(`[getUsersWithExpiringSubscriptions] знайдено: ${records.length}`);
        resolve(records.map(mapRecord));
      })
      .catch(error => {
        logErr('[getUsersWithExpiringSubscriptions]', error);
        resolve([]);
      });
  });
};

// ===== ЭКСПОРТ =====

export {
  ensureNewUserStub,
  finalizeRegistration,
  hasActiveAccess
};

export default {
  // Основні функції (асинхронні)
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
  hasActiveAccess,
  
  // Нові швидкі методи
  createUserInstant,
  updateUserInstant,
  
  // Утиліти
  cacheGet: (tgId) => cacheGet(tgId),
  cacheSet: (tgId, user) => cacheSet(tgId, user),
  getFromCache: (tgId) => cacheGet(tgId), // Alias для старого коду
  
  // Legacy compatibility
  createUserRecord: createUserInstant
};