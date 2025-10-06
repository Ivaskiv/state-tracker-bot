// src/services/responseService.js

import { getBase, tables } from '../config/database.js';
import logger from '../utils/logger.js';
import userService from './userService.js';
import activityTracker from './activityTracker.js';
import dataSyncService from './dataSyncService.js'; // ✅ ДОДАТИ ІМПОРТ
import { QUESTION_PARSERS } from '../config/constants.js'; // ✅ ДОДАТИ ІМПОРТ

const base = getBase();

const responseService = {

  /**
   * Збереження ранкової відповіді
   */
// src/services/responseService.js

async saveMorningAnswer(tgId, questionNumber, answer) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    const fieldName = `Q_m_${questionNumber}`;
    const currentStep = `Q_m_${questionNumber}`;
    
    logger.info(`[responseService] 💾 Збереження ${fieldName} для ${tgId}`);
    
    // 1️⃣ ЗНАХОДИМО АБО СТВОРЮЄМО ЗАПИС
    const records = await base(tables.RESPONSES)
      .select({
        filterByFormula: `AND({TG_id}="${String(tgId)}", DATESTR({Date_Response})="${today}")`,
        maxRecords: 1
      })
      .firstPage();
    
    // ✅ ПАРСИМО ВІДПОВІДЬ
    let additionalFields = {};
    
    if (questionNumber === 3) {
      additionalFields = QUESTION_PARSERS.parseGoals(answer);
    } else if (questionNumber === 4) {
      additionalFields = QUESTION_PARSERS.parseDailyFocus(answer);
    } else if (questionNumber === 6) {
      const parsed = QUESTION_PARSERS.parseActions(answer);
      if (parsed.affirmation) {
        additionalFields.affirmation_m = parsed.affirmation;
      } else {
        additionalFields = parsed;
      }
    } else if (questionNumber === 5) {
      additionalFields = QUESTION_PARSERS.parseState(answer);
    }
    
    const fieldsToUpdate = {
      [fieldName]: answer,
      ...additionalFields,
      Current_Activity: currentStep
    };
    
    if (records.length === 0) {
      // ✅ СТВОРЮЄМО НОВИЙ ЗАПИС
      logger.info(`[responseService] 🆕 Створюємо новий запис Responses`);
      
      const user = await userService.getUserByTgId(tgId);
      
      await base(tables.RESPONSES).create({
        'TG_id': String(tgId),
        'Date_Response': today,
        'User Name': user?.['User Name'] || 'Користувач',
        ...fieldsToUpdate
      });
    } else {
      // ✅ ОНОВЛЮЄМО ІСНУЮЧИЙ ЗАПИС
      logger.info(`[responseService] 🔄 Оновлюємо існуючий запис Responses (ID: ${records[0].id})`);
      
      await base(tables.RESPONSES).update(records[0].id, fieldsToUpdate);
    }
    
    logger.info(`[responseService] ✅ Відповідь ${fieldName} збережено`);
    
    // 3️⃣ ОНОВЛЮЄМО Answer_Step В USERS
    await userService.updateUserFields(tgId, {
      Answer_Step: currentStep,
      Last_Activity: now
    });
    
    // ✅ ПІСЛЯ Q_m_6 СИНХРОНІЗУЄМО
    if (questionNumber === 6) {
      await this.syncToAdditionalTables(tgId);
    }

    return true;
    
  } catch (error) {
    logger.error('[responseService] ❌ saveMorningAnswer:', error.message, error.stack);
    throw error;
  }
},
  /**
   * ✅ НОВИЙ МЕТОД: Синхронізація в додаткові таблиці
   */
  async syncToAdditionalTables(tgId) {
    try {
      const result = await dataSyncService.syncMorningData(tgId);
      
      if (result.success) {
        logger.info(`[responseService] ✅ Синхронізовано: ${result.goalsSynced} цілей, ${result.actionsSynced} дій`);
      } else {
        logger.warn(`[responseService] ⚠️ Синхронізація: ${result.message}`);
      }
    } catch (error) {
      logger.error('[responseService] ❌ syncToAdditionalTables:', error);
    }
  },

  /**
   * Збереження вечірньої відповіді
   */
// src/services/responseService.js

