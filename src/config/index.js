// src/config/index.js
export { SCHEDULE, CRON_SCHEDULES, SCHEDULER_MESSAGES } from './constantsSchedule.js';
export { TIMEZONES, getTzLabel, parseTz } from './constantsTimezones.js';

// core/misc
export { CONFIG } from './constantsMisc.js';
export { AI_MENTOR_CONFIG, CONTEXT_TYPES } from './constantsAi.js';

// ✅ СТАТУСИ / КРОКИ / ОНБОРДИНГ
export {
  USER_STATUS,
  SUBSCRIPTION_STATUS,
  CURRENT_ACTIVITY,
  ANSWER_STEPS,
  DAILY_MESSAGES,
  ONBOARDING_STEPS,
  OB_STEPS
} from './constantsStatuses.js';

// Підписка (без SUBSCRIPTION_STATUS!)
export {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_MESSAGES,
  WAYFORPAY_LINKS
} from './constantsSubscription.js';

// Повідомлення
export { MESSAGES, MENU_TEXTS, REGISTRATION_SUCCESS_TEMPLATE, MENU_BUTTONS } from './constantsMessages.js';

// Питання
export { QUESTIONS, MORNING_QUESTIONS, EVENING_QUESTIONS, QUESTION_PARSERS } from './constantsQuestions.js';

// Колесо
export { LIFE_SPHERES, SPHERE_FIELDS, NOTE_FIELDS, getSphereMeta } from './constantsWheel.js';

// Афірмації
export { MORNING_AFFIRMATIONS, EVENING_AFFIRMATIONS, GENERAL_AFFIRMATIONS } from './constantsAffirmations.js';

// Гейміфікація
export { BADGES, BADGE_CRITERIA, PROGRESS_LEVELS, getProgressLevel } from './constantsGamification.js';

// Курси / NFR / Контакти
export { COURSE_OFFERS, CONSULTATION_OFFER, COURSE_MESSAGES } from './constantsCourses.js';
export { ACTIVITY_TRIGGERS, PROBLEM_TYPES, PROBLEM_DESCRIPTIONS } from './constantsGamification.js';
export { CONTACTS } from './constantsContacts.js';

export { DASHBOARD_MESSAGES } from './constantsDashboard.js';

export { 
  AI_MENTOR_PROMPTS, 
  DAILY_ANALYSIS_PROMPTS,
  WHEEL_ANALYSIS_PROMPT
} from './prompts.js';