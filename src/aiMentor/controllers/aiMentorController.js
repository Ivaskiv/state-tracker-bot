// src/aiMentor/controllers/aiMentorController.js - ОНОВЛЕНО ЗА НОВИМ ТЗ

import userService from '../../auth/services/userService.js';
import keyboards from '../../utils/keyboards.js';
import { aiMentorSession } from '../session.js';
import { chat } from '../../services/openaiClient.js';
import conversationService from '../services/conversationService.js';
import { CONTEXT_TYPES, analyzeQuestionContext, selectPrompt } from '../../config/aiMentorPrompts.js';

const handleAIMentorRequest = async (ctx) => {
  const tgId = String(ctx.from.id);
  
  try {
    console.log(`🤖 [AI MENTOR] Запит від ${tgId}`);

    const user = await userService.getUserByTelegramId(tgId);
    if (!user) {
      console.log(`❌ [AI MENTOR] Користувач ${tgId} не знайдений`);
      return ctx.reply('Спочатку зареєструйся /start', keyboards.mainMenuKeyboard());
    }

    // Перевіряємо підписку
    const hasAccess = userService.hasActiveAccess(user);
                     
    if (!hasAccess) {
      console.log(`❌ [AI MENTOR] Підписка неактивна для ${tgId}`);
      return ctx.reply(
        '🤖 AI-наставник доступний з активною підпискою.\n\n💰 Активуй підписку для персональної підтримки.',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💰 Переглянути плани', callback_data: 'subscription_plans' }],
              [{ text: '🏠 До меню', callback_data: 'main_menu' }]
            ]
          }
        }
      );
    }

    // Запускаємо сесію
    aiMentorSession.start(tgId);
    console.log(`🤖 [AI MENTOR] Сесія запущена для ${tgId}`);

    const helpText = 
      `🤖 AI-НАСТАВНИК "ЕФЕКТ"\n\n` +
      `Привіт! Я твій персональний AI-коуч у стилі "Очі в очі" 💪\n\n` +
      `Готовий допомогти з:\n\n` +
      `🎯 Постановкою та досягненням цілей\n` +
      `⚡ Подоланням блоків та страхів\n` +
      `💡 Мотивацією та фокусом\n` +
      `📈 Створенням стратегій дій\n\n` +
      `Напиши своє питання! 👇\n\n` +
      `💬 Я відповідаю конкретно, з мікро-діями та підтримкою.`;

    await ctx.reply(helpText, keyboards.aiMentorStartKeyboard());

  } catch (error) {
    console.error('❌ [AI MENTOR] Помилка запиту:', error);
    await ctx.reply('❌ Помилка AI-наставника. Спробуй пізніше.', keyboards.mainMenuKeyboard());
  }
};

const handleAIMentorQuestion = async (ctx, question) => {
  const tgId = String(ctx.from.id);
  
  try {
    console.log(`🤖 [AI MENTOR] Питання від ${tgId}: "${question.substring(0, 50)}..."`);

    // Перевіряємо чи активна сесія
    if (!aiMentorSession.isActive(tgId)) {
      console.log(`❌ [AI MENTOR] Сесія неактивна для ${tgId}`);
      return ctx.reply('Сесія неактивна. Запусти AI-наставника заново.', keyboards.mainMenuKeyboard());
    }

    const user = await userService.getUserByTelegramId(tgId);
    if (!user || !userService.hasActiveAccess(user)) {
      aiMentorSession.end(tgId);
      return ctx.reply('🤖 Потрібна активна підписка', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💰 Переглянути плани', callback_data: 'subscription_plans' }]
          ]
        }
      });
    }

    // Показуємо що бот думає
    await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');

    // Аналізуємо контекст питання
    const contextType = analyzeQuestionContext(question);
    console.log(`🔍 [AI MENTOR] Контекст: ${contextType}`);

    // Генеруємо відповідь AI
    const responseText = await generateAIResponse(question, user, contextType, tgId);
    
    // Зберігаємо діалог
    const context = {
      contextType,
      userGoal: user.daily_main_goal || '',
      userState: user.daily_state || 'unknown'
    };
    
    await conversationService.saveAIConversation(tgId, question, responseText, context);
    
    await ctx.reply(responseText, keyboards.aiMentorControlKeyboard());
    console.log(`✅ [AI MENTOR] Відповідь надіслано для ${tgId}`);

  } catch (error) {
    console.error('❌ [AI MENTOR] Помилка питання:', error);
    await ctx.reply('❌ Помилка при обробці питання. Спробуй ще раз.');
  }
};

