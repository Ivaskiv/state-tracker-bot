// src/services/userService.js - ВИПРАВЛЕНО ЛОГІКУ РЕЄСТРАЦІЇ

import userRepo from '../repositories/userRepository.js';
import { USER_STATUS, SUBSCRIPTION_STATUS, ANSWER_STEPS, CONFIG } from '../config/constants.js';

// ===== КЕШ КОРИСТУВАЧІВ =====
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 хвилин

// ===== MAPPER =====
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
    'Start_Date': f.Start_Date || null,
    'End_Date': f.End_Date || null,
    'Active_Subscription_Status': f['Active_Subscription_Status'] || '',
    Answer_Step: f.Answer_Step || ANSWER_STEPS.COMPLETED,
    Created_At: f.Created_At || null,
    Last_Activity: f.Last_Activity || null,
    CreatedUserTime: f.CreatedUserTime || null
  };
};

// ===== ОСНОВНІ ОПЕРАЦІЇ =====

// ✅ GET USER З КЕШЕМ
export const getUserByTgId = async (tgId) => {
  const cacheKey = String(tgId);
  
  // Перевіряємо кеш
  const cached = userCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[userService] 💾 Користувач з кешу: ${tgId}`);
    return cached.user;
  }
  
  // Якщо немає в кеші - запитуємо з БД
  console.log(`[userService] 🔍 getUserByTgId(${tgId}) - запит до БД...`);
  const record = await userRepo.findByTgId(tgId);
  const user = mapRecord(record);
  
  // Зберігаємо в кеш якщо знайшли
  if (user) {
    userCache.set(cacheKey, {
      user,
      timestamp: Date.now()
    });
    console.log(`[userService] ✅ Користувача ${user['User Name']} додано до кешу`);
  } else {
    console.log(`[userService] ❌ Користувача ${tgId} не знайдено`);
  }
  
  return user;
};

// ✅ ENSURE USER - НЕ СТВОРЮЄ ДУБЛІКАТІВ
export const ensureUser = async (tgId, name) => {
  console.log(`[userService] 🔍 ensureUser(${tgId}, ${name})...`);
  
  // Спочатку перевіряємо чи існує
  let user = await getUserByTgId(tgId);
  
  if (user) {
    console.log(`[userService] ✅ Користувач вже існує: ${user['User Name']}, UserRegistered: ${user.UserRegistered}, Status: ${user.Status}`);
    return user;
  }
  
  // ✅ СТВОРЮЄМО ТІЛЬКИ якщо НЕ ІСНУЄ
  console.log(`[userService] 🆕 Створюємо нового користувача...`);
  const record = await userRepo.createUser(tgId, String(tgId));
  user = mapRecord(record);
  
  // Додаємо до кешу
  if (user) {
    userCache.set(String(tgId), {
      user,
      timestamp: Date.now()
    });
    console.log(`[userService] ✅ Користувача створено: ${user['User Name']}, UserRegistered: ${user.UserRegistered}, Status: ${user.Status}`);
  }
  
  return user;
};

// ✅ UPDATE USER З ОЧИЩЕННЯМ КЕШУ
export const updateUserFields = async (tgId, fields) => {
  console.log(`[userService] updateUserFields(${tgId})...`, Object.keys(fields));
  
  const user = await getUserByTgId(tgId);
  if (!user) {
    console.log(`[userService] ❌ Користувача не знайдено`);
    return null;
  }
  
  const updated = await userRepo.updateUser(user.id, fields);
  const result = mapRecord(updated);
  
  // ✅ ВИДАЛЯЄМО З КЕШУ після оновлення
  userCache.delete(String(tgId));
  console.log(`[userService] 🗑️ Кеш очищено для ${tgId}`);
  
  console.log(`[userService] ✅ Поля оновлено`);
  return result;
};

// ===== ПЕРЕВІРКА ДОСТУПУ =====
export const hasActiveAccess = (user) => {
  if (!user) return false;
  
  // 1) За статусом
  if (user['Subscription Status'] === SUBSCRIPTION_STATUS.ACTIVE) return true;
  
  // 2) За датою
  const endDate = user.End_Date;
  if (!endDate) return false;
  
  const expiry = new Date(endDate).getTime();
  const now = Date.now();
  
  return expiry > now;
};

// ===== ФІНАЛІЗАЦІЯ РЕЄСТРАЦІЇ =====
export const finalizeRegistration = async (tgId, data) => {
  const now = new Date().toISOString();
  
  console.log(`[userService] finalizeRegistration(${tgId})...`);
  
  return await updateUserFields(tgId, {
    'User Name': data.name,
    Email: data.email || null,
    Phone: data.phone || null,
    'Time Zone': data.timezone,
    UserRegistered: true,
    CreatedUserTime: now, // ✅ Правильна назва поля
    Answer_Step: ANSWER_STEPS.COMPLETED
  });
};

// ===== АКТИВАЦІЯ TRIAL =====
export const activateTrial = async (tgId, days = 7) => {
  const start = new Date();
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  
  console.log(`[userService] activateTrial(${tgId}, ${days} днів)...`);
  
  return await updateUserFields(tgId, {
    'Active Subscription Plan': '🧪 Пробний період — 0€',
    'Subscription Status': SUBSCRIPTION_STATUS.ACTIVE,
    'Start_Date': start.toISOString(),
    'End_Date': end.toISOString()
  });
};

// ===== УТИЛІТИ КЕШУ =====
export const clearCache = (tgId = null) => {
  if (tgId) {
    userCache.delete(String(tgId));
    console.log(`[userService] 🗑️ Кеш очищено для ${tgId}`);
  } else {
    const size = userCache.size;
    userCache.clear();
    console.log(`[userService] 🗑️ Весь кеш очищено (${size} записів)`);
  }
};

export const getCacheStats = () => {
  return {
    size: userCache.size,
    users: Array.from(userCache.keys())
  };
};

// ===== ЕКСПОРТ =====
export default {
  getUserByTgId,
  ensureUser, // ✅ ДОДАНО
  updateUserFields,
  hasActiveAccess,
  finalizeRegistration,
  activateTrial,
  clearCache,
  getCacheStats
};

console.log('✅ [userService] Сервіс з кешем ініціалізовано');