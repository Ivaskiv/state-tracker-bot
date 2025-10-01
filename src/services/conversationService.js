// src/aiMentor/services/conversationService.js - ПОВНА ВЕРСІЯ

import { getBase, tables } from '../config/database.js';
import { CONTEXT_TYPES } from '../config/constants.js';
import logger from '../utils/logger.js';

const base = getBase();

/**
 * ✅ Зберігає діалог з AI з УСІМА полями
 */

export const saveAIConversation = async (tgId, data) => {
  try {
    logger.info(`[CONVERSATION] 💾 Збереження діалогу для ${tgId}`);
    
    const now = new Date().toISOString();
    const today = now.split('T')[0]; // YYYY-MM-DD для Date
    const tgIdString = String(tgId);

    // ✅ ПРАВИЛЬНА СТРУКТУРА ПОЛІВ ЗГІДНО З AIRTABLE
    const conversationData = {
      TG_id: tgIdString,
      'User Name': data.userName || 'Користувач',
      Date: today, 
      Created_At: now, 
      Question: data.question.substring(0, 1000),
      AI_Response: data.response.substring(0, 2000),
      Context_Type: data.contextType || 'general',
      User_Goal: data.userGoal?.substring(0, 500) || '',
      User_State: data.userState?.substring(0, 200) || '',
      User_Qualities: data.userQualities?.substring(0, 500) || '',
      Generated_Actions: data.generatedActions ? JSON.stringify(data.generatedActions) : null,
      Course_Suggested: data.courseSuggested || null,
      Response_Rating: data.responseRating || null,
      Conversation_Length: data.conversationLength || 0,
      Has_Micro_Actions: data.hasMicroActions || false,
      Session_ID: data.sessionId || null
    };

    logger.info(`[CONVERSATION] 📊 Дані для збереження:`, {
      TG_id: conversationData.TG_id,
      Date: conversationData.Date,
      Created_At: conversationData.Created_At,
      Context: conversationData.Context_Type,
      Has_Goal: !!conversationData.User_Goal,
      Has_Actions: conversationData.Has_Micro_Actions
    });

    const record = await base(tables.AI_CONVERSATIONS).create([{
      fields: conversationData
    }], { typecast: true });
    
    logger.info(`✅ [CONVERSATION] Діалог збережено, ID: ${record[0].id}`);
    return record[0];

  } catch (error) {
    logger.error('❌ [CONVERSATION] ПОМИЛКА:', {
      message: error.message,
      statusCode: error.statusCode,
      tgId: tgId
    });
    
    return null;
  }
};
/**
 * ✅ Отримує історію діалогів
 */
export const getAIConversationHistory = async (tgId, limit = 5) => {
  try {
    logger.info(`[CONVERSATION] 📖 Отримання історії для ${tgId}, ліміт: ${limit}`);
    
    const records = await base(tables.AI_CONVERSATIONS)
      .select({
        filterByFormula: `{TG_id}="${String(tgId)}"`,
        maxRecords: limit,
        sort: [{ field: 'Created_At', direction: 'desc' }]
      })
      .firstPage();

    const history = records.map(record => ({
      id: record.id,
      question: record.fields.Question || '',
      response: record.fields.AI_Response || '',
      contextType: record.fields.Context_Type || CONTEXT_TYPES.GENERAL,
      userGoal: record.fields.User_Goal || '',
      userState: record.fields.User_State || '',
      createdAt: record.fields.Created_At || record.createdTime
    }));

    logger.info(`✅ [CONVERSATION] Отримано ${history.length} записів`);
    return history;

  } catch (error) {
    logger.error('❌ [CONVERSATION] Помилка отримання історії:', error);
    return [];
  }
};

/**
 * ✅ Генерує звіт діалогів
 */
