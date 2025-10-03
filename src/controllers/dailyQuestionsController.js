// // src/controllers/dailyQuestionsController.js - ВИПРАВЛЕНИЙ

// import userService from '../services/userService.js';
// import responseService from '../dialogue/services/responseService.js';
// import { chat } from '../services/openaiClient.js';
// import { QUESTIONS, CURRENT_ACTIVITY } from '../config/constants.js';

// // Динамічний імпорт для уникнення циклічних залежностей
// let markSessionCompleted, cancelSessionReminder;

// const initSchedulerFunctions = async () => {
//   if (!markSessionCompleted) {
//     try {
//       const schedulerModule = await import('../utils/scheduler.js');
//       markSessionCompleted = schedulerModule.markSessionCompleted;
//       cancelSessionReminder = schedulerModule.cancelSessionReminder;
//     } catch (error) {
//       console.error('[dailyQuestions] Помилка імпорту scheduler:', error);
//       // Fallback функції
//       markSessionCompleted = (tgId, type) => console.log(`Session ${type} completed for ${tgId}`);
//       cancelSessionReminder = (tgId) => console.log(`Reminder cancelled for ${tgId}`);
//     }
//   }
// };

// // Ранкові питання згідно з новим ТЗ
// const MORNING_QUESTIONS_V2 = [
//   {
//     id: 1,
//     text: "Хто я сьогодні? Опиши себе як нову версію з позиції сили (1-2 речення).",
//     field: 'Q_m_1',
//     example: "Я — топ експерт, я власниця відомого бренду"
//   },
//   {
//     id: 2,
//     text: "Яка я сьогодні? Опиши свої ключові якості.",
//     field: 'Q_m_2',
//     example: "сильна, смілива, рішуча, любляча"
//   },
//   {
//     id: 3,
//     text: "Мої 10 цілей на рік. Пропиши їх щодня, ніби вони вже реальність.",
//     field: 'Q_m_3'
//   },
//   {
//     id: 4,
//     text: "На яку одну ціль я фокусуюсь сьогодні?",
//     field: 'Q_m_4'
//   },
//   {
//     id: 5,
//     text: "Який мій стан сьогодні? Якщо стан не ресурсний — обери новий: впевненість, рішучість, легкість, сила.",
//     field: 'Q_m_5'
//   },
//   {
//     id: 6,
//     text: "Чому я гідна мати все це прямо зараз? Сильна відповідь із позиції самоцінності.",
//     field: 'Q_m_6',
//     example: "бо я вже достатня / цінна / варта"
//   }
// ];

// // Вечірні питання згідно з новим ТЗ
// const EVENING_QUESTIONS_V2 = [
//   {
//     id: 1,
//     text: "Що мене сьогодні наповнило енергією?",
//     field: 'Q_e_1'
//   },
//   {
//     id: 2,
//     text: "Де я сьогодні злила енергію чи втратила стан?",
//     field: 'Q_e_2'
//   },
//   {
//     id: 3,
//     text: "Яка програма або переконання активувалась сьогодні?",
//     field: 'Q_e_3',
//     example: "страх, 'мені не вийде', 'я не заслуговую'"
//   },
//   {
//     id: 4,
//     text: "З якої точки я діяла сьогодні: сили чи страху?",
//     field: 'Q_e_4'
//   },
//   {
//     id: 5,
//     text: "Яка моя головна перемога сьогодні?",
//     field: 'Q_e_5'
//   }
// ];

// // Мотиваційні афірмації
// const MORNING_AFFIRMATIONS = [
//   "Моє бачення — мій вибір. Моя сила — в мені. Я вже йду своїм шляхом.",
//   "Кожне рішення прокачує мою рішучість. Використовуй її щодня.",
//   "Впевненість і рішучість — мої інструменти досягнення цілей. Прокачуй їх.",
//   "Дія — це твоя мова проти страху. Починай зараз.",
//   "Рішення — це м'яз. Тренуй його сьогодні."
// ];

// const EVENING_AFFIRMATIONS = [
//   "Я вдячна цьому дню. Я стала сильнішою. Я обираю рухатися далі — до себе справжньої.",
//   "Кожна дія сьогодні наблизила мене до моїх цілей.",
//   "Я аналізую день, бачу прогрес та коригую стратегію для завтра.",
//   "Сьогоднішня дія — завтра моя реальність.",
//   "Не чекай натхнення. Створюй його діями."
// ];

// class DailyQuestionsController {
//   // Початок ранкової сесії
//   async startMorningSession(ctx) {
//     const tgId = ctx.from.id;
//     const userName = ctx.from.first_name || 'Користувач';

