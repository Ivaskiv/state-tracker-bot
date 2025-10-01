// src/services/userService.js - ПОКРАЩЕНИЙ КЕШ

import userRepo from '../repositories/userRepository.js';
import { USER_STATUS, SUBSCRIPTION_STATUS, ANSWER_STEPS, CONFIG } from '../config/constants.js';

// ===== БАГАТОРІВНЕВИЙ КЕШ =====
const userCache = new Map();           // L1: швидкий in-memory
const CACHE_TTL = 5 * 60 * 1000;      // 5 хвилин
const CACHE_SOFT_TTL = 2 * 60 * 1000; // 2 хв для "м'якого" оновлення

// ✅ НОВИЙ: Batch-запити для scheduler
const batchCache = {
  activeUsers: { data: null, timestamp: 0, ttl: 5 * 60 * 1000 },
  expiringUsers: { data: null, timestamp: 0, ttl: 10 * 60 * 1000 }
};

// ===== MAPPER (БЕЗ ЗМІН) =====
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
    Answer_Step: f.Answer_Step || ANSWER_STEPS.COMPLETED,
    Created_At: f.Created_At || null,
    Last_Activity: f.Last_Activity || null,
    'Registration Date': f['Registration Date'] || null
  };
};

// ===== GET USER З ПОКРАЩЕНИМ КЕШЕМ =====
export const getUserByTgId = async (tgId, options = {}) => {
  const { forceRefresh = false, softRefresh = false } = options;
  const cacheKey = String(tgId);
  const now = Date.now();
  
  // Перевіряємо кеш
  const cached = userCache.get(cacheKey);
  
  if (cached && !forceRefresh) {
    const age = now - cached.timestamp;
    
    // Жорсткий TTL
    if (age < CACHE_TTL) {
      console.log(`[userService] 💾 Кеш (${Math.round(age/1000)}s): ${tgId}`);
      return cached.user;
    }
    
    // М'який TTL - повертаємо старі дані, але оновлюємо в фоні
    if (softRefresh && age < CACHE_TTL * 2) {
      console.log(`[userService] 🔄 Soft refresh: ${tgId}`);
      
      // Асинхронно оновлюємо кеш
      refreshUserInBackground(tgId).catch(e => 
        console.error('[userService] Background refresh failed:', e)
      );
      
      return cached.user;
    }
  }
  
  // Запит до БД
  console.log(`[userService] 🔍 DB query: ${tgId}`);
  const record = await userRepo.findByTgId(tgId);
  const user = mapRecord(record);
  
  // Оновлюємо кеш
  if (user) {
    userCache.set(cacheKey, { user, timestamp: now });
    console.log(`[userService] ✅ Cached: ${user['User Name']}`);
  }
  
  return user;
};

// ✅ НОВИЙ: Фонове оновлення кешу
const refreshUserInBackground = async (tgId) => {
  try {
    const record = await userRepo.findByTgId(tgId);
    const user = mapRecord(record);
    
    if (user) {
      userCache.set(String(tgId), {
        user,
        timestamp: Date.now()
      });
    }
  } catch (error) {
    console.error(`[userService] Background refresh error ${tgId}:`, error.message);
  }
};

// ✅ НОВИЙ: Batch-завантаження активних користувачів
export const getActiveUsers = async (options = {}) => {
  const { forceRefresh = false } = options;
  const now = Date.now();
  const cache = batchCache.activeUsers;
  
  // Перевіряємо batch кеш
  if (!forceRefresh && cache.data && (now - cache.timestamp) < cache.ttl) {
    console.log(`[userService] 💾 Batch cache hit (${cache.data.length} users)`);
    return cache.data;
  }
  
  console.log(`[userService] 🔍 Fetching active users from DB...`);
  
  try {
    const records = await userRepo.findActiveUsers();
    const users = records.map(mapRecord).filter(u => u !== null);
    
    // Оновлюємо batch кеш
    cache.data = users;
    cache.timestamp = now;
    
    // Оновлюємо індивідуальний кеш для кожного юзера
    users.forEach(user => {
      userCache.set(user.TG_id, { user, timestamp: now });
    });
    
    console.log(`[userService] ✅ Loaded ${users.length} active users`);
    return users;
    
  } catch (error) {
    console.error('[userService] Error fetching active users:', error);
    // Повертаємо старі дані якщо є
    return cache.data || [];
  }
};

