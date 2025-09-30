// src/aiMentor/services/conversationService.js - ВИПРАВЛЕНО ФОРМАТ ДАТИ

import { getBase, tables } from '../../config/database.js';
import { CONTEXT_TYPES } from '../../config/aiMentorPrompts.js';
import logger from '../../utils/logger.js';

const base = getBase();

/**
 * Зберігає діалог з AI-наставником
 */
export const saveAIConversation = async (tgId, question, response, context) => {
  try {
    logger.info(`[CONVERSATION SERVICE] 💾 ЗБЕРЕЖЕННЯ діалогу для ${tgId}`);
    
    const today = new Date().toISOString().split('T')[0];
    const tgIdString = String(tgId);

    // ✅ ВИПРАВЛЕНА СТРУКТУРА - БЕЗ Created_At (використовуємо автополе в Airtable)
    const conversationData = {
      TG_id: tgIdString,
      Date: today,
      Question: question.substring(0, 1000),
      AI_Response: response.substring(0, 2000),
      Context_Type: context?.contextType || CONTEXT_TYPES.GENERAL,
      Created_At: new Date().toISOString() ,
      User_Goal: context?.userGoal?.substring(0, 100) || '',
      User_State: context?.userState?.substring(0, 100) || 'unknown'
    };

    logger.info(`[CONVERSATION SERVICE] 📊 Дані для збереження:`, {
      TG_id: conversationData.TG_id,
      Question_length: conversationData.Question.length,
      Response_length: conversationData.AI_Response.length,
      Context_Type: conversationData.Context_Type
    });

    // ✅ ЗБЕРЕЖЕННЯ В AIRTABLE
    const record = await base(tables.AI_CONVERSATIONS).create([{
      fields: conversationData
    }], { typecast: true });
    
    logger.info(`✅ [CONVERSATION SERVICE] Діалог збережено, ID: ${record[0].id}`);
    return record[0];

  } catch (error) {
    logger.error('❌ [CONVERSATION SERVICE] КРИТИЧНА ПОМИЛКА збереження:', {
      message: error.message,
      statusCode: error.statusCode,
      tgId: tgId,
      questionLength: question?.length || 0,
      responseLength: response?.length || 0
    });
    
    return null;
  }
};

/**
 * Отримує історію діалогів
 */
export const getAIConversationHistory = async (tgId, limit = 5) => {
  try {
    logger.info(`[CONVERSATION SERVICE] 📖 Отримання історії для ${tgId}, ліміт: ${limit}`);
    const records = await base(tables.AI_CONVERSATIONS)
      .select({
        filterByFormula: `{TG_id}="${String(tgId)}"`,
        maxRecords: limit,
        sort: [{ field: 'Created time', direction: 'desc' }] // ✅ ВИКОРИСТОВУЄМО АВТОПОЛЕ
      })
      .firstPage();

    const history = records.map(record => ({
      question: record.fields.Question || '',
      response: record.fields.AI_Response || '',
      contextType: record.fields.Context_Type || CONTEXT_TYPES.GENERAL,
      createdAt: record.createdTime // ✅ АВТОПОЛЕ AIRTABLE
    }));

    logger.info(`✅ [CONVERSATION SERVICE] Отримано ${history.length} записів історії для ${tgId}`);
    return history;

  } catch (error) {
    logger.error('❌ [CONVERSATION SERVICE] Помилка отримання історії:', {
      message: error.message,
      tgId: tgId
    });
    return [];
  }
};

/**
 * Генерує звіт діалогів
 */
export const generateAIConversationReport = async (tgId, days = 7) => {
  try {
    logger.info(`[CONVERSATION SERVICE] 📊 Генерація звіту для ${tgId}, період: ${days} днів`);
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    const dateFromStr = dateFrom.toISOString().split('T')[0];

    const records = await base(tables.AI_CONVERSATIONS)
      .select({
        filterByFormula: `AND({TG_id}="${String(tgId)}", IS_AFTER({Date}, "${dateFromStr}"))`,
        sort: [{ field: 'Created time', direction: 'desc' }] // ✅ АВТОПОЛЕ
      })
      .firstPage();

    const contextCounts = {};
    records.forEach(record => {
      const context = record.fields.Context_Type || CONTEXT_TYPES.GENERAL;
      contextCounts[context] = (contextCounts[context] || 0) + 1;
    });

    const contextNames = {
      [CONTEXT_TYPES.GOAL_SETTING]: 'Постановка цілей',
      [CONTEXT_TYPES.MOTIVATION]: 'Мотивація',
      [CONTEXT_TYPES.MICRO_ACTIONS]: 'Мікро-дії',
      [CONTEXT_TYPES.LIFE_BALANCE]: 'Життєвий баланс',
      [CONTEXT_TYPES.GENERAL]: 'Загальні питання'
    };

    let report = `📊 ЗВІТ AI-ДІАЛОГІВ (останні ${days} днів)\n\n`;
    report += `Загальна кількість діалогів: ${records.length}\n\n`;
    
    if (Object.keys(contextCounts).length > 0) {
      report += `🔍 Контексти питань:\n`;
      Object.entries(contextCounts).forEach(([context, count]) => {
        report += `- ${contextNames[context] || context}: ${count}\n`;
      });
    }

    if (records.length > 0) {
      report += `\n📝 Останнє питання: "${records[0].fields.Question?.substring(0, 50) || '---'}..."\n`;
      report += `💬 Остання відповідь: "${records[0].fields.AI_Response?.substring(0, 80) || '---'}..."\n`;
    }

    logger.info(`✅ [CONVERSATION SERVICE] Звіт згенеровано для ${tgId}`);
    return report;

  } catch (error) {
    logger.error('❌ [CONVERSATION SERVICE] Помилка генерації звіту:', {
      message: error.message,
      tgId: tgId
    });
    return '❌ Не вдалося згенерувати звіт. Спробуйте пізніше.';
  }
};

export default {
  saveAIConversation,
  getAIConversationHistory,
  generateAIConversationReport
};