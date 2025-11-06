// src/features/dailySessions/config.js

import { tables } from '../../config/database.js';
import { MORNING_QUESTIONS, EVENING_QUESTIONS, MORNING_ORDER, EVENING_ORDER } from './constants.js';

// ✅ ВСПОМАГАЮЧА ФУНКЦІЯ (залишаємо)
const createFieldMap = (order) => 
  Object.fromEntries(order.map((field, idx) => [idx, field]));

// ═══════════════════════════════════════════════════════════
// ✅ КОНФІГ РАНКУ (7 питань: Daily_Focus + Q_m_1..6)
// ═══════════════════════════════════════════════════════════
export const MORNING_CONFIG = {
  tableName: tables.RESPONSES,
  questionType: 'morning',
  
  // ✅ ПЛОСКИЙ МАСИВ ПИТАНЬ В ПРАВИЛЬНОМУ ПОРЯДКУ!
  questions: MORNING_QUESTIONS,
  
  // ✅ МАППІНГ: индекс -> назва поля в Airtable
  fieldMap: createFieldMap(MORNING_ORDER),
  
  initialFields: { 
    Current_Activity: null 
  },
  
  completionMessage: '✅ Ранкова рефлексія завершена! 🌞\n\nТи готова до дій! 💪',
  
  // ✅ ОБРОБКА ВІДПОВІДІ (зрізати по 2000 символів)
  processAnswer: (answer, stepIndex) => {
    if (typeof answer !== 'string') return answer;
    return answer.trim().substring(0, 2000);
  },
  
  // ✅ ВАЛІДАЦІЯ (непорожна відповідь)
  validate: (answer) => {
    const text = String(answer || '').trim();
    if (!text) {
      return { valid: false, error: 'Відповідь не може бути порожною' };
    }
    return { valid: true };
  }
};

// ═══════════════════════════════════════════════════════════
// ✅ КОНФІГ ВЕЧОРА (7 питань: Q_e_1..7)
// ═══════════════════════════════════════════════════════════
export const EVENING_CONFIG = {
  tableName: tables.RESPONSES,
  questionType: 'evening',
  
  // ✅ ПЛОСКИЙ МАСИВ ПИТАНЬ В ПРАВИЛЬНОМУ ПОРЯДКУ!
  questions: EVENING_QUESTIONS,
  
  // ✅ МАППІНГ: індекс -> назва поля в Airtable
  fieldMap: createFieldMap(EVENING_ORDER),
  
  initialFields: { 
    Current_Activity: null 
  },
  
  completionMessage: '✅ Вечірня рефлексія завершена! 🌙\n\nГарна ночі! Ти чудово попрацювала сьогодні! 💪',
  
  // ✅ ОБРОБКА ВІДПОВІДІ (зрізати по 2000 символів)
  processAnswer: (answer, stepIndex) => {
    if (typeof answer !== 'string') return answer;
    return answer.trim().substring(0, 2000);
  },
  
  // ✅ ВАЛІДАЦІЯ (непорожна відповідь)
  validate: (answer) => {
    const text = String(answer || '').trim();
    if (!text) {
      return { valid: false, error: 'Відповідь не може бути порожною' };
    }
    return { valid: true };
  }
};

console.log('✅ [dailySessions/config] Конфіг завантажено (ВИПРАВЛЕНО)');