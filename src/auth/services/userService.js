// src/auth/services/userService.js
// ОСТАТОЧНО ВИПРАВЛЕНО: ретраї, мапінг полів, апдейти по TG_id, читабельні логи.

import { getBase } from '../../config/database.js';
import { ANSWER_STEPS } from '../../config/constants.js';

/** ----------------------------------------------------------
 * Універсальний ретрай для операцій Airtable (з backoff)
 * ---------------------------------------------------------*/
const retryAirtableOperation = async (operation, maxRetries = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.log(
        `[retryAirtableOperation] Спроба ${attempt}/${maxRetries} невдала: ${error?.message || error}`
      );
      if (attempt === maxRetries) throw error;
      await new Promise((r) => setTimeout(r, delay * attempt));
    }
  }
};

/** ----------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------*/
const TABLE = 'Users';

const normalizeUserFields = (fields) => {
  // Нормалізація назв для внутрішнього вжитку (щоб не падали місця з різними ключами)
  return {
    ...fields,
    TG_id: String(fields?.TG_id ?? fields?.tg_id ?? ''),
    'User Name': fields?.['User Name'] ?? fields?.name ?? '',
    Timezone: fields?.Timezone || fields?.['Time Zone'] || fields?.TZ || '',
    'Active_Subscription_Status': fields?.['Active_Subscription_Status'] ?? fields?.subscription_status ?? '',
  };
};

const selectByTgId = async (base, tgId) => {
  return base(TABLE)
    .select({
      filterByFormula: `{TG_id} = '${String(tgId)}'`,
      maxRecords: 1
    })
    .firstPage();
};

/** ----------------------------------------------------------
 * READ
 * ---------------------------------------------------------*/
const getActiveUsers = async () => {
  try {
    return await retryAirtableOperation(async () => {
      const base = getBase();
      const records = await base(TABLE)
        .select({
          filterByFormula: "FIND('✅ Активна', {Active_Subscription_Status}) > 0"
        })
        .all();
      return records.map((r) => normalizeUserFields(r.fields));
    });
  } catch (error) {
    console.error('[userService.getActiveUsers] Помилка:', error);
    return [];
  }
};

const getUserByTelegramId = async (tgId) => {
  try {
    return await retryAirtableOperation(async () => {
      const base = getBase();
      const records = await selectByTgId(base, tgId);
      console.log(
        `[userService.getUserByTelegramId] Пошук користувача ${tgId}: знайдено ${records.length} запис(ів)`
      );
      return records.length > 0 ? normalizeUserFields(records[0].fields) : null;
    });
  } catch (error) {
    console.error('[userService.getUserByTelegramId] Помилка:', error);
    return null;
  }
};

/** ----------------------------------------------------------
 * UPDATE
 * ---------------------------------------------------------*/
const updateUserStep = async (tgId, step) => {
  try {
    return await retryAirtableOperation(async () => {
      const base = getBase();
      const records = await selectByTgId(base, tgId);
      if (!records.length) {
        console.warn(`[userService.updateUserStep] Юзера ${tgId} не знайдено`);
        return;
      }
      await base(TABLE).update(records[0].id, { Answer_Step: step });
      console.log(`[userService] Оновлено Answer_Step для ${tgId}: ${step}`);
    });
  } catch (error) {
    console.error('[userService.updateUserStep] Помилка:', error);
  }
};

const updateUserActivity = async (tgId) => {
  try {
    return await retryAirtableOperation(async () => {
      const base = getBase();
      const records = await selectByTgId(base, tgId);
      if (!records.length) {
        console.warn(`[userService.updateUserActivity] Юзера ${tgId} не знайдено`);
        return;
      }
      await base(TABLE).update(records[0].id, { Answer_Step: ANSWER_STEPS.COMPLETED });
      console.log(`[userService] Оновлено активність (Answer_Step=COMPLETED) для ${tgId}`);
    });
  } catch (error) {
    console.error('[userService.updateUserActivity] Помилка:', error);
  }
};

/**
 * Гнучкий апдейт довільних полів по TG_id.
 * fields — об’єкт з полями Airtable (за назвами у базі).
 */
const updateUser = async (tgId, fields) => {
  if (!fields || typeof fields !== 'object') return;
  try {
    return await retryAirtableOperation(async () => {
      const base = getBase();
      const records = await selectByTgId(base, tgId);
      if (!records.length) {
        console.warn(`[userService.updateUser] Юзера ${tgId} не знайдено`);
        return null;
      }
      const updated = await base(TABLE).update(records[0].id, fields, { typecast: true });
      console.log(`[userService.updateUser] Оновлено ${tgId}:`, Object.keys(fields));
      return normalizeUserFields(updated.fields);
    });
  } catch (error) {
    console.error('[userService.updateUser] Помилка:', error);
    return null;
  }
};

