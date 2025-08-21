// src/services/userService.js
import { getBase } from '../config/database.js';
const base = getBase();
const USERS_TABLE = 'Users';

async function getUserByTelegramId(tgId) {
  const records = await base(USERS_TABLE).select({
    filterByFormula: `{TG_id} = "${tgId}"`,
    maxRecords: 1
  }).firstPage();
  return records[0] || null;
}

async function updateUser(recordId, fields) {
  await base(USERS_TABLE).update([{ id: recordId, fields }]);
}

async function getAllActiveUsers() {
  const records = await base(USERS_TABLE).select({
    filterByFormula: "AND({Status} = 'Registered User', {Active_Subscription_Status} = '✅ Активна')"
  }).firstPage();
  return records;
}

// При старті /start
async function handleStart({ tgId, name }) {
  let user = await getUserByTelegramId(tgId);
  if (!user) {
    user = await base(USERS_TABLE).create([
      { fields: { TG_id: tgId, 'User Name': name, Status: 'Registered User', 'Active_Subscription_Status': '❌ Неактивна' } }
    ]);
    user = user[0];
  }
  const subscriptionActive = user.fields['Active_Subscription_Status']?.startsWith('✅');
  return { user, subscriptionActive };
}

export default {
  getUserByTelegramId,
  updateUser,
  getAllActiveUsers,
  handleStart
};
