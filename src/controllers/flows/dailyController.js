// src/controllers/flows/dailyController.js - ВИПРАВЛЕНО

import userService from '../../services/userService.js';
import responseService from '../../services/responseService.js';
import { chat } from '../../services/openaiClient.js';
import keyboards from '../../utils/keyboards.js';
import { QUESTIONS } from '../../config/constants.js';

// ✅ ПРАВИЛЬНИЙ ІМПОРТ
const MORNING_QUESTIONS = QUESTIONS.morning;
const EVENING_QUESTIONS = QUESTIONS.evening;

// Локальні афірмації
const MORNING_AFFIRMATIONS = [
  "Моє бачення — мій вибір. Моя сила — в мені. Я вже йду своїм шляхом.",
  "Кожне рішення прокачує мою рішучість. Використовуй її щодня.",
  "Впевненість і рішучість — мої інструменти досягнення цілей. Прокачуй їх.",
  "Дія — це твоя мова проти страху. Починай зараз.",
  "Рішення — це м'яз. Тренуй його сьогодні."
];

const EVENING_AFFIRMATIONS = [
  "Я вдячна цьому дню. Я стала сильнішою. Я обираю рухатися далі — до себе справжньої.",
  "Кожна дія сьогодні наблизила мене до моїх цілей.",
  "Я аналізую день, бачу прогрес та коригую стратегію для завтра.",
  "Сьогоднішня дія — завтра моя реальність.",
  "Не чекай натхнення. Створюй його діями."
];

