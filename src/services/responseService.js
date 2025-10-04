// src/dialogue/services/responseService.js - З ІНТЕГРАЦІЄЮ activityTracker

import { getBase, tables } from '../config/database.js';
import logger from '../utils/logger.js';
import userService from './userService.js';
import activityTracker from './activityTracker.js';

const base = getBase();

const responseService = {
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
        return !!(record.Q_m_6 || record.affirmation_m);
      } else if (sessionType === 'evening') {
        return !!(record.Q_e_5 || record.affirmation_e);
      }
      
      return false;
      
    } catch (error) {
      logger.error('[responseService] Помилка isSessionCompleted:', error);
      return false;
    }
  },

  /**
   * Збереження ранкової відповіді
   */
// src/services/responseService.js - ВИПРАВЛЕНО

async saveMorningAnswer(tgId, questionNumber, answer) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    const fieldName = `Q_m_${questionNumber}`;
    
    const records = await base(tables.RESPONSES)
      .select({
        filterByFormula: `AND({TG_id}="${String(tgId)}", DATESTR({Date_Response})="${today}")`,
        maxRecords: 1
      })
      .firstPage();
    
    const updateData = { 
      [fieldName]: answer,
      Last_Activity: now
    };
    
    if (records.length > 0) {
      await base(tables.RESPONSES).update(records[0].id, updateData);
    } else {
      await base(tables.RESPONSES).create({
        'TG_id': String(tgId),
        'Date_Response': today,
        'User Name': 'Користувач',
        Last_Activity: now,
        ...updateData
      });
    }
    
    logger.info(`[responseService] ✅ Збережено Q_m_${questionNumber} для ${tgId}`);
    
    // ✅ НЕ ВСТАНОВЛЮЄМО Current_Activity ТУТ - це робить dailyController!
    
    return true;
  } catch (error) {
    logger.error('[responseService] ❌ saveMorningAnswer:', error);
    throw error;
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
    
    const records = await base(tables.RESPONSES)
      .select({
        filterByFormula: `AND({TG_id}="${String(tgId)}", DATESTR({Date_Response})="${today}")`,
        maxRecords: 1
      })
      .firstPage();
    
    const updateData = { 
      [fieldName]: answer,
      Current_Activity: now // ✅ ДОДАНО
    };
    
    if (records.length > 0) {
      await base(tables.RESPONSES).update(records[0].id, updateData);
    } else {
      await base(tables.RESPONSES).create({
        'TG_id': String(tgId),
        'Date_Response': today,
        'User Name': 'Користувач',
        Current_Activity: now,
        ...updateData
      });
    }
    
    logger.info(`[responseService] ✅ Збережено Q_e_${questionNumber} для ${tgId}`);
    
    // ✅ ОНОВЛЮЄМО КОРИСТУВАЧА
    await userService.updateUserFields(tgId, {
      Current_Activity: `Q_e_${questionNumber}`,
      Last_Activity: now
    });
    
    // ✅ ЯКЩО ОСТАННЯ ВІДПОВІДЬ - ФІНАЛІЗАЦІЯ
    if (questionNumber === 5) {
      await activityTracker.finalizeDay(tgId).catch(err => 
        logger.error('[responseService] ❌ finalizeDay:', err)
      );
    }
    
    return true;
  } catch (error) {
    logger.error('[responseService] ❌ saveEveningAnswer:', error);
    throw error;
  }
},
  /**
   * Збереження афірмації
   */
  async saveAffirmation(tgId, type, affirmation) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const fieldName = type === 'morning' ? 'affirmation_m' : 'affirmation_e';
      
      const records = await base(tables.RESPONSES)
        .select({
          filterByFormula: `AND({TG_id}="${String(tgId)}", DATESTR({Date_Response})="${today}")`,
          maxRecords: 1
        })
        .firstPage();
      
      const updateData = { [fieldName]: affirmation };
      
      if (records.length > 0) {
        await base(tables.RESPONSES).update(records[0].id, updateData);
      } else {
        await base(tables.RESPONSES).create({
          'TG_id': String(tgId),
          'Date_Response': today,
          'User Name': 'Користувач',
          ...updateData
        });
      }
      
      logger.info(`[responseService] Збережено ${type} афірмацію для ${tgId}`);
      
      // ✅ ОНОВЛЮЄМО current_Activity
      await userService.updateUserActivity(tgId, {
        current_Activity: new Date().toISOString()
      }).catch(err => logger.error('[responseService] Помилка оновлення current_Activity:', err));
      
      return true;
      
    } catch (error) {
      logger.error('[responseService] Помилка saveAffirmation:', error);
      throw error;
    }
  }
};

export default responseService;