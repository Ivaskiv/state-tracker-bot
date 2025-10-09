// src/services/dataSyncService.js
// Оновлений: апсерт цілей (не видаляємо всі), синхронізація main goal (Q_m_5) і стану (Q_m_7).
// Всі функції — стрілкові.

import { getBase, tables } from '../config/database.js';
import logger from '../utils/logger.js';

const base = getBase();

// ==== HELPERS ====
const _todayStr = () => new Date().toISOString().split('T')[0];

const _normalize = (s) => (String(s || '').trim());

// ===== СИНХРОНІЗАЦІЯ ЦІЛЕЙ (апсерт) =====
const syncGoalsToUserGoals = async (tgId, data) => {
  try {
    const today = _todayStr();
    const newGoals = [];

    // Збираємо нові цілі з полів Goal_1..Goal_10 або альтернативних ключів
    for (let i = 1; i <= 10; i++) {
      const g = data[`Goal_${i}`] || data[`Daily_Goal_${i}`];
      if (_normalize(g)) {
        newGoals.push({
          text: _normalize(g),
          priority: 11 - i
        });
      }
    }

    // Якщо немає нових цілей — нічого не робимо
    if (!newGoals.length) {
      logger.info(`[dataSyncService] ℹ️ No goals to sync for ${tgId}`);
      return 0;
    }

    // Отримуємо існуючі цілі користувача
    const existing = await base(tables.USER_GOALS)
      .select({ filterByFormula: `{TG_id}="${tgId}"` })
      .all();

    // Map існуючих по нормалізованому тексту -> record
    const existingMap = {};
    existing.forEach(rec => {
      const txt = _normalize(rec.fields?.Goal_Text || '');
      if (txt) existingMap[txt] = rec;
    });

    const toCreate = [];
    const toUpdate = [];

    // Для кожної нової цілі — якщо є match по тексту => update priority/status, інакше create
    newGoals.forEach(g => {
      if (existingMap[g.text]) {
        const rec = existingMap[g.text];
        const updateFields = {
          Goal_Priority: g.priority,
          Status: rec.fields?.Status === 'active' ? rec.fields?.Status : 'active'
        };
        // не переписуємо Created_Date (зберігаємо історію)
        toUpdate.push({ id: rec.id, fields: updateFields });
        // помітимо, що ця існуюча ціль залишилася (щоб не деактивувати)
        delete existingMap[g.text];
      } else {
        toCreate.push({
          fields: {
            TG_id: tgId,
            Goal_Text: g.text,
            Goal_Priority: g.priority,
            Status: 'active',
            Created_Date: today
          }
        });
      }
    });

    // Всі записи, що лишилися в existingMap — це старі цілі, яких немає в новому списку.
    // Не видаляємо їх, а ставимо Status = 'inactive' (щоб зберегти історію).
    const toDeactivate = Object.values(existingMap).map(r => ({ id: r.id, fields: { Status: 'inactive' } }));

    // Пакетні операції: оновлення
    if (toUpdate.length) {
      // airtable batch update по 10 записів (Airtable limit)
      const chunk = (arr, size = 10) => {
        const out = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };
      for (const batch of chunk(toUpdate, 10)) {
        await base(tables.USER_GOALS).update(batch);
      }
    }

    // Деактивація старих
    if (toDeactivate.length) {
      const chunk = (arr, size = 10) => {
        const out = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };
      for (const batch of chunk(toDeactivate, 10)) {
        await base(tables.USER_GOALS).update(batch);
      }
    }

    // Створення нових
    if (toCreate.length) {
      // airtable create по 10
      const chunk = (arr, size = 10) => {
        const out = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };
      for (const batch of chunk(toCreate, 10)) {
        await base(tables.USER_GOALS).create(batch);
      }
    }

    const createdCount = toCreate.length;
    const updatedCount = toUpdate.length + toDeactivate.length;
    logger.info(`[dataSyncService] ✅ syncGoals: created=${createdCount}, updated_or_deactivated=${updatedCount} for ${tgId}`);
    return createdCount + updatedCount;
  } catch (error) {
    logger.error('[dataSyncService] ❌ syncGoalsToUserGoals error:', error);
    throw error;
  }
};