// ✅ ОБРОБКА Q_e_5 (виконання дій)
async saveEveningAnswer(tgId, questionNumber, answer) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    const fieldName = `Q_e_${questionNumber}`;
    
    logger.info(`[responseService] 💾 Збереження ${fieldName} для ${tgId}`);
    
    // 1️⃣ ЗНАХОДИМО ІСНУЮЧИЙ ЗАПИС
    const records = await base(tables.RESPONSES)
      .select({
        filterByFormula: `AND({TG_id}="${String(tgId)}", DATESTR({Date_Response})="${today}")`,
        maxRecords: 1
      })
      .firstPage();
    
    if (records.length === 0) {
      // ✅ ЯКЩО НЕМАЄ ЗАПИСУ - СТВОРЮЄМО
      logger.warn(`[responseService] ⚠️ Запис Responses не знайдено для вечірніх - створюємо`);
      
      const user = await userService.getUserByTgId(tgId);
      
      await base(tables.RESPONSES).create({
        'TG_id': String(tgId),
        'Date_Response': today,
        'User Name': user?.['User Name'] || 'Користувач',
        [fieldName]: answer
      });
      
      await userService.updateUserFields(tgId, {
        Answer_Step: `Q_e_${questionNumber}`,
        Last_Activity: now
      });
      
      return true;
    }
    
    let additionalFields = {};
    
    // ✅ Q_e_5 - аналіз виконання дій
    if (questionNumber === 5) {
      const completionAnalysis = this.analyzeActionCompletion(answer, records[0].fields);
      additionalFields = completionAnalysis;
      
      await this.updateMicroActionsStatus(tgId, completionAnalysis);
    }
    
    // ✅ Q_e_6 - аналіз прогресу до цілей
    if (questionNumber === 6) {
      const goalProgress = this.analyzeGoalProgress(answer, records[0].fields);
      additionalFields = goalProgress;
    }
    
    // ✅ ОНОВЛЮЄМО ІСНУЮЧИЙ ЗАПИС
    await base(tables.RESPONSES).update(records[0].id, {
      [fieldName]: answer,
      ...additionalFields
    });
    
    await userService.updateUserFields(tgId, {
      Answer_Step: `Q_e_${questionNumber}`,
      Last_Activity: now
    });
    
    return true;
    
  } catch (error) {
    logger.error('[responseService] ❌ saveEveningAnswer:', error);
    throw error;
  }
},

// ✅ АНАЛІЗ ВИКОНАННЯ ДІЙ
analyzeActionCompletion(answer, todayData) {
  const lowerAnswer = answer.toLowerCase();
  const actions = [
    todayData.Daily_Action_1,
    todayData.Daily_Action_2,
    todayData.Daily_Action_3
  ].filter(a => a);
  
  const completedActions = [];
  const skippedActions = [];
  
  // Шукаємо маркери виконання
  const completedMarkers = ['✅', 'зроблено', 'виконано', 'так', '+', 'done'];
  const skippedMarkers = ['⏭', 'не зроблено', 'ні', '-', 'пропустила'];
  
  actions.forEach((action, i) => {
    const actionLower = action.toLowerCase();
    const hasCompleted = completedMarkers.some(m => lowerAnswer.includes(m) && lowerAnswer.includes(actionLower.slice(0, 10)));
    const hasSkipped = skippedMarkers.some(m => lowerAnswer.includes(m) && lowerAnswer.includes(actionLower.slice(0, 10)));
    
    if (hasCompleted) {
      completedActions.push(i + 1);
    } else if (hasSkipped) {
      skippedActions.push(i + 1);
    }
  });
  
  return {
    Actions_Completed_Count: completedActions.length,
    Actions_Completed_List: completedActions.join(','),
    Actions_Skipped_List: skippedActions.join(','),
    Completion_Rate: actions.length > 0 ? Math.round((completedActions.length / actions.length) * 100) : 0
  };
},

