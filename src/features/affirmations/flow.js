// src/features/affirmations/flow.js
import { MORNING_AFFIRMATIONS, EVENING_AFFIRMATIONS, GENERAL_AFFIRMATIONS } from '../../config/index.js';

export const getRandomAffirmation = (type = 'general') => {
  const lists = {
    morning: MORNING_AFFIRMATIONS,
    evening: EVENING_AFFIRMATIONS,
    general: GENERAL_AFFIRMATIONS
  };
  const list = lists[type] || GENERAL_AFFIRMATIONS;
  return list[Math.floor(Math.random() * list.length)];
};