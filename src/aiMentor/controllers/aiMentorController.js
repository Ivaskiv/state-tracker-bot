// src/aiMentor/controllers.js/aiMentorController.js
import userService from '../../auth/services/userService.js';
import keyboards from '../../utils/keyboards.js';
import { aiMentorControlKeyboard } from '../../utils/keyboards.js';
import { ANSWER_STEPS } from '../../config/constants.js';
import typing from '../../utils/typing.js';
import { aiMentorSession } from '../session.js';
import { saveGoal, saveMicroAction } from '../services/goalService.js';

const handleAIMentorRequest = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    console.log(`🤖 [AI MENTOR REQUEST] Початок для користувача ${tgId}`);
    
    const user = await userService.getUserByTelegramId(tgId);
    if (!user) {
      return ctx.reply('Спочатку зареєструйтесь /start', keyboards.mainMenuKeyboard());
    }
    
    const isActive = user['Active_Subscription_Status']?.includes('✅ Активна');
    if (!isActive) {
      await typing(ctx);
      return ctx.reply('🤖 AI-наставник доступний тільки з активною підпискою', keyboards.mainMenuKeyboard());
    }
    
    aiMentorSession.start(tgId);
    await userService.updateUserStep(tgId, ANSWER_STEPS.AI_MENTOR_ACTIVE);
    console.log(`🔄 [AI MENTOR] Answer_Step встановлено на: ${ANSWER_STEPS.AI_MENTOR_ACTIVE}`);
    
    await typing(ctx);

    const helpText = `🤖 AI-НАСТАВНИК\n\nЯ твій персональний AI-коуч! Готовий відповісти на твоє питання.\n\n💡 Персональними порадами\n🎯 Мікро-діями для цілей\n⚡ Підтримкою в складних ситуаціях\n\nНапиши своє питання прямо зараз! 👇`;
    
    await ctx.reply(helpText);
    console.log(`✅ [AI MENTOR] Інструкції надіслано для ${tgId}, Answer_Step: ${ANSWER_STEPS.AI_MENTOR_ACTIVE}`);
    
  } catch (error) {
    console.error('[AI MENTOR REQUEST] Помилка:', error);
    await typing(ctx);
    await ctx.reply('❌ Помилка AI-наставника. Спробуйте пізніше.', keyboards.mainMenuKeyboard());
  }
};

const handleAIMentorQuestion = async (ctx, question) => {
  try {
    const tgId = ctx.from.id;
    console.log(`🤖 [AI MENTOR QUESTION] Обробка питання від ${tgId}: "${question}"`);
    
    const user = await userService.getUserByTelegramId(tgId);
    if (!user || !user['Active_Subscription_Status']?.includes('✅ Активна')) {
      console.log(`❌ [AI MENTOR] Немає доступу для ${tgId}`);
      
      aiMentorSession.end(tgId);
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      await typing(ctx);
      return ctx.reply('🤖 AI-наставник доступний тільки з активною підпискою', keyboards.mainMenuKeyboard());
    }
    
    await typing(ctx);
    
    const responseText = await generateAIResponse(question, user);
    
    await typing(ctx);
    await ctx.reply(responseText, aiMentorControlKeyboard());
    console.log(`✅ [AI MENTOR] Відповідь надіслано для ${tgId}`);
    
  } catch (error) {
    console.error('[AI MENTOR QUESTION] Помилка:', error);
    await typing(ctx);
    await ctx.reply('❌ Помилка при обробці питання. Спробуйте ще раз.');
  }
};

const generateAIResponse = async (question, user) => {
  try {
    const { chat } = await import('../../services/openaiClient.js');
    
    const prompt = `Ти експертний AI-наставник рівня Tony Robbins + Simon Sinek.

Користувач питає: "${question}"

Дай персоналізовану відповідь:
- З позиції "ти вже маєш силу всередині"
- Конкретні мікро-дії, не загальні поради
- До 150 слів
- Підтримуючий тон
- Українською мовою

Формат:
🎯 [короткий інсайт про ситуацію]
💡 [1-2 конкретні дії]
✨ [мотиваційне закриття]`;

    console.log(`[AI MENTOR] Відправляємо запит до OpenAI...`);
    
    const response = await chat([
      { 
        role: 'system', 
        content: 'Ти AI-наставник. Відповідай підтримуюче, конкретно, з позиції сили. Українською мовою.' 
      },
      { role: 'user', content: prompt }
    ], 'gpt-4o-mini', 300);

    console.log(`[AI MENTOR] OpenAI відповідь отримана: ${response.length} символів`);
    
    if (response && response.trim()) {
      try {
        await saveGoal(user['TG_id'], question);
        
        const actionMatches = response.match(/💡\s*([^✨]+)/);
        if (actionMatches) {
          const actions = actionMatches[1].trim();
          await saveMicroAction(user['TG_id'], actions, true);
        }
      } catch (error) {
        console.error('[AI MENTOR] Помилка збереження:', error);
      }

      return `🤖 AI-НАСТАВНИК ВІДПОВІДАЄ:\n\n${response}`;
    } else {
      throw new Error('Порожня відповідь від OpenAI');
    }
    
  } catch (error) {
    console.error('[AI MENTOR] Помилка OpenAI:', error);
    
    const fallbackResponses = [
      "🎯 Твоє питання показує глибину твоїх роздумів\n💡 Почни з одного маленького кроку сьогодні\n✨ Ти вже на правильному шляху до відповіді! 💪",
      "🎯 Розумію твоє прагнення до ясності\n💡 Запиши свої думки на папері та обери одну дію\n✨ Довіряй своїй мудрості - вона в тобі є! 🌟",
      "🎯 Такі питання виникають у сильних людей\n💡 Зроби паузу, подихай глибоко і прислухайся до себе\n✨ Ти знаєш відповідь, просто довіряй процесу! ✨"
    ];
    
    return `🤖 AI-НАСТАВНИК ВІДПОВІДАЄ:\n\n${fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)]}`;
  }
};

const handleAIMentorCallback = async (ctx) => {
  const data = ctx.callbackQuery.data;
  const tgId = ctx.from.id;
  
  try {
    console.log(`📱 [AI MENTOR CALLBACK] ${data} для ${tgId}`);
    
    if (data === 'ai_continue') {
      await userService.updateUserStep(tgId, ANSWER_STEPS.AI_MENTOR_ACTIVE);
      await typing(ctx);
      await ctx.reply('🤖 Задавай наступне питання! Я готовий допомогти 😊');
      await ctx.answerCbQuery('Продовжуємо діалог');
      
    } else if (data === 'ai_exit') {
      aiMentorSession.end(tgId);
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      await typing(ctx);
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