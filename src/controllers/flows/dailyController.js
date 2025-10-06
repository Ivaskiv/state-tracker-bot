// src/controllers/flows/dailyController.js

import userService from '../../services/userService.js';
import responseService from '../../services/responseService.js';
import { chat } from '../../services/openaiClient.js';
import keyboards from '../../utils/keyboards.js';
import { QUESTIONS, MORNING_AFFIRMATIONS, EVENING_AFFIRMATIONS, ANSWER_STEPS, CURRENT_ACTIVITY } from '../../config/constants.js';

// ===== УТИЛІТИ =====
const getNextStep = (currentStep) => {
  const steps = ['Q_m_1', 'Q_m_2', 'Q_m_3', 'Q_m_4', 'Q_m_5', 'Q_m_6'];
  const index = steps.indexOf(currentStep);
  return index < steps.length - 1 ? steps[index + 1] : ANSWER_STEPS.COMPLETED;
};

const getEveningNextStep = (currentStep) => {
  const steps = ['Q_e_1', 'Q_e_2', 'Q_e_3', 'Q_e_4', 'Q_e_5'];
  const index = steps.indexOf(currentStep);
  return index < steps.length - 1 ? steps[index + 1] : ANSWER_STEPS.COMPLETED;
};

const getQuestion = (step) => {
  if (step.startsWith('Q_m_')) {
    const index = parseInt(step.split('_')[2]) - 1;
    return QUESTIONS.morning[index] || { text: 'Завершено!' };
  }
  if (step.startsWith('Q_e_')) {
    const index = parseInt(step.split('_')[2]) - 1;
    return QUESTIONS.evening[index] || { text: 'Завершено!' };
  }
  return null;
};

