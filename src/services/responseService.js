// src/dialogue/services/responseService.js - З ІНІЦІАЛІЗАЦІЄЮ СЕСІЇ

import { getBase, tables } from '../config/database.js';
import logger from '../utils/logger.js';
import userService from './userService.js';
import activityTracker from './activityTracker.js';

const base = getBase();

const responseService = {
  /**
   * 🆕 ІНІЦІАЛІЗАЦІЯ РАНКОВОЇ СЕСІЇ
   * Викликається при натисканні кнопки "Почати"
   */
  async initMorningSession(tgId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();
      
      logger.info(`[responseService] 🌅 Ініціалізація ранкової сесії для ${tgId}`);
      
      // 1️⃣ ПЕРЕВІРЯЄМО ЧИ ВЖЕ ІСНУЄ ЗАПИС НА СЬОГОДНІ
      const records = await base(tables.RESPONSES)
        .select({
          filterByFormula: `AND({TG_id}="${String(tgId)}", DATESTR({Date_Response})="${today}")`,
          maxRecords: 1
        })
        .firstPage();
      
      // 2️⃣ ЯКЩО ЗАПИСУ НЕМАЄ - СТВОРЮЄМО
      if (records.length === 0) {
        await base(tables.RESPONSES).create({
          'TG_id': String(tgId),
          'Date_Response': today,
          'User Name': 'Користувач',
          'Current_Activity': now
        });
        logger.info(`[responseService] ✅ Створено новий запис Responses для ${tgId}`);
      } else {
        // Якщо запис існує - оновлюємо Current_Activity
await base(tables.RESPONSES).update(recordId, {
  'Current_Activity': CURRENT_ACTIVITY.Q_M_1, 
  'Date_Response': now, 
});
        logger.info(`[responseService] ✅ Оновлено існуючий запис Responses для ${tgId}`);
      }
      
      // 3️⃣ ВСТАНОВЛЮЄМО Answer_Step В USERS
      await userService.updateUserFields(tgId, {
        Answer_Step: 'Q_m_1',
        Last_Activity: now
      });
      
      logger.info(`[responseService] ✅ Answer_Step встановлено на Q_m_1`);
      
      return true;
      
    } catch (error) {
      logger.error('[responseService] ❌ initMorningSession:', error.message, error.stack);
      throw error;
    }
  },

  /**
   * 🆕 ІНІЦІАЛІЗАЦІЯ ВЕЧІРНЬОЇ СЕСІЇ
   * Викликається при натисканні кнопки "Почати"
   */
  async initEveningSession(tgId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();
      
      logger.info(`[responseService] 🌙 Ініціалізація вечірньої сесії для ${tgId}`);
      
      // 1️⃣ ПЕРЕВІРЯЄМО ЧИ ВЖЕ ІСНУЄ ЗАПИС НА СЬОГОДНІ
      const records = await base(tables.RESPONSES)
        .select({
          filterByFormula: `AND({TG_id}="${String(tgId)}", DATESTR({Date_Response})="${today}")`,
          maxRecords: 1
        })
        .firstPage();
      
      // 2️⃣ ЯКЩО ЗАПИСУ НЕМАЄ - СТВОРЮЄМО
      if (records.length === 0) {
        await base(tables.RESPONSES).create({
          'TG_id': String(tgId),
          'Date_Response': today,
          'User Name': 'Користувач',
          'Current_Activity': now
        });
        logger.info(`[responseService] ✅ Створено новий запис Responses для ${tgId}`);
      } else {
        // Якщо запис існує - оновлюємо Current_Activity
        await base(tables.RESPONSES).update(records[0].id, {
          'Current_Activity': now
        });
        logger.info(`[responseService] ✅ Оновлено існуючий запис Responses для ${tgId}`);
      }
      
      // 3️⃣ ВСТАНОВЛЮЄМО Answer_Step В USERS
      await userService.updateUserFields(tgId, {
        Answer_Step: 'Q_e_1',
        Last_Activity: now
      });
      
      logger.info(`[responseService] ✅ Answer_Step встановлено на Q_e_1`);
      
      return true;
      
    } catch (error) {
      logger.error('[responseService] ❌ initEveningSession:', error.message, error.stack);
      throw error;
    }
  },

  /**
   * Збереження ранкової відповіді
   */
  async saveMorningAnswer(tgId, questionNumber, answer) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();
      const fieldName = `Q_m_${questionNumber}`;
      
      logger.info(`[responseService] 💾 Збереження ${fieldName} для ${tgId}`);
      
      // 1️⃣ ЗНАХОДИМО ЗАПИС (має вже існувати після initMorningSession)
      const records = await base(tables.RESPONSES)
        .select({
          filterByFormula: `AND({TG_id}="${String(tgId)}", DATESTR({Date_Response})="${today}")`,
          maxRecords: 1
        })
        .firstPage();
      
      if (records.length === 0) {
        logger.warn(`[responseService] ⚠️ Запис Responses не знайдено - створюємо`);
        await base(tables.RESPONSES).create({
          'TG_id': String(tgId),
          'Date_Response': today,
          'User Name': 'Користувач',
          [fieldName]: answer,
          'Current_Activity': now
        });
      } else {
        // 2️⃣ ОНОВЛЮЄМО ВІДПОВІДЬ + Current_Activity
        await base(tables.RESPONSES).update(records[0].id, {
          [fieldName]: answer,
          'Current_Activity': now
        });
      }
      
      logger.info(`[responseService] ✅ Відповідь ${fieldName} збережено`);
      
      // 3️⃣ ОНОВЛЮЄМО Answer_Step В USERS
      await userService.updateUserFields(tgId, {
        Answer_Step: `Q_m_${questionNumber}`,
        Last_Activity: now
      });
      
      logger.info(`[responseService] ✅ Answer_Step оновлено до Q_m_${questionNumber}`);
      
      return true;
      
    } catch (error) {
      logger.error('[responseService] ❌ saveMorningAnswer:', error.message, error.stack);
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
      
      logger.info(`[responseService] 💾 Збереження ${fieldName} для ${tgId}`);
      
      // 1️⃣ ЗНАХОДИМО ЗАПИС (має вже існувати після initEveningSession)
      const records = await base(tables.RESPONSES)
        .select({
          filterByFormula: `AND({TG_id}="${String(tgId)}", DATESTR({Date_Response})="${today}")`,
          maxRecords: 1
        })
        .firstPage();
      
      if (records.length === 0) {
        logger.warn(`[responseService] ⚠️ Запис Responses не знайдено - створюємо`);
        await base(tables.RESPONSES).create({
          'TG_id': String(tgId),
          'Date_Response': today,
          'User Name': 'Користувач',
          [fieldName]: answer,
          'Current_Activity': now
        });
      } else {
        // 2️⃣ ОНОВЛЮЄМО ВІДПОВІДЬ + Current_Activity
        await base(tables.RESPONSES).update(records[0].id, {
          [fieldName]: answer,
          'Current_Activity': now
        });
      }
      
      logger.info(`[responseService] ✅ Відповідь ${fieldName} збережено`);
      
      // 3️⃣ ОНОВЛЮЄМО Answer_Step В USERS
      await userService.updateUserFields(tgId, {
        Answer_Step: `Q_e_${questionNumber}`,
        Last_Activity: now
      });
      
      logger.info(`[responseService] ✅ Answer_Step оновлено до Q_e_${questionNumber}`);
      
      // 4️⃣ ФІНАЛІЗАЦІЯ (тільки для останнього питання!)
      if (questionNumber === 5) {
        logger.info(`[responseService] 🎯 Остання вечірня відповідь - запуск finalizeDay`);
        
        // Фіналізуємо асинхронно
        activityTracker.finalizeDay(tgId)
          .then(() => logger.info(`[responseService] ✅ finalizeDay завершено для ${tgId}`))
          .catch(err => logger.error('[responseService] ❌ finalizeDay:', err));
      }
      
      return true;
      
    } catch (error) {
      logger.error('[responseService] ❌ saveEveningAnswer:', error.message, error.stack);
      throw error;
    }
  },

  /**
   * Збереження афірмації
   */
  async saveAffirmation(tgId, type, affirmation) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();
      const fieldName = type === 'morning' ? 'affirmation_m' : 'affirmation_e';
      
      logger.info(`[responseService] 💾 Збереження ${fieldName} для ${tgId}`);
      
      // 1️⃣ ЗНАХОДИМО ЗАПИС
      const records = await base(tables.RESPONSES)
        .select({
          filterByFormula: `AND({TG_id}="${String(tgId)}", DATESTR({Date_Response})="${today}")`,
          maxRecords: 1
        })
        .firstPage();
      
      if (records.length === 0) {
        logger.warn(`[responseService] ⚠️ Запис Responses не знайдено - створюємо`);
        await base(tables.RESPONSES).create({
          'TG_id': String(tgId),
          'Date_Response': today,
          'User Name': 'Користувач',
          [fieldName]: affirmation,
        });
      } else {
        // 2️⃣ ОНОВЛЮЄМО АФІРМАЦІЮ + Current_Activity
        await base(tables.RESPONSES).update(records[0].id, {
          [fieldName]: affirmation,
        });
      }
      
      logger.info(`[responseService] ✅ Афірмація ${fieldName} збережено`);
      
      // 3️⃣ ОНОВЛЮЄМО Answer_Step В USERS
      const step = type === 'morning' ? 'affirmation_m' : 'affirmation_e';
      await userService.updateUserFields(tgId, {
        Answer_Step: step,
        Last_Activity: now
      });
      
      logger.info(`[responseService] ✅ Answer_Step оновлено до ${step}`);
      
      return true;
      
    } catch (error) {
      logger.error('[responseService] ❌ saveAffirmation:', error.message, error.stack);
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
        return !!(record.Q_m_6 || record.affirmation_m);
      } else if (sessionType === 'evening') {
        return !!(record.Q_e_5 || record.affirmation_e);
      }
      
      return false;
      
    } catch (error) {
      logger.error('[responseService] Помилка isSessionCompleted:', error);
      return false;
    }
  }
};

export default responseService;