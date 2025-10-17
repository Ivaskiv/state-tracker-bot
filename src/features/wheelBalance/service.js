// src/features/wheelBalance/service.js
import { LIFE_SPHERES } from '../../config/index.js';
import { WHEEL_QUESTIONS } from '../../config/constantsWheel.js';

/**
 * Отримати питання за кроком
 */
export const getQuestion = (sphere, step) => {
  const question = WHEEL_QUESTIONS.wheel[step - 1] || {};
  return question;
};

/**
 * Отримати відсоток прогресу
 */
export const getProgressPercent = (step) => {
  const totalSteps = LIFE_SPHERES.length;
  return Math.round((step / totalSteps) * 100);
};

/**
 * Отримати прогрес-бар
 */
export const getProgressBar = (percent) => {
  const filled = Math.floor(percent / 10);
  const empty = 10 - filled;

  if (percent === 0) return '░░░░░░░░░░ 0%';
  if (percent === 100) return '██████████ 100%';

  return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percent}%`;
};

/**
 * Отримати поточну дату ISO
 */
export const getTodayISO = () => new Date().toISOString().split('T')[0];

export const wheelService = {
  getQuestion,
  getProgressPercent,
  getProgressBar,
  getTodayISO
};

console.log('✅ [wheelBalance/service] Сервіс завантажено');