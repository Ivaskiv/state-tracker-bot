// src/services/userService.js
// src/services/userService.js
import { getBase, tables } from '../config/database.js';
const base = getBase();

export const getUserByTelegramId = async (tgId) => {
  const records = await base(tables.USERS)
    .select({ filterByFormula: `{TG_id}="${tgId}"` })
    .firstPage();

  return records.length ? records[0].fields : null;
};

export const updateUserStep = async (tgId, step) => {
  try {
    const records = await base(tables.USERS)
      .select({ filterByFormula: `{TG_id}="${tgId}"` })
      .firstPage();

    if (!records.length) return null;

    const recordId = records[0].id;

    const updatedRecord = await base(tables.USERS).update([
      { id: recordId, fields: { Answer_Step: step } }
    ]);

    console.log(`[userService] Updated Answer_Step for ${tgId} -> ${step}`);
    return updatedRecord[0].fields;
  } catch (error) {
    console.error('[userService] Error updating step:', error);
    throw error;
  }
};

export const getAllUsers = async () => {
  const records = await base(tables.USERS).select().all();
  return records.map(r => r.fields);
};

export default { getUserByTelegramId, updateUserStep, getAllUsers };
