// src/services/questionEngine.js
// 🎯 УНІВЕРСАЛЬНИЙ QUESTION ENGINE
// Одна функція для всіх типів питань (onboarding, daily, wheel)

import { getBase, tables, updateRows } from '../config/database.js';
import logger from '../utils/logger.js';

const base = getBase();

/**
 * 🎯 CORE: Отримати одне питання з конфігурації
 * 
 * @param {Object} config - конфігурація модуля
 *   config.questions[] - масив питань
 *   config.questionType - для логування (наприклад 'morning', 'onboarding')
 * @param {number} stepIndex - індекс питання (0-based)
 * @returns {Object} питання або null
 */
export const getQuestion = (config, stepIndex) => {
  if (!config?.questions || stepIndex < 0 || stepIndex >= config.questions.length) {
    return null;
  }
  return config.questions[stepIndex];
};

/**
 * 🎯 CORE: Форматувати питання для UI
 * 
 * @param {Object} question - об'єкт питання
 * @param {number} stepIndex - поточний крок (1-based для дисплею)
 * @param {number} totalSteps - всього кроків
 * @returns {string} форматований текст для користувача
 */
export const formatQuestionForUI = (question, stepIndex, totalSteps) => {
  if (!question) return '❌ Питання не знайдено';

  const emoji = question.emoji || '❓';
  const stepNum = stepIndex + 1;
  const progressBar = '█'.repeat(stepNum) + '░'.repeat(totalSteps - stepNum);

  let message = `${emoji} *${question.title}*\n`;
  message += `[${progressBar}] ${stepNum}/${totalSteps}\n\n`;

  if (question.question) {
    message += `${question.question}\n\n`;
  }

  if (question.hint) {
    message += `💡 _${question.hint}_`;
  }

  return message;
};

/**
 * 🎯 CORE: Отримати keyboard для питання
 * 
 * Типи: 'text' | 'choice' | 'number' | 'yesno' | 'custom'
 */
export const getKeyboardForQuestion = (question, customKeyboard = null) => {
  // Якщо питання має власну функцію keyboard - використовуємо
  if (question.getKeyboard && typeof question.getKeyboard === 'function') {
    return question.getKeyboard();
  }

  // Якщо передали custom - використовуємо його
  if (customKeyboard) {
    return customKeyboard;
  }

  // За замовченням - пусто (для текстових відповідей)
  return { reply_markup: { remove_keyboard: true } };
};

/**
 * 🎯 SAVE: Записати відповідь до БД
 * 
 * @param {number} tgId - telegram ID
 * @param {Object} config - конфігурація
 *   config.tableName - таблиця для збереження
 *   config.recordId - ID запису
 *   config.fieldMap - { questionIndex: fieldName }
 * @param {number} stepIndex - індекс питання (0-based)
 * @param {any} answer - відповідь користувача
 */
export const saveAnswer = async (tgId, config, stepIndex, answer) => {
  try {
    if (!config.recordId) {
      throw new Error('recordId не визначено');
    }

    // Отримуємо назву поля з маппінга
    const fieldName = config.fieldMap?.[stepIndex];
    if (!fieldName) {
      logger.warn(`[questionEngine] ⚠️ Немає маппінга для кроку ${stepIndex}`);
      return false;
    }

    // Обробляємо значення (можлив custom processor)
    let value = answer;
    if (config.processAnswer && typeof config.processAnswer === 'function') {
      value = config.processAnswer(answer, stepIndex);
    }

    // Обмежуємо довжину текстових відповідей
    if (typeof value === 'string' && value.length > 10000) {
      value = value.substring(0, 10000);
    }

    // Записуємо до БД
    await updateRows(config.tableName, [{
      id: config.recordId,
      fields: { [fieldName]: value }
    }]);

    logger.info(`[questionEngine] ✅ Збережено ${fieldName} для ${tgId}`);
    return true;

  } catch (error) {
    logger.error('[questionEngine/saveAnswer]', error.message);
    return false;
  }
};

/**
 * 🎯 FLOW: Отримати наступне питання (або завершити)
 * 
 * @returns { nextQuestion, nextIndex, isCompleted, completionMessage }
 */
export const getNextStep = (config, currentIndex) => {
  const totalSteps = config.questions.length;
  const nextIndex = currentIndex + 1;

  if (nextIndex >= totalSteps) {
    return {
      nextQuestion: null,
      nextIndex: null,
      isCompleted: true,
      completionMessage: config.completionMessage || '✅ Всі питання завершені!'
    };
  }

  return {
    nextQuestion: config.questions[nextIndex],
    nextIndex,
    isCompleted: false,
    completionMessage: null
  };
};

