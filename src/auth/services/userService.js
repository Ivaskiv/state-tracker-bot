// src/auth/services/userService.js - ОПТИМІЗОВАНИЙ СЕРВІС КОРИСТУВАЧІВ

import { selectFromTable, createRows, updateRows } from '../../config/database.js';
import { ANSWER_STEPS } from '../../config/constants.js';

class UserService {
  constructor() {
    this.userCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 хвилин
  }

  // ===== ОТРИМАННЯ КОРИСТУВАЧА =====
async getUserByTelegramId(tgId) {
  const stringId = String(tgId);

  try {
    // Кеш
    const cached = this.userCache.get(stringId);
    if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
      return cached.user;
    }

    console.log(`[USER SERVICE] 🔍 Пошук користувача ${stringId}`);

    const records = await selectFromTable('USERS', {
      filterByFormula: `{TG_id} = '${stringId}'`,
      maxRecords: 1
    });

    if (!records || records.length === 0) {
      console.log(`[USER SERVICE] ❌ Користувач ${stringId} не знайдений`);
      this.userCache.delete(stringId);
      return null;
    }

    const user = this.normalizeUserData(records[0]);

    // Кешуємо
    this.userCache.set(stringId, { user, timestamp: Date.now() });

    console.log(`[USER SERVICE] ✅ Користувач ${stringId} знайдений:`, {
      name: user['User Name'],
      registered: user.UserRegistered,
      subscription: user['Active_Subscription_Status']?.substring(0, 30)
    });

    return user;
  } catch (error) {
    console.error(`[USER SERVICE] ❌ Помилка отримання користувача ${stringId}:`, error);
    return null;
  }
}
  // ===== СТВОРЕННЯ КОРИСТУВАЧА =====
  async createUser({ tgId, name, email, phone, timezone, registrationStatus = 'New' }) {
    const stringId = String(tgId);
    try {
      console.log(`[USER SERVICE] 🆕 Створення користувача ${stringId}`);

      const existingUser = await this.getUserByTelegramId(stringId);
      if (existingUser) {
        console.log(`[USER SERVICE] ⚠️ Користувач ${stringId} вже існує`);
        return existingUser;
      }

      const userData = {
        fields: {
          'TG_id': stringId,
          'User Name': name || 'Користувач',
          'Email': email || `user${tgId}@temp.com`,
          'Phone': phone || '+380000000000',
          'Time Zone': timezone || 'Europe/Kyiv',
          'UserRegistered': true,
          'Registration Date': new Date().toISOString(),
          'Status': 'Registered User',
          'Subscription Status': registrationStatus,
          'Answer_Step': ANSWER_STEPS.COMPLETED,
          'Last_Activity': new Date().toISOString(),
          'Created_At': new Date().toISOString()
        }
      };

      const records = await createRows('USERS', [userData]);
      if (!records || records.length === 0) throw new Error('Не вдалося створити користувача');

      const createdUser = this.normalizeUserData(records[0]);
      this.userCache.set(stringId, { user: createdUser, timestamp: Date.now() });

      console.log(`[USER SERVICE] ✅ Користувача ${stringId} створено`);
      return createdUser;

    } catch (error) {
      console.error(`[USER SERVICE] ❌ Помилка створення користувача ${stringId}:`, error);
      throw error;
    }
  }

  // ===== ОНОВЛЕННЯ КОРИСТУВАЧА =====
  async updateUser(tgId, fields) {
    const stringId = String(tgId);

    if (!fields || typeof fields !== 'object' || Object.keys(fields).length === 0) {
      console.warn(`[USER SERVICE] ⚠️ Порожні поля для оновлення ${stringId}`);
      return null;
    }

    try {
      console.log(`[USER SERVICE] 🔄 Оновлення користувача ${stringId}`, Object.keys(fields));

      const records = await selectFromTable('USERS', {
        filterByFormula: `{TG_id} = '${stringId}'`,
        maxRecords: 1
      });

      if (!records || records.length === 0) {
        console.warn(`[USER SERVICE] ⚠️ Користувача ${stringId} не знайдено для оновлення`);
        return null;
      }

      const updateData = {
        id: records[0].id,
        fields: { ...fields, 'Last_Activity': new Date().toISOString() }
      };

      const updatedRecords = await updateRows('USERS', [updateData]);
      if (!updatedRecords || updatedRecords.length === 0) throw new Error('Не вдалося оновити користувача');

      const updatedUser = this.normalizeUserData(updatedRecords[0]);
      this.userCache.set(stringId, { user: updatedUser, timestamp: Date.now() });

      console.log(`[USER SERVICE] ✅ Користувача ${stringId} оновлено`);
      return updatedUser;

    } catch (error) {
      console.error(`[USER SERVICE] ❌ Помилка оновлення користувача ${stringId}:`, error);
      return null;
    }
  }

  // ===== ОНОВЛЕННЯ КРОКУ =====
  async updateUserStep(tgId, step) {
    return await this.updateUser(tgId, { Answer_Step: step });
  }

  // ===== ОНОВЛЕННЯ АКТИВНОСТІ =====
  async updateUserActivity(tgId) {
    return await this.updateUser(tgId, { Answer_Step: ANSWER_STEPS.COMPLETED });
  }

  // ===== ОТРИМАННЯ АКТИВНИХ КОРИСТУВАЧІВ =====
  async getActiveUsers() {
    try {
      console.log('[USER SERVICE] 🔍 Пошук активних користувачів');
      const records = await selectFromTable('USERS', {
        filterByFormula: `FIND('✅ Активна', {Active_Subscription_Status}) > 0`
      });
      const users = (records || []).map((r) => this.normalizeUserData(r));
      console.log(`[USER SERVICE] ✅ Знайдено ${users.length} активних користувачів`);
      return users;
    } catch (error) {
      console.error('[USER SERVICE] ❌ Помилка отримання активних користувачів:', error);
      return [];
    }
  }

  // ===== ОТРИМАННЯ КОРИСТУВАЧІВ З ПІДПИСКАМИ ЩО ЗАКІНЧУЮТЬСЯ =====
  async getUsersWithExpiringSubscriptions(daysOffset = 1) {
    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysOffset);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      console.log(`[USER SERVICE] 📅 Пошук підписок що закінчуються ${targetDateStr}`);

      const records = await selectFromTable('USERS', {
        filterByFormula: `AND(
          FIND('✅ Активна', {Active_Subscription_Status}) > 0,
          DATESTR({End_Date}) = '${targetDateStr}'
        )`,
        fields: ['TG_id', 'User Name', 'Active Subscription Plan', 'End_Date']
      });

      const users = (records || []).map((r) => r.fields);
      console.log(`[USER SERVICE] 📊 Знайдено ${users.length} підписок що закінчуються`);
      return users;

    } catch (error) {
      console.error('[USER SERVICE] ❌ Помилка пошуку підписок що закінчуються:', error);
      return [];
    }
  }

  // ===== ПЕРЕВІРКА АКТИВНОГО ДОСТУПУ =====
  hasActiveAccess(user) {
    if (!user) return false;

    const subscriptionStatus = String(user['Active_Subscription_Status'] || '');
    const generalStatus = String(user['Subscription Status'] || '');
    const planName = String(user['Active Subscription Plan'] || '');
    const endDate = user['End_Date'];

    if (subscriptionStatus.includes('✅ Активна')) return true;
    if (generalStatus === 'Active') return true;

    if (planName.toLowerCase().includes('пробн') || planName.toLowerCase().includes('trial')) {
      if (endDate) {
        try {
          return new Date() < new Date(endDate);
        } catch (e) {
          console.warn('[USER SERVICE] Помилка парсингу дати:', e);
        }
      }
    }
    return false;
  }

  // ===== НОРМАЛІЗАЦІЯ ДАНИХ КОРИСТУВАЧА =====
  normalizeUserData(record) {
    if (!record || !record.fields) return null;
    const f = record.fields;

    return {
      id: record.id,
      'TG_id': String(f['TG_id'] || ''),
      'User Name': f['User Name'] || '',
      'Email': f['Email'] || '',
      'Phone': f['Phone'] || '',
      'Time Zone': f['Time Zone'] || 'Europe/Kyiv',
      'UserRegistered': Boolean(f['UserRegistered']),
      'Registration Date': f['Registration Date'] || f['Created_At'],
      'Status': f['Status'] || 'New User',
      'Subscription Status': f['Subscription Status'] || 'New',
      'Active Subscription Plan': f['Active Subscription Plan'] || '',
      'Active_Subscription_Status': f['Active_Subscription_Status'] || '❌ Неактивна',
      'Start_Date': f['Start_Date'],
      'End_Date': f['End_Date'],
      'Answer_Step': f['Answer_Step'] || ANSWER_STEPS.COMPLETED,
      'Last_Activity': f['Last_Activity'],
      'Created_At': f['Created_At'],
      // Додаткові поля для сумісності
      daily_main_goal: f['daily_main_goal'],
      daily_state: f['daily_state'],
      AT_id: record.id
    };
  }

  // ===== ОЧИЩЕННЯ КЕШУ =====
  clearCache(tgId = null) {
    if (tgId) {
      this.userCache.delete(String(tgId));
      console.log(`[USER SERVICE] 🧹 Кеш користувача ${tgId} очищено`);
    } else {
      this.userCache.clear();
      console.log('[USER SERVICE] 🧹 Весь кеш користувачів очищено');
    }
  }

  // ===== СТАТИСТИКА =====
  getCacheStats() {
    return { size: this.userCache.size, timeout: this.cacheTimeout };
  }
}

const userService = new UserService();
export default userService;
