// src/services/userService.js - ФІКС: hasActiveAccess З ЛОГАМИ + ДАТИ + TRUST STATUS

import userRepo from '../repositories/userRepository.js';
import { USER_STATUS, SUBSCRIPTION_STATUS, CURRENT_ACTIVITY, CONFIG } from '../config/constants.js';

// ===== КЕШ КОРИСТУВАЧІВ =====
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 хвилин
// ✅ НОВИЙ: Batch-запити для scheduler
const batchCache = {
  activeUsers: { data: null, timestamp: 0, ttl: 5 * 60 * 1000 },
  expiringUsers: { data: null, timestamp: 0, ttl: 10 * 60 * 1000 }
};
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
    Start_Date: f.Start_Date || null, // ✅ З підкресленням як поле в Airtable
    End_Date: f.End_Date || null, // ✅ З підкресленням як поле в Airtable
    'Active_Subscription_Status': f['Active_Subscription_Status'] || '',
    Current_Activity: f.Current_Activity || CURRENT_ACTIVITY.COMPLETED,
    Created_At: f.Created_At || null,
    Last_Activity: f.Last_Activity || null,
    'Registration Date': f['Registration Date'] || null
  };
};

// ===== ✅ ВИПРАВЛЕНА: hasActiveAccess З ЛОГАМИ + ДАТИ + TRUST STATUS =====
export const hasActiveAccess = (user) => {
  if (!user) {
    console.log(`[userService] ❌ hasActiveAccess: No user`);
    return false;
  }
  
  const subStatus = (user['Subscription Status'] || '').trim().toLowerCase();
  const activeStatus = (user['Active_Subscription_Status'] || '').trim();
  const plan = user['Active Subscription Plan'] || '';
  
  // 1) За статусом (довіряємо якщо 'Active' або '✅ Активна' або план з '🧪')
  const isStatusActive = subStatus === 'active' || 
                         activeStatus.includes('✅') || 
                         activeStatus.toLowerCase().includes('активна') ||
                         plan.includes('🧪 пробний');
  
  console.log(`[userService] 🔑 hasActiveAccess: SubStatus="${subStatus}", ActiveStatus="${activeStatus}", Plan="${plan}", isStatusActive=${isStatusActive}`);
  
  if (isStatusActive) {
    console.log(`[userService] ✅ hasActiveAccess: True (status OK)`);
    return true; // ✅ TRUST STATUS - ігнор дат для trial/active
  }
  
  // 2) Fallback за датою (якщо статус не active, але дати OK)
  const startDateStr = user.Start_Date;
  const endDateStr = user.End_Date;
  if (startDateStr && endDateStr) {
    try {
      const start = new Date(startDateStr + 'T00:00:00');
      const end = new Date(endDateStr + 'T23:59:59'); // ✅ До кінця дня
      const now = new Date();
      
      const isDateActive = now >= start && now <= end;
      console.log(`[userService] 📅 Dates: Start="${startDateStr}" (${start.toDateString()}), End="${endDateStr}" (${end.toDateString()}), Now="${now.toDateString()}", isDateActive=${isDateActive}`);
      
      if (isDateActive) {
        console.log(`[userService] ✅ hasActiveAccess: True (dates OK)`);
        return true;
      }
    } catch (dateError) {
      console.error(`[userService] ❌ hasActiveAccess: Date parse error:`, dateError);
      // Fallback: якщо дати не парсяться - false
      return false;
    }
  }
  
  console.log(`[userService] ❌ hasActiveAccess: False (status + dates fail)`);
  return false;
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
  
  // ✅ СТВОРЮЄМО ТІЛЬКИ якщо НЕ ІСНУЄ - використовуємо ім'я з Telegram
  console.log(`[userService] 🆕 Створюємо нового користувача...`);
  const record = await userRepo.createUser(tgId, name || String(tgId)); // ✅ ВИПРАВЛЕНО
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
  
  // ✅ ЗАВЖДИ запитуємо свіжі дані з БД (ігноруємо кеш)
  userCache.delete(String(tgId));
  const record = await userRepo.findByTgId(tgId);
  const user = mapRecord(record);
  
  if (!user) {
    console.log(`[userService] ❌ Користувача не знайдено`);
    return null;
  }
  
  try {
    const updated = await userRepo.updateUser(user.id, fields);
    const result = mapRecord(updated);
    
    console.log(`[userService] ✅ Поля оновлено`);
    return result;
  } catch (error) {
    console.error(`[userService] ❌ Помилка оновлення: ${error.message}`);
    // Очищаємо кеш при помилці
    userCache.delete(String(tgId));
    throw error;
  }
};

