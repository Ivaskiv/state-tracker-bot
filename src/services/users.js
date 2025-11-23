// src/services/users.js
import { getBase, tables, updateRows } from '../config/database.js';
import * as cache from '../utils/cache.js';
import { ANSWER_STEPS, USER_STATUS, CONFIG } from '../config/constants.js';

const base = getBase();
const CACHE_TTL = 120000;
const cacheKey = (tgId) => `user:${tgId}`;

// ========== CORE ==========

export const getUserByTgId = async (tgId, forceRefresh = false) => {
  const key = cacheKey(tgId);
  
  if (!forceRefresh && cache.has(key)) {
    return cache.get(key);
  }
  
  const recs = await base(tables.USERS)
    .select({ 
      filterByFormula: `{TG_id}='${String(tgId)}'`, 
      maxRecords: 1 
    })
    .firstPage();
  
  if (!recs[0]) {
    cache.del(key);
    return null;
  }
  
  const user = { 
    id: recs[0].id, 
    recordId: recs[0].id, 
    fields: recs[0].fields 
  };
  
  cache.set(key, user, CACHE_TTL);
  return user;
};

export const createUser = async (tgId, firstName = '', overrides = {}) => {
  const now = new Date();
  
  const fields = {
    TG_id: String(tgId),
    'User Name': firstName || 'Користувач',
    Status: USER_STATUS.REGISTERED,
    UserRegistered: true,
    'Subscription Status': 'New',
    Answer_Step: ANSWER_STEPS.IDLE,
    Last_Activity: now, 
    ...overrides,
  };
  
  const records = await base(tables.USERS).create([{ fields }]);
  const user = { 
    id: records[0].id, 
    recordId: records[0].id, 
    fields: records[0].fields 
  };
  
  cache.set(cacheKey(tgId), user, CACHE_TTL);
  return user;
};
export const ensureUserExists = async (tgId, firstName = '') => {
  let user = await getUserByTgId(tgId);
  if (user) return user;
  return createUser(tgId, firstName);
};

export const updateUserFields = async (tgId, fields) => {
  const user = await getUserByTgId(tgId);
  if (!user) throw new Error('User not found');
  
  await updateRows(tables.USERS, [{ id: user.id, fields }]);
  cache.del(cacheKey(tgId));
  
  return getUserByTgId(tgId, true);
};

// ========== HELPERS ==========

export const updateUserStep = (tgId, step) =>
  updateUserFields(tgId, { Answer_Step: step });

export const updateUserActivity = async (tgId) => {
  now.setSeconds(0, 0);
  
  return updateUserFields(tgId, {
    Last_Activity: new Date().toISOString(),
    Last_Answer_Date: new Date().toISOString().split('T')[0]
  });
};

export const finalizeRegistration = async (tgId, data) => {
  const now = new Date();
  const isoDate = now.toISOString(); // ✅ Повний ISO формат
  
  return updateUserFields(tgId, {
    'User Name': data.name,
    Email: data.email || null,
    Phone: data.phone || null,
    Time_Zone: data.timezone || CONFIG.DEFAULT_TIMEZONE,
    UserRegistered: true,
    Status: USER_STATUS.REGISTERED,
    Answer_Step: ANSWER_STEPS.COMPLETED,
    Last_Activity: isoDate, // ✅ Повний ISO
    Last_Answer_Date: isoDate.split('T')[0], // YYYY-MM-DD
  });
};

// ========== SUBSCRIPTION ==========

export const activateTrial = async (tgId, days = 7) => {
  const start = new Date();
  const end = new Date(start.getTime() + days * 86400000);
  
  return updateUserFields(tgId, {
    'Active_Subscription_Plan': '🧪 Пробний період — 0€',
    'Subscription Status': 'Active',
    Start_Date: start.toISOString().split('T')[0],
    End_Date: end.toISOString().split('T')[0],
  });
};

