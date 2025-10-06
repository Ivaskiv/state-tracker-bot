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
  async saveMorningAnswer(tgId, questionNumber, answer) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();
      const fieldName = `Q_m_${questionNumber}`;
      
      logger.info(`[responseService] 💾 Збереження ${fieldName} для ${tgId}`);
      
      // 1️⃣ ЗНАХОДИМО ЗАПИС
      const records = await base(tables.RESPONSES)
        .select({
          filterByFormula: `AND({TG_id}="${String(tgId)}", DATESTR({Date_Response})="${today}")`,
          maxRecords: 1
        })
        .firstPage();
      
      // ✅ ПАРСИМО ВІДПОВІДЬ ЗГІДНО З ТИПОМ ПИТАННЯ
      let additionalFields = {};
      
      if (questionNumber === 3) {
        // Q_m_3 → Goal_1...Goal_10
        additionalFields = QUESTION_PARSERS.parseGoals(answer);
      } else if (questionNumber === 4) {
        // Q_m_4 → Monthly_Priority_1/2/3 + Daily_Main_Goal
        additionalFields = QUESTION_PARSERS.parseDailyFocus(answer);
      } else if (questionNumber === 6) {
        // Q_m_6 → Daily_Action_1/2/3 або афірмація
        const parsed = QUESTION_PARSERS.parseActions(answer);
        if (parsed.affirmation) {
          additionalFields.affirmation_m = parsed.affirmation;
        } else {
          additionalFields = parsed;
        }
      } else if (questionNumber === 5) {
        // Q_m_5 → Daily_State
        additionalFields = QUESTION_PARSERS.parseState(answer);
      }
      
      // 2️⃣ ОНОВЛЮЄМО АБО СТВОРЮЄМО ЗАПИС
      const fieldsToUpdate = {
        [fieldName]: answer,
        ...additionalFields,
        'Current_Activity': now
      };
      
      if (records.length === 0) {
        logger.warn(`[responseService] ⚠️ Запис Responses не знайдено - створюємо`);
        await base(tables.RESPONSES).create({
          'TG_id': String(tgId),
          'Date_Response': today,
          'User Name': 'Користувач',
          ...fieldsToUpdate
        });
      } else {
        await base(tables.RESPONSES).update(records[0].id, fieldsToUpdate);
      }
      
      logger.info(`[responseService] ✅ Відповідь ${fieldName} збережено + додаткові поля:`, Object.keys(additionalFields));
      
      // 3️⃣ ОНОВЛЮЄМО Answer_Step В USERS
      await userService.updateUserFields(tgId, {
        Answer_Step: `Q_m_${questionNumber}`,
        Last_Activity: now
      });
      
      // ✅ ПІСЛЯ Q_m_6 СИНХРОНІЗУЄМО В ДОДАТКОВІ ТАБЛИЦІ
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
  async saveEveningAnswer(tgId, questionNumber, answer) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();
      const fieldName = `Q_e_${questionNumber}`;
      const currentActivity = `Q_e_${questionNumber}`;
      
      logger.info(`[responseService] 💾 Збереження ${fieldName} для ${tgId}`);
      
      const records = await base(tables.RESPONSES)
        .select({
          filterByFormula: `AND({TG_id}="${String(tgId)}", DATESTR({Date_Response})="${today}")`,
          maxRecords: 1
        })
        .firstPage();
      
      if (records.length === 0) {
        throw new Error('Запис Responses не знайдено. Спочатку викличте initEveningSession');
      }
      
      await base(tables.RESPONSES).update(records[0].id, {
        [fieldName]: answer,
        'Current_Activity': currentActivity
      });
      
      logger.info(`[responseService] ✅ Відповідь ${fieldName} збережено`);
      
      await userService.updateUserFields(tgId, {
        Answer_Step: currentActivity,
        Last_Activity: now
      });
      
      logger.info(`[responseService] ✅ Answer_Step оновлено до ${currentActivity}`);
      
      return true;
      
    } catch (error) {
      logger.error('[responseService] ❌ saveEveningAnswer:', error.message, error.stack);
      throw error;
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
        return record.Current_Activity === 'morning_completed';
      } else if (sessionType === 'evening') {
        return record.Current_Activity === 'evening_completed';
      }
      
      return false;
      
    } catch (error) {
      logger.error('[responseService] Помилка isSessionCompleted:', error);
      return false;
    }
  }
};

export default responseService;

console.log('✅ [responseService] Сервіс відповідей ініціалізовано');