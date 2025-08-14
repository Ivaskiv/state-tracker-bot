// src/utils/airtable.js
import Airtable from 'airtable';
import { config } from '../config/config.js';

const base = new Airtable({ apiKey: config.airtableApiKey }).base(config.airtableBaseId);

// ===== USERS =====
export const getUserByTgId = async (tgId) => {
  const records = await base('Users')
    .select({ filterByFormula: `{tg_user_id}='${tgId}'`, maxRecords: 1 })
    .firstPage();
  return records?.[0] || null;
};

export const createUser = async (fields) => {
  const records = await base('Users').create([{ fields }]);
  return records[0];
};

export const updateUser = async (tgId, fields) => {
  const user = await getUserByTgId(tgId);
  if (!user) throw new Error('User not found');
  const records = await base('Users').update([{ id: user.id, fields }]);
  return records[0];
};

export const getUsers = async () => await base('Users').select().all();

export const getActiveUsers = async () =>
  await base('Users').select({ filterByFormula: `{Status}='Active'` }).all();

// ===== RECORDS =====
export const createRecord = async (record) => {
  const records = await base('Records').create([{ fields: record }]);
  return records[0];
};

export const getRecordsByUserAndDate = async (userId, startDate, endDate) => {
  return await base('Records')
    .select({
      filterByFormula: `AND({userId}='${userId}', {timestamp} >= '${startDate}', {timestamp} < '${endDate}')`
    })
    .all();
};

// ===== RESPONSES =====
export const createDailyResponse = async (response) => {
  const records = await base('Responses').create([{ fields: response }]);
  return records[0];
};

export const getTodayResponse = async (tgUserId, sessionType) => {
  const today = new Date().toISOString().split('T')[0];
  const records = await base('Responses')
    .select({
      filterByFormula: `AND({tg_user_id}='${tgUserId}', {date}='${today}', {session_type}='${sessionType}')`,
      maxRecords: 1
    })
    .firstPage();
  return records?.[0] || null;
};

export const incrementUserResponses = async (tgUserId) => {
  const user = await getUserByTgId(tgUserId);
  if (!user) throw new Error('User not found');
  const count = (user.fields.totalResponses || 0) + 1;
  return await updateUser(tgUserId, { totalResponses: count });
};

// Отримати відповіді користувача за період
export const getUserResponses = async (tgUserId, startDate, endDate) => {
  return await base('Responses')
    .select({
      filterByFormula: `AND({tg_user_id}='${tgUserId}', {date} >= '${startDate}', {date} <= '${endDate}')`
    })
    .all();
};

// Оновлює щоденну відповідь за userId та дату
export const updateDailyResponse = async (userId, date, fields) => {
  const records = await base('Responses')
    .select({ filterByFormula: `AND({userId}='${userId}', {date}='${date}')`, maxRecords: 1 })
    .firstPage();

  if (!records[0]) throw new Error('Daily response not found');

  const updated = await base('Responses').update([{ id: records[0].id, fields }]);
  return updated[0];
};