//     try {
//       console.log(`🌞 [MORNING] Початок ранкової сесії для ${tgId}`);

//       const user = await userService.getUserByTgId(tgId);
//       if (!user || !userService.hasActiveAccess(user)) {
//         return ctx.reply('Потрібна активна підписка для ранкової рефлексії.');
//       }

//       // ВИПРАВЛЕНО: перевіряємо morning, а не evening
//       const completed = await responseService.isSessionCompleted(tgId, 'morning');
//       if (completed) {
//         return ctx.reply(
//           `🌞 Ти вже завершила ранкову рефлексію сьогодні!\n\n✨ Гарного дня, ${userName}!`,
//           { reply_markup: { remove_keyboard: true } }
//         );
//       }

//       // Починаємо з першого питання
//       await userService.updateUserStep(tgId, 'Q_m_1');
//       await this.askMorningQuestion(ctx, 1);

//     } catch (error) {
//       console.error('[startMorningSession] Помилка:', error);
//       await ctx.reply('❌ Помилка запуску ранкової сесії.');
//     }
//   }

//   // Початок вечірньої сесії  
//   async startEveningSession(ctx) {
//     const tgId = ctx.from.id;
//     const userName = ctx.from.first_name || 'Користувач';

//     try {
//       console.log(`🌙 [EVENING] Початок вечірньої сесії для ${tgId}`);

//       const user = await userService.getUserByTgId(tgId);
//       if (!user || !userService.hasActiveAccess(user)) {
//         return ctx.reply('Потрібна активна підписка для вечірньої рефлексії.');
//       }

//       // Перевіряємо чи вже завершили сьогодні
//       const completed = await responseService.isSessionCompleted(tgId, 'evening');
//       if (completed) {
//         return ctx.reply(
//           `🌙 Ти вже завершила вечірню рефлексію сьогодні!\n\n😴 Солодких снів, ${userName}!`,
//           { reply_markup: { remove_keyboard: true } }
//         );
//       }

//       // Починаємо з першого питання
//       await userService.updateUserStep(tgId, 'Q_e_1');
//       await this.askEveningQuestion(ctx, 1);

//     } catch (error) {
//       console.error('[startEveningSession] Помилка:', error);
//       await ctx.reply('❌ Помилка запуску вечірньої сесії.');
//     }
//   }

//   // Питання ранкової сесії
//   async askMorningQuestion(ctx, questionNumber) {
//     const question = MORNING_QUESTIONS_V2[questionNumber - 1];
//     if (!question) return;

//     let message = `🌞 РАНКОВА РЕФЛЕКСІЯ\n\n${question.id}/6 ${question.text}`;
    
//     if (question.example) {
//       message += `\n\n💡 Приклад: ${question.example}`;
//     }

//     await ctx.reply(message, {
//       reply_markup: {
//         inline_keyboard: [
//           [{ text: '🚪 Вийти із сесії', callback_data: 'exit_morning' }]
//         ]
//       }
//     });
//   }

//   // Питання вечірньої сесії
//   async askEveningQuestion(ctx, questionNumber) {
//     const question = EVENING_QUESTIONS_V2[questionNumber - 1];
//     if (!question) return;

//     let message = `🌙 ВЕЧІРНЯ РЕФЛЕКСІЯ\n\n${question.id}/5 ${question.text}`;
    
//     if (question.example) {
//       message += `\n\n💡 Приклад: ${question.example}`;
//     }

//     await ctx.reply(message, {
//       reply_markup: {
//         inline_keyboard: [
//           [{ text: '🚪 Вийти із сесії', callback_data: 'exit_evening' }]
//         ]
//       }
//     });
//   }

//   // Обробка відповідей на ранкові питання
//   async handleMorningAnswer(ctx, text) {
//     const tgId = ctx.from.id;
//     const user = await userService.getUserByTgId(tgId);
//     const currentStep = user?.Current_Activity;

//     if (!currentStep || !currentStep.startsWith('Q_m_')) {
//       return false;
//     }

//     const questionNumber = parseInt(currentStep.split('_')[2]);
    
//     try {
//       // Зберігаємо відповідь
//       await responseService.saveMorningAnswer(tgId, questionNumber, text);
//       console.log(`🌞 [MORNING] Збережено відповідь ${questionNumber} для ${tgId}`);

//       if (questionNumber < 6) {
//         // Переходимо до наступного питання
//         const nextStep = `Q_m_${questionNumber + 1}`;
//         await userService.updateUserStep(tgId, nextStep);
//         await this.askMorningQuestion(ctx, questionNumber + 1);
//       } else {
//         // Завершуємо ранкову сесію
//         await this.completeMorningSession(ctx);
//       }