// ===== СИНХРОНІЗАЦІЯ ДІЙ (без змін, але з невеликим hardening) =====
const syncActionsToMicroActions = async (tgId, data) => {
  try {
    const today = _todayStr();
    // Перевіряємо, чи вже є записи від цього користувача на сьогодні з джерелом user_input
    const existing = await base(tables.MICRO_ACTIONS)
      .select({ filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date})="${today}", {Source}="user_input")` })
      .firstPage();

    if (existing.length) {
      logger.info(`[dataSyncService] ℹ️ Micro actions already exist for ${tgId} today — skip`);
      return 0;
    }

    const actions = [];
    for (let i = 1; i <= 3; i++) {
      const a = _normalize(data[`Daily_Action_${i}`] || data[`Action_${i}`]);
      if (a) actions.push({
        fields: {
          TG_id: tgId,
          Date: today,
          Action_Text: a,
          Status: 'pending',
          Source: 'user_input',
          Priority: i === 1 ? 'висока' : i === 2 ? 'середня' : 'низька',
          Created_At: new Date().toISOString()
        }
      });
    }

    if (actions.length) {
      // create batch
      const chunk = (arr, size = 10) => {
        const out = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };
      for (const batch of chunk(actions, 10)) {
        await base(tables.MICRO_ACTIONS).create(batch);
      }
    }

    logger.info(`[dataSyncService] ✅ syncActions: created=${actions.length} for ${tgId}`);
    return actions.length;
  } catch (error) {
    logger.error('[dataSyncService] ❌ syncActionsToMicroActions error:', error);
    throw error;
  }
};

// ===== СИНХРОНІЗАЦІЯ MAIN GOAL (Q_m_5) =====
const syncMainGoal = async (tgId, data) => {
  try {
    const today = _todayStr();
    const main = _normalize(data?.Q_m_5 || data?.Daily_Main_Goal || data?.Main_Goal);
    if (!main) {
      logger.info(`[dataSyncService] ℹ️ No main goal to sync for ${tgId}`);
      return { created: 0, updated: 0 };
    }

    // Якщо у конфігурації є окрема таблиця для main goals — використаємо її
    if (tables.USER_MAIN_GOAL) {
      // шукаємо запис на користувача за сьогодні
      const exists = await base(tables.USER_MAIN_GOAL)
        .select({ filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date})="${today}")`, maxRecords: 1 })
        .firstPage();

      if (exists.length) {
        await base(tables.USER_MAIN_GOAL).update([{ id: exists[0].id, fields: { Main_Goal: main } }]);
        logger.info(`[dataSyncService] ✅ Updated USER_MAIN_GOAL for ${tgId}`);
        return { created: 0, updated: 1 };
      } else {
        await base(tables.USER_MAIN_GOAL).create([{ fields: { TG_id: tgId, Date: today, Main_Goal: main, Created_At: new Date().toISOString() } }]);
        logger.info(`[dataSyncService] ✅ Created USER_MAIN_GOAL for ${tgId}`);
        return { created: 1, updated: 0 };
      }
    }

    // Якщо таблиці немає — апсерт в USER_GOALS: позначаємо спеціальним полем Goal_Is_Main = true
    const existing = await base(tables.USER_GOALS)
      .select({ filterByFormula: `{TG_id}="${tgId}"` })
      .all();

    // шукаємо точний збіг по тексту
    const match = existing.find(r => _normalize(r.fields?.Goal_Text) === main);

    if (match) {
      // позначимо як main (оновимо поле)
      await base(tables.USER_GOALS).update([{ id: match.id, fields: { Goal_Is_Main: true } }]);
      logger.info(`[dataSyncService] ✅ Marked existing USER_GOALS record as Main for ${tgId}`);
      return { created: 0, updated: 1 };
    }

    // якщо такого немає — створимо як окремий запис з Goal_Is_Main
    await base(tables.USER_GOALS).create([{
      fields: {
        TG_id: tgId,
        Goal_Text: main,
        Goal_Priority: 99,
        Status: 'active',
        Goal_Is_Main: true,
        Created_Date: today
      }
    }]);

    logger.info(`[dataSyncService] ✅ Created USER_GOALS record for Main Goal for ${tgId}`);
    return { created: 1, updated: 0 };
  } catch (error) {
    logger.error('[dataSyncService] ❌ syncMainGoal error:', error);
    throw error;
  }
};

