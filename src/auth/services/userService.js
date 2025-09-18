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

// Виправлена функція в src/auth/services/userService.js

const getUserByTelegramId = async (tgId) => {
  try {
    console.log(`[userService] 🔍 ПОШУК користувача з TG_id: ${tgId}`);
    console.log(`[userService] Тип TG_id: ${typeof tgId}`);
    
    const base = getBase();
    const tgIdString = String(tgId);
    
    console.log(`[userService] Конвертований в рядок: "${tgIdString}"`);
    
    // ✅ ЄДИНИЙ ПРАВИЛЬНИЙ СПОСІБ ПОШУКУ - як рядок
    const records = await base('Users').select({
      filterByFormula: `{TG_id} = "${tgIdString}"`,
      maxRecords: 1
    }).firstPage();
    
    console.log(`[userService] 📊 Результат пошуку: знайдено ${records.length} записів`);
    
    if (records.length > 0) {
      const user = records[0].fields;
      console.log(`[userService] ✅ КОРИСТУВАЧ ЗНАЙДЕНИЙ:`);
      console.log(`- Запис ID: ${records[0].id}`);
      console.log(`- TG_id з бази: ${user['TG_id']}`);
      console.log(`- Ім'я: ${user['User Name']}`);
      console.log(`- Email: ${user['Email'] || 'не вказано'}`);
      console.log(`- Підписка: ${user['Active_Subscription_Status'] || 'не вказано'}`);
      
      return user;
    }
    
    // Якщо не знайшли - діагностика
    console.log(`[userService] ❌ КОРИСТУВАЧ НЕ ЗНАЙДЕНИЙ`);
    console.log(`[userService] 🔍 ДІАГНОСТИКА - перевіряємо що є в базі...`);
    
    try {
      const allUsers = await base('Users').select({
        maxRecords: 5,
        fields: ['TG_id', 'User Name'],
        sort: [{ field: 'TG_id', direction: 'desc' }]
      }).firstPage();
      
      console.log(`[userService] 📋 Останні 5 користувачів в базі:`);
      allUsers.forEach((record, index) => {
        console.log(`${index + 1}. TG_id: "${record.fields.TG_id}" (тип: ${typeof record.fields.TG_id}), Ім'я: "${record.fields['User Name']}"`);
      });
      
      // Перевіряємо чи є подібні ID
      const similarUsers = allUsers.filter(record => {
        const dbTgId = String(record.fields.TG_id || '');
        return dbTgId.includes(tgIdString) || tgIdString.includes(dbTgId);
      });
      
      if (similarUsers.length > 0) {
        console.log(`[userService] 🔍 Знайдено подібні TG_id:`);
        similarUsers.forEach(record => {
          console.log(`- "${record.fields.TG_id}" (шукали: "${tgIdString}")`);
        });
      }
      
    } catch (diagError) {
      console.error(`[userService] ❌ Помилка діагностики:`, diagError);
    }
    
    return null;
    
  } catch (error) {
    console.error('[userService.getUserByTelegramId] ❌ КРИТИЧНА ПОМИЛКА:', {
      message: error.message,
      stack: error.stack,
      tgId,
      tgIdType: typeof tgId
    });
    throw error; // Пробрасываем ошибку выше для обработки
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