export const generateAIConversationReport = async (tgId, days = 7) => {
  try {
    logger.info(`[CONVERSATION] 📊 Генерація звіту для ${tgId}`);
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    const dateFromStr = dateFrom.toISOString().split('T')[0];

    const records = await base(tables.AI_CONVERSATIONS)
      .select({
        filterByFormula: `AND({TG_id}="${String(tgId)}", IS_AFTER({Date}, "${dateFromStr}"))`,
        sort: [{ field: 'Created_At', direction: 'desc' }]
      })
      .firstPage();

    if (records.length === 0) {
      return `📊 ЗВІТ AI-ДІАЛОГІВ\n\nЗа останні ${days} днів діалогів не знайдено.\n\n💡 Почни використовувати AI-наставника!`;
    }

    // Статистика по контекстах
    const contextCounts = {};
    let totalWithActions = 0;
    let totalWithCourses = 0;
    
    records.forEach(record => {
  const context = record.fields.Context_Type || CONTEXT_TYPES.GENERAL;
      contextCounts[context] = (contextCounts[context] || 0) + 1;
      
      if (record.fields.Has_Micro_Actions) totalWithActions++;
      if (record.fields.Course_Suggested) totalWithCourses++;
    });

    const contextNames = {
      [CONTEXT_TYPES.GOAL_SETTING]: 'Постановка цілей',
      [CONTEXT_TYPES.MOTIVATION]: 'Мотивація',
      [CONTEXT_TYPES.MICRO_ACTIONS]: 'Мікро-дії',
      [CONTEXT_TYPES.LIFE_BALANCE]: 'Життєвий баланс',
      [CONTEXT_TYPES.BLOCK_ANALYSIS]: 'Аналіз блоків',
      [CONTEXT_TYPES.GENERAL]: 'Загальні питання'
    };

    let report = `📊 ЗВІТ AI-ДІАЛОГІВ (останні ${days} днів)\n\n`;
    report += `📈 Загальна кількість діалогів: ${records.length}\n`;
    report += `🎯 Згенеровано мікро-дій: ${totalWithActions}\n`;
    report += `📚 Запропоновано курсів: ${totalWithCourses}\n\n`;
    
    report += `🔍 Контексти питань:\n`;
    Object.entries(contextCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([context, count]) => {
        const percentage = Math.round((count / records.length) * 100);
        report += `• ${contextNames[context] || context}: ${count} (${percentage}%)\n`;
      });

    // Останній діалог
    if (records.length > 0) {
      const lastRecord = records[0];
      const lastDate = new Date(lastRecord.fields.Created_At || lastRecord.createdTime);
      const daysAgo = Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24));
      
      report += `\n⏰ Останній діалог: ${daysAgo === 0 ? 'сьогодні' : `${daysAgo} днів тому`}\n`;
      report += `💭 Останнє питання: "${lastRecord.fields.Question?.substring(0, 60) || '---'}..."\n`;
      
      if (lastRecord.fields.User_Goal) {
        report += `🎯 Поточна ціль: "${lastRecord.fields.User_Goal.substring(0, 60)}..."\n`;
      }
    }

    report += `\n💡 Продовжуй використовувати AI-наставника для досягнення цілей!`;

    logger.info(`✅ [CONVERSATION] Звіт згенеровано: ${records.length} діалогів`);
    return report;

  } catch (error) {
    logger.error('❌ [CONVERSATION] Помилка генерації звіту:', error);
    return '❌ Не вдалося згенерувати звіт. Спробуйте пізніше.';
  }
};

/**
 * ✅ Оновлює рейтинг відповіді
 */
export const updateResponseRating = async (conversationId, rating) => {
  try {
    await base(tables.AI_CONVERSATIONS).update(conversationId, {
      Response_Rating: rating
    });
    
    logger.info(`✅ [CONVERSATION] Рейтинг оновлено: ${rating}`);
    return true;
  } catch (error) {
    logger.error('❌ [CONVERSATION] Помилка оновлення рейтингу:', error);
    return false;
  }
};

export default {
  saveAIConversation,
  getAIConversationHistory,
  generateAIConversationReport,
  updateResponseRating
};