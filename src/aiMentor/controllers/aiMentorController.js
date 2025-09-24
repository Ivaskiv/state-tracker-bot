// src/aiMentor/controllers/aiMentorController.js - ПОВНИЙ ВИПРАВЛЕНИЙ ФАЙЛ

import userService from '../../auth/services/userService.js';
import keyboards from '../../utils/keyboards.js';
import { ANSWER_STEPS } from '../../config/constants.js';
import { AI_MENTOR_PROMPTS, CONTEXT_TYPES } from '../../config/aiMentorPrompts.js';
import { aiMentorSession } from '../session.js';
import conversationService from '../services/conversationService.js';
import logger from '../../utils/logger.js';
import { chat } from '../../services/openaiClient.js';
import typing from '../../utils/typing.js';

/**
 * Визначає тип контексту питання
 */
const determineContextType = (question) => {
  const lowerQuestion = question.toLowerCase();
  
  if (lowerQuestion.includes('ціль') || lowerQuestion.includes('досягти') || lowerQuestion.includes('планую')) {
    return CONTEXT_TYPES.GOAL_SETTING;
  }
  if (lowerQuestion.includes('мотивація') || lowerQuestion.includes('втом') || lowerQuestion.includes('енергія')) {
    return CONTEXT_TYPES.MOTIVATION;
  }
  if (lowerQuestion.includes('план') || lowerQuestion.includes('кроки') || lowerQuestion.includes('проєкт')) {
    return CONTEXT_TYPES.MICRO_ACTIONS;
  }
  if (lowerQuestion.includes('баланс') || lowerQuestion.includes('життя') || lowerQuestion.includes('сфери')) {
    return CONTEXT_TYPES.LIFE_BALANCE;
  }
  
  return CONTEXT_TYPES.GENERAL;
};

/**
 * Обробка запиту на початок сесії AI-наставника
 */
const handleAIMentorRequest = async (ctx) => {
  const tgId = String(ctx.from.id);
  
  try {
    logger.info(`🤖 [AI MENTOR REQUEST] Початок для користувача ${tgId}`);

    const user = await userService.getUserByTelegramId(tgId);
    if (!user) {
      logger.warn(`❌ [AI MENTOR] Користувача ${tgId} не знайдено`);
      return ctx.reply('Спочатку зареєструйтесь /start', keyboards.mainMenuKeyboard());
    }

    // Перевіряємо активну підписку
    const isActive = user['Active_Subscription_Status']?.includes('✅ Активна');
    if (!isActive) {
      logger.info(`❌ [AI MENTOR] Підписка неактивна для ${tgId}`);
      return ctx.reply(
        '🤖 AI-наставник доступний тільки з активною підпискою.\n\n💰 Активуй підписку для доступу до персональної підтримки.',
        keyboards.subscriptionKeyboard()
      );
    }

    // Запускаємо сесію
    aiMentorSession.start(tgId);
    logger.info(`🤖 [AI MENTOR] Сесія запущена для ${tgId}, isActive: ${aiMentorSession.isActive(tgId)}`);

    const helpText = 
      `🤖 AI-НАСТАВНИК\n\n` +
      `Я твій персональний AI-коуч! Готовий відповісти на твоє питання.\n\n` +
      `💡 Персональними порадами\n` +
      `🎯 Мікро-діями для цілей\n` +
      `⚡ Підтримкою в складних ситуаціях\n\n` +
      `Напиши своє питання прямо зараз! 👇`;

    await typing(ctx);
    await ctx.reply(helpText, keyboards.aiMentorStartKeyboard());
    logger.info(`✅ [AI MENTOR] Інструкції надіслано для ${tgId}`);

  } catch (error) {
    logger.error('❌ [AI MENTOR REQUEST] Помилка:', error);
    await ctx.reply('❌ Помилка AI-наставника. Спробуйте пізніше.', keyboards.mainMenuKeyboard());
  }
};

/**
 * Обробка питання до AI-наставника
 */
