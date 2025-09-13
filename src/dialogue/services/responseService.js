// src/dialogue/services/responseService.js
import { getBase } from '../../config/database.js';
import { QUESTION_TYPES, ANSWER_STEPS } from '../../config/constants.js';
import { getUserDateString, getUserDateTime } from '../../utils/timezoneUtils.js';

export const createOrUpdateResponse = async (
  tgId,
  userName,
  questionType,
  answerStep,
  questionNumber,
  answer,
  fieldName,
  isCompleted = false
) => {
  try {
    const base = getBase();
    const today = getUserDateString(tgId);
    const currentDateTime = getUserDateTime(tgId);
    const tgIdString = String(tgId);

    console.log(`[responseService] 💾 ЗБЕРЕЖЕННЯ/ОНОВЛЕННЯ ВІДПОВІДІ:`);
    console.log(`- Користувач: ${tgIdString} (${userName})`);
    console.log(`- Дата: ${today}`);
    console.log(`- Поле: ${fieldName}`);

    // 🔍 ЗАВЖДИ ШУКАЄМО ІСНУЮЧИЙ ЗАПИС
    const existingRecords = await base('Responses').select({
      filterByFormula: `AND({TG_id}="${tgIdString}", DATESTR({Date Response})="${today}")`,
      maxRecords: 1,
    }).firstPage();

    const fieldsToUpdate = {
      'TG_id': tgIdString,
      'User Name': userName,
      'Date Response': currentDateTime.toISOString(),
      'Answer_Step': answerStep,
    };

    // Додаємо конкретне поле відповіді
    if (fieldName && answer) {
      fieldsToUpdate[fieldName] = answer;
    }

    if (existingRecords.length > 0) {
      // ✅ ЗАВЖДИ ОНОВЛЮЄМО ІСНУЮЧИЙ ЗАПИС
      const recordId = existingRecords[0].id;
      
      await base('Responses').update([{ 
        id: recordId, 
        fields: fieldsToUpdate 
      }]);
      
      console.log(`[responseService] ✅ ОНОВЛЕНО існуючий запис ${recordId}`);
    } else {
      // ➕ СТВОРЮЄМО ТІЛЬКИ ЯКЩО НЕМАЄ ЗАПИСУ НА СЬОГОДНІ
      await base('Responses').create([{ 
        fields: fieldsToUpdate 
      }]);
      
      console.log(`[responseService] ✅ СТВОРЕНО новий запис`);
    }

  } catch (error) {
    console.error(`[responseService] ❌ ПОМИЛКА збереження:`, error);
    throw error;
  }
};

export const isSessionCompleted = async (tgId, questionType) => {
  try {
    const base = getBase();
    const today = getUserDateString(tgId);
    const tgIdString = String(tgId);

    console.log(`[responseService] 🔍 ПЕРЕВІРКА ЗАВЕРШЕНОСТІ:`);
    console.log(`- Користувач: ${tgIdString}`);
    console.log(`- Тип сесії: ${questionType}`);
    console.log(`- Дата: ${today}`);

    const records = await base('Responses').select({
      filterByFormula: `AND({TG_id}="${tgIdString}", DATESTR({Date Response})="${today}")`,
      maxRecords: 1,
    }).firstPage();

    if (!records.length) {
      console.log(`[responseService] ❌ Записів не знайдено для ${tgIdString} на ${today}`);
      return false;
    }

    const fields = records[0].fields;
    
    // Перевіряємо завершеність по афірмації (фінальний крок)
    const completedField = questionType === QUESTION_TYPES.MORNING ? 'affirmation_m' : 'affirmation_e';
    const isCompleted = !!fields[completedField];

    // Детальна діагностика
    if (questionType === QUESTION_TYPES.MORNING) {
      const answers = [fields.Q_m_1, fields.Q_m_2, fields.Q_m_3, fields.Q_m_4, fields.Q_m_5, fields.Q_m_6];
      const answeredCount = answers.filter(Boolean).length;
      const hasAffirmation = !!fields.affirmation_m;
      
      console.log(`[responseService] 🌅 РАНКОВА СЕСІЯ для ${tgIdString}:`);
      console.log(`- Відповіді: ${answeredCount}/6`);
      console.log(`- Питання 1: ${fields.Q_m_1 ? '✅' : '❌'}`);
      console.log(`- Питання 2: ${fields.Q_m_2 ? '✅' : '❌'}`);
      console.log(`- Питання 3: ${fields.Q_m_3 ? '✅' : '❌'}`);
      console.log(`- Питання 4: ${fields.Q_m_4 ? '✅' : '❌'}`);
      console.log(`- Питання 5: ${fields.Q_m_5 ? '✅' : '❌'}`);
      console.log(`- Питання 6: ${fields.Q_m_6 ? '✅' : '❌'}`);
      console.log(`- Афірмація: ${hasAffirmation ? '✅' : '❌'}`);
      console.log(`- ЗАВЕРШЕНО: ${isCompleted ? '✅' : '❌'}`);
    } else {
      const answers = [fields.Q_e_1, fields.Q_e_2, fields.Q_e_3, fields.Q_e_4, fields.Q_e_5];
      const answeredCount = answers.filter(Boolean).length;
      const hasAffirmation = !!fields.affirmation_e;
      
      console.log(`[responseService] 🌙 ВЕЧІРНЯ СЕСІЯ для ${tgIdString}:`);
      console.log(`- Відповіді: ${answeredCount}/5`);
      console.log(`- Питання 1: ${fields.Q_e_1 ? '✅' : '❌'}`);
      console.log(`- Питання 2: ${fields.Q_e_2 ? '✅' : '❌'}`);
      console.log(`- Питання 3: ${fields.Q_e_3 ? '✅' : '❌'}`);
      console.log(`- Питання 4: ${fields.Q_e_4 ? '✅' : '❌'}`);
      console.log(`- Питання 5: ${fields.Q_e_5 ? '✅' : '❌'}`);
      console.log(`- Афірмація: ${hasAffirmation ? '✅' : '❌'}`);
      console.log(`- ЗАВЕРШЕНО: ${isCompleted ? '✅' : '❌'}`);
    }

    return isCompleted;
  } catch (error) {
    console.error(`[responseService] ❌ ПОМИЛКА перевірки завершеності для ${tgId}:`);
    console.error(`- Тип: ${questionType}`);
    console.error(`- Помилка:`, error);
    return false;
  }
};

