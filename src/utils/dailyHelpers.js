// src/utils/dailyHelpers.js
import { QUESTIONS, ANSWER_STEPS } from '../config/constants.js';

export const getNextStep = (currentStep) => {
  const steps = QUESTIONS.morning.map(q => q.field);
  const index = steps.indexOf(currentStep);
  return index < steps.length-1 ? steps[index+1] : ANSWER_STEPS.COMPLETED;
};

export const getEveningNextStep = (currentStep) => {
  const steps = QUESTIONS.evening.map(q => q.field);
  const index = steps.indexOf(currentStep);
  return index < steps.length-1 ? steps[index+1] : ANSWER_STEPS.COMPLETED;
};

export const formatQuestionMessage = (text, number, total, hint) =>
  `📌 Питання ${number}/${total}\n\n${text}${hint?`\n💡 ${hint}`:''}`;
