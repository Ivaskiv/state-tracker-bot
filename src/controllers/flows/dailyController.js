// src/controllers/flows/dailyController.js - КОНТРОЛЕР ЩОДЕННИХ ПИТАНЬ (оновлено, питання з constants)

import userService from '../../services/userService.js';
import responseService from '../../dialogue/services/responseService.js';
import { chat } from '../../services/openaiClient.js';
import keyboards from '../../utils/keyboards.js';
import { QUESTIONS } from '../../config/constants.js';

// Локальні афірмації (можна винести в constants, але це не конфліктує)
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
  // ===== ОБРОБКА ТЕКСТУ =====
  async handleText(ctx, text, userStep) {
    const tgId = ctx.from.id;
    console.log(`[DAILY] 💬 Відповідь від ${tgId}, step: ${userStep}`);

    try {
      if (userStep?.startsWith('Q_m_')) {
        await this.handleMorningAnswer(ctx, text, userStep);
      } else if (userStep?.startsWith('Q_e_')) {
        await this.handleEveningAnswer(ctx, text, userStep);
      }
      return true;
    } catch (error) {
      console.error('[DAILY] ❌ Помилка обробки тексту:', error);
      await ctx.reply('❌ Помилка обробки відповіді. Спробуй ще раз.');
      return true;
    }
  },

  // ===== ОБРОБКА CALLBACK =====
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

  // ===== РАНКОВА СЕСІЯ =====
  async startMorningSession(ctx) {
    const tgId = ctx.from.id;
    const userName = ctx.from.first_name || 'Користувач';

    try {
      console.log(`[DAILY] 🌞 Початок ранкової сесії для ${tgId}`);

      const user = await userService.getUserByTelegramId(tgId);
      if (!user || !userService.hasActiveAccess(user)) {
        await ctx.reply('Потрібна активна підписка для ранкової рефлексії.');
        return;
      }

      // Перевіряємо чи вже завершені ранкові питання
      const completed = await responseService.isSessionCompleted(tgId, 'morning');
      if (completed) {
        await ctx.reply(
          `🌞 Ти вже завершила ранкову рефлексію сьогодні!\n\n✨ Гарного дня, ${userName}!`,
          keyboards.mainMenuKeyboard()
        );
        return;
      }

      // Починаємо з першого питання
      await userService.updateUserStep(tgId, 'Q_m_1');
      await this.askMorningQuestion(ctx, 1);
    } catch (error) {
      console.error('[DAILY] ❌ Помилка startMorningSession:', error);
      await ctx.reply('❌ Помилка запуску ранкової сесії.');
    }
  },

  // ===== ВЕЧІРНЯ СЕСІЯ =====
  async startEveningSession(ctx) {
    const tgId = ctx.from.id;
    const userName = ctx.from.first_name || 'Користувач';

    try {
      console.log(`[DAILY] 🌙 Початок вечірньої сесії для ${tgId}`);

      const user = await userService.getUserByTelegramId(tgId);
      if (!user || !userService.hasActiveAccess(user)) {
        await ctx.reply('Потрібна активна підписка для вечірньої рефлексії.');
        return;
      }

      // Перевіряємо чи вже завершені вечірні питання
      const completed = await responseService.isSessionCompleted(tgId, 'evening');
      if (completed) {
        await ctx.reply(
          `🌙 Ти вже завершила вечірню рефлексію сьогодні!\n\n😴 Солодких снів, ${userName}!`,
          keyboards.mainMenuKeyboard()
        );
        return;
      }

      // Починаємо з першого питання
      await userService.updateUserStep(tgId, 'Q_e_1');
      await this.askEveningQuestion(ctx, 1);
    } catch (error) {
      console.error('[DAILY] ❌ Помилка startEveningSession:', error);
      await ctx.reply('❌ Помилка запуску вечірньої сесії.');
    }
  },

  // ===== РАНКОВІ ПИТАННЯ (з QUESTIONS) =====
  async askMorningQuestion(ctx, questionNumber) {
    const q = QUESTIONS.morning[questionNumber - 1];
    if (!q) return;

    let message = `🌞 РАНКОВА РЕФЛЕКСІЯ\n\n${questionNumber}/${QUESTIONS.morning.length} ${q.text}`;
    if (q.hint) message += `\n\n💡 Підказка: ${q.hint}`;

    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚪 Вийти із сесії', callback_data: 'exit_morning' }]
        ]
      }
    });
  },

  // ===== ВЕЧІРНІ ПИТАННЯ (з QUESTIONS) =====
  async askEveningQuestion(ctx, questionNumber) {
    const q = QUESTIONS.evening[questionNumber - 1];
    if (!q) return;

    let message = `🌙 ВЕЧІРНЯ РЕФЛЕКСІЯ\n\n${questionNumber}/${QUESTIONS.evening.length} ${q.text}`;
    if (q.hint) message += `\n\n💡 Підказка: ${q.hint}`;

    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚪 Вийти із сесії', callback_data: 'exit_evening' }]
        ]
      }
    });
  },

  // ===== ОБРОБКА РАНКОВИХ ВІДПОВІДЕЙ =====
  async handleMorningAnswer(ctx, text, userStep) {
    const tgId = ctx.from.id;
    const questionNumber = parseInt(userStep.split('_')[2], 10);

    try {
      await responseService.saveMorningAnswer(tgId, questionNumber, text);
      console.log(`[DAILY] 🌞 Збережено ранкову відповідь ${questionNumber} для ${tgId}`);

      if (questionNumber < QUESTIONS.morning.length) {
        const nextStep = `Q_m_${questionNumber + 1}`;
        await userService.updateUserStep(tgId, nextStep);
        await this.askMorningQuestion(ctx, questionNumber + 1);
      } else {
        await this.completeMorningSession(ctx);
      }
    } catch (error) {
      console.error('[DAILY] ❌ Помилка handleMorningAnswer:', error);
      await ctx.reply('❌ Помилка збереження відповіді. Спробуй ще раз.');
    }
  },

  // ===== ОБРОБКА ВЕЧІРНІХ ВІДПОВІДЕЙ =====
  async handleEveningAnswer(ctx, text, userStep) {
    const tgId = ctx.from.id;
    const questionNumber = parseInt(userStep.split('_')[2], 10);

    try {
      await responseService.saveEveningAnswer(tgId, questionNumber, text);
      console.log(`[DAILY] 🌙 Збережено вечірню відповідь ${questionNumber} для ${tgId}`);

      if (questionNumber < QUESTIONS.evening.length) {
        const nextStep = `Q_e_${questionNumber + 1}`;
        await userService.updateUserStep(tgId, nextStep);
        await this.askEveningQuestion(ctx, questionNumber + 1);
      } else {
        await this.completeEveningSession(ctx);
      }
    } catch (error) {
      console.error('[DAILY] ❌ Помилка handleEveningAnswer:', error);
      await ctx.reply('❌ Помилка збереження відповіді. Спробуй ще раз.');
    }
  },

  // ===== ЗАВЕРШЕННЯ РАНКОВОЇ СЕСІЇ =====
  async completeMorningSession(ctx) {
    const tgId = ctx.from.id;
    const userName = ctx.from.first_name || 'Користувач';

    try {
      const microActions = await this.generateDailyMicroActions(tgId, 'morning');
      const affirmation = MORNING_AFFIRMATIONS[Math.floor(Math.random() * MORNING_AFFIRMATIONS.length)];

      await responseService.saveAffirmation(tgId, 'morning', affirmation);

      const message =
        `🌞 РАНКОВА РЕФЛЕКСІЯ ЗАВЕРШЕНА!\n\n` +
        `✨ Дякую, ${userName}! Твої відповіді збережено.\n\n` +
        `🎯 ТВОЯ АФІРМАЦІЯ НА ДЕНЬ:\n"${affirmation}"\n\n` +
        `💡 РЕКОМЕНДОВАНІ МІКРО-ДІЇ:\n${microActions}\n\n` +
        `🚀 Продуктивного дня!`;

      await ctx.reply(message, keyboards.mainMenuKeyboard());
      await userService.updateUserActivity(tgId);

      console.log(`[DAILY] ✅ Ранкова сесія завершена для ${tgId}`);
    } catch (error) {
      console.error('[DAILY] ❌ Помилка completeMorningSession:', error);
      await ctx.reply('❌ Помилка завершення сесії.', keyboards.mainMenuKeyboard());
    }
  },

  // ===== ЗАВЕРШЕННЯ ВЕЧІРНЬОЇ СЕСІЇ =====
  async completeEveningSession(ctx) {
    const tgId = ctx.from.id;
    const userName = ctx.from.first_name || 'Користувач';

    try {
      const dailyFeedback = await this.generateDailyFeedback(tgId, 'evening');
      const affirmation = EVENING_AFFIRMATIONS[Math.floor(Math.random() * EVENING_AFFIRMATIONS.length)];

      await responseService.saveAffirmation(tgId, 'evening', affirmation);

      const message =
        `🌙 ВЕЧІРНЯ РЕФЛЕКСІЯ ЗАВЕРШЕНА!\n\n` +
        `✨ Дякую, ${userName}! Твій день проаналізовано.\n\n` +
        `🎯 ТВОЯ АФІРМАЦІЯ НА НІЧ:\n"${affirmation}"\n\n` +
        `💡 ФІДБЕК ДНЯ:\n${dailyFeedback}\n\n` +
        `😴 Солодких снів!`;

      await ctx.reply(message, keyboards.mainMenuKeyboard());
      await userService.updateUserActivity(tgId);

      console.log(`[DAILY] ✅ Вечірня сесія завершена для ${tgId}`);
    } catch (error) {
      console.error('[DAILY] ❌ Помилка completeEveningSession:', error);
      await ctx.reply('❌ Помилка завершення сесії.', keyboards.mainMenuKeyboard());
    }
  },

  // ===== ГЕНЕРАЦІЯ МІКРО-ДІЙ =====
  async generateDailyMicroActions(tgId /*, sessionType */) {
    try {
      const records = await responseService.getUserRecords(tgId, 1);
      if (!records.length)
        return "• Зосередься на головній цілі дня\n• Зроби один крок до мрії\n• Підтримай ресурсний стан";

      const todayData = records[0].fields;
      const goal = todayData.Q_m_4 || '';
      const state = todayData.Q_m_5 || '';
      const qualities = todayData.Q_m_2 || '';

      const prompt = `
Створи 3 конкретні мікро-дії на сьогодні для користувача:

Головна ціль дня: "${goal}"
Поточний стан: "${state}"
Якості: "${qualities}"

Формат відповіді (лише текст дій):
• [Дія 1 - для просування до цілі]
• [Дія 2 - для підтримки стану]
• [Дія 3 - для розвитку якостей]

Кожна дія має бути конкретною, виконуваною за 15–30 хв і мотивуючою.`;

      const response = await chat(
        [
          { role: 'system', content: 'Ти експертний коуч. Генеруй конкретні мікро-дії для досягнення цілей.' },
          { role: 'user', content: prompt }
        ],
        'gpt-4o-mini',
        200
      );

      return response || "• Зроби один крок до головної цілі\n• Підтримай ресурсний стан\n• Розвивай свої сильні якості";
    } catch (error) {
      console.error('[DAILY] ❌ Помилка generateDailyMicroActions:', error);
      return "• Зосередься на головній цілі дня\n• Зроби один крок до мрії\n• Підтримай ресурсний стан";
    }
  },

  // ===== ГЕНЕРАЦІЯ ВЕЧІРНЬОГО ФІДБЕКУ =====
  async generateDailyFeedback(tgId /*, sessionType */) {
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
      console.error('[DAILY] ❌ Помилка generateDailyFeedback:', error);
      return "Дякую за чесність у відповідях. Кожен день робить тебе сильнішою.";
    }
  },

  // ===== ВИХІД ІЗ СЕСІЇ =====
  async exitSession(ctx, sessionType) {
    const tgId = ctx.from.id;

    await userService.updateUserActivity(tgId);

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