export const getDayRecord = async (tgId, date = null) => {
  try {
    const base = getBase();
    const targetDate = date || getUserDateString(tgId);
    const tgIdString = String(tgId);

    console.log(`[responseService] 📅 Отримання запису для ${tgIdString} на ${targetDate}`);

    const records = await base('Responses').select({
      filterByFormula: `AND({TG_id}="${tgIdString}", DATESTR({Date Response})="${targetDate}")`,
      maxRecords: 1,
    }).firstPage();

    const result = records.length > 0 ? records[0] : null;
    console.log(`[responseService] ${result ? '✅ Запис знайдено' : '❌ Запис не знайдено'} для ${tgIdString} на ${targetDate}`);
    
    return result;
  } catch (error) {
    console.error(`[responseService] ❌ Помилка отримання запису для ${tgId}:`, error);
    return null;
  }
};

export const getUserRecords = async (tgId, days = 7) => {
  try {
    const base = getBase();
    const tgIdString = String(tgId);
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    const sinceDateStr = sinceDate.toISOString().split('T')[0];

    console.log(`[responseService] 📊 ЗАПИТ ЗАПИСІВ:`);
    console.log(`- Користувач: ${tgIdString}`);
    console.log(`- Період: ${days} днів (з ${sinceDateStr})`);

    const records = await base('Responses').select({
      filterByFormula: `AND({TG_id}="${tgIdString}", IS_AFTER(DATESTR({Date Response}), "${sinceDateStr}"))`,
      sort: [{ field: 'Date Response', direction: 'desc' }],
    }).all();

    console.log(`[responseService] ✅ Знайдено ${records.length} записів за ${days} днів для ${tgIdString}`);
    
    // Детальна статистика
    let morningCompleted = 0;
    let eveningCompleted = 0;
    
    records.forEach((record, index) => {
      const fields = record.fields || {};
      const date = fields['Date Response'] ? new Date(fields['Date Response']).toLocaleDateString('uk-UA') : 'невідома дата';
      const hasMorning = !!fields.affirmation_m;
      const hasEvening = !!fields.affirmation_e;
      
      if (hasMorning) morningCompleted++;
      if (hasEvening) eveningCompleted++;
      
      console.log(`[responseService] 📋 Запис ${index + 1}: ${date} | Ранок: ${hasMorning ? '✅' : '❌'} | Вечір: ${hasEvening ? '✅' : '❌'}`);
    });
    
    console.log(`[responseService] 📈 СТАТИСТИКА за ${days} днів:`);
    console.log(`- Всього записів: ${records.length}`);
    console.log(`- Ранкових завершено: ${morningCompleted}`);
    console.log(`- Вечірніх завершено: ${eveningCompleted}`);
    
    return records;
  } catch (error) {
    console.error(`[responseService] ❌ ПОМИЛКА отримання записів для ${tgId}:`, error);
    console.error(`- Період: ${days} днів`);
    console.error(`- Помилка:`, error);
    return [];
  }
};

// Функція для отримання статистики користувача
export const getUserStats = async (tgId, days = 30) => {
  try {
    const records = await getUserRecords(tgId, days);
    
    let morningCompleted = 0;
    let eveningCompleted = 0;
    
    records.forEach(record => {
      const fields = record.fields || {};
      if (fields.affirmation_m) morningCompleted++;
      if (fields.affirmation_e) eveningCompleted++;
    });
    
    const stats = {
      totalDays: records.length,
      morningCompleted,
      eveningCompleted,
      morningPercent: records.length ? Math.round((morningCompleted / records.length) * 100) : 0,
      eveningPercent: records.length ? Math.round((eveningCompleted / records.length) * 100) : 0
    };
    
    console.log(`[responseService] 📈 СТАТИСТИКА для ${tgId} за ${days} днів:`);
    console.log(`- Загалом днів: ${stats.totalDays}`);
    console.log(`- Ранкових: ${stats.morningCompleted} (${stats.morningPercent}%)`);
    console.log(`- Вечірніх: ${stats.eveningCompleted} (${stats.eveningPercent}%)`);
    
    return stats;
  } catch (error) {
    console.error(`[responseService] ❌ Помилка отримання статистики для ${tgId}:`, error);
    return {
      totalDays: 0,
      morningCompleted: 0,
      eveningCompleted: 0,
      morningPercent: 0,
      eveningPercent: 0
    };
  }
};

export default { 
  createOrUpdateResponse, 
  isSessionCompleted, 
  getDayRecord, 
  getUserRecords,
  getUserStats 
};