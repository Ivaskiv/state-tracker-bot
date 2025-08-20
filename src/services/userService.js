// src/services/userService.js
import base from '../config/airtable.js';

const USERS = 'Users';

async function getUserByTelegramId(tgId) {
  const records = await base(USERS).select({
    filterByFormula: `{TG_id} = "${String(tgId)}"`,
    maxRecords: 1
  }).firstPage();
  return records[0] || null;
}

async function createUser({ tgId, name, email = '', phone = '' }) {
  const created = await base(USERS).create([{
    fields: {
      'User Name': name,
      'TG_id': String(tgId),
      'Email': email,
      'Phone': phone,
      'UserRegistered': true,
      'DateUserRegistered': new Date().toISOString(),
      'Status': 'Registered User',
      'Subscription Status': 'Empty',
      'Time Zone': 'Europe/Kyiv'
    }
  }], { typecast: true });
  return created[0];
}

async function updateUser(recordId, fields) {
  const updated = await base(USERS).update([{ id: recordId, fields }], { typecast: true });
  return updated[0];
}

async function hasActiveSubscription(tgId) {
  const user = await getUserByTelegramId(tgId);
  if (!user) return false;
  const v = user.fields['Active_Subscription_Status'];
  // Поле в твоїй базі формульне та містить "✅ Активна до DD.MM.YYYY"
  return typeof v === 'string' && v.includes('✅ Активна');
}

async function getActiveUsers() {
  const records = await base(USERS).select({
    filterByFormula: `AND({Active_Subscription_Status} != '', FIND("✅ Активна", {Active_Subscription_Status}) > 0, {Status} = 'Active User')`
  }).all();

  return records.map(r => ({
    airtableId: r.id,
    tgId: r.fields.TG_id,
    name: r.fields['User Name'] || 'Користувач'
  }));
}

export default {
  getUserByTelegramId,
  createUser,
  updateUser,
  hasActiveSubscription,
  getActiveUsers
};
