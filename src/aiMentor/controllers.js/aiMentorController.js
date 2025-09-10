// src/aiMentor/controllers/aiMentorController.js - ЗБЕРЕЖЕННЯ В RESPONSES
import aiMentorService from '../services/aiMentorService.js';
import userService from '../../auth/services/userService.js';
import responseService from '../../dialogue/services/responseService.js';
import keyboards from '../../utils/keyboards.js';
import { ANSWER_STEPS, QUESTION_TYPES } from '../../config/constants.js';

const handleAIMentorRequest = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    console.log(`\n🤖 [AI MENTOR REQUEST] Початок для користувача ${tgId}`);
    
    const user = await userService.getUserByTelegramId(tgId);
    if (!user) {
      console.log(`❌ [AI MENTOR] Користувача ${tgId} не знайдено`);
      return ctx.reply('Спочатку зареєструйтесь /start', keyboards.mainMenuKeyboard());
    }
    
    const isActive = user['Active_Subscription_Status']?.includes('✅ Активна');
    console.log(`💰 [AI MENTOR] Активна підписка для ${tgId}: ${isActive}`);
    
    if (!isActive) {
      console.log(`❌ [AI MENTOR] Немає підписки для ${tgId}`);
      return ctx.reply('🤖 AI-наставник доступний тільки з активною підпискою', keyboards.mainMenuKeyboard());
    }
    
    console.log(`📝 [AI MENTOR] Поточний Answer_Step: "${user.Answer_Step}"`);
    console.log(`🔄 [AI MENTOR] Встановлюємо Answer_Step на: "${ANSWER_STEPS.AI_MENTOR_WAITING}"`);
    
    // ✅ СПОЧАТКУ ОНОВЛЮЄМО СТАН
    await userService.updateUserStep(tgId, ANSWER_STEPS.AI_MENTOR_WAITING);
    
    // ✅ ПЕРЕВІРЯЄМО ЧИ ОНОВИЛОСЯ
    const updatedUser = await userService.getUserByTelegramId(tgId);
    console.log(`✅ [AI MENTOR] Після оновлення Answer_Step: "${updatedUser.Answer_Step}"`);
    console.log(`✅ [AI MENTOR] Стани збігаються: ${updatedUser.Answer_Step === ANSWER_STEPS.AI_MENTOR_WAITING}`);
    
    await ctx.telegram.sendChatAction(tgId, 'typing');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    const helpText = `🤖 AI-НАСТАВНИК\n\nЯ твій персональний AI-коуч! Готовий відповісти на твоє питання.\n\n💡 Персональними порадами\n🎯 Мікро-діями для цілей\n⚡ Підтримкою в складних ситуаціях\n\nНапиши своє питання прямо зараз! 👇`;
    
    await ctx.reply(helpText);
    console.log(`✅ [AI MENTOR] Інструкції надіслано, очікуємо питання від ${tgId}`);
    
  } catch (error) {
    console.error('[AI MENTOR REQUEST] Помилка:', error);
    await ctx.reply('❌ Помилка AI-наставника. Спробуйте пізніше.', keyboards.mainMenuKeyboard());
  }
};

const handleAIMentorQuestion = async (ctx, question) => {
  try {
    const tgId = ctx.from.id;
    console.log(`\n🤖 [AI MENTOR QUESTION] Обробка питання від ${tgId}: "${question}"`);
    
    const user = await userService.getUserByTelegramId(tgId);
    if (!user || !user['Active_Subscription_Status']?.includes('✅ Активна')) {
      console.log(`❌ [AI MENTOR] Немає доступу для ${tgId}`);
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      return ctx.reply('🤖 AI-наставник доступний тільки з активною підпискою', keyboards.mainMenuKeyboard());
    }
    
    await ctx.telegram.sendChatAction(tgId, 'typing');
    
    let responseText;
    const isGoalRequest = question.toLowerCase().includes('мікро-дії') || 
                         question.toLowerCase().includes('ціль') ||
                         question.toLowerCase().includes('дії для');
    
    if (isGoalRequest) {
      console.log(`🎯 [AI MENTOR] Генерація мікро-дій для ${tgId}`);
      const focusGoal = question.match(/ціль[:\s]*(.*)/i)?.[1] || question;
      const state = user['Q_m_5'] || 'невідомий стан';
      const result = await aiMentorService.generateMicroActions(focusGoal, state, tgId);
      
      const actionsText = result.microActions
        .map((action, index) => `${index + 1}. ${action.action}\n💡 ${action.tip}`)
        .join('\n\n');
      responseText = `🎯 МІКРО-ДІЇ НА СЬОГОДНІ:\n\n${actionsText}\n\n✨ ${result.motivation}`;
      
    } else {
      console.log(`💡 [AI MENTOR] Генерація поради для ${tgId}`);
      const advice = await aiMentorService.generatePersonalizedAdvice(question, tgId);
      responseText = `🤖 AI-НАСТАВНИК ВІДПОВІДАЄ:\n\n${advice}`;
    }
    
    // ✅ ЗБЕРІГАЄМО ДІАЛОГ
    try {
      await responseService.createOrUpdateResponse(
        tgId,
        user['User Name'] || 'Користувач',
        QUESTION_TYPES.AI_MESSAGE,
        ANSWER_STEPS.COMPLETED,
        0,
        `ПИТАННЯ: ${question}\n\nВІДПОВІДЬ: ${responseText}`,
        'ai_dialog'
      );
      console.log(`💾 [AI MENTOR] Діалог збережено для ${tgId}`);
    } catch (saveError) {
      console.error(`❌ [AI MENTOR] Помилка збереження:`, saveError);
    }
    
    // ✅ ПОКАЗУЄМО КНОПКИ ПРОДОВЖЕННЯ
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🤖 Ще питання', callback_data: 'ai_continue' },
            { text: '🏠 Головне меню', callback_data: 'ai_exit' }
          ]
        ]
      }
    };
    
    await ctx.reply(responseText, keyboard);
    console.log(`✅ [AI MENTOR] Відповідь надіслано для ${tgId}`);
    
    // ✅ ЗАЛИШАЄМО В РЕЖИМІ AI-НАСТАВНИКА ДЛЯ ПРОДОВЖЕННЯ
    // НЕ міняємо Answer_Step, щоб користувач міг задати ще питання
    
  } catch (error) {
    console.error('[AI MENTOR QUESTION] Помилка:', error);
    await ctx.reply('❌ Помилка при обробці питання. Спробуйте ще раз.');
  }
};

const handleAIMentorCallback = async (ctx) => {
  const data = ctx.callbackQuery.data;
  const tgId = ctx.from.id;
  
  try {
    console.log(`📱 [AI MENTOR CALLBACK] ${data} для ${tgId}`);
    
    if (data === 'ai_continue') {
      await ctx.reply('🤖 Задавай наступне питання! Я готовий допомогти 😊');
      await ctx.answerCbQuery('Продовжуємо діалог');
      // Залишаємо Answer_Step = AI_MENTOR_WAITING
      
    } else if (data === 'ai_exit') {
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      await ctx.reply('👋 Дякую за спілкування! Повертаємося до головного меню.', keyboards.mainMenuKeyboard());
      await ctx.answerCbQuery('Вихід з AI-наставника');
      console.log(`🚪 [AI MENTOR] Користувач ${tgId} вийшов з AI-наставника`);
    }
  } catch (error) {
    console.error('[AI MENTOR CALLBACK] Помилка:', error);
    await ctx.answerCbQuery('Помилка');
  }
};

export default {
  handleAIMentorRequest,
  handleAIMentorQuestion,
  handleAIMentorCallback,
};