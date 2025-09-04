import { getBase, tables } from '../../config/database.js';
const base = getBase();

// Отримання користувача за TG_id
export const getUserByTelegramId = async (tgId) => {
  try {
    const records = await base(tables.USERS)
      .select({
        filterByFormula: `{TG_id} = "${tgId}"`,
      })
      .firstPage();
    return records.length > 0 ? records[0].fields : null;
  } catch (error) {
    console.error('[userService] Помилка в getUserByTelegramId:', error);
    return null;
  }
};

// Створення користувача
export const createUser = async ({ tgId, name, email = null, phone = null }) => {
  try {
    const createdRecords = await base(tables.USERS).create([
      {
        fields: {
          TG_id: String(tgId),
          'User Name': name,
          Email: email,
          Phone: phone,
          Active_Subscription_Status: '❌ Неактивна',
          Answer_Step: 'completed'
        },
      },
    ]);
    return createdRecords[0].fields;
  } catch (error) {
    console.error('[userService] Помилка в createUser:', error);
    throw error;
  }
};

// Отримання всіх користувачів
export const getAllUsers = async () => {
  try {
    const records = await base(tables.USERS).select().all();
    return records.map((record) => record.fields);
  } catch (error) {
    console.error('[userService] Помилка в getAllUsers:', error);
    return [];
  }
};

// Оновлення Answer_Step
export const updateUserStep = async (tgId, step) => {
  try {
    const records = await base(tables.USERS)
      .select({
        filterByFormula: `{TG_id} = "${tgId}"`,
      })
      .firstPage();
    if (records.length > 0) {
      await base(tables.USERS).update([
        {
          id: records[0].id,
          fields: { Answer_Step: step },
        },
      ]);
      console.log(`[userService] Оновлено Answer_Step для ${tgId} -> ${step}`);
    }
  } catch (error) {
    console.error('[userService] Помилка в updateUserStep:', error);
    throw error;
  }
};

export default { getUserByTelegramId, createUser, getAllUsers, updateUserStep };