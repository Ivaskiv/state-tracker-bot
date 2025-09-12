// src/aiMentor/services/conversationService.js - НОВА СЛУЖБА ДЛЯ ЗБЕРЕЖЕННЯ AI ДІАЛОГІВ

import { getBase, tables } from '../../config/database.js';

const base = getBase();

// ✅ ВИКОРИСТАЄМО ТАБЛИЦЮ User Reflections АБО СТВОРИМО НОВУ
// Якщо хочемо окрему таблицю - додати до database.js: AI_CONVERSATIONS: 'AI_Conversations'

/**
 * Зберігає діалог з AI наставником
 * @param {number} tgId - Telegram ID користувача
 * @param {string} userQuestion - Питання користувача
 * @param {string} aiResponse - Відповідь AI
 * @param {string} conversationType - Тип розмови (ai_mentor, quick_question, etc.)
 */
export const saveAIConversation = async (tgId, userQuestion, aiResponse, conversationType = 'ai_mentor') => {
  try {
    console.log(`[conversationService] 💾 Збереження AI діалогу для ${tgId}`);
    console.log(`- Питання: "${userQuestion.substring(0, 50)}..."`);
    console.log(`- Відповідь: "${aiResponse.substring(0, 50)}..."`);

    const conversationData = {
      fields: {
        TG_id: String(tgId),
        Date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        Created_At: new Date().toISOString(),
        Question_Type: conversationType,
        User_Question: userQuestion,
        AI_Response: aiResponse,
        // Додаткові поля
        Question_Length: userQuestion.length,
        Response_Length: aiResponse.length,
        Session_Type: 'AI Mentor'
      }
    };

    // ✅ ВАРІАНТ 1: Використовуємо існуючу таблицю User Reflections
    const conversationRecord = await base('User Reflections').create([conversationData]);
    
    console.log(`[conversationService] ✅ AI діалог збережено з ID: ${conversationRecord[0].id}`);
    return conversationRecord[0].id;

  } catch (error) {
    console.error('[conversationService] ❌ Помилка збереження AI діалогу:', error);
    throw error;
  }
};

/**
 * Отримує історію AI розмов користувача
 * @param {number} tgId - Telegram ID користувача
 * @param {number} limit - Кількість останніх записів
 * @returns {Array} Історія розмов
 */