const generateAIResponse = async (question, user, contextType, tgId) => {
  try {
    // Отримуємо історію діалогів для контексту
    const conversationHistory = await conversationService.getAIConversationHistory(tgId, 3);
    
    // Отримуємо дані користувача для персоналізації
    const userName = user['User Name'] || 'Користувач';
    
    // Формуємо системний промпт
    const systemPrompt = selectPrompt(contextType);
    
    // Формуємо користувацький промпт з контекстом
    let userPrompt = `Користувач: ${userName}\nПитання: "${question}"`;
    
    // Додаємо контекст з попередніх діалогів
    if (conversationHistory.length > 0) {
      userPrompt += `\n\nКонтекст попередніх діалогів:\n`;
      conversationHistory.forEach((conv, i) => {
        userPrompt += `${i+1}. Питання: "${conv.question}"\n   Відповідь: "${conv.response.substring(0, 200)}..."\n`;
      });
    }
    
    userPrompt += `\n\nДай персоналізовану відповідь з конкретними діями в стилі "Очі в очі".`;

    console.log(`[AI MENTOR] Відправляємо запит до OpenAI`);
    
    const response = await chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], 'gpt-4o-mini', 400);

    if (!response?.trim()) {
      throw new Error('Порожня відповідь від OpenAI');
    }

    return `🤖 AI-НАСТАВНИК ВІДПОВІДАЄ:\n\n${response}`;

  } catch (error) {
    console.error('[AI MENTOR] Помилка OpenAI:', error);

    // Fallback відповіді залежно від контексту
    const contextFallbacks = {
      [CONTEXT_TYPES.GOAL_SETTING]: '🎯 Твоє бажання ставити цілі показує силу.\n💡 Почни з однієї конкретної мети на тиждень.\n✨ Ти вже знаєш що робити - довіряй собі! ✨',
      [CONTEXT_TYPES.MOTIVATION]: '💪 Твоя енергія всередині тебе!\n💡 Зроби 5-хвилинну прогулянку і подумай над одним кроком.\n✨ Ти сильніший, ніж думаєш! 🌟',
      [CONTEXT_TYPES.MICRO_ACTIONS]: '🎯 Маленькі кроки ведуть до великих результатів.\n💡 Обери одну дію на 15 хвилин і зроби її зараз.\n✨ Дія створює впевненість! 💪',
      [CONTEXT_TYPES.LIFE_BALANCE]: '⚖️ Баланс - це вибір пріоритетів.\n💡 Визнач одну сферу для фокусу на цьому тижні.\n✨ Ти маєш силу змінювати! 🌟',
      [CONTEXT_TYPES.BLOCK_ANALYSIS]: '🔍 Розпізнавання блоку - це вже половина перемоги.\n💡 Зроби один маленький крок всупереч страху.\n✨ Твоя сміливість зростає з кожною дією! ⚡',
      [CONTEXT_TYPES.GENERAL]: '🎯 Твоє питання показує силу духу.\n💡 Почни з одного маленького кроку вперед.\n✨ Ти знаєш відповідь, довіряй собі! ✨'
    };

    return `🤖 AI-НАСТАВНИК ВІДПОВІДАЄ:\n\n${contextFallbacks[contextType] || contextFallbacks[CONTEXT_TYPES.GENERAL]}`;
  }
};

const handleAIMentorCallback = async (ctx) => {
  const tgId = String(ctx.from.id);
  const data = ctx.callbackQuery.data;

  try {
    console.log(`📱 [AI MENTOR] Callback: ${data} від ${tgId}`);

    if (data === 'ai_continue' || data === 'ai_start_question') {
      await ctx.reply('💬 Напиши своє питання, і я дам персональну пораду в стилі "Очі в очі"!', keyboards.aiMentorControlKeyboard());
      await ctx.answerCbQuery('Продовжуємо діалог');

    } else if (data === 'ai_exit') {
      aiMentorSession.end(tgId);
      await ctx.reply('👋 Дякую за спілкування! Пам\'ятай: дія - це мова проти страху.\n\nПовертаємося до меню.', keyboards.mainMenuKeyboard());
      await ctx.answerCbQuery('Вихід з AI-наставника');
      console.log(`🚪 [AI MENTOR] Користувач ${tgId} вийшов`);
      
    } else if (data === 'ai_report') {
      // Генеруємо звіт діалогів
      const report = await conversationService.generateAIConversationReport(tgId, 7);
      await ctx.reply(report, keyboards.aiMentorControlKeyboard());
      await ctx.answerCbQuery('Звіт згенеровано');
      
    } else if (data === 'ai_goals') {
      // Спеціальний режим для роботи з цілями
      await ctx.reply(
        '🎯 РЕЖИМ РОБОТИ З ЦІЛЯМИ\n\n' +
        'Розкажи про свою ціль, і я допоможу:\n' +
        '• Сформулювати її чітко\n' +
        '• Розбити на кроки\n' +
        '• Створити план дій\n' +
        '• Подолати блоки\n\n' +
        'Опиши свою ціль 👇',
        keyboards.aiMentorControlKeyboard()
      );
      await ctx.answerCbQuery('Режим цілей активовано');
      
    } else {
      console.log(`❓ [AI MENTOR] Невідомий callback: ${data}`);
      await ctx.answerCbQuery('Команда не розпізнана');
    }

  } catch (error) {
    console.error('[AI MENTOR] Помилка callback:', error);
    await ctx.reply('❌ Помилка. Спробуй ще раз.', keyboards.mainMenuKeyboard());
    await ctx.answerCbQuery('Помилка');
  }
};

export default {
  handleAIMentorRequest,
  handleAIMentorQuestion,
  handleAIMentorCallback
};