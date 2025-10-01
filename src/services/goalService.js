// src/aiMentor/services/goalService.js - ВИПРАВЛЕНО

import { getBase, tables } from "../config/database.js";

const base = getBase();

// ✅ ЗБЕРЕЖЕННЯ ЦІЛІ В НОВУ ТАБЛИЦЮ User_Goals
export const saveGoal = async (tgId, goalText, priority = 5) => {
  try {
    console.log(`[goalService] Збереження цілі для ${tgId}: "${goalText}"`);
    
    const goalRecord = await base(tables.USER_GOALS).create({
      TG_id: String(tgId),
      Goal_Text: goalText,
      Goal_Priority: priority,
      Status: 'active',
      Created_Date: new Date().toISOString().split('T')[0] // YYYY-MM-DD формат
    });
    
    console.log(`[goalService] ✅ Ціль збережена з ID: ${goalRecord.id}`);
    return goalRecord.id;
  } catch (error) {
    console.error('[goalService] ❌ Помилка збереження цілі:', error);
    throw error;
  }
};

// ✅ ЗБЕРЕЖЕННЯ МІКРО-ДІЇ В НОВУ ТАБЛИЦЮ Daily_Micro_Actions
export const saveMicroAction = async (tgId, actionText, isAIGenerated = true, goalId = null) => {
  try {
    console.log(`[goalService] Збереження мікро-дії для ${tgId}: "${actionText}"`);
    
    const actionFields = {
      TG_id: String(tgId),
      Date: new Date().toISOString().split('T')[0], // YYYY-MM-DD формат
      Action_Text: actionText,
      AI_Generated: isAIGenerated,
      Completed: false
    };
    
    // ДОДАЄМО зв'язок з ціллю якщо є
    if (goalId) {
      actionFields.Goal_ID = [goalId]; // Link field в Airtable завжди масив
    }
    
    const actionRecord = await base(tables.DAILY_MICRO_ACTIONS).create(actionFields);
    
    console.log(`[goalService] ✅ Мікро-дія збережена з ID: ${actionRecord.id}`);
    return actionRecord.id;
  } catch (error) {
    console.error('[goalService] ❌ Помилка збереження мікро-дії:', error);
    throw error;
  }
};

// ✅ ОТРИМАННЯ ЦІЛЕЙ КОРИСТУВАЧА
export const getUserGoals = async (tgId, status = 'active') => {
  try {
    const records = await base(tables.USER_GOALS)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Status}="${status}")`,
        sort: [{ field: 'Goal_Priority', direction: 'desc' }]
      })
      .all();
    
    return records.map(r => r.fields);
  } catch (error) {
    console.error('[goalService] Помилка отримання цілей:', error);
    return [];
  }
};

// ✅ ОТРИМАННЯ МІКРО-ДІЙ НА СЬОГОДНІ
export const getTodayMicroActions = async (tgId) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const records = await base(tables.DAILY_MICRO_ACTIONS)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date})="${today}")`,
        sort: [{ field: 'Date', direction: 'desc' }]
      })
      .all();
    
    return records.map(r => r.fields);
  } catch (error) {
    console.error('[goalService] Помилка отримання мікро-дій:', error);
    return [];
  }
};

// ✅ ПОЗНАЧЕННЯ МІКРО-ДІЇ ЯК ВИКОНАНОЇ
export const completeMicroAction = async (actionId) => {
  try {
    await base(tables.DAILY_MICRO_ACTIONS).update(actionId, {
      Completed: true
    });
    console.log(`[goalService] ✅ Мікро-дія ${actionId} позначена як виконана`);
  } catch (error) {
    console.error('[goalService] Помилка позначення мікро-дії:', error);
    throw error;
  }
};