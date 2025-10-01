// src/aiMentor/controllers/aiMentorController.js - З КОНСТАНТАМИ

import userService from '../../services/userService.js';
import keyboards from '../../utils/keyboards.js';
import { aiMentorSession } from '../session.js';
import { chat } from '../../services/openaiClient.js';
import conversationService from '../services/conversationService.js';
import responseService from '../../dialogue/services/responseService.js';
import activityTracker from '../../services/activityTracker.js';
import { 
  CONTEXT_TYPES, 
  AI_MENTOR_PROMPTS,
  COURSE_OFFERS
} from '../../config/constants.js';

// ===== АНАЛІЗ КОНТЕКСТУ ПИТАННЯ =====
const analyzeQuestionContext = (question) => {
  const q = question.toLowerCase();
  
  if (q.includes('ціль') || q.includes('хочу досягти') || q.includes('планую')) {
    return CONTEXT_TYPES.GOAL_SETTING;
  }
  if (q.includes('мотивація') || q.includes('натхнення') || q.includes('сили немає')) {
    return CONTEXT_TYPES.MOTIVATION;
  }
  if (q.includes('що робити') || q.includes('як діяти') || q.includes('кроки')) {
    return CONTEXT_TYPES.MICRO_ACTIONS;
  }
  if (q.includes('баланс') || q.includes('сфери життя') || q.includes('все встигти')) {
    return CONTEXT_TYPES.LIFE_BALANCE;
  }
  if (q.includes('страх') || q.includes('блок') || q.includes('не можу') || q.includes('заважає')) {
    return CONTEXT_TYPES.BLOCK_ANALYSIS;
  }
  
  return CONTEXT_TYPES.GENERAL;
};

// ===== АНАЛІЗ ПОТРЕБИ В КУРСІ =====
const analyzeCourseNeed = (question, conversationHistory = []) => {
  const q = question.toLowerCase();
  
  // Тригери для різних курсів
  const courseTriggers = {
    state_mastery: ['тривога', 'апатія', 'нестабільний стан', 'поганий настрій', 'втомлююсь'],
    low_activity: ['відкладаю', 'не виконую', 'лінь', 'немає дисципліни', 'прокрастинація'],
    no_goals: ['немає цілей', 'не знаю що хочу', 'плутаюсь', 'немає стратегії'],
    fear: ['страх', 'боюсь', 'хаос', 'паніка', 'тривога']
  };
  
  for (const [problemType, triggers] of Object.entries(courseTriggers)) {
    const hasMatchingTriggers = triggers.some(trigger => q.includes(trigger));
    if (hasMatchingTriggers && COURSE_OFFERS[problemType]) {
      const offer = COURSE_OFFERS[problemType];
      return {
        course: offer,
        problemType: problemType,
        reason: `Твоє питання показує, що ${offer.title} може допомогти подолати цю ситуацію.`
      };
    }
  }
  
  return null;
};

