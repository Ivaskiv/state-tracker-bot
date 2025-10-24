// src/features/onboarding/config.js
import { tables } from '../../config/database.js';
import keyboards from '../../utils/keyboards.js';
import {
  STEPS,
  VALIDATORS,
  PROCESSORS,
  MESSAGES,
} from './constants.js';

const isEmpty = (v) =>
  v === null || v === undefined || (typeof v === 'string' && !v.trim());

const QUESTIONS = [
  {
    emoji: '👤',
    title: 'Як тебе звати?',
    question: 'Вкажи своє імʼя (2-50 символів):',
    hint: 'Буквами, без цифр',
    validate: VALIDATORS.name,
    process: PROCESSORS.name,
  },
  {
    emoji: '📧',
    title: 'Твій email?',
    question: 'Вкажи email для звітів (опціонально):',
    hint: 'приклад@mail.com',
    validate: VALIDATORS.email,
    process: PROCESSORS.email,
    getKeyboard: () => keyboards.kbSkipEmail(),
  },
  {
    emoji: '📱',
    title: 'Твій телефон?',
    question: 'Залиш номер телефону (опціонально):',
    hint: '+380XXXXXXXXX (9 цифр після +380)',
    validate: VALIDATORS.phone,
    process: PROCESSORS.phone,
    getKeyboard: () => keyboards.kbSkipPhone(),
  },
  {
    emoji: '🌍',
    title: 'Твій часовий пояс?',
    question: 'Обери свій часовий пояс (ранкові нагадування в 08:00):',
    hint: 'Прокрути вниз',
    validate: VALIDATORS.timezone,
    process: PROCESSORS.timezone,
    getKeyboard: () => keyboards.timezoneKeyboard(),
  },
  {
    emoji: '💰',
    title: 'Обери план підписки',
    question: 'Що тебе цікавить?',
    hint: 'Пробний період ідеальний для першого запуску',
    process: PROCESSORS.plan,
    getKeyboard: () => keyboards.subscriptionPlansKeyboard(),
  },
];

export const ONBOARDING_CONFIG = {
  tableName: tables.USERS,
  questions: QUESTIONS,
  questionType: 'onboarding',
  fieldMap: {
    0: 'User Name',
    1: 'Email',
    2: 'Phone',
    3: 'Time_Zone',
    4: 'Active_Subscription_Plan',
  },
  initialFields: {
    Status: 'New User',
    Answer_Step: 'pitch',
    Created_At: new Date().toISOString(),
  },
  completionMessage: MESSAGES.REG_SUCCESS,
  processAnswer: (answer) => (typeof answer === 'string' ? answer.trim() : answer),
  validate: (answer) => (isEmpty(answer) ? { valid: false, error: 'Відповідь не може бути порожньою' } : { valid: true }),
};
