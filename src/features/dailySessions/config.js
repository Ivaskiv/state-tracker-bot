// src/features/dailySessions/config.js

import { tables } from '../../config/database.js';
import { QUESTIONS, MORNING_ORDER, EVENING_ORDER } from './constants.js';

const createFieldMap = (order) => 
  Object.fromEntries(order.map((field, idx) => [idx, field]));

export const MORNING_CONFIG = {
  tableName: tables.RESPONSES,
  questionType: 'morning',
  questions: QUESTIONS.morning.map((q, i) => ({
    ...q,
    emoji: '🌞',
    question: q.text,
  })),
  fieldMap: createFieldMap(MORNING_ORDER),
  initialFields: { Current_Activity: null },
  completionMessage: '✅ Ранок завершено!',
};

export const EVENING_CONFIG = {
  tableName: tables.RESPONSES,
  questionType: 'evening',
  questions: QUESTIONS.evening.map((q, i) => ({
    ...q,
    emoji: '🌙',
    question: q.text,
  })),
  fieldMap: createFieldMap(EVENING_ORDER),
  initialFields: { Current_Activity: null },
  completionMessage: '✅ Вечір завершено!',
};