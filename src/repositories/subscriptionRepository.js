// src/repositories/subscriptionRepository.js
// — ІДЕМПОТЕНТНІСТЬ, КОРЕКТНІ СЕЛЕКТИ, БЕЗ ЗАПИСУ В ФОРМУЛЬНІ ПОЛЯ

import { selectFromTable, createRows, updateRows, getBase, tables } from '../config/database.js';

const TABLE = 'SUBSCRIPTIONS'; // мапиться на 'Subscriptions' у database.js

const toDateStr = (d) => new Date(d).toISOString().split('T')[0];

// ===== CREATE (idempotent) =====
export const createSubscription = async (tgId, planData) => {
  console.log(`[subscriptionRepo] 🆕 Створення підписки для ${tgId}...`);

  const now = new Date();
  const startDate = planData.startDate ? new Date(planData.startDate) : now;
  const endDate   = planData.endDate   ? new Date(planData.endDate)   : now;

  const startStr = toDateStr(startDate);
  const endStr   = toDateStr(endDate);
  const planName = planData.planName;

  try {
    // 🔒 ІДЕМПОТЕНТНІСТЬ: якщо вже є Active з тими ж датами/планом — не створюємо дубль
    const dupFilter = `AND(
      {TG_id}='${String(tgId)}',
      {Plan_Name}='${planName}',
      {Status}='Active',
      IS_SAME({Start_Date}, '${startStr}', 'day'),
      IS_SAME({End_Date}, '${endStr}', 'day')
    )`;

    const dupQuery = await selectFromTable(TABLE, {
      filterByFormula: dupFilter,
      maxRecords: 1
    }).firstPage();

    if (dupQuery.length) {
      console.log(`[subscriptionRepo] ♻️ Знайдено існуючий активний запис — повертаю без створення (${dupQuery[0].id})`);
      return dupQuery[0];
    }

    const fields = {
      TG_id: String(tgId),
      'User Name': planData.userName || 'Користувач',
      Order_Reference: planData.orderReference || `SUB_${tgId}_${Date.now()}`,
      Payment_Status: planData.paymentStatus || 'Approved',
      Status: planData.status || 'Active', // дозволені: Active | Pending | Expired | Cancelled | Failed
      Plan_Name: planName,
      Amount: planData.amount ?? 0,
      Start_Date: startStr,
      End_Date: endStr
      // ⛔️ НЕ пишемо формульні/автоматичні поля (Is_Active, Renewal_Date, Created time тощо)
    };

    const [record] = await createRows(TABLE, [{ fields }]);
    console.log(`[subscriptionRepo] ✅ Підписку створено, ID: ${record.id}`);
    return record;

  } catch (error) {
    console.error(`[subscriptionRepo] ❌ Помилка createSubscription:`, error.message);
    throw error;
  }
};

// ===== READ =====
export const findSubscriptionByTgId = async (tgId) => {
  console.log(`[subscriptionRepo] 🔍 Пошук підписки для ${tgId}...`);
  try {
    const page = await selectFromTable(TABLE, {
      filterByFormula: `{TG_id}='${String(tgId)}'`,
      sort: [{ field: 'End_Date', direction: 'desc' }],
      maxRecords: 1
    }).firstPage();

    const found = page.length ? page[0] : null;
    console.log(`[subscriptionRepo] ${found ? '✅ Знайдено' : '❌ Не знайдено'}`);
    return found;
  } catch (error) {
    console.error(`[subscriptionRepo] ❌ Помилка findSubscriptionByTgId:`, error.message);
    throw error;
  }
};

export const findActiveSubscription = async (tgId) => {
  console.log(`[subscriptionRepo] 🔍 Пошук активної підписки для ${tgId}...`);
  try {
    const page = await selectFromTable(TABLE, {
      filterByFormula: `AND({TG_id}='${String(tgId)}', {Status}='Active')`,
      sort: [{ field: 'End_Date', direction: 'desc' }],
      maxRecords: 1
    }).firstPage();

    const found = page.length ? page[0] : null;
    console.log(`[subscriptionRepo] ${found ? '✅ Активна підписка знайдена' : '❌ Активної підписки немає'}`);
    return found;
  } catch (error) {
    console.error(`[subscriptionRepo] ❌ Помилка findActiveSubscription:`, error.message);
    throw error;
  }
};

export const findSubscriptionsByStatus = async (status = 'Active') => {
  console.log(`[subscriptionRepo] 📋 Пошук підписок зі статусом: ${status}...`);
  try {
    // потрібно отримати ВСІ записи → .all()
    const base = getBase();
    const records = await base(tables.SUBSCRIPTIONS).select({
      filterByFormula: `{Status}='${status}'`,
      sort: [{ field: 'End_Date', direction: 'asc' }]
    }).all();

    console.log(`[subscriptionRepo] ✅ Знайдено ${records.length} підписок`);
    return records;
  } catch (error) {
    console.error(`[subscriptionRepo] ❌ Помилка findSubscriptionsByStatus:`, error.message);
    return [];
  }
};