export const getAIConversationHistory = async (tgId, limit = 10) => {
  try {
    console.log(`[conversationService] 📚 Отримання історії AI діалогів для ${tgId} (останні ${limit})`);

    const records = await base('User Reflections')
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Question_Type}="ai_mentor")`,
        sort: [{ field: 'Created_At', direction: 'desc' }],
        maxRecords: limit,
        fields: ['TG_id', 'Date', 'User_Question', 'AI_Response', 'Created_At']
      })
      .all();

    console.log(`[conversationService] ✅ Знайдено ${records.length} AI діалогів для ${tgId}`);
    
    return records.map(record => ({
      id: record.id,
      date: record.fields.Date,
      question: record.fields.User_Question,
      response: record.fields.AI_Response,
      createdAt: record.fields.Created_At
    }));

  } catch (error) {
    console.error('[conversationService] ❌ Помилка отримання історії AI діалогів:', error);
    return [];
  }
};

/**
 * Отримує статистику AI розмов користувача
 * @param {number} tgId - Telegram ID користувача
 * @param {number} days - Період для статистики
 * @returns {Object} Статистика розмов
 */
export const getAIConversationStats = async (tgId, days = 30) => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    console.log(`[conversationService] 📊 Статистика AI діалогів для ${tgId} за ${days} днів (з ${startDateStr})`);

    const records = await base('User Reflections')
      .select({
        filterByFormula: `AND(
          {TG_id}="${tgId}", 
          {Question_Type}="ai_mentor",
          IS_AFTER(DATESTR({Date}), "${startDateStr}")
        )`,
        fields: ['Date', 'User_Question', 'AI_Response']
      })
      .all();

    const stats = {
      totalConversations: records.length,
      averageQuestionLength: 0,
      averageResponseLength: 0,
      conversationsByDay: {},
      mostActiveDay: null
    };

    if (records.length > 0) {
      let totalQuestionLength = 0;
      let totalResponseLength = 0;

      records.forEach(record => {
        const date = record.fields.Date;
        const questionLength = record.fields.User_Question?.length || 0;
        const responseLength = record.fields.AI_Response?.length || 0;

        totalQuestionLength += questionLength;
        totalResponseLength += responseLength;

        // Підрахунок по днях
        if (!stats.conversationsByDay[date]) {
          stats.conversationsByDay[date] = 0;
        }
        stats.conversationsByDay[date]++;
      });

      stats.averageQuestionLength = Math.round(totalQuestionLength / records.length);
      stats.averageResponseLength = Math.round(totalResponseLength / records.length);

      // Знаходимо найактивніший день
      let maxConversations = 0;
      Object.entries(stats.conversationsByDay).forEach(([date, count]) => {
        if (count > maxConversations) {
          maxConversations = count;
          stats.mostActiveDay = { date, count };
        }
      });
    }

    console.log(`[conversationService] ✅ Статистика AI діалогів:`, stats);
    return stats;

  } catch (error) {
    console.error('[conversationService] ❌ Помилка отримання статистики AI діалогів:', error);
    return {
      totalConversations: 0,
      averageQuestionLength: 0,
      averageResponseLength: 0,
      conversationsByDay: {},
      mostActiveDay: null
    };
  }
};

/**
 * Видаляє старі AI розмови (для очищення бази)
 * @param {number} daysOld - Вік розмов у днях для видалення
 * @returns {number} Кількість видалених записів
 */
export const cleanupOldConversations = async (daysOld = 90) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    console.log(`[conversationService] 🧹 Очищення AI діалогів старіше ${daysOld} днів (до ${cutoffDateStr})`);

    const oldRecords = await base('User Reflections')
      .select({
        filterByFormula: `AND(
          {Question_Type}="ai_mentor",
          IS_BEFORE(DATESTR({Date}), "${cutoffDateStr}")
        )`,
        fields: ['TG_id', 'Date']
      })
      .all();

    if (oldRecords.length === 0) {
      console.log(`[conversationService] ℹ️ Немає старих AI діалогів для видалення`);
      return 0;
    }

    // Видаляємо партіями по 10 (обмеження Airtable)
    let deletedCount = 0;
    const batchSize = 10;
    
    for (let i = 0; i < oldRecords.length; i += batchSize) {
      const batch = oldRecords.slice(i, i + batchSize);
      const recordIds = batch.map(record => record.id);
      
      await base('User Reflections').destroy(recordIds);
      deletedCount += recordIds.length;
      
      console.log(`[conversationService] 🗑️ Видалено партію ${recordIds.length} записів`);
      
      // Затримка між партіями
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`[conversationService] ✅ Очищення завершено. Видалено ${deletedCount} старих AI діалогів`);
    return deletedCount;

  } catch (error) {
    console.error('[conversationService] ❌ Помилка очищення старих AI діалогів:', error);
    return 0;
  }
};

// ✅ ФУНКЦІЯ ДЛЯ ГЕНЕРАЦІЇ ЗВІТУ ПО AI ДІАЛОГАХ
export const generateAIConversationReport = async (tgId, days = 7) => {
  try {
    const history = await getAIConversationHistory(tgId, 20);
    const stats = await getAIConversationStats(tgId, days);

    if (stats.totalConversations === 0) {
      return `📊 AI НАСТАВНИК - ЗВІТ ЗА ${days} ДНІВ\n\n❌ У цей період ти не спілкувалася з AI наставником.\n\n💡 Спробуй поставити питання про цілі, мотивацію чи планування!`;
    }

    let report = `📊 AI НАСТАВНИК - ЗВІТ ЗА ${days} ДНІВ\n\n`;
    report += `💬 Всього діалогів: ${stats.totalConversations}\n`;
    report += `📝 Середня довжина питання: ${stats.averageQuestionLength} символів\n`;
    report += `🤖 Середня довжина відповіді: ${stats.averageResponseLength} символів\n\n`;

    if (stats.mostActiveDay) {
      const date = new Date(stats.mostActiveDay.date).toLocaleDateString('uk-UA');
      report += `🔥 Найактивніший день: ${date} (${stats.mostActiveDay.count} діалогів)\n\n`;
    }

    // Додаємо приклад останніх тем
    if (history.length > 0) {
      report += `💡 ОСТАННІ ТЕМИ:\n`;
      const recentTopics = history.slice(0, 3);
      recentTopics.forEach((conv, index) => {
        const questionPreview = conv.question.length > 30 
          ? `${conv.question.substring(0, 30)}...`
          : conv.question;
        const date = new Date(conv.createdAt).toLocaleDateString('uk-UA');
        report += `${index + 1}. ${date}: "${questionPreview}"\n`;
      });
    }

    report += `\n✨ Продовжуй спілкуватися з AI наставником для особистого розвитку!`;

    return report;

  } catch (error) {
    console.error('[conversationService] ❌ Помилка генерації звіту AI діалогів:', error);
    return '📊 AI НАСТАВНИК - ЗВІТ\n\n❌ Не вдалося згенерувати звіт. Спробуй пізніше.';
  }
};

export default {
  saveAIConversation,
  getAIConversationHistory,
  getAIConversationStats,
  cleanupOldConversations,
  generateAIConversationReport
};