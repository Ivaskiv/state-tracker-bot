import { getBase } from '../config/database.js';

const base = getBase();
const USERS_TABLE = 'Users';

export async function getAllActiveUsers() {
  const records = await base('Users').select({
    filterByFormula: `AND(
      {Status} = 'Registered User',
      FIND('✅ Активна', {Active_Subscription_Status}),
      {TG_id} != ''
    )`
  }).firstPage();

  console.log(`🔹 getAllActiveUsers() повернув ${records.length} записів`);
  return records;
}

export async function getUserByTelegramId(tgId) {
  const records = await base(USERS_TABLE).select({
    filterByFormula: `{TG_id} = "${tgId}"`
  }).firstPage();
  return records[0] || null;
}

export async function updateUser(userId, fields) {
  return await base(USERS_TABLE).update([
    { id: userId, fields }
  ]);
}

export default {
  getAllActiveUsers,
  getUserByTelegramId,
  updateUser
};
