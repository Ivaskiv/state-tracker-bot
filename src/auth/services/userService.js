// src/auth/services/userService.js
import { selectFromTable, getOneByFormula, createRows, updateRows } from '../../config/database.js';
import { ANSWER_STEPS } from '../../config/constants.js';

const TABLE = 'USERS';            // ключ із database.tables
const AT_TABLE_NAME = 'Users';    // фактична назва в Airtable (для логів/читабельності)

// ---- утиліти
const escapeFormula = (v) => String(v ?? '').replace(/'/g, "\\'");
const omitComputed = (fields = {}) => {
  const f = { ...fields };
  delete f['Active_Subscription_Status']; // обчислюване в Airtable
  delete f['Last Modified Time'];
  return f;
};

const mapRecord = (rec) => {
  const f = rec?.fields || {};
  return {
    id: rec.id,
    AT_id: f.AT_id || rec.id,
    TG_id: String(f.TG_id || ''),
    'User Name': f['User Name'] || '',
    Email: f.Email || '',
    Phone: f.Phone || '',
    'Time Zone': f['Time Zone'] || '',
    UserRegistered: Boolean(f.UserRegistered),
    Status: f.Status || 'New User',
    'Subscription Status': f['Subscription Status'] || 'New',
    'Active Subscription Plan': f['Active Subscription Plan'] || '',
    Start_Date: f.Start_Date || null,
    End_Date: f.End_Date || null,
    'Active_Subscription_Status': f['Active_Subscription_Status'] || '',
    Answer_Step: f.Answer_Step || ANSWER_STEPS.COMPLETED,
    Created_At: f.Created_At || null,
    Last_Activity: f.Last_Activity || null,
    DateUserRegistered: f.DateUserRegistered || null,
    'Registration Date': f['Registration Date'] || null,
  };
};

// ---- базові операції
export async function getUserByTelegramId(tgId) {
  const filter = `{TG_id} = '${escapeFormula(String(tgId))}'`;
  const rec = await getOneByFormula(TABLE, filter);
  return rec ? mapRecord(rec) : null;
}

export async function ensureUserRow(tgId, { name = '' } = {}) {
  const existing = await getUserByTelegramId(tgId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const fields = omitComputed({
    TG_id: String(tgId),
    'User Name': name || 'Користувач',
    UserRegistered: false,
    Status: 'New User',                // Single select
    'Subscription Status': 'New',      // Single select
    Answer_Step: ANSWER_STEPS.COMPLETED,
    Created_At: now,
    Last_Activity: now
  });

  const [created] = await createRows(TABLE, [{ fields }]);
  // гарантуємо AT_id
  if (!created.fields.AT_id) {
    await updateRows(TABLE, [{ id: created.id, fields: { AT_id: created.id } }]);
    created.fields.AT_id = created.id;
  }
  return mapRecord(created);
}

export async function updateUser(tgId, patch) {
  const user = await getUserByTelegramId(tgId);
  if (!user) return null;

  const fields = omitComputed({
    ...patch,
    Last_Activity: new Date().toISOString()
  });

  const [updated] = await updateRows(TABLE, [{ id: user.id, fields }]);
  // гарантуємо AT_id
  if (!updated.fields.AT_id) {
    await updateRows(TABLE, [{ id: updated.id, fields: { AT_id: updated.id } }]);
    updated.fields.AT_id = updated.id;
  }
  return mapRecord(updated);
}

export async function finalizeRegistration(tgId, { name, email, phone, timezoneLabel }) {
  const now = new Date().toISOString();
  return updateUser(tgId, {
    'User Name': name,
    Email: email || null,
    Phone: phone || null,
    'Time Zone': timezoneLabel,          // ВАЖЛИВО: повний LABEL з Single select
    UserRegistered: true,
    DateUserRegistered: now,
    'Registration Date': now,
    Status: 'Registered User',           // Single select
    Answer_Step: ANSWER_STEPS.COMPLETED
  });
}

export async function activateTrial(tgId, days = 7) {
  const start = new Date();
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);

  return updateUser(tgId, {
    'Active Subscription Plan': '🧪 Пробний період — 0€',
    'Subscription Status': 'Active',     // Single select
    Start_Date: start.toISOString(),
    End_Date: end.toISOString()
  });
}

export function hasActiveAccess(user) {
  if (!user) return false;
  // 1) статус
  if (String(user['Subscription Status']).toLowerCase() === 'active') return true;
  // 2) дата завершення
  const end = user.End_Date ? Date.parse(user.End_Date) : 0;
  return Boolean(end && end > Date.now());
}

export default {
  getUserByTelegramId,
  ensureUserRow,
  updateUser,
  finalizeRegistration,
  activateTrial,
  hasActiveAccess
};
