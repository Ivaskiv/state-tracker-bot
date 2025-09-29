// src/repositories/userRepository.js - ВИПРАВЛЕНО

import { selectOne, createRecord, updateRecord, findRecords } from '../config/database.js';
import { USER_STATUS, SUBSCRIPTION_STATUS, ANSWER_STEPS } from '../config/constants.js';

const TABLE = 'USERS';

// ===== READ =====
export const findByTgId = async (tgId) => {
  const filter = `{TG_id} = '${String(tgId)}'`;
  const record = await selectOne(TABLE, filter);
  console.log(`[userRepo] findByTgId(${tgId}):`, record ? 'ЗНАЙДЕНО' : 'НЕ ЗНАЙДЕНО');
  return record;
};

// ===== CREATE =====
export const createUser = async (tgId, name, timezone = 'Europe/Kiev (UTC+3)') => {
  const now = new Date().toISOString();
  
  console.log(`[userRepo] Створення користувача ${tgId}...`);
  
  const fields = {
    TG_id: String(tgId),
    'User Name': name,
    'Time Zone': timezone,
    UserRegistered: false,
    Status: USER_STATUS.NEW,
    'Subscription Status': SUBSCRIPTION_STATUS.NEW,
    Answer_Step: ANSWER_STEPS.OB_NAME,
    Created_At: now,
    Last_Activity: now
  };
  
  const record = await createRecord(TABLE, fields);
  console.log(`[userRepo] ✅ Користувача створено, ID: ${record.id}`);
  
  // Гарантуємо AT_id
  if (!record.fields.AT_id) {
    await updateRecord(TABLE, record.id, { AT_id: record.id });
    record.fields.AT_id = record.id;
    console.log(`[userRepo] ✅ AT_id встановлено: ${record.id}`);
  }
  
  return record;
};

// ===== UPDATE =====
export const updateUser = async (recordId, fields) => {
  console.log(`[userRepo] Оновлення користувача ${recordId}...`);
  
  const cleanFields = { ...fields };
  delete cleanFields['Active_Subscription_Status'];
  delete cleanFields['Last Modified Time'];
  
  cleanFields.Last_Activity = new Date().toISOString();
  
  const updated = await updateRecord(TABLE, recordId, cleanFields);
  console.log(`[userRepo] ✅ Користувача оновлено`);
  
  return updated;
};

// ===== BULK READ =====
export const findActiveUsers = async () => {
  return await findRecords(TABLE, {
    filterByFormula: `FIND('✅ Активна', {Active_Subscription_Status}) > 0`
  });
};

export default {
  findByTgId,
  createUser,
  updateUser,
  findActiveUsers
};