// ===== СИНХРОНІЗАЦІЯ СТАНУ (Q_m_7 або Q_m_state) =====
const syncState = async (tgId, data) => {
  try {
    const today = _todayStr();
    const state = _normalize(data?.Q_m_7 || data?.State || data?.Daily_State);
    if (!state) {
      logger.info(`[dataSyncService] ℹ️ No state to sync for ${tgId}`);
      return { success: true, updated: 0 };
    }

    // Якщо є таблиця USER_STATUS — оновимо/створимо там
    if (tables.USER_STATUS) {
      const exists = await base(tables.USER_STATUS)
        .select({ filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date})="${today}")`, maxRecords: 1 })
        .firstPage();
      if (exists.length) {
        await base(tables.USER_STATUS).update([{ id: exists[0].id, fields: { State: state } }]);
        logger.info(`[dataSyncService] ✅ Updated USER_STATUS for ${tgId}`);
        return { success: true, updated: 1 };
      } else {
        await base(tables.USER_STATUS).create([{ fields: { TG_id: tgId, Date: today, State: state, Created_At: new Date().toISOString() } }]);
        logger.info(`[dataSyncService] ✅ Created USER_STATUS for ${tgId}`);
        return { success: true, created: 1 };
      }
    }

    // Інакше — поки що оновимо ACTIVITY_STATS якщо є відповідна колонка
    if (tables.ACTIVITY_STATS) {
      const stats = await base(tables.ACTIVITY_STATS)
        .select({ filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date})="${today}")`, maxRecords: 1 })
        .firstPage();
      if (stats.length) {
        await base(tables.ACTIVITY_STATS).update([{ id: stats[0].id, fields: { State: state } }]);
        logger.info(`[dataSyncService] ✅ Updated ACTIVITY_STATS.State for ${tgId}`);
        return { success: true, updated: 1 };
      } else {
        // якщо запису немає — створимо
        await base(tables.ACTIVITY_STATS).create([{ fields: { TG_id: tgId, Date: today, State: state, Created_At: new Date().toISOString() } }]);
        logger.info(`[dataSyncService] ✅ Created ACTIVITY_STATS with State for ${tgId}`);
        return { success: true, created: 1 };
      }
    }

    // Фолбек — якщо нічого немає, просто повернемо успіх
    logger.info('[dataSyncService] ℹ️ No table available for syncing state');
    return { success: true, updated: 0 };
  } catch (error) {
    logger.error('[dataSyncService] ❌ syncState error:', error);
    throw error;
  }
};

// ===== ГОЛОВНА СИНХРОНІЗАЦІЯ РАНКУ =====
const syncMorningData = async (tgId) => {
  try {
    const today = _todayStr();
    const records = await base(tables.RESPONSES)
      .select({ filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date_Response})="${today}")`, maxRecords: 1 })
      .firstPage();
    if (!records.length) return { success: false, message: 'No data' };

    const data = records[0].fields || {};

    const goalsSynced = await syncGoalsToUserGoals(tgId, data);
    const actionsSynced = await syncActionsToMicroActions(tgId, data);
    const mainGoalResult = await syncMainGoal(tgId, data);
    const stateResult = await syncState(tgId, data);

    logger.info(`[dataSyncService] ✅ Morning sync for ${tgId}: goals=${goalsSynced}, actions=${actionsSynced}, mainGoal=${JSON.stringify(mainGoalResult)}, state=${JSON.stringify(stateResult)}`);
    return { success: true, goalsSynced, actionsSynced, mainGoalResult, stateResult };
  } catch (error) {
    logger.error('[dataSyncService] ❌ syncMorningData error:', error);
    throw error;
  }
};

// ===== ВЕЧІРНЯ СИНХРОНІЗАЦІЯ (збережено логіку) =====
const syncEveningData = async (tgId) => {
  try {
    const today = _todayStr();
    const records = await base(tables.RESPONSES)
      .select({ filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date_Response})="${today}")`, maxRecords: 1 })
      .firstPage();
    if (!records.length) return { success: false };

    const data = records[0].fields || {};
    const victory = data.Q_e_5;

    const stats = await base(tables.ACTIVITY_STATS)
      .select({ filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date})="${today}")`, maxRecords: 1 })
      .firstPage();

    if (stats.length) {
      await base(tables.ACTIVITY_STATS).update([{ id: stats[0].id, fields: { Has_Victory: !!victory, Evening_Completed: true } }]);
    } else if (tables.ACTIVITY_STATS) {
      // створимо запис, якщо його нема
      await base(tables.ACTIVITY_STATS).create([{ fields: { TG_id: tgId, Date: today, Has_Victory: !!victory, Evening_Completed: true, Created_At: new Date().toISOString() } }]);
    }

    logger.info(`[dataSyncService] ✅ syncEveningData for ${tgId}`);
    return { success: true, victory: !!victory };
  } catch (error) {
    logger.error('[dataSyncService] ❌ syncEveningData error:', error);
    throw error;
  }
};

// ====== EXPORTS ======
const dataSyncService = {
  syncMorningData,
  syncEveningData,
  syncGoalsToUserGoals,
  syncActionsToMicroActions,
  syncMainGoal,
  syncState
};

export default dataSyncService;

// Ініціалізаційний лог
console.log('✅ [dataSyncService] Сервіс ініціалізовано');
