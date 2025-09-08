// src/auth/services/userService.js
import { getBase } from '../../config/database.js';

const base = getBase();
const USERS_TABLE = 'Users';

export const getUserByTelegramId = async (tgId) => {
  const records = await base(USERS_TABLE).select({
    filterByFormula: `{TG_id}="${tgId}"`,
    maxRecords: 1
  }).firstPage();
  
  return records.length > 0 ? records[0].fields : null;
};

export const createUser = async ({ tgId, name, email }) => {
  const [record] = await base(USERS_TABLE).create([{
    fields: {
      'TG_id': String(tgId),
      'User Name': name,
      'Email': email || '',
      'Answer_Step': 'completed',
      'Active_Subscription_Status': '✅ Активна'
    }
  }]);
  return record.fields;
};

export const updateUserStep = async (tgId, step) => {
  const records = await base(USERS_TABLE).select({
    filterByFormula: `{TG_id}="${tgId}"`,
    maxRecords: 1
  }).firstPage();
  
  if (records.length > 0) {
    await base(USERS_TABLE).update([{
      id: records[0].id,
      fields: { 'Answer_Step': step }
    }]);
  }
};

export const getAllUsers = async () => {
  const records = await base(USERS_TABLE).select().all();
  return records.map(r => ({ ...r.fields, id: r.id }));
};

export default { getUserByTelegramId, createUser, updateUserStep, getAllUsers };