export const findExpiringSubscriptions = async (daysAhead = 1) => {
  console.log(`[subscriptionRepo] ⏰ Пошук підписок що закінчуються через ${daysAhead} днів...`);

  const today = new Date();
  const target = new Date(today);
  target.setDate(today.getDate() + daysAhead);

  const todayStr  = toDateStr(today);
  const targetStr = toDateStr(target);

  try {
    const base = getBase();
    const records = await base(tables.SUBSCRIPTIONS).select({
      filterByFormula: `AND(
        {Status}='Active',
        IS_AFTER({End_Date}, '${todayStr}'),
        IS_BEFORE({End_Date}, '${targetStr}')
      )`,
      sort: [{ field: 'End_Date', direction: 'asc' }]
    }).all();

    console.log(`[subscriptionRepo] ✅ Знайдено ${records.length} підписок що закінчуються`);
    return records;
  } catch (error) {
    console.error(`[subscriptionRepo] ❌ Помилка findExpiringSubscriptions:`, error.message);
    return [];
  }
};

// ===== UPDATE =====
export const updateSubscription = async (recordId, fields) => {
  console.log(`[subscriptionRepo] 🔄 Оновлення підписки ${recordId}...`);
  try {
    // прибираємо формульні/авто-поля, якщо випадково передали
    const { Is_Active, Renewal_Date, Created_time, Last_Modified, ...safe } = fields || {};
    const [updated] = await updateRows(TABLE, [{ id: recordId, fields: safe }]);
    console.log(`[subscriptionRepo] ✅ Підписку оновлено`);
    return updated;
  } catch (error) {
    console.error(`[subscriptionRepo] ❌ Помилка updateSubscription:`, error.message);
    throw error;
  }
};

export const deactivateSubscription = async (recordId) => {
  console.log(`[subscriptionRepo] 🔴 Деактивація підписки ${recordId}...`);
  try {
    const [updated] = await updateRows(TABLE, [{
      id: recordId,
      fields: { Status: 'Expired' } // ⛔️ Is_Active не чіпаємо (формула)
    }]);
    console.log(`[subscriptionRepo] ✅ Підписку деактивовано`);
    return updated;
  } catch (error) {
    console.error(`[subscriptionRepo] ❌ Помилка deactivateSubscription:`, error.message);
    throw error;
  }
};

export const renewSubscription = async (recordId, endDate) => {
  console.log(`[subscriptionRepo] 🔄 Продовження підписки ${recordId}...`);
  const endDateStr = toDateStr(endDate);
  try {
    const [updated] = await updateRows(TABLE, [{
      id: recordId,
      fields: {
        Status: 'Active',
        End_Date: endDateStr
        // ⛔️ Is_Active / Renewal_Date — формули/авто
      }
    }]);
    console.log(`[subscriptionRepo] ✅ Підписку продовжено до ${endDateStr}`);
    return updated;
  } catch (error) {
    console.error(`[subscriptionRepo] ❌ Помилка renewSubscription:`, error.message);
    throw error;
  }
};

// ===== BULK =====
export const deactivateExpiredSubscriptions = async () => {
  console.log(`[subscriptionRepo] 🔍 Пошук прострочених підписок...`);
  const todayStr = toDateStr(new Date());

  try {
    const base = getBase();
    const expired = await base(tables.SUBSCRIPTIONS).select({
      filterByFormula: `AND(
        {Status}='Active',
        IS_BEFORE({End_Date}, '${todayStr}')
      )`
    }).all();

    if (!expired.length) {
      console.log(`[subscriptionRepo] ℹ️ Прострочених підписок не знайдено`);
      return 0;
    }

    console.log(`[subscriptionRepo] ⚠️ Знайдено ${expired.length} прострочених підписок`);
    const updates = expired.map(r => ({ id: r.id, fields: { Status: 'Expired' } }));
    await updateRows(TABLE, updates);

    console.log(`[subscriptionRepo] ✅ Деактивовано ${expired.length} підписок`);
    return expired.length;
  } catch (error) {
    console.error(`[subscriptionRepo] ❌ Помилка deactivateExpiredSubscriptions:`, error.message);
    return 0;
  }
};

// ===== STATS =====
export const getSubscriptionStats = async () => {
  console.log(`[subscriptionRepo] 📊 Збір статистики підписок...`);
  try {
    const base = getBase();
    const [active, expired, trial] = await Promise.all([
      base(tables.SUBSCRIPTIONS).select({ filterByFormula: `{Status}='Active'` }).all(),
      base(tables.SUBSCRIPTIONS).select({ filterByFormula: `{Status}='Expired'` }).all(),
      base(tables.SUBSCRIPTIONS).select({ filterByFormula: `FIND('Пробний', {Plan_Name}) > 0` }).all(),
    ]);

    const stats = {
      active: active.length,
      expired: expired.length,
      trial: trial.length,
      total: active.length + expired.length
    };
    console.log(`[subscriptionRepo] 📊 Статистика:`, stats);
    return stats;
  } catch (error) {
    console.error(`[subscriptionRepo] ❌ Помилка getSubscriptionStats:`, error.message);
    return { active: 0, expired: 0, trial: 0, total: 0 };
  }
};

export default {
  createSubscription,
  findSubscriptionByTgId,
  findActiveSubscription,
  findSubscriptionsByStatus,
  findExpiringSubscriptions,
  updateSubscription,
  deactivateSubscription,
  renewSubscription,
  deactivateExpiredSubscriptions,
  getSubscriptionStats
};

console.log('✅ [subscriptionRepo] Репозиторій підписок ініціалізовано');
