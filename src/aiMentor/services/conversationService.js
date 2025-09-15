// src/aiMentor/services/conversationService.js
import { getBase, tables } from '../../config/database.js';
import { CONTEXT_TYPES } from '../../config/aiMentorPrompts.js';
import logger from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

const base = getBase();

/**
 * Зберігає діалог з AI-наставником
 * @param {string} tgId - Telegram ID користувача
 * @param {string} question - Питання користувача
 * @param {string} response - Відповідь AI
 * @param {Object} context - Контекст діалогу
 */
export const saveAIConversation = async (tgId, question, response, context) => {
  try {
    logger.info(`[CONVERSATION SERVICE] Збереження діалогу для ${tgId}`);
    const conversationData = {
      fields: {
        TG_id: String(tgId),
        Date: new Date().toISOString().split('T')[0],
        Created_At: new Date().toISOString(),
        Session_ID: uuidv4(),
        Question: question.substring(0, 1000), // Обмеження довжини
        AI_Response: response.substring(0, 2000), // Обмеження довжини
        Context_Type: context.contextType || CONTEXT_TYPES.GENERAL,
        User_Goal: context.userGoal?.substring(0, 100) || '',
        User_State: context.userState?.substring(0, 100) || 'unknown',
        Generated_Actions: context.generatedActions?.substring(0, 500) || '',
        Course_Suggested: context.courseSuggested?.substring(0, 100) || ''
      }
    };

    logger.info(`[CONVERSATION SERVICE] Дані для збереження:`, JSON.stringify(conversationData, null, 2));
    const [record] = await base(tables.AI_CONVERSATIONS).create([conversationData]);
    logger.info(`✅ [CONVERSATION SERVICE] Діалог збережено, ID: ${record.id}`);
    return record;

  } catch (error) {
    logger.error('❌ [CONVERSATION SERVICE] Помилка збереження діалогу:', {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
      response: error.response?.data
    });
    throw error;
  }
};

/**
 * Отримує історію діалогів
 * @param {string} tgId - Telegram ID користувача
 * @param {number} limit - Ліміт записів
 * @returns {Array} Історія діалогів
 */
export const getAIConversationHistory = async (tgId, limit = 5) => {
  try {
    logger.info(`[CONVERSATION SERVICE] Отримання історії для ${tgId}, ліміт: ${limit}`);
    const records = await base(tables.AI_CONVERSATIONS)
      .select({
        filterByFormula: `{TG_id}="${tgId}"`,
        maxRecords: limit,
        sort: [{ field: 'Created_At', direction: 'desc' }]
      })
      .firstPage();

    const history = records.map(record => ({
      question: record.fields.Question || '',
      response: record.fields.AI_Response || '',
      contextType: record.fields.Context_Type || CONTEXT_TYPES.GENERAL,
      createdAt: record.fields.Created_At
    }));

    logger.info(`✅ [CONVERSATION SERVICE] Отримано ${history.length} записів історії для ${tgId}`);
    return history;

  } catch (error) {
    logger.error('❌ [CONVERSATION SERVICE] Помилка отримання історії:', {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
      response: error.response?.data
    });
    return [];
  }
};

/**
 * Генерує звіт діалогів
 * @param {string} tgId - Telegram ID користувача
 * @param {number} days - Кількість днів для аналізу
 * @returns {string} Текст звіту
 */
export const generateAIConversationReport = async (tgId, days = 7) => {
  try {
    logger.info(`[CONVERSATION SERVICE] Генерація звіту для ${tgId}, період: ${days} днів`);
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const records = await base(tables.AI_CONVERSATIONS)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Date}>= "${dateFrom.toISOString().split('T')[0]}")`,
        sort: [{ field: 'Created_At', direction: 'desc' }]
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
    report += `🔍 Контексти питань:\n`;
    Object.entries(contextCounts).forEach(([context, count]) => {
      report += `- ${contextNames[context] || context}: ${count}\n`;
    });

    if (records.length > 0) {
      report += `\n📝 Останнє питання: "${records[0].fields.Question?.substring(0, 50) || '---'}..."\n`;
      report += `💬 Остання відповідь: "${records[0].fields.AI_Response?.substring(0, 80) || '---'}..."\n`;
    }

    logger.info(`✅ [CONVERSATION SERVICE] Звіт згенеровано для ${tgId}`);
    return report;

  } catch (error) {
    logger.error('❌ [CONVERSATION SERVICE] Помилка генерації звіту:', {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
      response: error.response?.data
    });
    return '❌ Не вдалося згенерувати звіт. Спробуйте пізніше.';
  }
};

export default {
  saveAIConversation,
  getAIConversationHistory,
  generateAIConversationReport
};