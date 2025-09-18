// src/auth/services/userService.js - МІНІМАЛЬНА ВЕРСІЯ ТІЛЬКИ З БАЗОВИМИ ПОЛЯМИ
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
      // Спробуємо оновити тільки Answer_Step як показник активності
      await base('Users').update(records[0].id, { 
        Answer_Step: ANSWER_STEPS.COMPLETED 
      });
      console.log(`[userService] Оновлено активність для ${tgId}`);
    }
  } catch (error) {
    console.error('[userService.updateUserActivity] Помилка:', error);
  }
};

// ✅ МІНІМАЛЬНА ВЕРСІЯ - тільки обов'язкові поля
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
    
    // ✅ СПОЧАТКУ спробуємо тільки обов'язкові поля
    let userData = {
      'TG_id': String(tgId),
      'User Name': name || 'Користувач'
    };
    
    console.log(`[userService] 📝 Спроба 1 - мінімальні дані:`, userData);
    
    try {
      const record = await base('Users').create(userData);
      console.log(`[userService] ✅ Базовий користувач створений, ID: ${record.id}`);
      
      // Тепер спробуємо додати додаткові поля по одному
      const additionalFields = {};
      
      // Додаємо email якщо є
      if (email) {
        additionalFields['Email'] = email;
      }
      
      // Додаємо телефон якщо є
      if (phone) {
        additionalFields['Phone'] = phone;
      }
      
      // Додаємо часовий пояс якщо є
      if (timezone) {
        additionalFields['Time Zone'] = timezone;
      }
      
      // Додаємо Answer_Step
      additionalFields['Answer_Step'] = ANSWER_STEPS.COMPLETED;
      
      // Оновлюємо запис з додатковими полями
      if (Object.keys(additionalFields).length > 0) {
        try {
          await base('Users').update(record.id, additionalFields);
          console.log(`[userService] ✅ Додаткові поля оновлено:`, additionalFields);
        } catch (updateError) {
          console.warn(`[userService] ⚠️ Не вдалося оновити додаткові поля:`, updateError.message);
          // Продовжуємо - користувач уже створений
        }
      }
      
      // Отримуємо повну інформацію про користувача
      const fullUserRecord = await base('Users').find(record.id);
      
      return {
        id: record.id,
        ...fullUserRecord.fields
      };
      
    } catch (createError) {
      console.error(`[userService] ❌ Помилка створення базового користувача:`, createError.message);
      throw createError;
    }
    
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

    // ✅ ТІЛЬКИ поля дат - найбезпечніші для оновлення
    const updateFields = {
      'Start_Date': subscriptionData.startDate,
      'End_Date': subscriptionData.endDate
    };

    const updatedRecord = await base('Users').update(records[0].id, updateFields);

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