const handleAIMentorQuestion = async (ctx, question) => {
  const tgId = String(ctx.from.id);
  
  try {
    logger.info(`🤖 [AI MENTOR QUESTION] Обробка питання від ${tgId}: "${question.substring(0, 50)}..."`);

    const user = await userService.getUserByTelegramId(tgId);
    if (!user || !user['Active_Subscription_Status']?.includes('✅ Активна')) {
      logger.warn(`❌ [AI MENTOR] Немає доступу для ${tgId}`);
      aiMentorSession.end(tgId);
      return ctx.reply(
        '🤖 AI-наставник доступний тільки з активною підпискою',
        keyboards.subscriptionKeyboard()
      );
    }

    // Перевіряємо чи активна сесія
    if (!aiMentorSession.isActive(tgId)) {
      logger.warn(`❌ [AI MENTOR] Сесія неактивна для ${tgId}, запускаємо знову`);
      aiMentorSession.start(tgId);
    }

    const contextType = determineContextType(question);
    logger.info(`🧠 [AI MENTOR] Контекст питання: ${contextType}`);

    await typing(ctx);
    
    const responseText = await generateAIResponse(question, user, contextType);
    
    // Збереження діалогу
    try {
      await conversationService.saveAIConversation(
        tgId,
        question,
        responseText,
        {
          contextType,
          userGoal: question.substring(0, 100),
          userState: 'unknown',
          generatedActions: responseText.match(/💡.*?(?=✨|$)/s)?.[0] || '',
          courseSuggested: ''
        }
      );
      logger.info(`✅ [AI MENTOR] Діалог збережено для ${tgId}`);
    } catch (saveError) {
      logger.warn(`⚠️ [AI MENTOR] Не вдалося зберегти діалог:`, saveError);
    }

    await ctx.reply(responseText, keyboards.aiMentorControlKeyboard());
    logger.info(`✅ [AI MENTOR] Відповідь надіслано для ${tgId}`);

  } catch (error) {
    logger.error('❌ [AI MENTOR QUESTION] Помилка:', error);
    await ctx.reply('❌ Помилка при обробці питання. Спробуйте ще раз.');
  }
};

/**
 * Генерація відповіді від AI
 */
const generateAIResponse = async (question, user, contextType) => {
  try {
    let conversationContext = '';
    
    // Отримуємо контекст попередніх розмов
    try {
      const recentHistory = await conversationService.getAIConversationHistory(user['TG_id'], 3);
      if (recentHistory.length > 0) {
        conversationContext = '\n\nКонтекст попередніх розмов:\n';
        recentHistory.reverse().forEach((conv, index) => {
          conversationContext += `${index + 1}. Питання: "${conv.question.substring(0, 50)}..."\n`;
          conversationContext += `   Відповідь: "${conv.response.substring(0, 80)}..."\n`;
        });
      }
    } catch (historyError) {
      logger.warn('[AI MENTOR] Не вдалося отримати історію розмов:', historyError);
    }

    const systemPrompt = AI_MENTOR_PROMPTS.SYSTEM_PROMPT;
    const contextPrompt = AI_MENTOR_PROMPTS[contextType] || AI_MENTOR_PROMPTS.GENERAL;
    
    const prompt = 
      `Користувач: ${user['User Name'] || 'Анонім'} (TG_id: ${user['TG_id']})\n` +
      `Питання: "${question}"\n` +
      `${conversationContext}\n\n` +
      `${contextPrompt}`;

    logger.info(`[AI MENTOR] Відправляємо запит до OpenAI для ${user['TG_id']}`);
    
    const response = await chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ], 'gpt-4o-mini', 300);

    if (!response?.trim()) {
      throw new Error('Порожня відповідь від OpenAI');
    }

    logger.info(`[AI MENTOR] OpenAI відповідь отримана: ${response.length} символів`);
    return `🤖 AI-НАСТАВНИК ВІДПОВІДАЄ:\n\n${response}`;

  } catch (error) {
    logger.error('[AI MENTOR] Помилка OpenAI:', error);

    const fallbackResponses = {
      [CONTEXT_TYPES.MICRO_ACTIONS]: '🎯 Твій проєкт має потенціал! Розбий його на маленькі кроки.\n💡 1. Визнач одну ключову дію на сьогодні. 2. Заплануй 15 хвилин для її виконання.\n✨ Ти вже робиш крок до успіху! Продовжуй! 💪',
      [CONTEXT_TYPES.GOAL_SETTING]: '🎯 Твоя ціль — це твій маяк! Почни з малого.\n💡 1. Запиши ціль на папері. 2. Визнач один крок на сьогодні.\n✨ Ти на шляху до великих звершень! 🌟',
      [CONTEXT_TYPES.MOTIVATION]: '🎯 Твоя енергія всередині тебе!\n💡 1. Зроби 5-хвилинну прогулянку. 2. Напиши 3 речі, за які вдячний.\n✨ Ти сильніший, ніж думаєш! 💪',
      [CONTEXT_TYPES.LIFE_BALANCE]: '🎯 Баланс — це ключ до гармонії.\n💡 1. Виділи 10 хвилин для себе. 2. Запиши одну річ для покращення життя.\n✨ Ти вже на шляху до гармонії! 🌟',
      [CONTEXT_TYPES.GENERAL]: '🎯 Твоє питання показує силу духу.\n💡 1. Зроби паузу і подихай глибоко. 2. Запиши одну ідею для дії.\n✨ Ти знаєш відповідь, довіряй собі! ✨'
    };

    return `🤖 AI-НАСТАВНИК ВІДПОВІДАЄ:\n\n${fallbackResponses[contextType] || fallbackResponses[CONTEXT_TYPES.GENERAL]}`;
  }
};

