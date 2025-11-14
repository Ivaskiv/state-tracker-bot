import { ANSWER_STEPS, CONFIG, USER_STATUS } from '../config/constants.js';
import { getBase, tables, updateRows } from '../config/database.js';
import * as cache from '../utils/cache.js';

const base = getBase();
const CACHE_TTL = 120000;

export const tryFindByField = async (field, tgId) => {
  const idStr = String(tgId);
  const idNum = Number(tgId);
  const numOk = !Number.isNaN(idNum);
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
  console.info('🔍 [getUserByTgId] START', { tgId, forceRefresh });

  if (!forceRefresh && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    console.info('📦 [getUserByTgId] CACHE HIT', { tgId, userId: cached?.id, status: cached?.fields?.Status });
    return cached;
  }

  console.info('🔍 [getUserByTgId] CACHE MISS, query by TG_id…');
  const recs = await base(tables.USERS)
    .select({ filterByFormula: `{TG_id}='${String(tgId)}'`, maxRecords: 1 })
    .firstPage();

  const rec = recs?.[0];
  if (!rec) {
    console.warn('❌ [getUserByTgId] Not found by TG_id');
    cache.del(cacheKey);
    return null;
  }

  const user = { id: rec.id, recordId: rec.id, fields: rec.fields };
  cache.set(cacheKey, user, CACHE_TTL);
  return user;
};

export const clearUserCache = (tgId) => {
  const cacheKey = `user:${tgId}`;
  return cache.del(cacheKey);
};

export const clearAllUserCache = () => {
  const allCache = cache.getAll();
  const userKeys = Object.keys(allCache).filter(k => k.startsWith('user:'));
  let cleared = 0;
  userKeys.forEach(key => { if (cache.del(key)) cleared++; });
  return cleared;
};

export const createUser = async (tgId, firstName = '', overrides = {}) => {
  console.log('➕ [createUser]', { tgId, firstName, overrides: Object.keys(overrides) });

  const fields = {
    TG_id: String(tgId),
    'User Name': firstName || 'Користувач',
    Status: 'Registered User',
    'UserRegistered': true,
    'Subscription Status': 'New',
    Answer_Step: ANSWER_STEPS.IDLE,
    Last_Activity: new Date().toISOString(),
    ...overrides,
  };

  try {
    const records = await base(tables.USERS).create([{ fields }]);
    const user = { id: records[0].id, recordId: records[0].id, fields: records[0].fields };
    cache.set(`user:${tgId}`, user, CACHE_TTL);
    console.log('✅ [createUser] created', { tgId, userId: user.id });
    return user;
  } catch (e) {
    console.error('[createUser] Error:', e?.response?.data || e.message || e);
    throw e;
  }
};

export const ensureUserExists = async (tgId, firstName = '') => {
  let user = await getUserByTgId(tgId);
  if (user) return user;
  return createUser(tgId, firstName, {
    'Status': 'Registered User',
    'UserRegistered': true,
    'Subscription Status': 'New',
    'Answer_Step': ANSWER_STEPS.IDLE,
  });
};

export const updateUser = async (recordId, fields) => {
  const oldRecord = await base(tables.USERS).find(recordId);
  const tgId = oldRecord.fields?.TG_id;

  const updated = await base(tables.USERS).update([{ id: recordId, fields }]);
  if (tgId) clearUserCache(tgId);

  return { id: updated[0].id, recordId: updated[0].id, fields: updated[0].fields };
};

export const updateUserFields = async (tgId, fields) => {
  const user = await getUserByTgId(tgId);
  if (!user) throw new Error('User not found');
  await updateRows(tables.USERS, [{ id: user.id, fields }]);
  clearUserCache(tgId);
  return getUserByTgId(tgId, true);
};

export const deleteUser = async (recordId) => {
  const record = await base(tables.USERS).find(recordId);
  const tgId = record.fields?.TG_id;

  await base(tables.USERS).update([{
    id: recordId,
    fields: { 'Status': 'Deleted', 'Deleted_At': new Date().toISOString() }
  }]);

  if (tgId) clearUserCache(tgId);
  return true;
};

export const updateUserStep = (tgId, step) =>
  updateUserFields(tgId, { Answer_Step: step });

export const updateUserActivity = async (tgId) => {
  const now = new Date(); now.setSeconds(0, 0);
  return updateUserFields(tgId, {
    Last_Activity: now.toISOString(),
    Last_Answer_Date: new Date().toISOString().split('T')[0]
  });
};

export const finalizeRegistration = async (tgId, data) => {
  const now = new Date(); now.setSeconds(0, 0);
  return updateUserFields(tgId, {
    'User Name': data.name,
    Email: data.email || null,
    Phone: data.phone || null,
    'Time_Zone': data.timezone || CONFIG.DEFAULT_TIMEZONE,
    UserRegistered: true,
    Status: USER_STATUS.REGISTERED,
    Answer_Step: ANSWER_STEPS.COMPLETED,
    Last_Activity: now.toISOString(),
    Last_Answer_Date: new Date().toISOString().split('T')[0],
  });
};

export const activateTrial = async (tgId, days = 7) => {
  const start = new Date();
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  return updateUserFields(tgId, {
    'Active_Subscription_Plan': '🧪 Пробний період — 0€',
    'Subscription Status': 'Active',
    Start_Date: start.toISOString().split('T')[0],
    End_Date: end.toISOString().split('T')[0],
  });
};

export const hasActiveAccessByFields = (fields = {}) => {
  if (!fields) return false;

  const plan = String(fields['Active_Subscription_Plan'] || '');
  const status = String(fields['Subscription Status'] || '').trim().toLowerCase();

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
        fields: ['TG_id', 'User Name', 'Subscription Status', 'End_Date']
      })
      .all();
    return records;
  } catch (e) {
    console.error('[user] ❌ Помилка getActiveUsers:', e);
    return [];
  }
};
export const upsertAttribution = async (tgId, meta = {}) => {
  try {
    const user = await getUserByTgId(tgId);
    if (!user) return false;

    const fields = {
      // зручно мати сире джейсон-поле
      Attribution: JSON.stringify(meta || {}),
    };

    // якщо в payload є знайомі ключі — розкладаємо по окремих полях (optional)
    if (meta.source)  fields.Attribution_Source  = String(meta.source);
    if (meta.campaign) fields.Attribution_Campaign = String(meta.campaign);
    if (meta.medium)  fields.Attribution_Medium  = String(meta.medium);

    await updateRows(tables.USERS, [{ id: user.id, fields }]);
    clearUserCache(tgId);
    return true;
  } catch (e) {
    console.warn('[users.upsertAttribution] skip', e?.message);
    return false;
  }
};
export const setUserAnswerStep = (tgId, step) =>
  updateUserFields(tgId, { Answer_Step: step });

export const setUserName = (tgId, name) =>
  updateUserFields(tgId, { 'User Name': name });

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
  ensureUserExists,
  setUserAnswerStep,
  setUserName,
};