const dailyController = {
  // ===== ОБРОБКА ТЕКСТУ (ВІДПОВІДІ НА ПИТАННЯ) =====
  async handleText(ctx, text, userStep) {
    const tgId = ctx.from.id;
    console.log(`[DAILY] 💬 Відповідь "${text.substring(0, 50)}..." для step "${userStep}" від ${tgId}`);

    try {
      if (userStep?.startsWith('Q_m_')) {
        await this.handleMorningAnswer(ctx, text, userStep);
      } else if (userStep?.startsWith('Q_e_')) {
        await this.handleEveningAnswer(ctx, text, userStep);
      } else {
        console.log(`[DAILY] ⚠️ Невідомий step для daily: ${userStep}`);
        await ctx.reply('❌ Невідомий тип питання. Почни сесію заново.');
        return false;
      }
      return true;
    } catch (error) {
      console.error('[DAILY] ❌ Помилка обробки тексту:', error);
      console.error('[DAILY] Stack:', error.stack);
      await ctx.reply('❌ Помилка збереження. Спробуй ще раз.', keyboards.mainMenuKeyboard());
      return true;
    }
  },

  // ===== ОБРОБКА CALLBACK (СТАРТ/ВИХІД) =====
  async handleCallback(ctx, data) {
    const tgId = ctx.from.id;
    console.log(`[DAILY] 📱 Callback "${data}" від ${tgId}`);

    try {
      switch (data) {
        case 'start_morning':
          await this.startMorningSession(ctx);
          break;
        case 'start_evening':
          await this.startEveningSession(ctx);
          break;
        case 'exit_morning':
        case 'exit_evening':
          await this.exitSession(ctx, data.includes('morning') ? 'morning' : 'evening');
          break;
        case 'later_morning':
          await ctx.reply('🌞 Добре! Ранкові питання чекатимуть.');
          await ctx.answerCbQuery('Відкладено');
          break;
        case 'later_evening':
          await ctx.reply('🌙 Добре! Вечірні питання чекатимуть.');
          await ctx.answerCbQuery('Відкладено');
          break;
        default:
          console.log(`[DAILY] ❓ Невідомий callback: ${data}`);
          await ctx.answerCbQuery('Команда не розпізнана');
          return false;
      }
      return true;
    } catch (error) {
      console.error('[DAILY] ❌ Помилка callback:', error);
      console.error('[DAILY] Stack:', error.stack);
      await ctx.answerCbQuery('Помилка');
      return true;
    }
  },

  // ===== СТАРТ РАНКОВОЇ СЕСІЇ =====
  async startMorningSession(ctx) {
    const tgId = ctx.from.id;

    try {
      console.log(`[DAILY] 🌞 Start morning для ${tgId}`);

      const user = await userService.getUserByTgId(tgId);
      if (!user || !userService.hasActiveAccess(user)) {
        await ctx.reply('🔒 Потрібна активна підписка.', keyboards.subscriptionMenuInline());
        return;
      }

      const completed = await responseService.isSessionCompleted(tgId, 'morning');
      if (completed) {
        await ctx.reply('🌞 Вже завершила ранкову рефлексію!', keyboards.mainMenuKeyboard());
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const { getBase, tables } = await import('../../config/database.js');
      const base = getBase();
      
      await base(tables.RESPONSES).create({
        'TG_id': String(tgId),
        'Date_Response': today,
        'User Name': user['User Name'] || 'Користувач'
      });

      await userService.updateUserFields(tgId, { Answer_Step: 'Q_m_1' });
      console.log(`[DAILY] ✅ Responses створено, Step = Q_m_1`);

      await this.askMorningQuestion(ctx, 1);
      
    } catch (error) {
      console.error('[DAILY] ❌ Start morning fail:', error);
      await ctx.reply('❌ Помилка запуску.', keyboards.mainMenuKeyboard());
    }
  },

  // ===== СТАРТ ВЕЧІРНЬОЇ СЕСІЇ =====
  async startEveningSession(ctx) {
    const tgId = ctx.from.id;

    try {
      console.log(`[DAILY] 🌙 Start evening для ${tgId}`);

      const user = await userService.getUserByTgId(tgId);
      if (!user || !userService.hasActiveAccess(user)) {
        await ctx.reply('🔒 Потрібна активна підписка.', keyboards.subscriptionMenuInline());
        return;
      }

      const completed = await responseService.isSessionCompleted(tgId, 'evening');
      if (completed) {
        await ctx.reply('🌙 Вже завершила вечірню рефлексію!', keyboards.mainMenuKeyboard());
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const { getBase, tables } = await import('../../config/database.js');
      const base = getBase();
      
      const records = await base(tables.RESPONSES)
        .select({
          filterByFormula: `AND({TG_id}="${String(tgId)}", DATESTR({Date_Response})="${today}")`,
          maxRecords: 1
        })
        .firstPage();
      
      if (records.length === 0) {
        await base(tables.RESPONSES).create({
          'TG_id': String(tgId),
          'Date_Response': today,
          'User Name': user['User Name'] || 'Користувач'
        });
      }

      await userService.updateUserFields(tgId, { Answer_Step: 'Q_e_1' });
      console.log(`[DAILY] ✅ Step = Q_e_1`);

      await this.askEveningQuestion(ctx, 1);
      
    } catch (error) {
      console.error('[DAILY] ❌ Start evening fail:', error);
      await ctx.reply('❌ Помилка запуску.', keyboards.mainMenuKeyboard());
    }
  },

  // ===== РАНКОВІ ПИТАННЯ =====
  async askMorningQuestion(ctx, questionNumber) {
    const tgId = ctx.from.id;
    console.log(`[DAILY] 🌞 Ask morning Q${questionNumber} для ${tgId}`);

    try {
      const q = QUESTIONS.morning[questionNumber - 1];
      if (!q) {
        console.error(`[DAILY] ❌ Q${questionNumber} not found`);
        await ctx.reply('❌ Помилка завантаження питання.', keyboards.mainMenuKeyboard());
        return;
      }

      await userService.updateUserStep(tgId, `Q_m_${questionNumber}`);
      console.log(`[DAILY] ✅ Step updated to Q_m_${questionNumber}`);

      const message = `🌞 РАНКОВА РЕФЛЕКСІЯ\n\n${questionNumber}/6\n\n${q.text}${q.hint ? `\n\n💡 ${q.hint}` : ''}`;

      await ctx.reply(message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚪 Вийти із сесії', callback_data: 'exit_morning' }]
          ]
        }
      });
      console.log(`[DAILY] ✅ Morning Q${questionNumber} sent`);
    } catch (error) {
      console.error('[DAILY] ❌ Ask morning fail:', error);
      console.error('[DAILY] Stack:', error.stack);
      await ctx.reply('❌ Помилка питання. Спробуй заново.', keyboards.mainMenuKeyboard());
    }
  },

  // ===== ВЕЧІРНІ ПИТАННЯ =====
  async askEveningQuestion(ctx, questionNumber) {
    const tgId = ctx.from.id;
    console.log(`[DAILY] 🌙 Ask evening Q${questionNumber} для ${tgId}`);

    try {
      const q = QUESTIONS.evening[questionNumber - 1];
      if (!q) {
        console.error(`[DAILY] ❌ Q${questionNumber} not found`);
        await ctx.reply('❌ Помилка завантаження питання.', keyboards.mainMenuKeyboard());
        return;
      }

      await userService.updateUserStep(tgId, `Q_e_${questionNumber}`);
      console.log(`[DAILY] ✅ Step updated to Q_e_${questionNumber}`);

      const message = `🌙 ВЕЧІРНЯ РЕФЛЕКСІЯ\n\n${questionNumber}/5\n\n${q.text}${q.hint ? `\n\n💡 ${q.hint}` : ''}`;

      await ctx.reply(message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚪 Вийти із сесії', callback_data: 'exit_evening' }]
          ]
        }
      });
      console.log(`[DAILY] ✅ Evening Q${questionNumber} sent`);
    } catch (error) {
      console.error('[DAILY] ❌ Ask evening fail:', error);
      console.error('[DAILY] Stack:', error.stack);
      await ctx.reply('❌ Помилка питання. Спробуй заново.', keyboards.mainMenuKeyboard());
    }
  },

  // ===== ОБРОБКА РАНКОВИХ ВІДПОВІДЕЙ =====
  async handleMorningAnswer(ctx, text, userStep) {
    const tgId = ctx.from.id;
    const questionNumber = parseInt(userStep.split('_')[2], 10);

    try {
      console.log(`[DAILY] 🌞 Handle morning answer Q${questionNumber}: "${text.substring(0, 50)}..."`);

      await responseService.saveMorningAnswer(tgId, questionNumber, text);
      console.log(`[DAILY] ✅ Saved Q_m_${questionNumber}`);

      const nextStep = getNextStep(userStep);
      await userService.updateUserStep(tgId, nextStep);
      console.log(`[DAILY] 🔄 Updated to "${nextStep}"`);

      if (nextStep === ANSWER_STEPS.COMPLETED) {
        await this.completeMorningSession(ctx);
      } else {
        await this.askMorningQuestion(ctx, questionNumber + 1);
      }
    } catch (error) {
      console.error('[DAILY] ❌ Morning answer fail:', error);
      console.error('[DAILY] Stack:', error.stack);
      await ctx.reply('❌ Помилка збереження. Спробуй ще раз.', keyboards.mainMenuKeyboard());
    }
  },

  // ===== ОБРОБКА ВЕЧІРНІХ ВІДПОВІДЕЙ =====
  async handleEveningAnswer(ctx, text, userStep) {
    const tgId = ctx.from.id;
    const questionNumber = parseInt(userStep.split('_')[2], 10);

    try {
      console.log(`[DAILY] 🌙 Handle evening answer Q${questionNumber}: "${text.substring(0, 50)}..."`);

      await responseService.saveEveningAnswer(tgId, questionNumber, text);
      console.log(`[DAILY] ✅ Saved Q_e_${questionNumber}`);

      const nextStep = getEveningNextStep(userStep);
      await userService.updateUserStep(tgId, nextStep);
      console.log(`[DAILY] 🔄 Updated to "${nextStep}"`);

      if (nextStep === ANSWER_STEPS.COMPLETED) {
        await this.completeEveningSession(ctx);
      } else {
        await this.askEveningQuestion(ctx, questionNumber + 1);
      }
    } catch (error) {
      console.error('[DAILY] ❌ Evening answer fail:', error);
      console.error('[DAILY] Stack:', error.stack);
      await ctx.reply('❌ Помилка збереження. Спробуй ще раз.', keyboards.mainMenuKeyboard());
    }
  },

  // ===== ✅ ЗАВЕРШЕННЯ РАНКОВОЇ (ВИПРАВЛЕНО) =====
  async completeMorningSession(ctx) {
    const tgId = ctx.from.id;
    const userName = ctx.from.first_name || 'Користувач';

    try {
      console.log(`[DAILY] 🌞 Complete morning для ${tgId}`);

      // Афірмація + Фіналізація
      const affirmation = MORNING_AFFIRMATIONS[Math.floor(Math.random() * MORNING_AFFIRMATIONS.length)];
      await responseService.saveAffirmationAndFinalize(tgId, 'morning', affirmation);
      console.log(`[DAILY] ✅ Morning session completed & finalized`);

      // Мікро-дії (AI)
      let microActions = await this.generateDailyMicroActions(tgId);
      console.log(`[DAILY] ✅ Generated micro-actions`);

      // Reply
      const message = `🌞 РАНКОВА РЕФЛЕКСІЯ ЗАВЕРШЕНА!\n\n✨ Дякую, ${userName}!\n\n🎯 Афірмація: "${affirmation}"\n\n💡 Мікро-дії:\n${microActions}\n\n🚀 Продуктивного дня!`;
      await ctx.reply(message, keyboards.mainMenuKeyboard());
      console.log(`[DAILY] ✅ Morning summary sent`);

      // ✅ КРИТИЧНО: ПОЗНАЧАЄМО СЕСІЮ ЯК ЗАВЕРШЕНУ В SCHEDULER
      try {
        const { markSessionCompleted } = await import('../../utils/scheduler.js');
        markSessionCompleted(tgId, 'morning');
        console.log(`[DAILY] ✅ Scheduler session marked completed`);
      } catch (schedulerError) {
        console.error('[DAILY] ⚠️ Помилка markSessionCompleted:', schedulerError);
      }

    } catch (error) {
      console.error('[DAILY] ❌ Complete morning fail:', error);
      console.error('[DAILY] Stack:', error.stack);
      await ctx.reply('✅ Сесія збережена, але помилка звіту.', keyboards.mainMenuKeyboard());
    }
  },

  // ===== ✅ ЗАВЕРШЕННЯ ВЕЧІРНЬОЇ (ВИПРАВЛЕНО) =====
  async completeEveningSession(ctx) {
    const tgId = ctx.from.id;
    const userName = ctx.from.first_name || 'Користувач';

    try {
      console.log(`[DAILY] 🌙 Complete evening для ${tgId}`);

      // Афірмація + Фіналізація
      const affirmation = EVENING_AFFIRMATIONS[Math.floor(Math.random() * EVENING_AFFIRMATIONS.length)];
      await responseService.saveAffirmationAndFinalize(tgId, 'evening', affirmation);
      console.log(`[DAILY] ✅ Evening session completed & finalized`);

      // Фідбек (AI)
      let feedback = await this.generateDailyFeedback(tgId);
      console.log(`[DAILY] ✅ Generated feedback`);

      // Reply
      const message = `🌙 ВЕЧІРНЯ РЕФЛЕКСІЯ ЗАВЕРШЕНА!\n\n✨ Дякую, ${userName}!\n\n🎯 Афірмація: "${affirmation}"\n\n💡 Фідбек: ${feedback}\n\n😴 Солодких снів!`;
      await ctx.reply(message, keyboards.mainMenuKeyboard());
      console.log(`[DAILY] ✅ Evening summary sent`);

      // ✅ КРИТИЧНО: ПОЗНАЧАЄМО СЕСІЮ ЯК ЗАВЕРШЕНУ В SCHEDULER
      try {
        const { markSessionCompleted } = await import('../../utils/scheduler.js');
        markSessionCompleted(tgId, 'evening');
        console.log(`[DAILY] ✅ Scheduler session marked completed`);
      } catch (schedulerError) {
        console.error('[DAILY] ⚠️ Помилка markSessionCompleted:', schedulerError);
      }
    
    } catch (error) {
      console.error('[DAILY] ❌ Complete evening fail:', error);
      console.error('[DAILY] Stack:', error.stack);
      await ctx.reply('✅ Сесія збережена, але помилка звіту.', keyboards.mainMenuKeyboard());
    }
  },

  // ===== ГЕНЕРАЦІЯ МІКРО-ДІЙ (AI) =====
  async generateDailyMicroActions(tgId) {
    try {
      const records = await responseService.getUserRecords(tgId, 1);
      if (!records.length) return "• Зосередься на головній цілі дня\n• Зроби один крок\n• Підтримай стан";

      const todayData = records[0].fields;
      const goal = todayData.Q_m_4 || '';
      const state = todayData.Q_m_5 || '';
      const qualities = todayData.Q_m_2 || '';

      const prompt = `Створи 3 мікро-дії на день:\nЦіль: "${goal}"\nСтан: "${state}"\nЯкості: "${qualities}"\nФормат: • [Дія] (15-30 хв)`;

      const response = await chat([{ role: 'user', content: prompt }], 'gpt-4o-mini', 150);
      return response || "• Головна дія дня\n• Підтримка стану\n• Розвиток якості";
    } catch (error) {
      console.error('[DAILY] ❌ Micro-actions fail:', error);
      return "• Головна дія дня\n• Підтримка стану\n• Розвиток якості";
    }
  },

  // ===== ГЕНЕРАЦІЯ ФІДБЕКУ (AI) =====
  async generateDailyFeedback(tgId) {
    try {
      const records = await responseService.getUserRecords(tgId, 1);
      if (!records.length) return "Дякую за день! Кожен крок - сила.";

      const todayData = records[0].fields;
      const energy = todayData.Q_e_1 || '';
      const loss = todayData.Q_e_2 || '';
      const programs = todayData.Q_e_3 || '';
      const source = todayData.Q_e_4 || '';
      const victory = todayData.Q_e_5 || '';

      const prompt = `Фідбек дня:\nЕнергія: "${energy}"\nВтрата: "${loss}"\nПрограми: "${programs}"\nДжерело: "${source}"\nПеремога: "${victory}"\n2-3 речення: перемога + порада + мотивація`;

      const response = await chat([{ role: 'user', content: prompt }], 'gpt-4o-mini', 100);
      return response || "Перемога дня - твоя сила! Завтра новий крок.";
    } catch (error) {
      console.error('[DAILY] ❌ Feedback fail:', error);
      return "Перемога дня - твоя сила! Завтра новий крок.";
    }
  },

  // ===== ВИХІД З СЕСІЇ =====
  async exitSession(ctx, sessionType) {
    const tgId = ctx.from.id;
    
    await userService.updateUserActivity(tgId);
    await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
    console.log(`[DAILY] ✅ Step to completed`);

    // ✅ ПОЗНАЧАЄМО СЕСІЮ ЯК ЗАВЕРШЕНУ
    try {
      const { markSessionCompleted } = await import('../../utils/scheduler.js');
      markSessionCompleted(tgId, sessionType);
      console.log(`[DAILY] ✅ Exit: scheduler session marked completed`);
    } catch (schedulerError) {
      console.error('[DAILY] ⚠️ Exit: помилка markSessionCompleted:', schedulerError);
    }

    const message = sessionType === 'morning' 
      ? '🌞 Сесію завершено. Гарного дня!' 
      : '🌙 Сесію завершено. Солодких снів!';
    
    await ctx.reply(message, keyboards.mainMenuKeyboard());
    await ctx.answerCbQuery('Сесію завершено');
    console.log(`[DAILY] 🚪 Exit ${sessionType} для ${tgId}`);
  }
};

export default dailyController;