/** ----------------------------------------------------------
 * CREATE / UPSERT
 * ---------------------------------------------------------*/
const createUser = async ({
  tgId,
  name,
  email,
  phone,
  timezone,
  registrationStatus = 'in_progress'
}) => {
  const maxRetries = 5; // Більше спроб для створення

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[userService.createUser] 🆕 СПРОБА ${attempt}/${maxRetries} створення користувача ${tgId}`);

      const base = getBase();

      // Підготовка полів (під твою схему)
      const userData = {
        TG_id: String(tgId),
        'User Name': name || 'Користувач',

        // Флаги реєстрації (підтримуємо і checkbox, і статус)
        UserRegistered: registrationStatus === 'done',
        DateUserRegistered: new Date().toISOString(),
        Status: registrationStatus === 'done' ? 'Registered User' : 'New User', // single select
        'Subscription Status': 'New', // single select (не плутати з Active_Subscription_Status)

        // Базовий стан
        Answer_Step: ANSWER_STEPS.COMPLETED
      };

      if (email) userData.Email = email;
      if (phone) userData.Phone = phone;
      if (timezone) {
        // підтримуємо обидва варіанти назв поля
        userData['Time Zone'] = timezone;
        userData.Timezone = timezone;
      }

      console.log(`[userService.createUser] 📝 Дані для створення:`, userData);

      const records = await base(TABLE).create([{ fields: userData }], {
        typecast: true,
        returnFieldsByFieldId: false
      });

      const createdRecord = records[0];
      console.log(`[userService.createUser] ✅ Створено: ${createdRecord.id}`);

      return normalizeUserFields(createdRecord.fields);
    } catch (error) {
      console.error(`[userService.createUser] ❌ Спроба ${attempt}/${maxRetries} невдала:`, {
        message: error?.message,
        statusCode: error?.statusCode,
        error: error?.error
      });

      // Детальні підказки
      if (error?.statusCode === 422) {
        console.error('🔍 422 Validation: перевір назви полів та опції Single Select.');
        if (error?.error?.type === 'INVALID_MULTIPLE_CHOICE_OPTIONS') {
          console.error('💡 Додай опції: "New User", "Registered User" в Status; "New" у Subscription Status.');
        }
      }
      if (error?.statusCode === 403) {
        console.error('🔐 403 Access: перевір API ключ/права.');
      }
      if (error?.statusCode === 404) {
        console.error('📋 404: Таблицю/базу не знайдено. Перевір назву таблиці "Users" та BASE_ID.');
      }

      if (attempt === maxRetries) throw error;
      await new Promise((r) => setTimeout(r, 700 * attempt));
    }
  }
};

/**
 * Upsert: якщо юзер існує — оновлюємо, якщо ні — створюємо.
 */
const upsertUser = async (payload) => {
  const existing = await getUserByTelegramId(payload.tgId);
  if (existing) {
    return await updateUser(payload.tgId, {
      'User Name': payload.name ?? existing['User Name'],
      Email: payload.email ?? existing.Email,
      Phone: payload.phone ?? existing.Phone,
      'Time Zone': payload.timezone ?? existing.Timezone,
      Timezone: payload.timezone ?? existing.Timezone
    });
  }
  return await createUser(payload);
};

/** ----------------------------------------------------------
 * BUSINESS HELPERS
 * ---------------------------------------------------------*/
const setRegistrationDone = async (tgId, timezone, name) => {
  return updateUser(tgId, {
    Registration_Status: 'done',
    UserRegistered: true,
    DateUserRegistered: new Date().toISOString(),
    Status: 'Registered User',
    'User Name': name,
    'Time Zone': timezone,
    Timezone: timezone
  });
};

const checkSubscriptionStatus = async (tgId) => {
  const user = await getUserByTelegramId(tgId);
  const raw = user?.['Active_Subscription_Status'] || '';
  const active = raw.includes('✅ Активна');
  return { active, raw };
};

/** ----------------------------------------------------------
 * EXPORTS
 * ---------------------------------------------------------*/
export default {
  getActiveUsers,
  getUserByTelegramId,
  updateUserStep,
  updateUserActivity,
  updateUser,
  createUser,
  upsertUser,
  setRegistrationDone,
  checkSubscriptionStatus
};