const dailyController = {
  // ═══════════════════════════════════════════════════════════════════════
  // ОБРОБКА ТЕКСТУ
  // ═══════════════════════════════════════════════════════════════════════
  async handleText(ctx, text, step) {
    const tgId = ctx.from.id;
    
    try {
      const isMorning = step?.startsWith('Q_m_');
      const isEvening = step?.startsWith('Q_e_');
      
      if (!isMorning && !isEvening) {
        return false;
      }
      
      const qNum = parseInt(step.split('_')[2], 10);
      console.log(`[DAILY] 💬 Відповідь на питання ${qNum}: "${text.substring(0, 50)}..."`);
      
      if (isMorning) {
        await responseService.saveMorningAnswer(tgId, qNum, text);
        
        if (qNum < 6) {
          await this.askMorningQuestion(ctx, qNum + 1);
        } else {
          await this.completeMorningSession(ctx);
        }
      }
      
      if (isEvening) {
        await responseService.saveEveningAnswer(tgId, qNum, text);
        
        if (qNum < 5) {
          await this.askEveningQuestion(ctx, qNum + 1);
        } else {
          await this.completeEveningSession(ctx);
        }
      }
      
      return true;
      
    } catch (error) {
      console.error('[DAILY] ❌ handleText:', error);
      await ctx.reply('❌ Помилка збереження. Спробуй ще раз.', keyboards.mainMenuKeyboard());
      return true;
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ОБРОБКА CALLBACK
  // ═══════════════════════════════════════════════════════════════════════
  async handleCallback(ctx, data) {
    const tgId = ctx.from.id;
    console.log(`[DAILY] 📱 Callback: ${data}`);

    try {
      switch (data) {
        case 'start_morning':
          await this.startMorningSession(ctx);
          break;
        case 'start_evening':
          await this.startEveningSession(ctx);
          break;
        case 'exit_morning':
          await this.exitSession(ctx, 'morning');
          break;
        case 'exit_evening':
          await this.exitSession(ctx, 'evening');
          break;
        case 'later_morning':
          await ctx.reply('🌞 Гарно! Ранкові питання будуть чекати на тебе.');
          await ctx.answerCbQuery('Відкладено');
          break;
        case 'later_evening':
          await ctx.reply('🌙 Добре! Вечірні питання будуть доступні пізніше.');
          await ctx.answerCbQuery('Відкладено');
          break;
        default:
          return false;
      }
      return true;
    } catch (error) {
      console.error('[DAILY] ❌ Помилка callback:', error);
      await ctx.answerCbQuery('Помилка');
      return true;
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // РАНКОВА СЕСІЯ
  // ═══════════════════════════════════════════════════════════════════════
  async startMorningSession(ctx) {
    const tgId = ctx.from.id;
    
    try {
      console.log(`[DAILY] 🌞 Початок ранкової сесії для ${tgId}`);
      
      await userService.updateUserFields(tgId, {
        Current_Activity: 'Q_m_1'
      });
      
      await this.askMorningQuestion(ctx, 1);
      
    } catch (error) {
      console.error('[DAILY] ❌ startMorningSession:', error);
      await ctx.reply('❌ Помилка запуску ранкової сесії.', keyboards.mainMenuKeyboard());
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ВЕЧІРНЯ СЕСІЯ
  // ═══════════════════════════════════════════════════════════════════════
  async startEveningSession(ctx) {
    const tgId = ctx.from.id;
    const userName = ctx.from.first_name || 'Користувач';

    try {
      console.log(`[DAILY] 🌙 Початок вечірньої сесії для ${tgId}`);

      const user = await userService.getUserByTgId(tgId);
      
      if (!user || !userService.hasActiveAccess(user)) {
        await ctx.reply('Потрібна активна підписка для вечірньої рефлексії.');
        return;
      }

      const completed = await responseService.isSessionCompleted(tgId, 'evening');
      if (completed) {
        await ctx.reply(
          `🌙 Ти вже завершила вечірню рефлексію сьогодні!\n\n😴 Солодких снів, ${userName}!`,
          keyboards.mainMenuKeyboard()
        );
        return;
      }

      await userService.updateUserFields(tgId, {
        Current_Activity: 'Q_e_1'
      });
      
      await this.askEveningQuestion(ctx, 1);
      
    } catch (error) {
      console.error('[DAILY] ❌ startEveningSession:', error);
      await ctx.reply('❌ Помилка запуску вечірньої сесії.');
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // РАНКОВІ ПИТАННЯ
  // ═══════════════════════════════════════════════════════════════════════
  async askMorningQuestion(ctx, qNum) {
    const tgId = ctx.from.id;
    
    try {
      // ✅ ІНДЕКС МАСИВУ = qNum - 1
      const question = MORNING_QUESTIONS[qNum - 1];
      
      if (!question) {
        console.error(`[DAILY] ❌ Питання ${qNum} не знайдено`);
        await ctx.reply('❌ Помилка завантаження питання.', keyboards.mainMenuKeyboard());
        return;
      }
      
      await userService.updateUserFields(tgId, {
        Current_Activity: `Q_m_${qNum}`
      });
      
      await ctx.reply(
        `🌞 РАНКОВА РЕФЛЕКСІЯ\n\n${qNum}/6 ${question.text}\n\n💡 Підказка: ${question.hint}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚪 Вийти із сесії', callback_data: 'exit_morning' }]
            ]
          }
        }
      );
      
    } catch (error) {
      console.error('[DAILY] ❌ askMorningQuestion:', error);
      await ctx.reply('❌ Помилка запуску питання.', keyboards.mainMenuKeyboard());
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ВЕЧІРНІ ПИТАННЯ
  // ═══════════════════════════════════════════════════════════════════════
  async askEveningQuestion(ctx, qNum) {
    const tgId = ctx.from.id;
    
    try {
      const question = EVENING_QUESTIONS[qNum - 1];
      
      if (!question) {
        console.error(`[DAILY] ❌ Питання ${qNum} не знайдено`);
        await ctx.reply('❌ Помилка завантаження питання.', keyboards.mainMenuKeyboard());
        return;
      }
      
      await userService.updateUserFields(tgId, {
        Current_Activity: `Q_e_${qNum}`
      });
      
      await ctx.reply(
        `🌙 ВЕЧІРНЯ РЕФЛЕКСІЯ\n\n${qNum}/5 ${question.text}\n\n💡 Підказка: ${question.hint}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚪 Вийти із сесії', callback_data: 'exit_evening' }]
            ]
          }
        }
      );
      
    } catch (error) {
      console.error('[DAILY] ❌ askEveningQuestion:', error);
      await ctx.reply('❌ Помилка запуску питання.', keyboards.mainMenuKeyboard());
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ЗАВЕРШЕННЯ РАНКОВОЇ СЕСІЇ
  // ═══════════════════════════════════════════════════════════════════════
  async completeMorningSession(ctx) {
    const tgId = ctx.from.id;
    
    try {
      await userService.updateUserFields(tgId, {
        Current_Activity: 'completed'
      });
      
      const affirmation = MORNING_AFFIRMATIONS[Math.floor(Math.random() * MORNING_AFFIRMATIONS.length)];
      
      await ctx.reply(
        `✅ РАНКОВУ РЕФЛЕКСІЮ ЗАВЕРШЕНО!\n\n✨ ${affirmation}\n\nГарного дня! 🌞`,
        keyboards.mainMenuKeyboard()
      );
      
      console.log(`[DAILY] ✅ Ранкова сесія завершена для ${tgId}`);
      
    } catch (error) {
      console.error('[DAILY] ❌ completeMorningSession:', error);
      await ctx.reply('✅ Відповіді збережено!', keyboards.mainMenuKeyboard());
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ЗАВЕРШЕННЯ ВЕЧІРНЬОЇ СЕСІЇ
  // ═══════════════════════════════════════════════════════════════════════
  async completeEveningSession(ctx) {
    const tgId = ctx.from.id;
    const userName = ctx.from.first_name || 'Користувач';

    try {
      console.log(`[DAILY] 🔄 Завершення вечірньої сесії для ${tgId}`);
      
      let dailyFeedback = "Дякую за чесність у відповідях. Кожен день робить тебе сильнішою.";
      try {
        dailyFeedback = await this.generateDailyFeedback(tgId);
      } catch (error) {
        console.error('[DAILY] ⚠️ Помилка генерації фідбеку:', error.message);
      }
      
      const affirmation = EVENING_AFFIRMATIONS[Math.floor(Math.random() * EVENING_AFFIRMATIONS.length)];

      try {
        await responseService.saveAffirmation(tgId, 'evening', affirmation);
      } catch (error) {
        console.error('[DAILY] ⚠️ Помилка збереження афірмації:', error.message);
      }

      const message =
        `🌙 ВЕЧІРНЯ РЕФЛЕКСІЯ ЗАВЕРШЕНА!\n\n` +
        `✨ Дякую, ${userName}! Твій день проаналізовано.\n\n` +
        `🎯 ТВОЯ АФІРМАЦІЯ НА НІЧ:\n"${affirmation}"\n\n` +
        `💡 ФІДБЕК ДНЯ:\n${dailyFeedback}\n\n` +
        `😴 Солодких снів!`;

      await ctx.reply(message, keyboards.mainMenuKeyboard());

      await userService.updateUserFields(tgId, {
        Current_Activity: 'completed'
      });

      try {
        const { markSessionCompleted } = await import('../../utils/scheduler.js');
        markSessionCompleted(tgId, 'evening');
      } catch (error) {
        console.error('[DAILY] ⚠️ Помилка scheduler:', error.message);
      }

      console.log(`[DAILY] ✅ Вечірня сесія завершена для ${tgId}`);
      
    } catch (error) {
      console.error('[DAILY] ❌ completeEveningSession:', error);
      
      try {
        await userService.updateUserFields(tgId, {
          Current_Activity: 'completed'
        });
      } catch {}
      
      await ctx.reply(
        '✅ Відповіді збережено!\n\n❌ Виникла помилка при формуванні звіту, але твої дані в безпеці.',
        keyboards.mainMenuKeyboard()
      );
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ГЕНЕРАЦІЯ ВЕЧІРНЬОГО ФІДБЕКУ
  // ═══════════════════════════════════════════════════════════════════════
  async generateDailyFeedback(tgId) {
    try {
      const records = await responseService.getUserRecords(tgId, 1);
      if (!records.length)
        return "Дякую за чесність у відповідях. Кожен день - це крок до кращої версії себе.";

      const todayData = records[0].fields;
      const energy = todayData.Q_e_1 || '';
      const energyLoss = todayData.Q_e_2 || '';
      const programs = todayData.Q_e_3 || '';
      const source = todayData.Q_e_4 || '';
      const victory = todayData.Q_e_5 || '';

      const prompt = `
Проаналізуй день користувача та дай короткий фідбек:

Що додало енергії: "${energy}"
Де втратила енергію: "${energyLoss}"
Активні програми: "${programs}"
Діяла зі сили чи страху: "${source}"
Головна перемога: "${victory}"

Дай короткий фідбек (2–3 речення):
- підкресли перемогу
- порада щодо енергії
- мотивуюче завершення
Стиль: підтримуючий, конкретний, мотивуючий.`;

      const response = await chat(
        [
          { role: 'system', content: 'Ти мудрий коуч. Даєш підтримуючий фідбек з конкретними порадами.' },
          { role: 'user', content: prompt }
        ],
        'gpt-4o-mini',
        200
      );

      return response || "Твоя перемога сьогодні — доказ твоєї сили. Продовжуй рухатись вперед з вірою в себе.";
    } catch (error) {
      console.error('[DAILY] ❌ generateDailyFeedback:', error);
      return "Дякую за чесність у відповідях. Кожен день робить тебе сильнішою.";
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ВИХІД ІЗ СЕСІЇ
  // ═══════════════════════════════════════════════════════════════════════
  async exitSession(ctx, sessionType) {
    const tgId = ctx.from.id;

    await userService.updateUserFields(tgId, {
      Current_Activity: 'completed'
    });

    const message =
      sessionType === 'morning'
        ? '🌞 Ранкову сесію завершено. Гарного дня!'
        : '🌙 Вечірню сесію завершено. Солодких снів!';

    await ctx.reply(message, keyboards.mainMenuKeyboard());
    await ctx.answerCbQuery('Сесію завершено');

    console.log(`[DAILY] 🚪 Користувач ${tgId} вийшов із ${sessionType} сесії`);
  }
};

export default dailyController;