// src/aiMentor/controllers/aiMentorController.js
import aiMentorService from '../services/aiMentorService.js';
import userService from '../../auth/services/userService.js';
import keyboards from '../../utils/keyboards.js';
import { ANSWER_STEPS } from '../../config/constants.js';

const handleAIMentorRequest = async (ctx) => {
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
    const helpText = `🤖 AI-НАСТАВНИК\n\nЯ твій персональний AI-коуч! Можу допомогти з:\n\n💡 Персональними порадами\n🎯 Мікро-діями для цілей\n⚡ Підтримкою в складних ситуаціях\n🧠 Аналізом твоїх шаблонів\n📅 Денним фідбеком\n\nПросто напиши своє питання, ціль або ситуацію!\n\nНаприклад:\n- "Як підвищити мотивацію?"\n- "Дай мікро-дії для цілі: завершити проєкт"\n- "Що робити, коли немає енергії?"`;
    await ctx.reply(helpText, keyboards.mainMenuKeyboard());
    await userService.updateUserStep(tgId, ANSWER_STEPS.AI_COACH_WAITING);
  } catch (error) {
    console.error('[aiMentorController.handleAIMentorRequest] Помилка:', error);
    await ctx.reply('❌ Помилка AI-наставника. Спробуйте пізніше.', keyboards.mainMenuKeyboard());
  }
};

const handleAIMentorQuestion = async (ctx, question) => {
  try {
    const tgId = ctx.from.id;
    const user = await userService.getUserByTelegramId(tgId);
    if (!user || !user['Active_Subscription_Status']?.includes('✅ Активна')) {
      return ctx.reply('🤖 AI-наставник доступний тільки з активною підпискою', keyboards.mainMenuKeyboard());
    }
    await ctx.telegram.sendChatAction(tgId, 'typing');
    const isGoalRequest = question.toLowerCase().includes('мікро-дії') || 
                         question.toLowerCase().includes('ціль') ||
                         question.toLowerCase().includes('дії для');
    if (isGoalRequest) {
      const focusGoal = question.match(/ціль[:\s]*(.*)/i)?.[1] || question;
      const state = user['Q_m_5'] || 'невідомий стан';
      const result = await aiMentorService.generateMicroActions(focusGoal, state, tgId);
      const actionsText = result.microActions
        .map((action, index) => `${index + 1}. ${action.action}\n💡 ${action.tip}`)
        .join('\n\n');
      const responseText = `🎯 МІКРО-ДІЇ НА СЬОГОДНІ:\n\n${actionsText}\n\n✨ ${result.motivation}`;
      await ctx.reply(responseText, keyboards.mainMenuKeyboard());
    } else {
      const advice = await aiMentorService.generatePersonalizedAdvice(question, tgId);
      await ctx.reply(`🤖 AI-НАСТАВНИК ВІДПОВІДАЄ:\n\n${advice}`, keyboards.mainMenuKeyboard());
    }
    await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
  } catch (error) {
    console.error('[aiMentorController.handleAIMentorQuestion] Помилка:', error);
    await ctx.reply('❌ Помилка при обробці питання. Спробуйте ще раз.', keyboards.mainMenuKeyboard());
  }
};

export default {
  handleAIMentorRequest,
  handleAIMentorQuestion,
};