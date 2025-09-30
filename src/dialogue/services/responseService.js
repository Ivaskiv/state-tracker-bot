// src/dialogue/services/responseService.js - З ІНТЕГРАЦІЄЮ activityTracker

import { getBase, tables } from '../../config/database.js';
import logger from '../../utils/logger.js';
import userService from '../../services/userService.js';
import activityTracker from '../../services/activityTracker.js';

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
          filterByFormula: `AND({TG_id}="${String(tgId)}", {Date Response} >= "${fromDateStr}")`,
          sort: [{ field: 'Date Response', direction: 'desc' }]
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
          filterByFormula: `AND({TG_id}="${String(tgId)}", DATESTR({Date Response})="${today}")`,
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
  async saveMorningAnswer(tgId, questionNumber, answer) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const fieldName = `Q_m_${questionNumber}`;
      
      const records = await base(tables.RESPONSES)
        .select({
          filterByFormula: `AND({TG_id}="${String(tgId)}", DATESTR({Date Response})="${today}")`,
          maxRecords: 1
        })
        .firstPage();
      
      const updateData = { [fieldName]: answer };
      
      if (records.length > 0) {
        await base(tables.RESPONSES).update(records[0].id, updateData);
      } else {
        await base(tables.RESPONSES).create({
          'TG_id': String(tgId),
          'Date Response': today,
          'User Name': 'Користувач',
          ...updateData
        });
      }
      
      logger.info(`[responseService] Збережено ранкову відповідь ${questionNumber} для ${tgId}`);
      
      // ✅ ОНОВЛЮЄМО last_activity_ts після КОЖНОЇ відповіді
      await userService.updateUserFields(tgId, {
        last_activity_ts: new Date().toISOString()
      }).catch(err => logger.error('[responseService] Помилка оновлення last_activity_ts:', err));
      
      return true;
      
    } catch (error) {
      logger.error('[responseService] Помилка saveMorningAnswer:', error);
      throw error;
    }
  },

  /**
   * Збереження вечірньої відповіді
   */
  async saveEveningAnswer(tgId, questionNumber, answer) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const fieldName = `Q_e_${questionNumber}`;
      
      const records = await base(tables.RESPONSES)
        .select({
          filterByFormula: `AND({TG_id}="${String(tgId)}", DATESTR({Date Response})="${today}")`,
          maxRecords: 1
        })
        .firstPage();
      
      const updateData = { [fieldName]: answer };
      
      if (records.length > 0) {
        await base(tables.RESPONSES).update(records[0].id, updateData);
      } else {
        await base(tables.RESPONSES).create({
          'TG_id': String(tgId),
          'Date Response': today,
          'User Name': 'Користувач',
          ...updateData
        });
      }
      
      logger.info(`[responseService] Збережено вечірню відповідь ${questionNumber} для ${tgId}`);
      
      // ✅ ОНОВЛЮЄМО last_activity_ts після КОЖНОЇ відповіді
      await userService.updateUserFields(tgId, {
        last_activity_ts: new Date().toISOString()
      }).catch(err => logger.error('[responseService] Помилка оновлення last_activity_ts:', err));
      
      // ✅ ЯКЩО ЦЕ ОСТАННЯ ВЕЧІРНЯ ВІДПОВІДЬ (Q_e_5) - ФІНАЛІЗУЄМО ДЕНЬ
      if (questionNumber === 5) {
        logger.info(`[responseService] 🌙 Остання вечірня відповідь - фіналізація дня для ${tgId}`);
        
        // Запускаємо асинхронно, щоб не блокувати відповідь користувачу
        activityTracker.finalizeDay(tgId).catch(err => {
          logger.error('[responseService] Помилка finalizeDay:', err);
        });
      }
      
      return true;
      
    } catch (error) {
      logger.error('[responseService] Помилка saveEveningAnswer:', error);
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
          filterByFormula: `AND({TG_id}="${String(tgId)}", DATESTR({Date Response})="${today}")`,
          maxRecords: 1
        })
        .firstPage();
      
      const updateData = { [fieldName]: affirmation };
      
      if (records.length > 0) {
        await base(tables.RESPONSES).update(records[0].id, updateData);
      } else {
        await base(tables.RESPONSES).create({
          'TG_id': String(tgId),
          'Date Response': today,
          'User Name': 'Користувач',
          ...updateData
        });
      }
      
      logger.info(`[responseService] Збережено ${type} афірмацію для ${tgId}`);
      
      // ✅ ОНОВЛЮЄМО last_activity_ts
      await userService.updateUserFields(tgId, {
        last_activity_ts: new Date().toISOString()
      }).catch(err => logger.error('[responseService] Помилка оновлення last_activity_ts:', err));
      
      return true;
      
    } catch (error) {
      logger.error('[responseService] Помилка saveAffirmation:', error);
      throw error;
    }
  }
};

export default responseService;