/**
 * Обробка callback-запитів AI-наставника
 */
const handleAIMentorCallback = async (ctx) => {
  const tgId = String(ctx.from.id);
  const data = ctx.callbackQuery.data;

  try {
    logger.info(`📱 [AI MENTOR CALLBACK] ${data} для ${tgId}, AI активна: ${aiMentorSession.isActive(tgId)}`);

    if (data === 'ai_continue') {
      await ctx.reply('🤖 Задавай наступне питання! Я готовий допомогти 😊', keyboards.aiMentorControlKeyboard());
      await ctx.answerCbQuery('Продовжуємо діалог');

    } else if (data === 'ai_exit') {
      aiMentorSession.end(tgId);
      await ctx.reply('👋 Дякую за спілкування! Повертаємося до головного меню.', keyboards.mainMenuKeyboard());
      await ctx.answerCbQuery('Вихід з AI-наставника');
      logger.info(`🚪 [AI MENTOR] Користувач ${tgId} вийшов з AI-наставника`);
      
    } else if (data === 'ai_start_question') {
      await ctx.reply('💬 Напиши своє питання, і я дам персональну пораду!', keyboards.aiMentorControlKeyboard());
      await ctx.answerCbQuery('Починаємо діалог');
      
    } else {
      logger.warn(`❓ [AI MENTOR CALLBACK] Невідомий callback: ${data}`);
      await ctx.answerCbQuery('Команда не розпізнана');
    }

  } catch (error) {
    logger.error('[AI MENTOR CALLBACK] Помилка:', error);
    await ctx.reply('❌ Помилка. Спробуйте ще раз.', keyboards.mainMenuKeyboard());
    await ctx.answerCbQuery('Помилка');
  }
};

/**
 * Генерація звіту AI-діалогів
 */
const getAIConversationReport = async (ctx) => {
  const tgId = String(ctx.from.id);
  
  try {
    logger.info(`📊 [AI MENTOR REPORT] Генерація звіту для ${tgId}`);

    const user = await userService.getUserByTelegramId(tgId);
    if (!user || !user['Active_Subscription_Status']?.includes('✅ Активна')) {
      logger.warn(`❌ [AI MENTOR REPORT] Немає доступу для ${tgId}`);
      return ctx.reply(
        '🤖 AI-наставник доступний тільки з активною підпискою',
        keyboards.subscriptionKeyboard()
      );
    }

    const report = await conversationService.generateAIConversationReport(tgId, 7);
    await ctx.reply(report, keyboards.mainMenuKeyboard());
    logger.info(`✅ [AI MENTOR REPORT] Звіт надіслано для ${tgId}`);

  } catch (error) {
    logger.error('[AI MENTOR REPORT] Помилка:', error);
    await ctx.reply('❌ Не вдалося згенерувати звіт AI діалогів', keyboards.mainMenuKeyboard());
  }
};

export default {
  handleAIMentorRequest,
  handleAIMentorQuestion,
  handleAIMentorCallback,
  getAIConversationReport
};