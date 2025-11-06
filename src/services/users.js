// src/services/users.js
import { ANSWER_STEPS, CONFIG, USER_STATUS } from '../config/constants.js';
import { getBase, tables, updateRows } from '../config/database.js';
import * as cache from '../utils/cache.js';

const base = getBase();

const CACHE_TTL = 120000; // 2 хвилини
// + додай на початок файлу після імпортів:

const TG_ID_FIELDS = ['TG_id', 'Chat ID', 'ChatID', 'ChatId', 'Chat Id', 'tg_id'];

const tryFindByField = async (field, tgId) => {
  // Підтримка текст/число
  const idStr = String(tgId);
  const idNum = Number(tgId);
  const numOk = !Number.isNaN(idNum);

  // точний збіг (текст) або числовий
  const eqText = `{${field}}='${idStr}'`;
  const eqNum  = numOk ? `VALUE({${field}})=${idNum}` : null;

  const formula = eqNum ? `OR(${eqText}, ${eqNum})` : eqText;

  const recs = await base(tables.USERS)
    .select({ filterByFormula: formula, maxRecords: 1 })
    .firstPage();

  return recs?.[0] || null;
};

export const getUserByTgId = async (tgId, forceRefresh = false) => {
  const cacheKey = `user:${tgId}`;
  console.log('🔍 [getUserByTgId] START:', { tgId, forceRefresh });

  if (!forceRefresh && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    console.log('📦 [getUserByTgId] CACHE HIT:', { tgId, userId: cached?.id, status: cached?.fields?.Status });
    return cached;
  }

  console.log('🔍 [getUserByTgId] CACHE MISS, probing fields...');
  let found = null;
  let lastErr = null;

  for (const f of TG_ID_FIELDS) {
    try {
      const rec = await tryFindByField(f, tgId);
      if (rec) {
        const user = { id: rec.id, recordId: rec.id, fields: rec.fields };
        cache.set(cacheKey, user, CACHE_TTL);
        console.log('✅ [getUserByTgId] Found by field:', f);
        return user;
      }
    } catch (e) {
      // якщо поле не існує — 422. Йдемо далі
      lastErr = e;
      if (e?.statusCode !== 422) {
        console.error('❌ [getUserByTgId] Unexpected Airtable error:', e);
      }
    }
  }

  if (!found) {
    console.log('❌ [getUserByTgId] User NOT found by any TG fields');
    cache.del(cacheKey);
    if (lastErr && lastErr.statusCode !== 422) throw lastErr;
    return null;
  }
};

const tryCreateWithField = async (field, tgId, firstName) => {
  const fields = {
    'User Name': firstName || '',
    'Status': 'New User',
    'Created': new Date().toISOString(),
  };
  fields[field] = String(tgId);

  const recs = await base(tables.USERS).create([{ fields }]);
  return recs?.[0] || null;
};


// 🗑️ Очистка кешу конкретного користувача
export const clearUserCache = (tgId) => {
  const cacheKey = `user:${tgId}`;
  console.log('🗑️ [clearUserCache] Clearing cache for:', { tgId });
  return cache.del(cacheKey);
};

// 🧹 Очистка всього кешу користувачів
export const clearAllUserCache = () => {
  console.log('🧹 [clearAllUserCache] Clearing all user cache...');
  const allCache = cache.getAll();
  const userKeys = Object.keys(allCache).filter(k => k.startsWith('user:'));
  
  let cleared = 0;
  userKeys.forEach(key => {
    if (cache.del(key)) cleared++;
  });
  
  console.log('✅ [clearAllUserCache] Cleared', cleared, 'user cache entries');
  return cleared;
};

export const createUser = async (tgId, firstName = '') => {
  console.log('➕ [createUser] Creating new user:', { tgId, firstName });

  const fields = {
    'User Name': firstName || '',
    'Status': 'New User',
    'Created': new Date().toISOString(),
  };
  // продублюємо TG у всі можливі поля
  TG_ID_FIELDS.forEach(k => fields[k] = String(tgId));

  try {
    const records = await base(tables.USERS).create([{ fields }]);
    const user = { id: records[0].id, recordId: records[0].id, fields: records[0].fields };
    cache.set(`user:${tgId}`, user, CACHE_TTL);
    console.log('✅ [createUser] User created:', { tgId, userId: user.id });
    return user;
  } catch (error) {
    console.error('❌ [createUser] Error:', error);
    throw error;
  }
};
// + нова утиліта: гарантувати існування
export const ensureUserExists = async (tgId, firstName = '') => {
  let user = await getUserByTgId(tgId);
  if (user) return user;

  // не знайшли → створюємо
  user = await createUser(tgId, firstName);

  // одразу легенький апдейт станів за замовчуванням (опціонально)
  try {
    await updateUser(user.id, {
      Answer_Step: ANSWER_STEPS.IDLE,
      UserRegistered: false,
      Subscription_Status: 'Inactive'
    });
  } catch {}
  return user;
};


