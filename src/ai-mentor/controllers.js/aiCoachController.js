// src/ai-coach/controllers/aiCoachController.js
import aiMentorService from '../../ai-mentor/services/aiMentorService.js';
import userService from '../../auth/services/userService.js';
import responseService from '../../dialogue/services/responseService.js';
import keyboards from '../../utils/keyboards.js';
import { ANSWER_STEPS, QUESTION_TYPES } from '../../config/constants.js';

const handleAICoachRequest = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const user = await userService.getUserByTelegramId(tgId);

    if (!user) {
      return ctx.reply('Спочатку зареєструйтесь /start', keyboards.mainMenuKeyboard());
    }

    const isActive = user['Active_Subscription_Status']?.includes('✅ Активна');
    if (!isActive) {
      return ctx.reply('🤖 AI-наставник доступний тільки з активною підпискою', keyboards.mainMenuKeyboard());
    }

    await ctx.telegram.sendChatAction(tgId, 'typing');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const helpText = `🤖 AI-НАСТАВНИК

Я твій персональний AI-коуч! Можу допомогти з:

💡 Персональними порадами  
🎯 Мікро-діями для цілей
⚡ Підтримкою в складних ситуаціях
🧠 Аналізом твоїх шаблонів
📅 Денним фідбеком

Просто напиши своє питання, ціль або ситуацію, і я дам персоналізовану пораду на основі твоєї історії! 

Наприклад:
- "Як підвищити мотивацію?"
- "Дай мікро-дії для цілі: завершити проєкт"
- "Що робити, коли немає енергії?"`;

    await ctx.reply(helpText, keyboards.mainMenuKeyboard());
    await userService.updateUserStep(tgId, ANSWER_STEPS.AI_COACH_WAITING);
  } catch (error) {
    console.error('[aiCoachController.handleAICoachRequest] Помилка:', error);
    await ctx.reply('❌ Помилка AI-наставника. Спробуйте пізніше.', keyboards.mainMenuKeyboard());
  }
};

const handleAICoachQuestion = async (ctx, question) => {
  try {
    const tgId = ctx.from.id;
    const user = await userService.getUserByTelegramId(tgId);

    if (!user || !user['Active_Subscription_Status']?.includes('✅ Активна')) {
      return ctx.reply('🤖 AI-наставник доступний тільки з активною підпискою', keyboards.mainMenuKeyboard());
    }

    await ctx.telegram.sendChatAction(tgId, 'typing');

    const userContext = await aiMentorService.getUserHistory(tgId);
    const advice = await aiMentorService.answerQuestion(question, userContext);

    await ctx.reply(`🤖 AI-НАСТАВНИК ВІДПОВІДАЄ:\n\n${advice}`, keyboards.mainMenuKeyboard());
    await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
  } catch (error) {
    console.error('[aiCoachController.handleAICoachQuestion] Помилка:', error);
    await ctx.reply('❌ Помилка при обробці питання. Спробуйте ще раз.', keyboards.mainMenuKeyboard());
  }
};

const handleMicroActionsRequest = async (ctx, focusGoal, state) => {
  try {
    const tgId = ctx.from.id;
    const user = await userService.getUserByTelegramId(tgId);

    if (!user || !user['Active_Subscription_Status']?.includes('✅ Активна')) {
      return ctx.reply('🤖 AI-наставник доступний тільки з активною підпискою', keyboards.mainMenuKeyboard());
    }

    await ctx.telegram.sendChatAction(tgId, 'typing');

    const { microActions, motivation } = await aiMentorService.generateMicroActions(focusGoal, state, tgId);
    const actionsText = microActions
      .map((action, index) => `${index + 1}. ${action.action} (${action.priority})\n💡 ${action.tip}`)
      .join('\n\n');
    const responseText = `🎯 Мікро-дії для цілі "${focusGoal}":\n\n${actionsText}\n\n✨ ${motivation}`;

    await ctx.reply(responseText, keyboards.mainMenuKeyboard());
    await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
  } catch (error) {
    console.error('[aiCoachController.handleMicroActionsRequest] Помилка:', error);
    await ctx.reply('❌ Помилка при генерації мікро-дій. Спробуйте ще раз.', keyboards.mainMenuKeyboard());
  }
};

const handleDayFeedbackRequest = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const user = await userService.getUserByTelegramId(tgId);

    if (!user || !user['Active_Subscription_Status']?.includes('✅ Активна')) {
      return ctx.reply('🤖 AI-наставник доступний тільки з активною підпискою', keyboards.mainMenuKeyboard());
    }

    await ctx.telegram.sendChatAction(tgId, 'typing');

    const today = new Date().toISOString().split('T')[0];
    const responses = await responseService.getUserRecords(tgId, 1);
    const todayResponses = responses.filter((r) => r.fields.Date_Response === today);
    const state = todayResponses.find((r) => r.fields.Q_m_5)?.fields.Q_m_5 || 'невідомий';
    const goal = todayResponses.find((r) => r.fields.Q_m_4)?.fields.Q_m_4 || 'немає цілі';

    const feedback = await aiMentorService.provideDayFeedback(todayResponses, state, goal);
    await ctx.reply(`📅 Денний фідбек:\n\n${feedback}`, keyboards.mainMenuKeyboard());
    await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
  } catch (error) {
    console.error('[aiCoachController.handleDayFeedbackRequest] Помилка:', error);
    await ctx.reply('❌ Помилка при генерації фідбеку. Спробуйте ще раз.', keyboards.mainMenuKeyboard());
  }
};

export default {
  handleAICoachRequest,
  handleAICoachQuestion,
  handleMicroActionsRequest,
  handleDayFeedbackRequest,
};