//       return true;
//     } catch (error) {
//       console.error('[handleMorningAnswer] Помилка:', error);
//       await ctx.reply('❌ Помилка збереження відповіді. Спробуй ще раз.');
//       return true;
//     }
//   }

//   // Обробка відповідей на вечірні питання
//   async handleEveningAnswer(ctx, text) {
//     const tgId = ctx.from.id;
//     const user = await userService.getUserByTgId(tgId);
//     const currentStep = user?.Current_Activity;

//     if (!currentStep || !currentStep.startsWith('Q_e_')) {
//       return false;
//     }

//     const questionNumber = parseInt(currentStep.split('_')[2]);
    
//     try {
//       // Зберігаємо відповідь
//       await responseService.saveEveningAnswer(tgId, questionNumber, text);
//       console.log(`🌙 [EVENING] Збережено відповідь ${questionNumber} для ${tgId}`);

//       if (questionNumber < 5) {
//         // Переходимо до наступного питання
//         const nextStep = `Q_e_${questionNumber + 1}`;
//         await userService.updateUserStep(tgId, nextStep);
//         await this.askEveningQuestion(ctx, questionNumber + 1);
//       } else {
//         // Завершуємо вечірню сесію
//         await this.completeEveningSession(ctx);
//       }

//       return true;
//     } catch (error) {
//       console.error('[handleEveningAnswer] Помилка:', error);
//       await ctx.reply('❌ Помилка збереження відповіді. Спробуй ще раз.');
//       return true;
//     }
//   }

//   // Завершення ранкової сесії
//   async completeMorningSession(ctx) {
//     const tgId = ctx.from.id;
//     const userName = ctx.from.first_name || 'Користувач';

//     try {
//       await initSchedulerFunctions();
      
//       // Генеруємо персональні мікро-дії на день
//       const microActions = await this.generateDailyMicroActions(tgId, 'morning');
      
//       // Обираємо афірмацію
//       const affirmation = MORNING_AFFIRMATIONS[Math.floor(Math.random() * MORNING_AFFIRMATIONS.length)];
      
//       // Зберігаємо афірмацію
//       await responseService.saveAffirmation(tgId, 'morning', affirmation);
      
//       const message = 
//         `🌞 РАНКОВА РЕФЛЕКСІЯ ЗАВЕРШЕНА!\n\n` +
//         `✨ Дякую, ${userName}! Твої відповіді збережено.\n\n` +
//         `🎯 ТВОЯ АФІРМАЦІЯ НА ДЕНЬ:\n"${affirmation}"\n\n` +
//         `💡 РЕКОМЕНДОВАНІ МІКРО-ДІЇ:\n${microActions}\n\n` +
//         `🚀 Продуктивного дня!`;

//       await ctx.reply(message, { reply_markup: { remove_keyboard: true } });

//       // Оновлюємо стан користувача
//       await userService.updateUserActivity(tgId);
      
//       // Позначаємо сесію як завершену
//       markSessionCompleted(tgId, 'morning');

//       console.log(`✅ [MORNING] Ранкова сесія завершена для ${tgId}`);

//     } catch (error) {
//       console.error('[completeMorningSession] Помилка:', error);
//       await ctx.reply('❌ Помилка завершення сесії.');
//     }
//   }

//   // Завершення вечірньої сесії
//   async completeEveningSession(ctx) {
//     const tgId = ctx.from.id;
//     const userName = ctx.from.first_name || 'Користувач';

//     try {
//       await initSchedulerFunctions();
      
//       // Генеруємо персональний фідбек на день
//       const dailyFeedback = await this.generateDailyFeedback(tgId, 'evening');
      
//       // Обираємо афірмацію
//       const affirmation = EVENING_AFFIRMATIONS[Math.floor(Math.random() * EVENING_AFFIRMATIONS.length)];
      
//       // Зберігаємо афірмацію
//       await responseService.saveAffirmation(tgId, 'evening', affirmation);
      
//       const message = 
//         `🌙 ВЕЧІРНЯ РЕФЛЕКСІЯ ЗАВЕРШЕНА!\n\n` +
//         `✨ Дякую, ${userName}! Твій день проаналізовано.\n\n` +
//         `🎯 ТВОЯ АФІРМАЦІЯ НА НІЧ:\n"${affirmation}"\n\n` +
//         `💡 ФІДБЕК ДНЯ:\n${dailyFeedback}\n\n` +
//         `😴 Солодких снів!`;

//       await ctx.reply(message, { reply_markup: { remove_keyboard: true } });

//       // Оновлюємо стан користувача
//       await userService.updateUserActivity(tgId);
      