export const hasActiveAccess = (userOrFields) => {
  const fields = userOrFields?.fields || userOrFields || {};
  
  const plan = String(fields['Active_Subscription_Plan'] || '');
  const status = String(fields['Subscription Status'] || '').trim().toLowerCase();
  
  if (status === 'active' || /пробний/i.test(plan)) return true;
  
  const endDate = fields.End_Date;
  if (!endDate) return false;
  
  return new Date() <= new Date(`${endDate}T23:59:59`);
};

export const getSubscriptionText = (userOrFields) => {
  const fields = userOrFields?.fields || userOrFields || {};
  const formulaText = String(fields.Active_Subscription_Status || '').trim();
  
  if (formulaText) return formulaText;
  
  if (hasActiveAccess(fields)) {
    if (fields.End_Date) {
      const [y, m, d] = fields.End_Date.split('-');
      return `✅ Активна до ${d}.${m}.${y}`;
    }
    return '✅ Активна';
  }
  
  return '❌ Немає підписки';
};

// ========== CACHE ==========

export const clearUserCache = (tgId) => cache.del(cacheKey(tgId));

export const clearAllUserCache = () => {
  const allCache = cache.getAll();
  const userKeys = Object.keys(allCache).filter(k => k.startsWith('user:'));
  userKeys.forEach(k => cache.del(k));
  return userKeys.length;
};

// ========== ADMIN ==========

export const getActiveUsers = async () => {
  try {
    return await base(tables.USERS)
      .select({
        filterByFormula: `{Status} = "Active User"`,
        fields: ['TG_id', 'User Name', 'Subscription Status', 'End_Date']
      })
      .all();
  } catch (e) {
    console.error('[users] getActiveUsers:', e.message);
    return [];
  }
};

export const deleteUser = async (recordId) => {
  const record = await base(tables.USERS).find(recordId);
  const tgId = record.fields?.TG_id;
  
  await base(tables.USERS).update([{
    id: recordId,
    fields: { 
      Status: 'Deleted', 
      Deleted_At: new Date().toISOString() 
    }
  }]);
  
  if (tgId) clearUserCache(tgId);
  return true;
};

export const upsertAttribution = async (tgId, meta = {}) => {
  try {
    const user = await getUserByTgId(tgId);
    if (!user) return false;
    
    const fields = {
      Attribution: JSON.stringify(meta),
    };
    
    if (meta.source) fields.Attribution_Source = String(meta.source);
    if (meta.campaign) fields.Attribution_Campaign = String(meta.campaign);
    if (meta.medium) fields.Attribution_Medium = String(meta.medium);
    
    await updateRows(tables.USERS, [{ id: user.id, fields }]);
    clearUserCache(tgId);
    return true;
  } catch (e) {
    console.warn('[users] upsertAttribution:', e.message);
    return false;
  }
};

// ========== DEPRECATED (видали, якщо не використовуються) ==========
export const tryFindByField = async (field, tgId) => {
  const idStr = String(tgId);
  const idNum = Number(tgId);
  const numOk = !Number.isNaN(idNum);
  const eqText = `{${field}}='${idStr}'`;
  const eqNum = numOk ? `VALUE({${field}})=${idNum}` : null;
  const formula = eqNum ? `OR(${eqText}, ${eqNum})` : eqText;
  
  const recs = await base(tables.USERS)
    .select({ filterByFormula: formula, maxRecords: 1 })
    .firstPage();
  
  return recs?.[0] || null;
};

export const updateUser = async (recordId, fields) => {
  const oldRecord = await base(tables.USERS).find(recordId);
  const tgId = oldRecord.fields?.TG_id;
  
  const updated = await base(tables.USERS).update([{ id: recordId, fields }]);
  if (tgId) clearUserCache(tgId);
  
  return { 
    id: updated[0].id, 
    recordId: updated[0].id, 
    fields: updated[0].fields 
  };
};


export const setUserName = (tgId, name) =>
  updateUserFields(tgId, { 'User Name': name });