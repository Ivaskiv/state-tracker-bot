// src/services/userService.js

import userRepo from '../repositories/userRepository.js';
import { USER_STATUS, SUBSCRIPTION_STATUS, CURRENT_ACTIVITY, CONFIG } from '../config/constants.js';

// ===== КЕШ КОРИСТУВАЧІВ =====
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 хв
const batchCache = {
  activeUsers: { data: null, timestamp: 0, ttl: 5 * 60 * 1000 },
  expiringUsers: { data: null, timestamp: 0, ttl: 10 * 60 * 1000 }
};

// ===== МАППЕР ЗАПИСІВ =====
const mapRecord = (record) => {
  if (!record) return null;
  const f = record.fields;
  return {
    id: record.id,
    AT_id: f.AT_id || record.id,
    TG_id: String(f.TG_id),
    'User Name': f['User Name'] || '',
    Email: f.Email || null,
    Phone: f.Phone || null,
    'Time Zone': f['Time Zone'] || CONFIG.DEFAULT_TIMEZONE,
    UserRegistered: Boolean(f.UserRegistered),
    Status: f.Status || USER_STATUS.NEW,
    'Subscription Status': f['Subscription Status'] || SUBSCRIPTION_STATUS.NEW,
    'Active Subscription Plan': f['Active Subscription Plan'] || '',
    Start_Date: f.Start_Date || null,
    End_Date: f.End_Date || null,
    'Active_Subscription_Status': f['Active_Subscription_Status'] || '',
    Answer_Step: f.Answer_Step || CURRENT_ACTIVITY.COMPLETED,
    Created_At: f.Created_At || null,
    Last_Activity: f.Last_Activity || null,
    'Registration Date': f['Registration Date'] || null
  };
};

// ===== ОСНОВНІ ОПЕРАЦІЇ =====
export const getUserByTgId = async (tgId, options) => {
  const skipCache = options?.skipCache || false;
  const cacheKey = String(tgId);
  
  if (!skipCache) {
    const cached = userCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.user;
  }
  
  const record = await userRepo.findByTgId(tgId);
  const user = mapRecord(record);
  if (user) userCache.set(cacheKey, { user, timestamp: Date.now() });
  return user;
};

export const ensureUser = async (tgId, name) => {
  let user = await getUserByTgId(tgId);
  if (user) return user;

  const record = await userRepo.createUser(tgId, name || String(tgId));
  user = mapRecord(record);
  if (user) userCache.set(String(tgId), { user, timestamp: Date.now() });
  return user;
};

export const updateUserFields = async (tgId, fields) => {
  userCache.delete(String(tgId));
  const record = await userRepo.findByTgId(tgId);
  const user = mapRecord(record);
  if (!user) return null;

  const updated = await userRepo.updateUser(user.id, fields);
  const result = mapRecord(updated);
  userCache.set(String(tgId), { user: result, timestamp: Date.now() });
  return result;
};

export const updateUserStep = async (tgId, step) => {
  return updateUserFields(tgId, { Answer_Step: step });
};

export const updateUserActivity = async (tgId) => {
  return updateUserFields(tgId, { Last_Activity: new Date().toISOString() });
};

export const finalizeRegistration = async (tgId, data) => {
  const now = new Date().toISOString();
  return updateUserFields(tgId, {
    'User Name': data.name,
    Email: data.email || null,
    Phone: data.phone || null,
    'Time Zone': data.timezone,
    UserRegistered: true,
    'Registration Date': now,
    Answer_Step: CURRENT_ACTIVITY.COMPLETED
  });
};

export const hasActiveAccess = (user) => {
  if (!user) return false;
  const subStatus = (user['Subscription Status'] || '').trim().toLowerCase();
  const activeStatus = (user['Active_Subscription_Status'] || '').trim();
  const plan = user['Active Subscription Plan'] || '';

  const isStatusActive = subStatus === 'active' ||
                         activeStatus.includes('✅') ||
                         activeStatus.toLowerCase().includes('активна') ||
                         plan.includes('🧪 пробний');
  if (isStatusActive) return true;

  const start = user.Start_Date ? new Date(user.Start_Date + 'T00:00:00') : null;
  const end = user.End_Date ? new Date(user.End_Date + 'T23:59:59') : null;
  const now = new Date();
  if (start && end && now >= start && now <= end) return true;

  return false;
};

export const activateTrial = async (tgId, days = 7) => {
  const start = new Date();
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  return updateUserFields(tgId, {
    'Active Subscription Plan': '🧪 Пробний період — 0€',
    'Subscription Status': SUBSCRIPTION_STATUS.ACTIVE,
    Start_Date: start.toISOString().split('T')[0],
    End_Date: end.toISOString().split('T')[0]
  });
};

export const getActiveUsers = async ({ forceRefresh = false } = {}) => {
  const now = Date.now();
  const cache = batchCache.activeUsers;
  if (!forceRefresh && cache.data && now - cache.timestamp < cache.ttl) return cache.data;

  const records = await userRepo.findActiveUsers();
  const users = records.map(mapRecord).filter(u => u !== null);
  cache.data = users;
  cache.timestamp = now;
  users.forEach(user => userCache.set(user.TG_id, { user, timestamp: now }));
  return users;
};

export const getUsersWithExpiringSubscriptions = async (daysAhead = 1) => {
  const today = new Date();
  const target = new Date(today);
  target.setDate(today.getDate() + daysAhead);
  const todayStr = today.toISOString().split('T')[0];
  const targetStr = target.toISOString().split('T')[0];

  const { getBase, tables } = await import('../config/database.js');
  const base = getBase();

  const records = await base(tables.USERS)
    .select({
      filterByFormula: `AND(FIND('✅', {Active_Subscription_Status}) > 0, IS_AFTER({End_Date}, '${todayStr}'), IS_BEFORE({End_Date}, '${targetStr}'))`,
      fields: ['TG_id', 'User Name', 'End_Date', 'Active Subscription Plan']
    })
    .all();

  return records.map(mapRecord).filter(u => u !== null);
};

export const clearCache = (tgId = null) => {
  if (tgId) userCache.delete(String(tgId));
  else userCache.clear();
};

export const getCacheStats = () => ({
  size: userCache.size,
  users: Array.from(userCache.keys())
});

export default {
  getUserByTgId,
  ensureUser,
  updateUserFields,
  updateUserStep,
  updateUserActivity,
  finalizeRegistration,
  hasActiveAccess,
  activateTrial,
  getActiveUsers,
  getUsersWithExpiringSubscriptions,
  clearCache,
  getCacheStats
};

console.log('✅ [userService] Сервіс ініціалізовано');
