// src/services/userService.js

import userRepo from '../repositories/userRepository.js';
import { USER_STATUS, SUBSCRIPTION_STATUS, CONFIG, ANSWER_STEPS } from '../config/constants.js';

// ===== КЕШ КОРИСТУВАЧІВ =====
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 хв

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
    'Subscription_Status': f['Subscription_Status'] || SUBSCRIPTION_STATUS.NEW,
    'Active Subscription Plan': f['Active Subscription Plan'] || '',
    Start_Date: f.Start_Date || null,
    End_Date: f.End_Date || null,
    'Active_Subscription_Status': f['Active_Subscription_Status'] || '',
    Answer_Step: f.Answer_Step ?? ANSWER_STEPS.IDLE,
    Created_At: f.Created_At || null,
    Last_Activity: f.Last_Activity || null,
    'Registration Date': f['Registration Date'] || null
  };
};

// ===== ОСНОВНІ ОПЕРАЦІЇ =====
export const getUserByTgId = async (tgId, options = {}) => {
  const skipCache = options?.skipCache || false;
  const cacheKey = String(tgId);

  if (!skipCache) {
    const cached = userCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[userService] 📦 Отримано з кешу: ${tgId}`);
      return cached.user;
    }
  }

  const record = await userRepo.findByTgId(tgId);
  const user = mapRecord(record);
  
  if (user) {
    userCache.set(cacheKey, { user, timestamp: Date.now() });
  }
  
  return user;
};

export const ensureUser = async (tgId, name) => {
  let user = await getUserByTgId(tgId);
  
  if (user) {
    console.log(`[userService] ✅ Користувач вже існує: ${tgId}`);
    return user;
  }

  console.log(`[userService] 🆕 Створення нового користувача: ${tgId}`);
  const record = await userRepo.createUser(tgId, name || String(tgId));
  user = mapRecord(record);
  
  if (user) {
    userCache.set(String(tgId), { user, timestamp: Date.now() });
  }
  
  return user;
};

// ===== ОНОВЛЕННЯ ПОЛІВ =====
export const updateUserFields = async (tgId, fields) => {
  try {
    console.log(`[userService] 🔄 Оновлення полів для ${tgId}:`, Object.keys(fields).join(', '));
    
    // ✅ ВИПРАВЛЕНО: використовуємо updateUserByTgId замість updateUser
    const record = await userRepo.updateUserByTgId(tgId, fields);
    const user = mapRecord(record);
    
    if (user) {
      userCache.set(String(tgId), { user, timestamp: Date.now() });
      console.log(`[userService] ✅ Оновлено успішно, Answer_Step: ${user.Answer_Step}`);
    }
    
    return user;
  } catch (error) {
    console.error('[userService] ❌ Помилка оновлення полів:', error);
    throw error;
  }
};

export const updateUserField = async (tgId, key, value) => {
  return updateUserFields(tgId, { [key]: value });
};

export const updateUserStep = async (tgId, step) => {
  console.log(`[userService] 📍 Оновлення кроку для ${tgId}: ${step}`);
  return updateUserFields(tgId, { Answer_Step: step });
};

export const updateUserActivity = async (tgId) => {
  return updateUserFields(tgId, { 
    Last_Activity: new Date().toISOString()
  });
};

export const markUserRegistered = async (tgId) => {
  return updateUserFields(tgId, {
    UserRegistered: true,
    Status: USER_STATUS.REGISTERED,
    'Registration Date': new Date().toISOString(),
    Answer_Step: ANSWER_STEPS.COMPLETED
  });
};

export const finalizeRegistration = async (tgId, data) => {
  const now = new Date().toISOString();
  
  console.log(`[userService] 🎉 Фіналізація реєстрації для ${tgId}`);
  
  return updateUserFields(tgId, {
    'User Name': data.name,
    Email: data.email || null,
    Phone: data.phone || null,
    'Time Zone': data.timezone || CONFIG.DEFAULT_TIMEZONE,
    UserRegistered: true,
    Status: USER_STATUS.REGISTERED,
    'Registration Date': now,
    Answer_Step: ANSWER_STEPS.COMPLETED
  });
};

export const activateTrial = async (tgId, days = 7) => {
  const start = new Date();
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  
  console.log(`[userService] 🧪 Активація trial для ${tgId} на ${days} днів`);
  
  return updateUserFields(tgId, {
    'Active Subscription Plan': '🧪 Пробний період — 0€',
    'Subscription_Status': SUBSCRIPTION_STATUS.ACTIVE,
    Start_Date: start.toISOString().split('T')[0],
    End_Date: end.toISOString().split('T')[0]
  });
};

// ===== ПЕРЕВІРКА ДОСТУПУ =====
export const hasActiveAccess = (user) => {
  if (!user) return false;
  
  const subStatus = (user['Subscription_Status'] || '').trim().toLowerCase();
  const activeStatus = (user['Active_Subscription_Status'] || '').trim();
  const plan = user['Active Subscription Plan'] || '';

  // Перевірка статусу
  const isStatusActive =
    subStatus === 'active' ||
    activeStatus.includes('✅') ||
    activeStatus.toLowerCase().includes('активна') ||
    plan.toLowerCase().includes('пробний');

  if (isStatusActive) return true;

  // Перевірка дат
  const start = user.Start_Date ? new Date(user.Start_Date + 'T00:00:00') : null;
  const end = user.End_Date ? new Date(user.End_Date + 'T23:59:59') : null;
  const now = new Date();
  
  return start && end && now >= start && now <= end;
};

// ===== BULK ОПЕРАЦІЇ =====
export const getActiveUsers = async ({ forceRefresh = false } = {}) => {
  const records = await userRepo.findActiveUsers();
  const users = records.map(mapRecord).filter(Boolean);
  
  // Оновлюємо кеш
  users.forEach(user => {
    userCache.set(user.TG_id, { user, timestamp: Date.now() });
  });
  
  return users;
};

// ===== КЕШ =====
export const clearCache = (tgId = null) => {
  if (tgId) {
    userCache.delete(String(tgId));
    console.log(`[userService] 🗑️ Кеш очищено для ${tgId}`);
  } else {
    userCache.clear();
    console.log(`[userService] 🗑️ Весь кеш очищено`);
  }
};

export const getCacheStats = () => ({
  size: userCache.size,
  users: Array.from(userCache.keys())
});

export default {
  getUserByTgId,
  ensureUser,
  updateUserField,
  updateUserFields, 
  updateUserStep,
  updateUserActivity,
  finalizeRegistration,
  markUserRegistered,
  hasActiveAccess,
  activateTrial,
  getActiveUsers,
  clearCache,
  getCacheStats
};

console.log('✅ [userService] Сервіс ініціалізовано');