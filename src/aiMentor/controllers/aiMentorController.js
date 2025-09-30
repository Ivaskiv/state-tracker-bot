// src/aiMentor/controllers/aiMentorController.js - ДОДАНО ЛОГУВАННЯ

import userService from '../../services/userService.js';
import keyboards from '../../utils/keyboards.js';
import { aiMentorSession } from '../session.js';
import { chat } from '../../services/openaiClient.js';
import conversationService from '../services/conversationService.js';
import { CONTEXT_TYPES, analyzeQuestionContext, selectPrompt } from '../../config/aiMentorPrompts.js';

const aiMentorController = {

  // ===== ЗАПУСК AI НАСТАВНИКА =====
  async handleAIMentorRequest(ctx) {
    const tgId = String(ctx.from.id);
    
    try {
      console.log(`[AI MENTOR] 🤖 Запит від ${tgId}`);

      const user = await userService.getUserByTgId(tgId);
      if (!user) {
        console.log(`[AI MENTOR] ❌ Користувач ${tgId} не знайдений`);
        await ctx.reply('Спочатку зареєструйся /start', keyboards.mainMenuKeyboard());
        return;
      }

      const hasAccess = userService.hasActiveAccess(user);
                       
      if (!hasAccess) {
        console.log(`[AI MENTOR] ❌ Підписка неактивна для ${tgId}`);
        await ctx.reply(
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
        return;
      }

      // Запускаємо сесію
      aiMentorSession.start(tgId);
      console.log(`[AI MENTOR] ✅ Сесія запущена для ${tgId}`);

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
      console.error('[AI MENTOR] ❌ Помилка запиту:', error);
      await ctx.reply('❌ Помилка AI-наставника. Спробуй пізніше.', keyboards.mainMenuKeyboard());
    }
  },

  // ===== ОБРОБКА ПИТАННЯ =====
  async handleAIMentorQuestion(ctx, question) {
    const tgId = String(ctx.from.id);
    
    try {
      console.log(`[AI MENTOR] 💬 Питання від ${tgId}: "${question.substring(0, 50)}..."`);

      // ✅ ДОДАНО: Перевірка активності сесії
      if (!aiMentorSession.isActive(tgId)) {
        console.log(`[AI MENTOR] ❌ Сесія неактивна для ${tgId} - запускаємо заново`);
        aiMentorSession.start(tgId);
      }

      const user = await userService.getUserByTgId(tgId);
      if (!user || !userService.hasActiveAccess(user)) {
        aiMentorSession.end(tgId);
        await ctx.reply('🤖 Потрібна активна підписка', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💰 Переглянути плани', callback_data: 'subscription_plans' }]
            ]
          }
        });
        return;
      }

      // Показуємо що бот думає
      await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');

      // Аналізуємо контекст питання
      const contextType = analyzeQuestionContext(question);
      console.log(`[AI MENTOR] 🔍 Контекст: ${contextType}`);

      // Генеруємо відповідь AI
      const responseText = await this.generateAIResponse(question, user, contextType, tgId);
      const recentData = await responseService.getUserRecords(tgId, 1);
const todayData = recentData[0]?.fields || {};

      // Зберігаємо діалог
      const context = {
        contextType,
  userGoal: todayData.Q_m_4 || todayData.Q_m_3 || '', 
  userState: todayData.Q_m_5 || 'unknown'     
};
      
      await conversationService.saveAIConversation(tgId, question, responseText, context);
      
      await ctx.reply(responseText, keyboards.aiMentorControlKeyboard());
      console.log(`[AI MENTOR] ✅ Відповідь надіслано для ${tgId}`);

    } catch (error) {
      console.error('[AI MENTOR] ❌ Помилка питання:', error);
      await ctx.reply('❌ Помилка при обробці питання. Спробуй ще раз.');
    }
  },

  // ===== ОБРОБКА CALLBACK =====
  async handleAIMentorCallback(ctx) {
    const tgId = String(ctx.from.id);
    const data = ctx.callbackQuery.data;

    try {
      console.log(`[AI MENTOR] 📱 Callback: ${data} від ${tgId}`);

      switch (data) {
        case 'ai_continue':
        case 'ai_start_question':
          // ✅ ВИПРАВЛЕНО: Перевіряємо/запускаємо сесію
          if (!aiMentorSession.isActive(tgId)) {
            aiMentorSession.start(tgId);
            console.log(`[AI MENTOR] ✅ Сесію перезапущено для ${tgId}`);
          }
          await ctx.reply('💬 Напиши своє питання, і я дам персональну пораду в стилі "Очі в очі"!', keyboards.aiMentorControlKeyboard());
          await ctx.answerCbQuery('Продовжуємо діалог');
          break;
          
        case 'ai_exit':
          aiMentorSession.end(tgId);
          await ctx.reply('👋 Дякую за спілкування! Пам\'ятай: дія - це мова проти страху.\n\nПовертаємося до меню.', keyboards.mainMenuKeyboard());
          await ctx.answerCbQuery('Вихід з AI-наставника');
          console.log(`[AI MENTOR] 🚪 Користувач ${tgId} вийшов`);
          break;
          
        case 'ai_report':
          const report = await conversationService.generateAIConversationReport(tgId, 7);
          await ctx.reply(report, keyboards.aiMentorControlKeyboard());
          await ctx.answerCbQuery('Звіт згенеровано');
          break;
          
        case 'ai_goals':
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
          break;
          
        default:
          console.log(`[AI MENTOR] ❓ Невідомий callback: ${data}`);
          await ctx.answerCbQuery('Команда не розпізнана');
      }

    } catch (error) {
      console.error('[AI MENTOR] ❌ Помилка callback:', error);
      await ctx.reply('❌ Помилка. Спробуй ще раз.', keyboards.mainMenuKeyboard());
      await ctx.answerCbQuery('Помилка');
    }
  },

  // ===== ГЕНЕРАЦІЯ AI ВІДПОВІДІ =====
  async generateAIResponse(question, user, contextType, tgId) {
    try {
      const conversationHistory = await conversationService.getAIConversationHistory(tgId, 3);
      const userName = user['User Name'] || 'Користувач';
      const systemPrompt = selectPrompt(contextType);
      
      let userPrompt = `Користувач: ${userName}\nПитання: "${question}"`;
      
      if (conversationHistory.length > 0) {
        userPrompt += `\n\nКонтекст попередніх діалогів:\n`;
        conversationHistory.forEach((conv, i) => {
          userPrompt += `${i+1}. Питання: "${conv.question}"\n   Відповідь: "${conv.response.substring(0, 200)}..."\n`;
        });
      }
      
      userPrompt += `\n\nДай персоналізовану відповідь з конкретними діями в стилі "Очі в очі".`;

      console.log(`[AI MENTOR] 🔄 Відправляємо запит до OpenAI`);
      
      const response = await chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], 'gpt-4o-mini', 400);

      if (!response?.trim()) {
        throw new Error('Порожня відповідь від OpenAI');
      }

      return `🤖 AI-НАСТАВНИК ВІДПОВІДАЄ:\n\n${response}`;

    } catch (error) {
      console.error('[AI MENTOR] ❌ Помилка OpenAI:', error);

      const contextFallbacks = {
        [CONTEXT_TYPES.GOAL_SETTING]: '🎯 Твоє бажання ставити цілі показує силу.\n💡 Почни з однієї конкретної мети на тиждень.\n✨ Ти вже знаєш що робити - довіряй собі!',
        [CONTEXT_TYPES.MOTIVATION]: '💪 Твоя енергія всередині тебе!\n💡 Зроби 5-хвилинну прогулянку і подумай над одним кроком.\n✨ Ти сильніший, ніж думаєш!',
        [CONTEXT_TYPES.MICRO_ACTIONS]: '🎯 Маленькі кроки ведуть до великих результатів.\n💡 Обери одну дію на 15 хвилин і зроби її зараз.\n✨ Дія створює впевненість!',
        [CONTEXT_TYPES.LIFE_BALANCE]: '⚖️ Баланс - це вибір пріоритетів.\n💡 Визнач одну сферу для фокусу на цьому тижні.\n✨ Ти маєш силу змінювати!',
        [CONTEXT_TYPES.BLOCK_ANALYSIS]: '🔍 Розпізнавання блоку - це вже половина перемоги.\n💡 Зроби один маленький крок всупереч страху.\n✨ Твоя сміливість зростає з кожною дією!',
        [CONTEXT_TYPES.GENERAL]: '🎯 Твоє питання показує силу духу.\n💡 Почни з одного маленького кроку вперед.\n✨ Ти знаєш відповідь, довіряй собі!'
      };

      return `🤖 AI-НАСТАВНИК ВІДПОВІДАЄ:\n\n${contextFallbacks[contextType] || contextFallbacks[CONTEXT_TYPES.GENERAL]}`;
    }
  }
};

export default aiMentorController;