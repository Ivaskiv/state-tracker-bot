// src/dialogue/services/responseService.js - ПОВНИЙ ФАЙЛ

import Airtable from 'airtable';
import logger from '../../utils/logger.js';

const base = Airtable.base(process.env.AIRTABLE_BASE_ID);
const RESPONSES_TABLE = 'Daily_Responses';

const responseService = {
  async getTodayResponse(telegramId, type = null) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      let formula = `AND({Telegram_ID} = '${telegramId}', {Date} = '${today}')`;
      if (type) {
        formula = `AND({Telegram_ID} = '${telegramId}', {Date} = '${today}', {Type} = '${type}')`;
      }
      
      const records = await base(RESPONSES_TABLE).select({
        filterByFormula: formula,
        maxRecords: 1
      }).firstPage();
      
      return records && records.length > 0 ? { id: records[0].id, ...records[0].fields } : null;
    } catch (error) {
      logger.error('[responseService] Помилка отримання відповіді:', error);
      return null;
    }
  },

  async saveMorningAnswer(telegramId, questionNumber, answer) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const fieldName = `Q_m_${questionNumber}`;
      
      let existingRecord = null;
      try {
        const records = await base(RESPONSES_TABLE).select({
          filterByFormula: `AND({Telegram_ID} = '${telegramId}', {Date} = '${today}')`,
          maxRecords: 1
        }).firstPage();
        
        if (records && records.length > 0) {
          existingRecord = records[0];
        }
      } catch (error) {
        logger.warn('[responseService] Не знайдено існуючий запис:', error);
      }
      
      const updateData = { [fieldName]: answer };
      
      if (existingRecord) {
        await base(RESPONSES_TABLE).update(existingRecord.id, updateData);
        logger.info(`[responseService] Оновлено ранкову відповідь ${questionNumber} для ${telegramId}`);
      } else {
        await base(RESPONSES_TABLE).create({
          'Telegram_ID': telegramId.toString(),
          'Date': today,
          'Type': 'morning',
          ...updateData
        });
        logger.info(`[responseService] Створено ранкову відповідь ${questionNumber} для ${telegramId}`);
      }
      
      return true;
    } catch (error) {
      logger.error('[responseService] Помилка збереження ранкової відповіді:', error);
      throw error;
    }
  },

  async saveEveningAnswer(telegramId, questionNumber, answer) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const fieldName = `Q_e_${questionNumber}`;
      
      let existingRecord = null;
      try {
        const records = await base(RESPONSES_TABLE).select({
          filterByFormula: `AND({Telegram_ID} = '${telegramId}', {Date} = '${today}')`,
          maxRecords: 1
        }).firstPage();
        
        if (records && records.length > 0) {
          existingRecord = records[0];
        }
      } catch (error) {
        logger.warn('[responseService] Не знайдено існуючий запис:', error);
      }
      
      const updateData = { [fieldName]: answer };
      
      if (existingRecord) {
        await base(RESPONSES_TABLE).update(existingRecord.id, updateData);
        logger.info(`[responseService] Оновлено вечірню відповідь ${questionNumber} для ${telegramId}`);
      } else {
        await base(RESPONSES_TABLE).create({
          'Telegram_ID': telegramId.toString(),
          'Date': today,
          'Type': 'evening',
          ...updateData
        });
        logger.info(`[responseService] Створено вечірню відповідь ${questionNumber} для ${telegramId}`);
      }
      
      return true;
    } catch (error) {
      logger.error('[responseService] Помилка збереження вечірньої відповіді:', error);
      throw error;
    }
  }
};

export default responseService;