export const updateUser = async (recordId, fields) => {
  console.log('🔄 [updateUser] Updating user:', { recordId, fields });
  
  try {
    const oldRecord = await base(tables.USERS).find(recordId);
    const tgId = oldRecord.fields?.TG_id;
    
    const updated = await base(tables.USERS).update([{
      id: recordId,
      fields
    }]);
    
    if (tgId) {
      clearUserCache(tgId);
      console.log('✅ [updateUser] Cache cleared for:', { tgId });
    }
    
    return {
      id: updated[0].id,
      recordId: updated[0].id,
      fields: updated[0].fields
    };
  } catch (error) {
    console.error('❌ [updateUser] Error:', error);
    throw error;
  }
};

export const updateUserFields = async (tgId, fields) => {
  const user = await getUserByTgId(tgId);
  if (!user) throw new Error('User not found');

  await updateRows(tables.USERS, [{ id: user.id, fields }]);
  
  clearUserCache(tgId);
  
  return getUserByTgId(tgId, true);
};

export const deleteUser = async (recordId) => {
  console.log('🗑️ [deleteUser] Marking user as deleted:', { recordId });
  
  try {
    const record = await base(tables.USERS).find(recordId);
    const tgId = record.fields?.TG_id;
    
    await base(tables.USERS).update([{
      id: recordId,
      fields: {
        'Status': 'Deleted',
        'Deleted_At': new Date().toISOString()
      }
    }]);
    
    if (tgId) {
      clearUserCache(tgId);
    }
    
    return true;
  } catch (error) {
    console.error('❌ [deleteUser] Error:', error);
    throw error;
  }
};

export const updateUserStep = (tgId, step) =>
  updateUserFields(tgId, { Answer_Step: step });

export const updateUserActivity = async (tgId) => {
  const now = new Date(); 
  now.setSeconds(0, 0);
  return updateUserFields(tgId, {
    Last_Activity: now.toISOString(),
    Last_Answer_Date: new Date().toISOString().split('T')[0]
  });
};

export const finalizeRegistration = async (tgId, data) => {
  const now = new Date(); 
  now.setSeconds(0, 0);
  return updateUserFields(tgId, {
    'User Name': data.name,
    Email: data.email || null,
    Phone: data.phone || null,
    'Time_Zone': data.timezone || CONFIG.DEFAULT_TIMEZONE,
    UserRegistered: true,
    Status: USER_STATUS.REGISTERED,
    Answer_Step: ANSWER_STEPS.COMPLETED,
    Last_Activity: now.toISOString(),
    Last_Answer_Date: new Date().toISOString().split('T')[0]
  });
};

export const activateTrial = async (tgId, days = 7) => {
  const start = new Date();
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  return updateUserFields(tgId, {
    'Active_Subscription_Plan': '🧪 Пробний період — 0€',
    'Subscription_Status': 'Active',
    Start_Date: start.toISOString().split('T')[0],
    End_Date: end.toISOString().split('T')[0]
  });
};

export const hasActiveAccessByFields = (fields = {}) => {
  if (!fields) return false;

  const plan = String(fields['Active_Subscription_Plan'] || '');
  const status = String(fields['Subscription_Status'] || '').trim().toLowerCase();

  if (status === 'active' || /пробний/i.test(plan)) return true;

  const endDate = fields.End_Date;
  if (!endDate) return false;

  const end = new Date(`${endDate}T23:59:59`);
  return new Date() <= end;
};

export const hasActiveAccess = (userOrFields) => {
  const fields = userOrFields?.fields || userOrFields || {};
  return hasActiveAccessByFields(fields);
};

export const getSubscriptionText = (userOrFields) => {
  const fields = userOrFields?.fields || userOrFields || {};
  const formulaText = String(fields.Active_Subscription_Status || '').trim();

  if (formulaText) return formulaText;

  if (hasActiveAccessByFields(fields)) {
    if (fields.End_Date) {
      const [y, m, d] = fields.End_Date.split('-');
      return `✅ Активна до ${[d, m, y].join('.')}`;
    }
    return '✅ Активна';
  }
  return '❌ Немає активної підписки';
};

export const getActiveUsers = async () => {
  try {
    const records = await base(tables.USERS)
      .select({
        filterByFormula: `{Status} = "Active User"`,
        fields: ['TG_id', 'User Name', 'Subscription_Status', 'End_Date']
      })
      .all();
    return records;
  } catch (e) {
    console.error('[user] ❌ Помилка getActiveUsers:', e);
    return [];
  }
};

export default {
  getUserByTgId,
  createUser,
  updateUser,
  updateUserFields,
  updateUserStep,
  updateUserActivity,
  finalizeRegistration,
  activateTrial,
  deleteUser,
  clearUserCache,
  clearAllUserCache,
  hasActiveAccessByFields,
  hasActiveAccess,
  getSubscriptionText,
  getActiveUsers,
  ensureUserExists
};