export const finalizeRegistration = async (tgId, data) => {
  const now = new Date().toISOString();
  console.log(`[userService] finalizeRegistration(${tgId})...`);
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
// ===== АКТИВАЦІЯ TRIAL =====
export const activateTrial = async (tgId, days = 7) => {
  const start = new Date();
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  
  console.log(`[userService] activateTrial(${tgId}, ${days} днів)...`);
  
  return await updateUserFields(tgId, {
    'Active Subscription Plan': '🧪 Пробний період — 0€',
    'Subscription Status': SUBSCRIPTION_STATUS.ACTIVE,
    Start_Date: start.toISOString().split('T')[0], // ✅ ТІЛЬКИ ДАТА: 2025-01-15
    End_Date: end.toISOString().split('T')[0] // ✅ ТІЛЬКИ ДАТА: 2025-01-22
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
// ===== ОНОВЛЕННЯ КРОКУ КОРИСТУВАЧА =====
export const updateUserStep = async (tgId, step) => {
  console.log(`[userService] 🔄 updateUserStep(${tgId}, ${step})`);
  
  // Інвалідуємо індивідуальний кеш
  userCache.delete(String(tgId));
  
  return await updateUserFields(tgId, {
    Current_Activity: step
  });
};

// ===== ОНОВЛЕННЯ АКТИВНОСТІ КОРИСТУВАЧА =====
export const updateUserActivity = async (tgId) => {
  console.log(`[userService] 🔄 updateUserActivity(${tgId})`);
  
  try {
    return await updateUserFields(tgId, {
      Last_Activity: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[userService] ❌ Помилка updateUserActivity:`, error.message);
    throw error;
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

// ===== ОТРИМАННЯ КОРИСТУВАЧІВ З ПІДПИСКАМИ, ЩО ЗАКІНЧУЮТЬСЯ =====
export const getUsersWithExpiringSubscriptions = async (daysAhead = 1) => {
  console.log(`[userService] ⏰ Пошук підписок що закінчуються через ${daysAhead} днів`);
  
  try {
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysAhead);
    
    const todayStr = today.toISOString().split('T')[0];
    const targetStr = targetDate.toISOString().split('T')[0];
    
    const { getBase, tables } = await import('../config/database.js');
    const base = getBase();
    
    const records = await base(tables.USERS)
      .select({
        filterByFormula: `AND(
          FIND('✅', {Active_Subscription_Status}) > 0,
          IS_AFTER({End_Date}, '${todayStr}'),
          IS_BEFORE({End_Date}, '${targetStr}')
        )`,
        fields: ['TG_id', 'User Name', 'End_Date', 'Active Subscription Plan']
      })
      .all();
    
    const users = records.map(r => mapRecord(r)).filter(u => u !== null);
    
    console.log(`[userService] ✅ Знайдено ${users.length} підписок що закінчуються`);
    return users;
    
  } catch (error) {
    console.error('[userService] ❌ Помилка пошуку підписок що закінчуються:', error);
    return [];
  }
};

export default {
getUserByTgId,
  getActiveUsers,
  ensureUser,
  updateUserFields,
  updateUserStep,
  updateUserActivity,
  getUsersWithExpiringSubscriptions,
  hasActiveAccess,
  finalizeRegistration,
  activateTrial,
  clearCache,
  getCacheStats
};

console.log('✅ [userService] Сервіс з кешем ініціалізовано');