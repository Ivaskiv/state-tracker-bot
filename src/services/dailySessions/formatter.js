// src/services/dailySessions/formatter.js
import { QUESTIONS } from '../../config/constants.js';

export const formatQuestionMessage = (sessionType, questionIndex) => {
  const questions = sessionType === 'morning' ? QUESTIONS.morning : QUESTIONS.evening;
  const question = questions[questionIndex];
  
  if (!question) return null;
  
  const icon = sessionType === 'morning' ? '🌞' : '🌙';
  const title = sessionType === 'morning' ? 'РАНКОВА РЕФЛЕКСІЯ' : 'ВЕЧІРНЯ РЕФЛЕКСІЯ';
  const emojiNumbers = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
  const currentEmoji = emojiNumbers[questionIndex + 1];
  
  const questionLines = question.text.split('\n');
  const questionTitle = questionLines[0];
  
  return {
    text: 
      `${icon} ${title}\n\n` +
      `${currentEmoji}/${questions.length} ${questionTitle}\n` +
      (question.hint ? `💡 ${question.hint}` : ''),
    field: question.field,
    total: questions.length
  };
};

export const formatCompletionMessage = (sessionType) => {
  const icon = sessionType === 'morning' ? '🌞' : '🌙';
  const title = sessionType === 'morning' ? 'Ранкову' : 'Вечірню';
  const message = sessionType === 'morning' 
    ? 'Налаштування на день готове! 💪'
    : 'Дякую за чесність! 💪';
  
  return `${icon} ${title} рефлексію завершено!\n\n✅ Всі відповіді збережено.\n\n${message}`;
};

export const formatRestartWarning = (sessionType) => {
  const title = sessionType === 'morning' ? 'ранкову' : 'вечірню';
  
  return (
    `⚠️ Ти вже пройшла ${title} рефлексію сьогодні!\n\n` +
    `Якщо почнеш заново, попередні відповіді будуть перезаписані.\n\n` +
    `Що робимо?`
  );
};

export const formatEveningWithoutMorning = (userName) => {
  return (
    `🌙 Добрий вечір, ${userName}!\n\n` +
    `⚠️ Ти ще не пройшла ранкові питання сьогодні.\n\n` +
    `Що робимо?`
  );
};

export const getStepNumber = (field) => {
  const match = field.match(/Q_[me]_(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
};