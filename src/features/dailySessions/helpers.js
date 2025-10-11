// Парсинг та аналіз відповідей ✅

// src/services/dailySessions/helpers.js
import { QUESTION_PARSERS } from '../../config/constants.js';
import logger from '../../123/logger.js';

// ===== ПАРСИНГ РАНКОВИХ ВІДПОВІДЕЙ =====

export const parseMorningAnswer = (questionNumber, answer) => {
  try {
    switch (questionNumber) {
      case 3: // Цілі
        return QUESTION_PARSERS?.parseGoals?.(answer) || {};
      case 4: // Фокус дня
        return QUESTION_PARSERS?.parseDailyFocus?.(answer) || {};
      case 5: // Стан
        return QUESTION_PARSERS?.parseState?.(answer) || {};
      case 6: // Дії
        const parsed = QUESTION_PARSERS?.parseActions?.(answer) || {};
        return parsed.affirmation 
          ? { affirmation_m: parsed.affirmation } 
          : parsed;
      default:
        return {};
    }
  } catch (error) {
    logger.error(`❌ [dailySessions] parseMorningAnswer Q${questionNumber}:`, error);
    return {};
  }
};

// ===== ПАРСИНГ ВЕЧІРНІХ ВІДПОВІДЕЙ =====

export const parseEveningAnswer = (questionNumber, answer, todayData) => {
  try {
    if (questionNumber === 5) {
      return analyzeActionCompletion(answer || '', todayData || {});
    }
    if (questionNumber === 6) {
      return analyzeGoalProgress(answer || '');
    }
    return {};
  } catch (error) {
    logger.error(`❌ [dailySessions] parseEveningAnswer Q${questionNumber}:`, error);
    return {};
  }
};

// ===== АНАЛІЗ ВИКОНАННЯ ДІЙ =====

export const analyzeActionCompletion = (answer, todayData) => {
  try {
    const lower = (answer || '').toLowerCase();
    const actions = [
      todayData?.Daily_Action_1, 
      todayData?.Daily_Action_2, 
      todayData?.Daily_Action_3
    ].filter(Boolean);
    
    const completed = [];
    const skipped = [];
    const doneMarkers = ['✅', 'зроблено', 'виконано', 'так', '+', 'done'];
    const skipMarkers = ['⏭', 'не зроблено', 'ні', '-', 'пропустила', 'пропустив'];

    actions.forEach((act, i) => {
      const actionStart = (act || '').toLowerCase().slice(0, 40);
      const matchedDone = doneMarkers.some(m => 
        lower.includes(m) && lower.includes(actionStart.slice(0, 10))
      );
      const matchedSkip = skipMarkers.some(m => 
        lower.includes(m) && lower.includes(actionStart.slice(0, 10))
      );
      
      if (matchedDone) completed.push(i + 1);
      else if (matchedSkip) skipped.push(i + 1);
    });

    return {
      Actions_Completed_Count: completed.length || null,
      Actions_Completed_List: completed.length ? completed.join(',') : null,
      Actions_Skipped_List: skipped.length ? skipped.join(',') : null,
      Completion_Rate: actions.length 
        ? Math.round((completed.length / actions.length) * 100) 
        : null
    };
  } catch (error) {
    logger.error('❌ [dailySessions] analyzeActionCompletion:', error);
    return {};
  }
};

// ===== АНАЛІЗ ПРОГРЕСУ ПО ЦІЛЯХ =====

export const analyzeGoalProgress = (answer) => {
  try {
    return { Goal_Progress: answer || null };
  } catch (error) {
    logger.error('❌ [dailySessions] analyzeGoalProgress:', error);
    return {};
  }
};