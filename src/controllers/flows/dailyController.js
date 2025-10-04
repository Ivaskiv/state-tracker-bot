// src/controllers/flows/dailyController.js - ВИПРАВЛЕНО: ІМПОРТ CURRENT_ACTIVITY + ЛОГИ В startMorningSession

import userService from '../../services/userService.js';
import responseService from '../../services/responseService.js';
import { chat } from '../../services/openaiClient.js';
import keyboards from '../../utils/keyboards.js';
import { QUESTIONS, MORNING_AFFIRMATIONS, EVENING_AFFIRMATIONS, ANSWER_STEPS, CURRENT_ACTIVITY } from '../../config/constants.js'; // ✅ ІМПОРТ CURRENT_ACTIVITY

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
    const userName = ctx.from.first_name || 'Користувач';

    try {
      console.log(`[DAILY] 🌞 Start morning для ${tgId}`);

      const user = await userService.getUserByTgId(tgId);
      if (!user || !userService.hasActiveAccess(user)) {
        console.log(`[DAILY] ❌ No access for morning`);
        await ctx.reply('🔒 Потрібна активна підписка для рефлексії.', keyboards.subscriptionMenuInline());
        return;
      }

      // Перевірка завершеності
      const completed = await responseService.isSessionCompleted(tgId, 'morning');
      if (completed) {
        console.log(`[DAILY] ✅ Already completed morning`);
        await ctx.reply(
          `🌞 Ти вже завершила ранкову рефлексію!\n\n✨ Гарного дня, ${userName}!`,
          keyboards.mainMenuKeyboard()
        );
        return;
      }

      // ✅ Set step to Q_m_1
      await userService.updateUserStep(tgId, CURRENT_ACTIVITY.Q_M_1);
      console.log(`[DAILY] ✅ Step set to Q_m_1`);

      await this.askMorningQuestion(ctx, 1);
      
    } catch (error) {
      console.error('[DAILY] ❌ Start morning fail:', error);
      console.error('[DAILY] Stack:', error.stack);
      await ctx.reply('❌ Помилка запуску. Спробуй пізніше.', keyboards.mainMenuKeyboard());
    }
  },

  // ===== СТАРТ ВЕЧІРНЇ СЕСІЇ =====
  async startEveningSession(ctx) {
    const tgId = ctx.from.id;
    const userName = ctx.from.first_name || 'Користувач';

    try {
      console.log(`[DAILY] 🌙 Start evening для ${tgId}`);

      const user = await userService.getUserByTgId(tgId);
      if (!user || !userService.hasActiveAccess(user)) {
        console.log(`[DAILY] ❌ No access for evening`);
        await ctx.reply('🔒 Потрібна активна підписка для рефлексії.', keyboards.subscriptionMenuInline());
        return;
      }

      // Перевірка завершеності
      const completed = await responseService.isSessionCompleted(tgId, 'evening');
      if (completed) {
        console.log(`[DAILY] ✅ Already completed evening`);
        await ctx.reply(
          `🌙 Ти вже завершила вечірню рефлексію!\n\n😴 Солодких снів, ${userName}!`,
          keyboards.mainMenuKeyboard()
        );
        return;
      }

      // ✅ Set step to Q_e_1
      await userService.updateUserStep(tgId, CURRENT_ACTIVITY.Q_E_1);
      console.log(`[DAILY] ✅ Step set to Q_e_1`);

      await this.askEveningQuestion(ctx, 1);
      
    } catch (error) {
      console.error('[DAILY] ❌ Start evening fail:', error);
      console.error('[DAILY] Stack:', error.stack);
      await ctx.reply('❌ Помилка запуску. Спробуй пізніше.', keyboards.mainMenuKeyboard());
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

      // ✅ Update step to current Q
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

      // ✅ Update step to current Q
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

      // ✅ Save answer
      await responseService.saveMorningAnswer(tgId, questionNumber, text);
      console.log(`[DAILY] ✅ Saved Q_m_${questionNumber}`);

      // Next step
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

      // ✅ Save answer
      await responseService.saveEveningAnswer(tgId, questionNumber, text);
      console.log(`[DAILY] ✅ Saved Q_e_${questionNumber}`);

      // Next step
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

  // ===== ЗАВЕРШЕННЯ РАНКОВОЇ =====
  async completeMorningSession(ctx) {
    const tgId = ctx.from.id;
    const userName = ctx.from.first_name || 'Користувач';

    try {
      console.log(`[DAILY] 🌞 Complete morning для ${tgId}`);

      // Афірмація
      const affirmation = MORNING_AFFIRMATIONS[Math.floor(Math.random() * MORNING_AFFIRMATIONS.length)];
      await responseService.saveAffirmation(tgId, 'morning', affirmation);
      console.log(`[DAILY] ✅ Saved morning affirmation`);

      // Мікро-дії (AI)
      let microActions = await this.generateDailyMicroActions(tgId);
      console.log(`[DAILY] ✅ Generated micro-actions`);

      // Reply
      const message = `🌞 РАНКОВА РЕФЛЕКСІЯ ЗАВЕРШЕНА!\n\n✨ Дякую, ${userName}!\n\n🎯 Афірмація: "${affirmation}"\n\n💡 Мікро-дії:\n${microActions}\n\n🚀 Продуктивного дня!`;
      await ctx.reply(message, keyboards.mainMenuKeyboard());
      console.log(`[DAILY] ✅ Morning summary sent`);

      // Final update
      await userService.updateUserActivity(tgId);
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      console.log(`[DAILY] ✅ Step to completed`);
    } catch (error) {
      console.error('[DAILY] ❌ Complete morning fail:', error);
      console.error('[DAILY] Stack:', error.stack);
      await ctx.reply('✅ Сесія збережена, але помилка звіту.', keyboards.mainMenuKeyboard());
    }
  },

  // ===== ЗАВЕРШЕННЯ ВЕЧІРНЬОЇ =====
  async completeEveningSession(ctx) {
    const tgId = ctx.from.id;
    const userName = ctx.from.first_name || 'Користувач';

    try {
      console.log(`[DAILY] 🌙 Complete evening для ${tgId}`);

      // Афірмація
      const affirmation = EVENING_AFFIRMATIONS[Math.floor(Math.random() * EVENING_AFFIRMATIONS.length)];
      await responseService.saveAffirmation(tgId, 'evening', affirmation);
      console.log(`[DAILY] ✅ Saved evening affirmation`);

      // Фідбек (AI)
      let feedback = await this.generateDailyFeedback(tgId);
      console.log(`[DAILY] ✅ Generated feedback`);

      // Reply
      const message = `🌙 ВЕЧІРНЯ РЕФЛЕКСІЯ ЗАВЕРШЕНА!\n\n✨ Дякую, ${userName}!\n\n🎯 Афірмація: "${affirmation}"\n\n💡 Фідбек: ${feedback}\n\n😴 Солодких снів!`;
      await ctx.reply(message, keyboards.mainMenuKeyboard());
      console.log(`[DAILY] ✅ Evening summary sent`);

      // Final update
      await userService.updateUserActivity(tgId);
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      console.log(`[DAILY] ✅ Step to completed`);
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

    const message = sessionType === 'morning' 
      ? '🌞 Сесію завершено. Гарного дня!' 
      : '🌙 Сесію завершено. Солодких снів!';
    
    await ctx.reply(message, keyboards.mainMenuKeyboard());
    await ctx.answerCbQuery('Сесію завершено');
    console.log(`[DAILY] 🚪 Exit ${sessionType} для ${tgId}`);
  }
};
// ✅ При натисканні кнопки "Почати" (ранок)
export const startMorningReflection = async (ctx) => {
  const tgId = ctx.from.id;
  
  try {
    // 🆕 ІНІЦІАЛІЗУЄМО СЕСІЮ
    await responseService.initMorningSession(tgId);
    
    // Показуємо перше питання
    await showMorningQuestion(ctx, 1);
    
  } catch (error) {
    logger.error('[dailyController] Помилка startMorningReflection:', error);
    await ctx.reply('❌ Помилка запуску ранкової рефлексії');
  }
};

// ✅ При натисканні кнопки "Почати" (вечір)
export const startEveningReflection = async (ctx) => {
  const tgId = ctx.from.id;
  
  try {
    // 🆕 ІНІЦІАЛІЗУЄМО СЕСІЮ
    await responseService.initEveningSession(tgId);
    
    // Показуємо перше питання
    await showEveningQuestion(ctx, 1);
    
  } catch (error) {
    logger.error('[dailyController] Помилка startEveningReflection:', error);
    await ctx.reply('❌ Помилка запуску вечірньої рефлексії');
  }
};

export default dailyController;