// src/auth/services/userService.js
import { getBase } from '../../config/database.js';
import { ANSWER_STEPS } from '../../config/constants.js';

const getActiveUsers = async () => {
  try {
    const base = getBase('Users');
    const records = await base('Users')
      .select({
        filterByFormula: "{Active_Subscription_Status} = '✅ Активна'",
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
    const base = getBase('Users');
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
    const base = getBase('Users');
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

const createUser = async ({ tgId, name, email }) => {
  try {
    const base = getBase('Users');
    const record = await base('Users').create({
      TG_id: tgId,
      'User Name': name,
      Email: email,
      Active_Subscription_Status: '❌ Неактивна',
      'Active Subscription Plan': 'Базовий',
      'Subscription Status': 'Inactive',
      Answer_Step: ANSWER_STEPS.PLAN_SELECTION, // після реєстрації одразу вибір плану
    });
    console.log(`[userService] Створено користувача: ${tgId}, крок: ${ANSWER_STEPS.PLAN_SELECTION}`);
    return record.fields;
  } catch (error) {
    console.error('[userService.createUser] Помилка:', error);
    return null;
  }
};

// Оновлення підписки користувача (для payment webhook)
const updateUserSubscription = async (tgId, subscriptionData) => {
  try {
    const base = getBase('Users');
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

// Отримання користувачів з підписками, що закінчуються
const getUsersWithExpiringSubscriptions = async (daysOffset) => {
  try {
    const base = getBase('Users');
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysOffset);
    const targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD

    const records = await base('Users')
      .select({
        filterByFormula: `AND(
          {Active_Subscription_Status} = '✅ Активна',
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
  createUser,
  updateUserSubscription,
  getUsersWithExpiringSubscriptions
};