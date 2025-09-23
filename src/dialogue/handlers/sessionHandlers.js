// src/dialogue/handlers/sessionHandlers.js - ВИПРАВЛЕНИЙ
import userService from '../../auth/services/userService.js';
import responseService from '../services/responseService.js';
import keyboards from '../../utils/keyboards.js';
import { handleError } from '../../utils/errorHandler.js';
import { ANSWER_STEPS, QUESTIONS } from '../../config/constants.js';
import logger from '../../utils/logger.js';

// Обробка відповідей на питання
const handleQuestionAnswer = async (ctx, user, text) => {
  const step = user?.Answer_Step;
  if (!step || step === ANSWER_STEPS.COMPLETED) return false;
  
  const tgId = ctx.from.id;

  try {
    if (step.startsWith('Q_m_')) {
      return await processMorningQuestions(ctx, user, text, step, tgId);
    }

    if (step.startsWith('Q_e_')) {
      return await processEveningQuestions(ctx, user, text, step, tgId);
    }

    return false;
  } catch (error) {
    await handleError(ctx, error);
    return true;
  }
};

// Обробка ранкових питань
const processMorningQuestions = async (ctx, user, text, step, tgId) => {
  const questionNum = parseInt(step.split('_')[2]);
  
  if (!text) {
    const question = QUESTIONS.morning[questionNum - 1];
    if (question) {
      await ctx.reply(`${question.text}\n\n${question.hint || ''}`, keyboards.exitSessionKeyboard());
    }
    return true;
  }

  if (text.length < 3) {
    await ctx.reply('Будь ласка, дай більш детальну відповідь (мінімум 3 символи)', keyboards.exitSessionKeyboard());
    return true;
  }

  if (text.length > 500) {
    await ctx.reply('Відповідь завелика. Максимум 500 символів.', keyboards.exitSessionKeyboard());
    return true;
  }

  await responseService.saveMorningAnswer(tgId, questionNum, text);
  
  if (questionNum < 6) {
    const nextStep = `Q_m_${questionNum + 1}`;
    await userService.updateUserStep(tgId, nextStep);
    
    const nextQuestion = QUESTIONS.morning[questionNum];
    if (nextQuestion) {
      await ctx.reply(`✅ Збережено!\n\n${nextQuestion.text}\n\n${nextQuestion.hint || ''}`, keyboards.exitSessionKeyboard());
    }
  } else {
    await completeMorningSession(ctx, tgId);
  }
  
  return true;
};

// Обробка вечірніх питань
const processEveningQuestions = async (ctx, user, text, step, tgId) => {
  const questionNum = parseInt(step.split('_')[2]);
  
  if (!text) {
    const question = QUESTIONS.evening[questionNum - 1];
    if (question) {
      await ctx.reply(`${question.text}\n\n${question.hint || ''}`, keyboards.exitSessionKeyboard());
    }
    return true;
  }

  if (text.length < 3) {
    await ctx.reply('Будь ласка, дай більш детальну відповідь (мінімум 3 символи)', keyboards.exitSessionKeyboard());
    return true;
  }

  if (text.length > 500) {
    await ctx.reply('Відповідь завелика. Максимум 500 символів.', keyboards.exitSessionKeyboard());
    return true;
  }

  await responseService.saveEveningAnswer(tgId, questionNum, text);
  
  if (questionNum < 5) {
    const nextStep = `Q_e_${questionNum + 1}`;
    await userService.updateUserStep(tgId, nextStep);
    
    const nextQuestion = QUESTIONS.evening[questionNum];
    if (nextQuestion) {
      await ctx.reply(`✅ Збережено!\n\n${nextQuestion.text}\n\n${nextQuestion.hint || ''}`, keyboards.exitSessionKeyboard());
    }
  } else {
    await completeEveningSession(ctx, tgId);
  }
  
  return true;
};

// Завершення ранкової сесії
const completeMorningSession = async (ctx, tgId) => {
  try {
    await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
    
    const affirmation = '✨ Твоя енергія створює позитивні зміни!';
    
    await ctx.reply(
      `🎉 РАНКОВА РЕФЛЕКСІЯ ЗАВЕРШЕНА!\n\n💫 Твоя афірмація на день:\n"${affirmation}"\n\n🔥 Гарного дня! Увечері я нагадаю про вечірню рефлексію.`,
      keyboards.mainMenuKeyboard()
    );
    
    logger.info(`✅ [SESSION] Ранкова сесія завершена для ${tgId}`);
  } catch (error) {
    logger.error(`❌ [SESSION] Помилка завершення ранкової сесії:`, error);
    await ctx.reply('✅ Ранкову рефлексію завершено!', keyboards.mainMenuKeyboard());
  }
};

// Завершення вечірньої сесії
const completeEveningSession = async (ctx, tgId) => {
  try {
    await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
    
    const insight = '🌙 Відпочинь і набирайся сил. Завтра нові можливості!';
    
    await ctx.reply(
      `🌙 ВЕЧІРНЯ РЕФЛЕКСІЯ ЗАВЕРШЕНА!\n\n💭 Інсайт дня:\n"${insight}"\n\n😴 Солодких снів! Завтра вранці на нас чекає нова рефлексія.`,
      keyboards.mainMenuKeyboard()
    );
    
    logger.info(`✅ [SESSION] Вечірня сесія завершена для ${tgId}`);
  } catch (error) {
    logger.error(`❌ [SESSION] Помилка завершення вечірньої сесії:`, error);
    await ctx.reply('✅ Вечірню рефлексію завершено!', keyboards.mainMenuKeyboard());
  }
};

// Обробка рестарту сесій
const handleRestartCallback = async (ctx) => {
  const data = ctx.callbackQuery.data;
  const tgId = ctx.from.id;

  try {
    if (data === 'restart_morning') {
      await userService.updateUserStep(tgId, ANSWER_STEPS.Q_M_1);
      
      const firstQuestion = QUESTIONS.morning[0];
      await ctx.editMessageText(
        `🌅 РАНКОВА РЕФЛЕКСІЯ\n\n${firstQuestion.text}\n\n${firstQuestion.hint || ''}`,
        keyboards.exitSessionKeyboard()
      );
      await ctx.answerCbQuery('Ранкову рефлексію розпочато!');
      
    } else if (data === 'restart_evening') {
      await userService.updateUserStep(tgId, ANSWER_STEPS.Q_E_1);
      
      const firstQuestion = QUESTIONS.evening[0];
      await ctx.editMessageText(
        `🌙 ВЕЧІРНЯ РЕФЛЕКСІЯ\n\n${firstQuestion.text}\n\n${firstQuestion.hint || ''}`,
        keyboards.exitSessionKeyboard()
      );
      await ctx.answerCbQuery('Вечірню рефлексію розпочато!');
      
    } else if (data === 'cancel_restart') {
      await ctx.editMessageText('❌ Скасовано');
      await ctx.answerCbQuery('Скасовано');
      
      setTimeout(async () => {
        await ctx.reply('🏠 Головне меню:', keyboards.mainMenuKeyboard());
      }, 1000);
    }
  } catch (error) {
    logger.error('[sessionHandlers] Помилка рестарту:', error);
    await ctx.answerCbQuery('Помилка. Спробуй ще раз.');
  }
};

export {
  handleQuestionAnswer,
  processMorningQuestions,
  processEveningQuestions,
  completeMorningSession,
  completeEveningSession,
  handleRestartCallback
};