// ✅ ОНОВЛЕННЯ СТАТУСУ ДІЙ В MICRO_ACTIONS
async updateMicroActionsStatus(tgId, completionData) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const completedList = completionData.Actions_Completed_List.split(',').filter(n => n);
    
    const records = await base(tables.MICRO_ACTIONS)
      .select({
        filterByFormula: `AND({TG_id}="${String(tgId)}", DATESTR({Date})="${today}", {Source}="user_input")`,
        sort: [{ field: 'Created_At', direction: 'asc' }]
      })
      .firstPage();
    
    const updates = [];
    records.forEach((record, index) => {
      const actionNumber = index + 1;
      updates.push({
        id: record.id,
        fields: {
          Status: completedList.includes(String(actionNumber)) ? 'completed' : 'skipped',
          Completed_At: completedList.includes(String(actionNumber)) ? new Date().toISOString() : null
        }
      });
    });
    
    if (updates.length > 0) {
      await base(tables.MICRO_ACTIONS).update(updates);
      logger.info(`[responseService] ✅ Оновлено статус ${updates.length} дій`);
    }
    
  } catch (error) {
    logger.error('[responseService] ❌ updateMicroActionsStatus:', error);
  }
},
  /**
   * Збереження афірмації та фіналізація сесії
   */
  async saveAffirmationAndFinalize(tgId, type, affirmation) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();
      const fieldName = type === 'morning' ? 'affirmation_m' : 'affirmation_e';
      const completedActivity = type === 'morning' ? 'morning_completed' : 'evening_completed';
      
      logger.info(`[responseService] 💾 Збереження ${fieldName} та фіналізація для ${tgId}`);
      
      const records = await base(tables.RESPONSES)
        .select({
          filterByFormula: `AND({TG_id}="${String(tgId)}", DATESTR({Date_Response})="${today}")`,
          maxRecords: 1
        })
        .firstPage();
      
      if (records.length === 0) {
        throw new Error('Запис Responses не знайдено');
      }
      
      await base(tables.RESPONSES).update(records[0].id, {
        [fieldName]: affirmation,
        'Current_Activity': completedActivity
      });
      
      logger.info(`[responseService] ✅ Афірмація збережено, Current_Activity = ${completedActivity}`);
      
      await userService.updateUserFields(tgId, {
        Answer_Step: completedActivity,
        Last_Activity: now
      });
      
      // ✅ СИНХРОНІЗУЄМО ВЕЧІРНІ ДАНІ
      if (type === 'evening') {
        await dataSyncService.syncEveningData(tgId);
        await activityTracker.finalizeDay(tgId);
      }
      
      return true;
      
    } catch (error) {
      logger.error('[responseService] ❌ saveAffirmationAndFinalize:', error);
      throw error;
    }
  },

  /**
   * Отримання записів користувача за період
   */
  async getUserRecords(tgId, days = 30) {
    try {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);
      const fromDateStr = fromDate.toISOString().split('T')[0];
      
      const records = await base(tables.RESPONSES)
        .select({
          filterByFormula: `AND({TG_id}="${String(tgId)}", {Date_Response} >= "${fromDateStr}")`,
          sort: [{ field: 'Date_Response', direction: 'desc' }]
        })
        .all();
      
      logger.info(`[responseService] Отримано ${records.length} записів для ${tgId}`);
      return records;
      
    } catch (error) {
      logger.error('[responseService] Помилка getUserRecords:', error);
      return [];
    }
  },

  /**
   * Перевірка чи завершена сесія
   */
// src/services/responseService.js

async isSessionCompleted(tgId, sessionType) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const records = await base(tables.RESPONSES)
      .select({
        filterByFormula: `AND({TG_id}="${String(tgId)}", DATESTR({Date_Response})="${today}")`,
        maxRecords: 1
      })
      .firstPage();
    
    if (records.length === 0) return false;
    
    const record = records[0].fields;
    
    if (sessionType === 'morning') {
      // ✅ Перевіряємо Current_Activity АБО наявність Q_m_6
      return record.Current_Activity === 'morning_completed' || !!record.Q_m_6;
    } else if (sessionType === 'evening') {
      // ✅ Перевіряємо Current_Activity АБО наявність Q_e_5
      return record.Current_Activity === 'evening_completed' || !!record.Q_e_5;
    }
    
    return false;
    
  } catch (error) {
    logger.error('[responseService] Помилка isSessionCompleted:', error);
    return false;
  }
}};

export default responseService;

console.log('✅ [responseService] Сервіс відповідей ініціалізовано');