// ===== ВИБІР ПРОМПТУ =====
const selectPrompt = (contextType) => {
  const basePrompt = AI_MENTOR_PROMPTS.SYSTEM_PROMPT;
  
  const specificPrompts = {
    [CONTEXT_TYPES.GOAL_SETTING]: `Користувач працює над постановкою цілей. Дай конкретні кроки.`,
    [CONTEXT_TYPES.MOTIVATION]: `Користувач потребує мотивації. Активізуй внутрішню силу.`,
    [CONTEXT_TYPES.MICRO_ACTIONS]: `Генеруй конкретні мікро-дії для досягнення цілі.`,
    [CONTEXT_TYPES.LIFE_BALANCE]: `Допоможи з балансом різних сфер життя.`,
    [CONTEXT_TYPES.BLOCK_ANALYSIS]: `Допоможи проаналізувати та подолати блоки.`
  };
  
  const specificPrompt = specificPrompts[contextType] || '';
  
  return `${basePrompt}\n\n${specificPrompt}`;
};

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

      // Перевіряємо активну сесію
      if (aiMentorSession.isActive(tgId)) {
        console.log(`[AI MENTOR] ✅ Сесія вже активна для ${tgId}`);
        await ctx.reply(
          '🤖 Сесія AI-наставника вже активна!\n\n💬 Напиши своє питання або натисни "Вийти" для завершення.',
          keyboards.aiMentorControlKeyboard()
        );
        return;
      }

      // Запускаємо сесію
      const sessionId = aiMentorSession.start(tgId);
      console.log(`[AI MENTOR] ✅ Сесію запущено для ${tgId}, session: ${sessionId}`);

      // ✅ ЗБІЛЬШУЄМО ЛІЧИЛЬНИК AI ВЗАЄМОДІЙ
      await activityTracker.incrementAIInteractions(tgId);

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

      await ctx.reply(helpText, keyboards.aiMentorControlKeyboard());

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

      if (!aiMentorSession.isActive(tgId)) {
        console.log(`[AI MENTOR] ⚠️ Сесія неактивна для ${tgId} - запускаємо заново`);
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

      await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');

      // ✅ ОТРИМУЄМО КОНТЕКСТ
      const recentData = await responseService.getUserRecords(tgId, 1);
      const todayData = recentData[0]?.fields || {};
      
      const conversationHistory = await conversationService.getAIConversationHistory(tgId, 3);

      const contextType = analyzeQuestionContext(question);
      console.log(`[AI MENTOR] 🔍 Контекст: ${contextType}`);

      const needsMicroActions = this.shouldGenerateMicroActions(question, contextType);

      // ✅ ГЕНЕРУЄМО ВІДПОВІДЬ
      const responseData = await this.generateAIResponse(
        question, 
        user, 
        contextType, 
        tgId, 
        todayData,
        conversationHistory,
        needsMicroActions
      );

      const courseNeed = analyzeCourseNeed(question, conversationHistory);

      // ✅ ЗБЕРІГАЄМО ДІАЛОГ З ПРАВИЛЬНОЮ СТРУКТУРОЮ
      const conversationRecord = await conversationService.saveAIConversation(tgId, {
        userName: user['User Name'],
        question,
        response: responseData.response,
        contextType,
        userGoal: todayData.Q_m_4 || todayData.Q_m_3 || '',
        userState: todayData.Q_m_5 || '',
        userQualities: todayData.Q_m_2 || '',
        generatedActions: responseData.microActions || null,
        courseSuggested: courseNeed?.course?.title || null,
        conversationLength: question.length + responseData.response.length,
        hasMicroActions: !!responseData.microActions,
        sessionId: aiMentorSession.get(tgId)?.sessionId || null
      });

      console.log(`[AI MENTOR] 📊 Діалог збережено, ID: ${conversationRecord?.id || 'none'}`);

      // ✅ ЗБЕРІГАЄМО МІКРО-ДІЇ З ПОСИЛАННЯМ НА ДІАЛОГ
      if (responseData.microActions && Array.isArray(responseData.microActions) && responseData.microActions.length > 0) {
        console.log(`[AI MENTOR] 📝 Підготовка ${responseData.microActions.length} мікро-дій до збереження`);
        
        const savedActions = await activityTracker.saveMicroActions(
          tgId, 
          responseData.microActions, 
          conversationRecord?.id
        );
        
        if (savedActions && savedActions.length > 0) {
          console.log(`[AI MENTOR] ✅ Збережено ${savedActions.length} мікро-дій з посиланням на діалог ${conversationRecord?.id}`);
          
          const actionsText = responseData.microActions
            .map((a, i) => `${i + 1}. ${a.action} (${a.time || 'будь-коли'})`)
            .join('\n');
          
          await ctx.reply(
            `✅ Зафіксовано ${savedActions.length} мікро-дій:\n\n${actionsText}\n\n💡 Відмічай виконані дії командою /progress`,
            { disable_notification: true }
          );
        }
      } else {
        console.log(`[AI MENTOR] ℹ️ Мікро-дії не згенеровано або масив порожній`);
      }

      // Відправляємо основну відповідь
      await ctx.reply(responseData.response, keyboards.aiMentorControlKeyboard());
      
      // Пропозиція курсу (якщо потрібно)
      if (courseNeed && responseData.shouldOfferCourse) {
        await new Promise(r => setTimeout(r, 2000));
        
        const courseMessage = 
          `💡 ПЕРСОНАЛЬНА РЕКОМЕНДАЦІЯ\n\n` +
          `${courseNeed.reason}\n\n` +
          `📚 Курс "${courseNeed.course.title}" — ${courseNeed.course.price}€\n` +
          `${courseNeed.course.description}\n\n` +
          `Або персональна консультація з Надею — 60 хв, 150€`;
        
        await ctx.reply(courseMessage, keyboards.courseOfferKeyboard(
          courseNeed.problemType || 'general',
          courseNeed.course.title,
          courseNeed.course.price
        ));
      }

      console.log(`[AI MENTOR] ✅ Відповідь надіслано для ${tgId}`);

      aiMentorSession.updateActivity(tgId);
      
      // ✅ ІНКРЕМЕНТУЄМО AI ВЗАЄМОДІЇ
      await activityTracker.incrementAIInteractions(tgId);

    } catch (error) {
      console.error('[AI MENTOR] ❌ Помилка питання:', error);
      console.error('[AI MENTOR] Stack:', error.stack);
      await ctx.reply('❌ Помилка при обробці питання. Спробуй ще раз.');
    }
  },

  // ===== ВИЗНАЧЕННЯ ЧИ ПОТРІБНІ МІКРО-ДІЇ =====
  shouldGenerateMicroActions(question, contextType) {
    const q = question.toLowerCase();
    
    const actionKeywords = [
      'що робити', 'як діяти', 'з чого почати', 'план', 'кроки',
      'як досягти', 'допоможи', 'потрібна порада', 'не знаю що',
      'застрягла', 'як подолати', 'дій', 'стратегія'
    ];
    
    const hasActionKeyword = actionKeywords.some(keyword => q.includes(keyword));
    const isActionContext = [
      CONTEXT_TYPES.MICRO_ACTIONS,
      CONTEXT_TYPES.GOAL_SETTING,
      CONTEXT_TYPES.BLOCK_ANALYSIS
    ].includes(contextType);
    
    return hasActionKeyword || isActionContext;
  },

  // ===== ГЕНЕРАЦІЯ AI ВІДПОВІДІ =====
  async generateAIResponse(question, user, contextType, tgId, todayData, conversationHistory, needsMicroActions) {
    try {
      const userName = user['User Name'] || 'Користувач';
      const systemPrompt = selectPrompt(contextType);
      
      let userPrompt = `Користувач: ${userName}\nПитання: "${question}"\n\n`;
      
      if (todayData.Q_m_4) {
        userPrompt += `🎯 Головна ціль на сьогодні: "${todayData.Q_m_4}"\n`;
      }
      if (todayData.Q_m_3) {
        userPrompt += `🎯 Мікро-цілі: "${todayData.Q_m_3}"\n`;
      }
      if (todayData.Q_m_5) {
        userPrompt += `💭 Поточний стан: "${todayData.Q_m_5}"\n`;
      }
      if (todayData.Q_m_2) {
        userPrompt += `💪 Сильні якості: "${todayData.Q_m_2}"\n`;
      }
      if (todayData.Q_m_1) {
        userPrompt += `✨ Самоідентифікація: "${todayData.Q_m_1}"\n`;
      }
      
      if (conversationHistory.length > 0) {
        userPrompt += `\n📚 Контекст попередніх діалогів:\n`;
        conversationHistory.forEach((conv, i) => {
          userPrompt += `${i+1}. Q: "${conv.question.substring(0, 80)}..."\n`;
          userPrompt += `   A: "${conv.response.substring(0, 100)}..."\n`;
        });
      }
      
      if (needsMicroActions) {
        userPrompt += `\n\n🎯 ВАЖЛИВО: Після відповіді створи 2-3 КОНКРЕТНІ МІКРО-ДІЇ у форматі JSON:\n`;
        userPrompt += `{"microActions": [{"action": "конкретна дія", "time": "HH:MM-HH:MM", "duration_min": 15, "result_metric": "результат", "priority": "висока"}]}\n`;
      }
      
      userPrompt += `\n\nДай персоналізовану відповідь з конкретними діями в стилі "Очі в очі".`;

      console.log(`[AI MENTOR] 🔄 Відправляємо запит до OpenAI`);
      console.log(`[AI MENTOR] 📊 Контекст: цілі=${!!todayData.Q_m_4}, стан=${!!todayData.Q_m_5}, історія=${conversationHistory.length}`);
      
      const response = await chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], 'gpt-4o-mini', needsMicroActions ? 600 : 400);

      if (!response?.trim()) {
        throw new Error('Порожня відповідь від OpenAI');
      }

      let microActions = null;
      let cleanResponse = response;
      
      if (needsMicroActions) {
        const jsonMatch = response.match(/\{[\s\S]*"microActions"[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.microActions && Array.isArray(parsed.microActions)) {
              microActions = parsed.microActions;
              cleanResponse = response.replace(jsonMatch[0], '').trim();
              console.log(`[AI MENTOR] ✅ Виділено ${microActions.length} мікро-дій`);
            }
          } catch (parseError) {
            console.error('[AI MENTOR] ⚠️ Помилка парсингу мікро-дій:', parseError);
          }
        }
      }

      const shouldOfferCourse = conversationHistory.length >= 2 && 
                               contextType !== CONTEXT_TYPES.GENERAL;

      return {
        response: `🤖 AI-НАСТАВНИК ВІДПОВІДАЄ:\n\n${cleanResponse}`,
        microActions,
        shouldOfferCourse
      };

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

      return {
        response: `🤖 AI-НАСТАВНИК ВІДПОВІДАЄ:\n\n${contextFallbacks[contextType] || contextFallbacks[CONTEXT_TYPES.GENERAL]}`,
        microActions: null,
        shouldOfferCourse: false
      };
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
          if (!aiMentorSession.isActive(tgId)) {
            aiMentorSession.start(tgId);
            console.log(`[AI MENTOR] ✅ Сесію перезапущено для ${tgId}`);
          }
          
          await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
          
          await ctx.reply(
            '💬 Напиши своє питання, і я дам персональну пораду в стилі "Очі в очі"!',
            { 
              reply_markup: { remove_keyboard: true }
            }
          );
          await ctx.answerCbQuery('Продовжуємо діалог');
          break;
          
        case 'ai_exit':
          await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
          
          aiMentorSession.end(tgId);
          await ctx.reply(
            '👋 Дякую за спілкування! Пам\'ятай: дія - це мова проти страху.\n\nПовертаємося до меню.',
            keyboards.mainMenuKeyboard()
          );
          await ctx.answerCbQuery('Вихід з AI-наставника');
          console.log(`[AI MENTOR] 🚪 Користувач ${tgId} вийшов`);
          break;
          
        case 'ai_report':
          const report = await conversationService.generateAIConversationReport(tgId, 7);
          await ctx.reply(report, keyboards.aiMentorControlKeyboard());
          await ctx.answerCbQuery('Звіт згенеровано');
          break;
          
        case 'ai_goals':
          await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
          
          await ctx.reply(
            '🎯 РЕЖИМ РОБОТИ З ЦІЛЯМИ\n\n' +
            'Розкажи про свою ціль, і я допоможу:\n' +
            '• Сформулювати її чітко\n' +
            '• Розбити на кроки\n' +
            '• Створити план дій\n' +
            '• Подолати блоки\n\n' +
            'Опиши свою ціль 👇',
            { reply_markup: { remove_keyboard: true } }
          );
          await ctx.answerCbQuery('Режим цілей активовано');
          break;
          
        case 'rate_helpful':
        case 'rate_not_helpful':
          const rating = data === 'rate_helpful' ? 'helpful' : 'not_helpful';
          
          const lastConversation = await conversationService.getAIConversationHistory(tgId, 1);
          if (lastConversation.length > 0) {
            await conversationService.updateResponseRating(lastConversation[0].id, rating);
          }
          
          await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
          
          const thankYouMessage = rating === 'helpful' 
            ? '👍 Дякую за відгук! Рада, що було корисно.'
            : '👎 Дякую за чесність. Спробую краще розуміти твої потреби.';
          
          await ctx.reply(thankYouMessage, { reply_markup: { remove_keyboard: true } });
          await ctx.answerCbQuery('Відгук збережено');
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
  }
};

export default aiMentorController;