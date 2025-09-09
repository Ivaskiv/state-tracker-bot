// src/auth/services/userService.js
import { getBase } from '../../config/database.js';

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
      Answer_Step: ANSWER_STEPS.COMPLETED,
    });
    return record.fields;
  } catch (error) {
    console.error('[userService.createUser] Помилка:', error);
    return null;
  }
};

export default { getActiveUsers, getUserByTelegramId, updateUserStep, createUser };