// src/services/users.js
import { ANSWER_STEPS, CONFIG, USER_STATUS } from '../config/constants.js';
import { getBase, tables, updateRows } from '../config/database.js';

const base = getBase();

/**
 * Повернути Airtable record користувача за TG_id (працює і для string, і для number).
 */
export const getUserByTgId = async (tgId) => {
  try {
    const num = Number(tgId);
    const asNumber = Number.isFinite(num) ? num : -1;

    const formula = `OR({TG_id} = "${tgId}", {TG_id} = ${asNumber})`;

    const records = await base(tables.USERS)
      .select({ filterByFormula: formula, maxRecords: 1 })
      .firstPage();

    if (!records.length) {
      console.log(`[user] ❌ Користувач ${tgId} не знайдений`);
      return null;
    }

    console.log(`[user] ✅ Користувач ${tgId} знайдено`);
    return records[0];
  } catch (error) {
    console.error('[user] ❌ Помилка getUserByTgId:', error);
    throw error;
  }
};

/**
 * Створити нового користувача (мінімальний профіль + стартовий step).
 */
export const createUser = async (tgId, userName) => {
  try {
    console.log(`[user] 📝 Створення користувача ${tgId}`);

    const [rec] = await base(tables.USERS).create([{
      fields: {
        TG_id: String(tgId),
        'User Name': userName || `User_${tgId}`,
        Status: USER_STATUS.NEW,
        Answer_Step: ANSWER_STEPS.OB_PITCH,
        Created_At: new Date().toISOString()
      }
    }], { typecast: true });

    console.log(`[user] ✅ Користувача створено: ${rec.id}`);
    return rec;
  } catch (error) {
    console.error('[user] ❌ Помилка createUser:', error);
    throw error;
  }
};

/**
 * Оновити поля Users по TG_id та повернути оновлений запис.
 */
export const updateUserFields = async (tgId, fields) => {
  const user = await getUserByTgId(tgId);
  if (!user) throw new Error('User not found');

  await updateRows(tables.USERS, [{ id: user.id, fields }]);
  return getUserByTgId(tgId);
};

export const updateUserStep = (tgId, step) =>
  updateUserFields(tgId, { Answer_Step: step });

export const updateUserActivity = async (tgId) => {
  const now = new Date(); now.setSeconds(0, 0);
  return updateUserFields(tgId, {
    Last_Activity: now.toISOString(),
    Last_Answer_Date: new Date().toISOString().split('T')[0]
  });
};

export const finalizeRegistration = async (tgId, data) => {
  const now = new Date(); now.setSeconds(0, 0);
  return updateUserFields(tgId, {
    'User Name': data.name,
    Email: data.email || null,
    Phone: data.phone || null,
    'Time_Zone': data.timezone || CONFIG.DEFAULT_TIMEZONE, // <— Time_Zone (як у тебе в Airtable)
    UserRegistered: true,
    Status: USER_STATUS.REGISTERED,
    Answer_Step: ANSWER_STEPS.COMPLETED,
    Last_Activity: now.toISOString(),
    Last_Answer_Date: new Date().toISOString().split('T')[0]
  });
};

export const activateTrial = async (tgId, days = 7) => {
  const start = new Date();
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  return updateUserFields(tgId, {
    'Active_Subscription_Plan': '🧪 Пробний період — 0€',
    'Subscription_Status': 'Active',
    Start_Date: start.toISOString().split('T')[0],
    End_Date: end.toISOString().split('T')[0]
  });
};

/* ──────────────────────────────────────────────────────────
   ✅ Централізовані хелпери доступу (single source of truth)
   Використання: hasActiveAccess(userRecord або fields), 
                 hasActiveAccessByFields(fields),
                 getSubscriptionText(userRecord або fields)
   ────────────────────────────────────────────────────────── */

/** Базова логіка активного доступу по «плоских» fields */
export const hasActiveAccessByFields = (fields = {}) => {
  if (!fields) return false;

  const plan = String(fields['Active_Subscription_Plan'] || '');
  const status = String(fields['Subscription_Status'] || '').trim().toLowerCase();

  // Активна підписка або пробний план
  if (status === 'active' || /пробний/i.test(plan)) return true;

  // Перевірка End_Date (дійсна до кінця дня)
  const endDate = fields.End_Date;
  if (!endDate) return false;

  const end = new Date(`${endDate}T23:59:59`);
  return new Date() <= end;
};

/** Адаптер: приймає Airtable record або fields */
export const hasActiveAccess = (userOrFields) => {
  const fields = userOrFields?.fields || userOrFields || {};
  return hasActiveAccessByFields(fields);
};

/** Готовий текст для UI (враховує формульне поле Active_Subscription_Status, якщо є) */
export const getSubscriptionText = (userOrFields) => {
  const fields = userOrFields?.fields || userOrFields || {};
  const formulaText = String(fields.Active_Subscription_Status || '').trim();

  if (formulaText) return formulaText;

  if (hasActiveAccessByFields(fields)) {
    if (fields.End_Date) {
      const [y, m, d] = fields.End_Date.split('-');
      return `✅ Активна до ${[d, m, y].join('.')}`;
    }
    return '✅ Активна';
  }
  return '❌ Немає активної підписки';
};

/**
 * Витяг активних користувачів (приклад використання у планувальнику).
 */
export const getActiveUsers = async () => {
  try {
    const records = await base(tables.USERS)
      .select({
        filterByFormula: `{Status} = "Active User"`,
        fields: ['TG_id', 'User Name', 'Subscription_Status', 'End_Date']
      })
      .all();
    return records;
  } catch (e) {
    console.error('[user] ❌ Помилка getActiveUsers:', e);
    return [];
  }
};

export default {
  getUserByTgId,
  createUser,
  updateUserFields,
  updateUserStep,
  updateUserActivity,
  finalizeRegistration,
  activateTrial,

  hasActiveAccessByFields,
  hasActiveAccess,
  getSubscriptionText,
  getActiveUsers
};
