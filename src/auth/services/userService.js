// src/auth/services/userService.js - ВИПРАВЛЕНО СТВОРЕННЯ КОРИСТУВАЧА
import { getBase } from '../../config/database.js';
import { ANSWER_STEPS } from '../../config/constants.js';

const getActiveUsers = async () => {
  try {
    const base = getBase();
    const records = await base('Users')
      .select({
        filterByFormula: "FIND('✅ Активна', {Active_Subscription_Status}) > 0"
      })
      .all();
    return records.map((r) => r.fields);
  } catch (error) {
    console.error('[userService.getActiveUsers] Помилка:', error);
    return [];
  }
};

const getUserByTelegramId = async (tgId) => {
  try {
    const base = getBase();
    const records = await base('Users')
      .select({
        filterByFormula: `{TG_id} = '${tgId}'`,
      })
      .firstPage();
    return records.length > 0 ? records[0].fields : null;
  } catch (error) {
    console.error('[userService.getUserByTelegramId] Помилка:', error);
    return null;
  }
};

const updateUserStep = async (tgId, step) => {
  try {
    const base = getBase();
    const records = await base('Users')
      .select({
        filterByFormula: `{TG_id} = '${tgId}'`,
      })
      .firstPage();
    if (records.length > 0) {
      await base('Users').update(records[0].id, { Answer_Step: step });
      console.log(`[userService] Оновлено крок для ${tgId}: ${step}`);
    }
  } catch (error) {
    console.error('[userService.updateUserStep] Помилка:', error);
  }
};

const updateUserActivity = async (tgId) => {
  try {
    const base = getBase();
    const records = await base('Users')
      .select({
        filterByFormula: `{TG_id} = '${tgId}'`,
      })
      .firstPage();
    if (records.length > 0) {
      await base('Users').update(records[0].id, { 
        Last_Activity: new Date().toISOString() 
      });
      console.log(`[userService] Оновлено активність для ${tgId}`);
    }
  } catch (error) {
    console.error('[userService.updateUserActivity] Помилка:', error);
  }
};

// ВИПРАВЛЕНО: правильні назви полів та обробка помилок
const createUser = async ({ tgId, name, email, phone, timezone }) => {
  try {
    console.log(`[userService] 🆕 Створення користувача:`, {
      tgId,
      name,
      email,
      phone,
      timezone
    });
    
    const base = getBase();
    
    // ВИПРАВЛЕНО: правильна структура даних для Airtable
    const userData = {
      'TG_id': String(tgId), // ВАЖЛИВО: конвертуємо в строку
      'User Name': name || 'Користувач',
      'Email': email || null,
      'Phone': phone || null,
      'Time_Zone': timezone || 'Europe/Prague',
      'Active_Subscription_Status': '❌ Неактивна',
      'Active Subscription Plan': null,
      'Subscription Status': 'Inactive',
      'Answer_Step': ANSWER_STEPS.COMPLETED,
      'Last_Activity': new Date().toISOString(),
      'Created_At': new Date().toISOString() // ДОДАНО дата створення
    };
    
    console.log(`[userService] 📝 Дані для збереження:`, userData);
    
    const record = await base('Users').create(userData);
    
    console.log(`[userService] ✅ Користувача створено успішно:`, {
      id: record.id,
      tgId: userData['TG_id'],
      name: userData['User Name'],
      timezone: userData['Time_Zone']
    });
    
    // Повертаємо дані користувача
    return {
      id: record.id,
      ...userData
    };
    
  } catch (error) {
    console.error('[userService.createUser] ❌ КРИТИЧНА ПОМИЛКА:', {
      message: error.message,
      stack: error.stack,
      tgId,
      name,
      email,
      phone,
      timezone
    });
    
    // ВИПРАВЛЕНО: кидаємо помилку для обробки вище
    throw new Error(`Не вдалося створити користувача: ${error.message}`);
  }
};

const updateUserSubscription = async (tgId, subscriptionData) => {
  try {
    const base = getBase();
    const records = await base('Users')
      .select({
        filterByFormula: `{TG_id} = '${tgId}'`,
      })
      .firstPage();
      
    if (records.length === 0) {
      console.error(`[userService] Користувача ${tgId} не знайдено для оновлення підписки`);
      return null;
    }

    const updatedRecord = await base('Users').update(records[0].id, {
      'Active_Subscription_Status': subscriptionData.status,
      'Active Subscription Plan': subscriptionData.plan,
      'Subscription Status': subscriptionData.subscriptionStatus,
      'Start_Date': subscriptionData.startDate,
      'End_Date': subscriptionData.endDate,
      Answer_Step: ANSWER_STEPS.COMPLETED
    });

    console.log(`[userService] Оновлено підписку для ${tgId}: ${subscriptionData.plan}`);
    return updatedRecord.fields;
  } catch (error) {
    console.error('[userService.updateUserSubscription] Помилка:', error);
    return null;
  }
};

const getUsersWithExpiringSubscriptions = async (daysOffset) => {
  try {
    const base = getBase();
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysOffset);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    const records = await base('Users')
      .select({
        filterByFormula: `AND(
          FIND('✅ Активна', {Active_Subscription_Status}) > 0,
          DATESTR({End_Date}) = '${targetDateStr}'
        )`,
        fields: ['TG_id', 'User Name', 'Active Subscription Plan', 'End_Date']
      })
      .all();

    return records.map(r => r.fields);
  } catch (error) {
    console.error('[userService.getUsersWithExpiringSubscriptions] Помилка:', error);
    return [];
  }
};

export default { 
  getActiveUsers, 
  getUserByTelegramId, 
  updateUserStep, 
  updateUserActivity, 
  createUser,
  updateUserSubscription,
  getUsersWithExpiringSubscriptions
};