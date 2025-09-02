// src/utils/time.js
import { SCHEDULE, ANSWER_STEPS } from '../config/constants.js';

export function isValidResponseTime(answerStep) {
  const now = new Date();
  const hh = now.getHours();
  const mm = now.getMinutes();
  const t = hh * 60 + mm;

  const morningStart = SCHEDULE.MORNING_START * 60;
  const morningEnd = SCHEDULE.MORNING_END * 60;
  const eveningStart = SCHEDULE.EVENING_START * 60;
  const eveningEnd = SCHEDULE.EVENING_END * 60;

  const isMorningTime = t >= morningStart && t <= morningEnd;
  const isEveningTime = t >= eveningStart || t <= eveningEnd;

  if (answerStep.startsWith('Q_m_') || answerStep === ANSWER_STEPS.MORNING_PENDING) return isMorningTime;
  if (answerStep.startsWith('Q_e_') || answerStep === ANSWER_STEPS.EVENING_PENDING) return isEveningTime;
  return false;
}