/**
 * 🎯 STATE: Отримати поточний статус сесії питань
 */
export const getSessionState = async (tgId, config) => {
  try {
    const rec = await base(config.tableName)
      .select({ filterByFormula: `{TG_id} = "${tgId}"`, maxRecords: 1 })
      .firstPage();

    if (!rec.length) return null;

    const record = rec[0];
    const fields = record.fields;

    // Знаходимо останнє заповнене питання
    let lastAnsweredIndex = -1;
    for (let i = 0; i < config.questions.length; i++) {
      const fieldName = config.fieldMap[i];
      if (fields[fieldName]) {
        lastAnsweredIndex = i;
      }
    }

    const isCompleted = lastAnsweredIndex === config.questions.length - 1;

    return {
      recordId: record.id,
      currentIndex: lastAnsweredIndex + 1,
      isCompleted,
      lastAnsweredIndex,
      fields
    };

  } catch (error) {
    logger.error('[questionEngine/getSessionState]', error.message);
    return null;
  }
};

/**
 * 🎯 INIT: Створити новий запис сесії (якщо не існує)
 */
export const initializeSession = async (tgId, config, initialData = {}) => {
  try {
    // Перевіряємо чи існує запис
    const existing = await getSessionState(tgId, config);
    if (existing) {
      return existing;
    }

    // Створюємо новий запис
    const [record] = await base(config.tableName).create([{
      fields: {
        TG_id: String(tgId),
        ...config.initialFields,
        ...initialData
      }
    }], { typecast: true });

    logger.info(`[questionEngine] 📝 Новий запис: ${record.id}`);

    return {
      recordId: record.id,
      currentIndex: 0,
      isCompleted: false,
      lastAnsweredIndex: -1,
      fields: record.fields
    };

  } catch (error) {
    logger.error('[questionEngine/initializeSession]', error.message);
    return null;
  }
};

/**
 * 🎯 RESET: Очистити сесію (перезапустити питання)
 */
export const resetSession = async (config) => {
  try {
    if (!config.recordId) throw new Error('recordId не визначено');

    const resetFields = {};
    for (const fieldName of Object.values(config.fieldMap)) {
      resetFields[fieldName] = null;
    }

    await updateRows(config.tableName, [{
      id: config.recordId,
      fields: resetFields
    }]);

    logger.info(`[questionEngine] 🔄 Сесія очищена`);
    return true;

  } catch (error) {
    logger.error('[questionEngine/resetSession]', error.message);
    return false;
  }
};

/**
 * 🎯 VALIDATE: Перевірити відповідь (опційно)
 */
export const validateAnswer = (answer, question, config) => {
  // Якщо питання має власний валідатор
  if (question.validate && typeof question.validate === 'function') {
    return question.validate(answer);
  }

  // Якщо конфіг має глобальний валідатор
  if (config.validate && typeof config.validate === 'function') {
    return config.validate(answer, question);
  }

  // За замовченням - вважаємо відповідь валідною
  return { valid: true };
};

/**
 * 📝 EXAMPLE CONFIG (як структурувати конфіг для модуля)
 * 
 * const onboardingConfig = {
 *   tableName: tables.USERS,
 *   questions: [
 *     { title: 'Ім\'я?', question: 'Як тебе звати?', hint: '2-30 символів', emoji: '👤' },
 *     { title: 'Email?', question: '...', hint: '...', emoji: '📧' }
 *   ],
 *   fieldMap: {
 *     0: 'User Name',
 *     1: 'Email',
 *     2: 'Phone'
 *   },
 *   initialFields: { Status: 'New' },
 *   completionMessage: '✅ Реєстрація завершена!',
 *   processAnswer: (answer, index) => {
 *     // опціонна обробка відповіді
 *     return answer.trim();
 *   },
 *   validate: (answer, question) => {
 *     return { valid: answer.length > 0 };
 *   }
 * };
 */

export default {
  getQuestion,
  formatQuestionForUI,
  getKeyboardForQuestion,
  saveAnswer,
  getNextStep,
  getSessionState,
  initializeSession,
  resetSession,
  validateAnswer
};

console.log('✅ [questionEngine] Унифікований Question Engine завантажено');