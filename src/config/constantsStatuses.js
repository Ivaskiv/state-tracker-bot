//src/config/constantsStatuses.js
export const USER_STATUS = Object.freeze({
  NEW: 'New User',
  REGISTERED: 'Registered User',
  ACTIVE: 'Active User'
});

export const SUBSCRIPTION_STATUS = Object.freeze({
  NEW: 'New',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  EXPIRED: 'Expired',
  PAID: 'Paid',
  PENDING: 'Pending',
  EMPTY: 'Empty',
  DECLINED: 'Declined',
  APPROVED: 'Approved'
});

export const CURRENT_ACTIVITY = Object.freeze({
  IDLE: 'idle',
  OB_NAME: 'ob_userName',
  OB_EMAIL: 'ob_email',
  OB_PHONE: 'ob_phone',
  OB_TZ: 'ob_timezone',
  OB_PLAN: 'ob_plan',
  PAYMENT_PENDING: 'payment_pending',
  COMPLETED: 'completed',
  WHEEL: 'WheelBalance',
  AI_MENTOR: 'ai_mentor',
  WEEKLY: 'weekly_report',
  MONTHLY: 'monthly_report',
  SUBSCRIPTION: 'subscription',
DAILY_FOCUS:  'daily_focus',
  Q_M_1: 'Q_m_1', Q_M_2: 'Q_m_2', Q_M_3: 'Q_m_3', Q_M_4: 'Q_m_4', Q_M_5: 'Q_m_5', Q_M_6: 'Q_m_6',
  Q_E_1: 'Q_e_1', Q_E_2: 'Q_e_2', Q_E_3: 'Q_e_3', Q_E_4: 'Q_e_4', Q_E_5: 'Q_e_5', Q_E_6: 'Q_e_6', Q_E_7: 'Q_e_7',
});

export const ANSWER_STEPS = Object.freeze({
  BEGIN: 'Begin_answer',
  COMPLETED:'COMPLETED',
  IDLE:'IDLE',
  OB_PITCH: 'ob_pitch',
  OB_NAME: 'OB_NAME',
  OB_EMAIL: 'OB_EMAIL',
  OB_PHONE: 'OB_PHONE',
  OB_TZ: 'OB_TZ',
  OB_PLAN: 'OB_PLAN',
  OB_PAYMENT_PENDING: 'ob_payment_pending',
  OB_PAYMENT_SUCCESS: 'ob_payment_success',
  OB_REMINDERS_INTRO: 'ob_reminders_intro',
  OB_DONE: 'ob_done',
  MORNING_1: 'Q_m_1', MORNING_2: 'Q_m_2', MORNING_3: 'Q_m_3', MORNING_4: 'Q_m_4', MORNING_5: 'Q_m_5', MORNING_6: 'Q_m_6',
  EVENING_1: 'Q_e_1', EVENING_2: 'Q_e_2', EVENING_3: 'Q_e_3', EVENING_4: 'Q_e_4', EVENING_5: 'Q_e_5', EVENING_6: 'Q_e_6', EVENING_7: 'Q_e_7',
  WHEEL_BALANCE_ACTIVE: 'WheelBalance',
  AI_MENTOR_ACTIVE: 'ai_mentor_active',
  DAILY_FOCUS:  'daily_focus',

});

export const DAILY_MESSAGES = Object.freeze({
  EVENING_WITHOUT_MORNING: (userName) =>
    `🌙 Добрий вечір, ${userName}!\n\n⚠️ Ти ще не пройшла ранкові питання сьогодні.\n\nЩо робимо?`,
  MORNING_SKIPPED: '✅ Добре! Почнімо відразу з вечірньої рефлексії.',
  SESSION_EXITED: '✅ Зрозуміла! Повертайся коли будеш готова. 💪'
});

export const ONBOARDING_STEPS = Object.freeze({
  NAME: ANSWER_STEPS.OB_NAME,
  EMAIL: ANSWER_STEPS.OB_EMAIL,
  PHONE: ANSWER_STEPS.OB_PHONE,
  TIMEZONE: ANSWER_STEPS.OB_TZ,
  PLAN: ANSWER_STEPS.OB_PLAN,
  COMPLETED: ANSWER_STEPS.COMPLETED
});

export const OB_STEPS = Object.freeze({
  PITCH: ANSWER_STEPS.OB_PITCH,
  NAME: ANSWER_STEPS.OB_NAME,
  EMAIL: ANSWER_STEPS.OB_EMAIL,
  PHONE: ANSWER_STEPS.OB_PHONE,
  TIMEZONE: ANSWER_STEPS.OB_TZ,
  PLAN: ANSWER_STEPS.OB_PLAN,
  PAYMENT_PENDING: ANSWER_STEPS.OB_PAYMENT_PENDING,
  PAYMENT_SUCCESS: ANSWER_STEPS.OB_PAYMENT_SUCCESS,
  REMINDERS_INTRO: ANSWER_STEPS.OB_REMINDERS_INTRO,
  DONE: ANSWER_STEPS.OB_DONE,
});
