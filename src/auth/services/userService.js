// src/auth/services/userService.js - ВИПРАВЛЕНО ДЛЯ РОБОТИ З AIRTABLE
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
        Answer_Step: ANSWER_STEPS.COMPLETED 
      });
      console.log(`[userService] Оновлено активність для ${tgId}`);
    }
  } catch (error) {
    console.error('[userService.updateUserActivity] Помилка:', error);
  }
};

// ✅ ВИПРАВЛЕНО: створюємо користувача тільки з дозволеними полями
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
    
    // ✅ Спочатку створюємо з мінімальними полями
    const basicData = {
      'TG_id': String(tgId),
      'User Name': name || 'Користувач'
    };
    
    console.log(`[userService] 📝 Створення базового користувача:`, basicData);
    
    const record = await base('Users').create(basicData);
    console.log(`[userService] ✅ Базовий користувач створений, ID: ${record.id}`);
    
    // ✅ Тепер намагаємося додати додаткові поля, але ігноруємо помилки
    const additionalUpdates = {};
    
    if (email) {
      additionalUpdates['Email'] = email;
    }
    
    if (phone) {
      additionalUpdates['Phone'] = phone;
    }
    
    // ✅ ВИПРАВЛЕНО: додаємо Answer_Step для правильного стану
    additionalUpdates['Answer_Step'] = ANSWER_STEPS.COMPLETED;
    
    // ✅ НЕ додаємо Time Zone - це поле викликає помилки в Airtable
    // Залишаємо тільки безпечні поля
    
    if (Object.keys(additionalUpdates).length > 0) {
      try {
        await base('Users').update(record.id, additionalUpdates);
        console.log(`[userService] ✅ Додаткові поля оновлено:`, additionalUpdates);
      } catch (updateError) {
        console.warn(`[userService] ⚠️ Деякі додаткові поля не вдалося оновити:`, updateError.message);
        // Не кидаємо помилку - користувач уже створений
      }
    }
    
    // ✅ Отримуємо повну інформацію про користувача
    const fullUserRecord = await base('Users').find(record.id);
    
    console.log(`[userService] 🎉 Користувача успішно створено:`, {
      id: record.id,
      tgId: fullUserRecord.fields['TG_id'],
      name: fullUserRecord.fields['User Name'],
      email: fullUserRecord.fields['Email'] || 'не вказано',
      phone: fullUserRecord.fields['Phone'] || 'не вказано',
      subscriptionStatus: fullUserRecord.fields['Active_Subscription_Status'] || 'невідомо'
    });
    
    return {
      id: record.id,
      ...fullUserRecord.fields
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

// ✅ ДОДАНО: функція для перевірки чи користувач існує
const checkUserExists = async (tgId) => {
  try {
    const user = await getUserByTelegramId(tgId);
    if (user) {
      console.log(`[userService] ✅ Користувач ${tgId} знайдений в базі:`, {
        name: user['User Name'],
        email: user['Email'],
        subscriptionStatus: user['Active_Subscription_Status']
      });
      return true;
    } else {
      console.log(`[userService] ❌ Користувача ${tgId} не знайдено в базі`);
      return false;
    }
  } catch (error) {
    console.error('[userService.checkUserExists] Помилка:', error);
    return false;
  }
};

export default { 
  getActiveUsers, 
  getUserByTelegramId, 
  updateUserStep, 
  updateUserActivity, 
  createUser,
  updateUserSubscription,
  getUsersWithExpiringSubscriptions,
  checkUserExists // ✅ ДОДАНО для діагностики
};