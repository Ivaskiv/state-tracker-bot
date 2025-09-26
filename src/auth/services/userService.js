// src/auth/services/userService.js - ОПТИМІЗОВАНИЙ СЕРВІС КОРИСТУВАЧІВ

import { getBase, tables, selectFromTable, createRows, updateRows } from '../../config/database.js';
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
      // Перевіряємо кеш
      const cached = this.userCache.get(stringId);
      if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
        return cached.user;
      }

      console.log(`[USER SERVICE] 🔍 Пошук користувача ${stringId}`);

      const records = await selectFromTable('USERS', {
        filterByFormula: `{TG_id} = '${stringId}'`,
        maxRecords: 1
      });

      if (records.length === 0) {
        console.log(`[USER SERVICE] ❌ Користувач ${stringId} не знайдений`);
        this.userCache.delete(stringId);
        return null;
      }

      const user = this.normalizeUserData(records[0]);
      
      // Кешуємо користувача
      this.userCache.set(stringId, {
        user,
        timestamp: Date.now()
      });

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

      // Перевіряємо чи не існує
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
      
      if (records.length === 0) {
        throw new Error('Не вдалося створити користувача');
      }

      const createdUser = this.normalizeUserData(records[0]);
      
      // Кешуємо нового користувача
      this.userCache.set(stringId, {
        user: createdUser,
        timestamp: Date.now()
      });

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

      // Знаходимо користувача
      const records = await selectFromTable('USERS', {
        filterByFormula: `{TG_id} = '${stringId}'`,
        maxRecords: 1
      });

      if (records.length === 0) {
        console.warn(`[USER SERVICE] ⚠️ Користувача ${stringId} не знайдено для оновлення`);
        return null;
      }

      const updateData = {
        id: records[0].id,
        fields: {
          ...fields,
          'Last_Activity': new Date().toISOString()
        }
      };

      const updatedRecords = await updateRows('USERS', [updateData]);
      
      if (updatedRecords.length === 0) {
        throw new Error('Не вдалося оновити користувача');
      }

      const updatedUser = this.normalizeUserData(updatedRecords[0]);
      
      // Оновлюємо кеш
      this.userCache.set(stringId, {
        user: updatedUser,
        timestamp: Date.now()
      });

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

      const users = records.map(record => this.normalizeUserData(record));
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

      const users = records.map(record => record.fields);
      console.log(`[USER SERVICE] 📊 Знайдено ${users.length} підписок що закінчуються`);

      return users;

    } catch (error) {
      console.error('[USER SERVICE] ❌ Помилка пошуку підписок що закінчуються:', error);
      return [];
    }
  }

  // ===== ПЕРЕВІРКА АКТИВНОГО ДОСТУПУ =====
  hasActiveAccess(user) {
    if (!user) {
      return false;
    }

    const subscriptionStatus = String(user['Active_Subscription_Status'] || '');
    const generalStatus = String(user['Subscription Status'] || '');
    const planName = String(user['Active Subscription Plan'] || '');
    const endDate = user['End_Date'];

    // Перевіряємо за статусом підписки
    if (subscriptionStatus.includes('✅ Активна')) {
      return true;
    }

    if (generalStatus === 'Active') {
      return true;
    }

    // Перевіряємо пробну підписку
    if (planName.toLowerCase().includes('пробн') || planName.toLowerCase().includes('trial')) {
      if (endDate) {
        try {
          const now = new Date();
          const expiry = new Date(endDate);
          return now < expiry;
        } catch (error) {
          console.warn('[USER SERVICE] Помилка парсингу дати:', error);
        }
      }
    }

    return false;
  }

  // ===== НОРМАЛІЗАЦІЯ ДАНИХ КОРИСТУВАЧА =====
  normalizeUserData(record) {
    if (!record || !record.fields) {
      return null;
    }

    const fields = record.fields;
    
    return {
      id: record.id,
      'TG_id': String(fields['TG_id'] || ''),
      'User Name': fields['User Name'] || '',
      'Email': fields['Email'] || '',
      'Phone': fields['Phone'] || '',
      'Time Zone': fields['Time Zone'] || 'Europe/Kyiv',
      'UserRegistered': Boolean(fields['UserRegistered']),
      'Registration Date': fields['Registration Date'] || fields['Created_At'],
      'Status': fields['Status'] || 'New User',
      'Subscription Status': fields['Subscription Status'] || 'New',
      'Active Subscription Plan': fields['Active Subscription Plan'] || '',
      'Active_Subscription_Status': fields['Active_Subscription_Status'] || '❌ Неактивна',
      'Start_Date': fields['Start_Date'],
      'End_Date': fields['End_Date'],
      'Answer_Step': fields['Answer_Step'] || ANSWER_STEPS.COMPLETED,
      'Last_Activity': fields['Last_Activity'],
      'Created_At': fields['Created_At'],
      // Додаткові поля для сумісності
      daily_main_goal: fields['daily_main_goal'],
      daily_state: fields['daily_state'],
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
    return {
      size: this.userCache.size,
      timeout: this.cacheTimeout
    };
  }
}

// Створюємо та експортуємо єдиний інстанс
const userService = new UserService();

export default userService;