//       // Позначаємо сесію як завершену
//       markSessionCompleted(tgId, 'evening');

//       console.log(`✅ [EVENING] Вечірня сесія завершена для ${tgId}`);

//     } catch (error) {
//       console.error('[completeEveningSession] Помилка:', error);
//       await ctx.reply('❌ Помилка завершення сесії.');
//     }
//   }

//   // Генерація мікро-дій на день
//   async generateDailyMicroActions(tgId, sessionType) {
//     try {
//       // Отримуємо відповіді користувача за сьогодні
//       const records = await responseService.getUserRecords(tgId, 1);
//       if (!records.length) return "• Зосередься на головній цілі дня\n• Зроби один крок до мрії\n• Підтримай ресурсний стан";

//       const todayData = records[0].fields;
//       const goal = todayData.Q_m_4 || '';
//       const state = todayData.Q_m_5 || '';
//       const qualities = todayData.Q_m_2 || '';

//       const prompt = `
//       Створи 3 конкретні мікро-дії на сьогодні для користувача:
      
//       Головна ціль дня: "${goal}"
//       Поточний стан: "${state}"  
//       Якості: "${qualities}"
      
//       Формат відповіді (лише текст дій):
//       • [Дія 1 - для просування до цілі]
//       • [Дія 2 - для підтримки стану]
//       • [Дія 3 - для розвитку якостей]
      
//       Кожна дія повинна бути:
//       - Конкретна (що саме робити)
//       - Виконувана за 15-30 хвилин
//       - Мотивуюча
//       `;

//       const response = await chat([
//         { role: 'system', content: 'Ти експертний коуч. Генеруй конкретні мікро-дії для досягнення цілей.' },
//         { role: 'user', content: prompt }
//       ], 'gpt-4o-mini', 200);

//       return response || "• Зроби один крок до головної цілі\n• Підтримай ресурсний стан\n• Розвивай свої сильні якості";

//     } catch (error) {
//       console.error('[generateDailyMicroActions] Помилка:', error);
//       return "• Зосередься на головній цілі дня\n• Зроби один крок до мрії\n• Підтримай ресурсний стан";
//     }
//   }

//   // Генерація вечірнього фідбеку
//   async generateDailyFeedback(tgId, sessionType) {
//     try {
//       // Отримуємо відповіді користувача за сьогодні
//       const records = await responseService.getUserRecords(tgId, 1);
//       if (!records.length) return "Дякую за чесність у відповідях. Кожен день - це крок до кращої версії себе.";

//       const todayData = records[0].fields;
//       const energy = todayData.Q_e_1 || '';
//       const energyLoss = todayData.Q_e_2 || '';
//       const programs = todayData.Q_e_3 || '';
//       const source = todayData.Q_e_4 || '';
//       const victory = todayData.Q_e_5 || '';

//       const prompt = `
//       Проаналізуй день користувача та дай короткий фідбек:
      
//       Що додало енергії: "${energy}"
//       Де втратила енергію: "${energyLoss}"
//       Активні програми: "${programs}"
//       Діяла зі сили чи страху: "${source}"
//       Головна перемога: "${victory}"
      
//       Дай короткий фідбек (2-3 речення) з:
//       - Підкресленням перемоги
//       - Порадою щодо енергії
//       - Мотиваційним закриттям
      
//       Стиль: підтримуючий, конкретний, мотивуючий.
//       `;

//       const response = await chat([
//         { role: 'system', content: 'Ти мудрий коуч. Даєш підтримуючий фідбек з конкретними порадами.' },
//         { role: 'user', content: prompt }
//       ], 'gpt-4o-mini', 200);

//       return response || "Твоя перемога сьогодні - це доказ твоєї сили. Продовжуй рухатись вперед з вірою в себе.";

//     } catch (error) {
//       console.error('[generateDailyFeedback] Помилка:', error);
//       return "Дякую за чесність у відповідях. Кожен день робить тебе сильнішою.";
//     }
//   }

//   // Вихід із сесії
//   async exitSession(ctx, sessionType) {
//     const tgId = ctx.from.id;
    
//     await initSchedulerFunctions();
//     await userService.updateUserActivity(tgId);
//     cancelSessionReminder(tgId);
    
//     const message = sessionType === 'morning' 
//       ? '🌞 Ранкову сесію завершено. Гарного дня!'
//       : '🌙 Вечірню сесію завершено. Солодких снів!';
      
//     await ctx.reply(message, { reply_markup: { remove_keyboard: true } });
    
//     console.log(`🚪 [${sessionType.toUpperCase()}] Користувач ${tgId} вийшов із сесії`);
//   }
// }

// export default new DailyQuestionsController();