// ✅ НОВИЙ: Batch invalidation при оновленні
export const updateUserFields = async (tgId, fields) => {
  console.log(`[userService] updateUserFields(${tgId})...`, Object.keys(fields));
  
  // Інвалідуємо індивідуальний кеш
  userCache.delete(String(tgId));
  
  // Інвалідуємо batch кеш якщо змінюється підписка
  if (fields['Subscription Status'] || fields['Active Subscription Plan']) {
    batchCache.activeUsers.data = null;
  }
  
  const record = await userRepo.findByTgId(tgId);
  const user = mapRecord(record);
  
  if (!user) {
    console.log(`[userService] ❌ User not found`);
    return null;
  }
  
  try {
    const updated = await userRepo.updateUser(user.id, fields);
    const result = mapRecord(updated);
    
    // Оновлюємо кеш новими даними
    if (result) {
      userCache.set(String(tgId), {
        user: result,
        timestamp: Date.now()
      });
    }
    
    console.log(`[userService] ✅ Updated`);
    return result;
  } catch (error) {
    console.error(`[userService] ❌ Update error:`, error.message);
    userCache.delete(String(tgId));
    throw error;
  }
};

// ===== ІНШІ ФУНКЦІЇ БЕЗ ЗМІН =====
export const ensureUser = async (tgId, name) => {
  console.log(`[userService] 🔍 ensureUser(${tgId}, ${name})...`);
  
  let user = await getUserByTgId(tgId);
  if (user) {
    console.log(`[userService] ✅ User exists: ${user['User Name']}`);
    return user;
  }
  
  console.log(`[userService] 🆕 Creating new user...`);
  const record = await userRepo.createUser(tgId, name || String(tgId));
  user = mapRecord(record);
  
  if (user) {
    userCache.set(String(tgId), { user, timestamp: Date.now() });
    console.log(`[userService] ✅ User created: ${user['User Name']}`);
  }
  
  return user;
};

export const hasActiveAccess = (user) => {
  if (!user) return false;
  if (user['Subscription Status'] === SUBSCRIPTION_STATUS.ACTIVE) return true;
  
  const endDate = user.End_Date;
  if (!endDate) return false;
  
  return new Date(endDate).getTime() > Date.now();
};

export const finalizeRegistration = async (tgId, data) => {
  const now = new Date().toISOString();
  return await updateUserFields(tgId, {
    'User Name': data.name,
    Email: data.email || null,
    Phone: data.phone || null,
    'Time Zone': data.timezone,
    UserRegistered: true,
    'Registration Date': now,
    Current_Activity: 'completed'
  });
};

export const activateTrial = async (tgId, days = 7) => {
  const start = new Date();
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  
  return await updateUserFields(tgId, {
    'Active Subscription Plan': '🧪 Пробний період — 0€',
    'Subscription Status': SUBSCRIPTION_STATUS.ACTIVE,
    Start_Date: start.toISOString().split('T')[0],
    End_Date: end.toISOString().split('T')[0]
  });
};

export const clearCache = (tgId = null) => {
  if (tgId) {
    userCache.delete(String(tgId));
    console.log(`[userService] 🗑️ Cache cleared: ${tgId}`);
  } else {
    const size = userCache.size;
    userCache.clear();
    batchCache.activeUsers.data = null;
    batchCache.expiringUsers.data = null;
    console.log(`[userService] 🗑️ All cache cleared (${size} entries)`);
  }
};

export const getCacheStats = () => {
  return {
    individual: userCache.size,
    batch: {
      activeUsers: batchCache.activeUsers.data?.length || 0,
      expiringUsers: batchCache.expiringUsers.data?.length || 0
    },
    users: Array.from(userCache.keys())
  };
};

export default {
  getUserByTgId,
  getActiveUsers,
  ensureUser,
  updateUserFields,
  hasActiveAccess,
  finalizeRegistration,
  activateTrial,
  clearCache,
  getCacheStats
};

console.log('✅ [userService] Optimized service with batch caching initialized');