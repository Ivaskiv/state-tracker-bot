// src/controllers/botController.js
import userService from '../auth/services/userService.js';
import responseService from '../dialogue/services/responseService.js';
import affirmationService from '../dialogue/services/affirmationService.js';
import { ANSWER_STEPS, QUESTION_TYPES, MORNING_QUESTIONS, EVENING_QUESTIONS, SCHEDULE } from '../config/constants.js';
import keyboards from '../dialogue/utils/keyboards.js';
import { sendReport } from '../services/reportService.js';
import { getUserDateTime } from '../utils/timezoneUtils.js';

const botController = (bot) => {
  // Start command
  bot.start(async (ctx) => {
    const tgId = ctx.from.id;
    const name = ctx.from.first_name || 'Користувач';

    let user = await userService.getUserByTelegramId(tgId);

    if (!user) {
      user = await userService.createUser({
        tgId,
        name,
        email: ctx.from.username ? ctx.from.username + '@telegram.user' : null,
      });
    }

    const welcomeMessage = `Привіт, ${name}! 👋\n\nЯ твій персональний коуч трансформації. Готова допомогти тобі відстежувати щоденний прогрес та досягати цілей! ✨`;
    await ctx.reply(welcomeMessage, keyboards.mainMenuKeyboard());
  });

  // Handle text messages
  bot.on('text', async (ctx) => {
    const tgId = ctx.from.id;
    const text = ctx.message.text?.trim();

    if (!text) return;

    const user = await userService.getUserByTelegramId(tgId);
    if (!user) {
      await ctx.reply('Будь ласка, спочатку натисніть /start', keyboards.mainMenuKeyboard());
      return;
    }

    // Handle question flow
    if (await handleQuestionAnswer(ctx, user, text)) return;

    // Handle menu commands
    await handleMenuCommands(ctx, user, text);
  });

  const handleQuestionAnswer = async (ctx, user, text) => {
    const step = user.Answer_Step;
    if (!step || step === ANSWER_STEPS.COMPLETED) return false;

    const tgId = ctx.from.id;
    const userName = user['User Name'] || 'Користувач';

    try {
      // Morning questions logic
      if (step.startsWith('Q_m_')) {
        const currentTime = getUserDateTime(tgId);
        const currentHour = new Date(currentTime).getHours();
        const eveningHour = parseInt(SCHEDULE.EVENING_TIME.split(':')[0]);
        if (currentHour >= eveningHour) {
          await ctx.reply('Ранкові питання недоступні після 20:00. Спробуй вечірні питання або зачекай до завтра.', keyboards.mainMenuKeyboard());
          await userService.updateUserStep(tgId, ANSWER_STEPS.EVENING_PENDING);
          return true;
        }

        const questionNum = parseInt(step.split('_')[2]);
        const fieldName = `Q_m_${questionNum}`;

        await responseService.createOrUpdateResponse(
          tgId,
          userName,
          QUESTION_TYPES.MORNING,
          step,
          questionNum,
          text,
          fieldName
        );

        if (questionNum < 6) {
          const nextStep = `Q_m_${questionNum + 1}`;
          await userService.updateUserStep(tgId, nextStep);
          await ctx.reply(`${questionNum + 1}️⃣/6 ${MORNING_QUESTIONS[questionNum]}`);
        } else {
          const affirmation = await affirmationService.getAffirmationAndMarkUsed('morning');
          await responseService.createOrUpdateResponse(
            tgId,
            userName,
            QUESTION_TYPES.MORNING,
            ANSWER_STEPS.AFFIRMATION_MORNING,
            0,
            affirmation,
            'affirmation_m',
            true
          );
          await userService.updateUserStep(tgId, ANSWER_STEPS.END_MORNING);
          await ctx.reply(`✅ Ранкові питання завершено!\n\n💎 ${affirmation}`, keyboards.mainMenuKeyboard());
        }
        return true;
      }

      // Evening questions logic
      if (step.startsWith('Q_e_')) {
        const questionNum = parseInt(step.split('_')[2]);
        const fieldName = `Q_e_${questionNum}`;

        await responseService.createOrUpdateResponse(
          tgId,
          userName,
          QUESTION_TYPES.EVENING,
          step,
          questionNum,
          text,
          fieldName
        );

        if (questionNum < 5) {
          const nextStep = `Q_e_${questionNum + 1}`;
          await userService.updateUserStep(tgId, nextStep);
          await ctx.reply(`${questionNum + 1}️⃣/5 ${EVENING_QUESTIONS[questionNum]}`);
        } else {
          const affirmation = await affirmationService.getAffirmationAndMarkUsed('evening');
          await responseService.createOrUpdateResponse(
            tgId,
            userName,
            QUESTION_TYPES.EVENING,
            ANSWER_STEPS.AFFIRMATION_EVENING,
            0,
            affirmation,
            'affirmation_e',
            true
          );
          await userService.updateUserStep(tgId, ANSWER_STEPS.END_EVENING);
          await ctx.reply(`✅ Вечірні питання завершено!\n\n💎 ${affirmation}`, keyboards.mainMenuKeyboard());
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error('[handleQuestionAnswer] Error:', error);
      await ctx.reply('Виникла помилка. Спробуйте ще раз.', keyboards.mainMenuKeyboard());
      return true;
    }
  };

  const handleMenuCommands = async (ctx, user, text) => {
    const isActiveSubscription = user['Active_Subscription_Status']?.includes('✅ Активна');
    const currentTime = getUserDateTime(ctx.from.id);
    const currentHour = new Date(currentTime).getHours();
    const eveningHour = parseInt(SCHEDULE.EVENING_TIME.split(':')[0]);

    switch (text) {
      case '🌅 Ранкові питання':
        if (currentHour >= eveningHour) {
          await ctx.reply('Ранкові питання недоступні після 20:00. Спробуй вечірні питання або зачекай до завтра.', keyboards.mainMenuKeyboard());
          return;
        }
        await startMorningQuestions(ctx, user);
        break;

      case '🌙 Вечірні питання':
        await startEveningQuestions(ctx, user);
        break;

      case '💎 Афірмація':
        const affirmation = await affirmationService.getAffirmationAndMarkUsed('morning');
        await ctx.reply(`✨ ${affirmation}`);
        break;

      case '📈 Щотижневий звіт':
        if (!isActiveSubscription) {
          await ctx.reply('📊 Ця функція доступна тільки з активною підпискою');
          return;
        }
        await sendReport(bot, ctx.from.id, 'weekly');
        break;

      case '📈 Щомісячний звіт':
        if (!isActiveSubscription) {
          await ctx.reply('📊 Ця функція доступна тільки з активною підпискою');
          return;
        }
        await sendReport(bot, ctx.from.id, 'monthly');
        break;

      case '💰 Підписка':
        await showSubscriptionInfo(ctx, user);
        break;

      case '📊 Мій прогрес':
      case '📊 Мій прогрес':
        await showUserProgress(ctx, user);
        break;

      case '❓ Допомога':
        const helpText = `❓ ДОПОМОГА ТА КОНТАКТИ\n\nЯкщо виникли питання — пишіть на nadyastarway@gmail.com\nАбо перегляньте інструкції у головному меню.`;
        await ctx.reply(helpText, keyboards.mainMenuKeyboard());
        break;

      case '📞 Зв\'язок з нами':
        const contactText = `📞 ЗВ'ЯЗОК З НАМИ\n\n💬 **ТЕХНІЧНА ПІДТРИМКА:**\nEmail: nadyastarway@gmail.com\nTelegram: @Nadya2316 (ментор)\nTelegram: @vira_333 (техпідтримка)\n\n📊 **ПИТАННЯ ПРО МАРАФОН:**\nПишіть ментору.\n\n⏰ **ЧАС ВІДПОВІДІ:**\nПротягом 24 годин.\n\n🎯 **ПЕРСОНАЛЬНА КОНСУЛЬТАЦІЯ:**\nEmail з темою "Персональна консультація".`;
        await ctx.reply(contactText, keyboards.supportKeyboard());
        break;

      case '📊 Інструкції':
      case '📝 Інструкції':
        const instructionsText = `📝 ЯК КОРИСТУВАТИСЯ БОТОМ\n\n🚀 **ПОЧАТОК:**\n• /start для реєстрації\n• Перевір підписку: "💰 Підписка"\n\n📊 **ЩОДЕННІ ЗВІТИ:**\n• "📈 Щотижневий звіт" — AI-аналіз за тиждень\n• "📈 Щомісячний звіт" — глибокий аналіз за місяць\n• "💎 Афірмація" — щоденна мотивація\n• "📊 Мій прогрес" — статистика\n\n⏰ **АВТОМАТИЧНІ ПИТАННЯ:**\n• ${SCHEDULE.MORNING_TIME} — ранкові питання (6 запитань)\n• ${SCHEDULE.EVENING_TIME} — вечірні питання (5 запитань)\n\n💡 **ПОРАДИ:**\n• Відповідай щиро на автоматичні питання\n• Переглядай звіти для усвідомлення прогресу\n• Пиши в "📞 Зв'язок з нами" при проблемах`;
        await ctx.reply(instructionsText, keyboards.mainMenuKeyboard());
        break;

      default:
        await ctx.reply('Оберіть опцію з меню:', keyboards.mainMenuKeyboard());
    }
  };

  const startMorningQuestions = async (ctx, user) => {
    const tgId = ctx.from.id;
    const currentTime = getUserDateTime(tgId);
    const currentHour = new Date(currentTime).getHours();
    const eveningHour = parseInt(SCHEDULE.EVENING_TIME.split(':')[0]);

    if (currentHour >= eveningHour) {
      await ctx.reply('Ранкові питання недоступні після 20:00. Спробуй вечірні питання або зачекай до завтра.', keyboards.mainMenuKeyboard());
      return;
    }

    const isMorningCompleted = await responseService.isSessionCompleted(tgId, QUESTION_TYPES.MORNING);
    if (isMorningCompleted) {
      await ctx.reply('Ти вже завершив(ла) ранкові питання за сьогодні. Хочеш оновити відповіді?', {
        reply_markup: {
          inline_keyboard: [[{ text: 'Так, оновити', callback_data: 'restart_morning' }]],
        },
      });
      return;
    }
    await userService.updateUserStep(tgId, ANSWER_STEPS.MORNING_1);
    await ctx.reply(`🌞 Ранкова рефлексія\n\n1️⃣/6 ${MORNING_QUESTIONS[0]}`);
  };

  const startEveningQuestions = async (ctx, user) => {
    const tgId = ctx.from.id;
    const isEveningCompleted = await responseService.isSessionCompleted(tgId, QUESTION_TYPES.EVENING);
    if (isEveningCompleted) {
      await ctx.reply('Ти вже завершив(ла) вечірні питання за сьогодні. Хочеш оновити відповіді?', {
        reply_markup: {
          inline_keyboard: [[{ text: 'Так, оновити', callback_data: 'restart_evening' }]],
        },
      });
      return;
    }
    await userService.updateUserStep(tgId, ANSWER_STEPS.EVENING_1);
    await ctx.reply(`🌙 Вечірня рефлексія\n\n1️⃣/5 ${EVENING_QUESTIONS[0]}`);
  };

  // Handle callback queries for restart
  bot.on('callback_query', async (ctx) => {
    const tgId = ctx.from.id;
    const data = ctx.callbackQuery.data;

    if (data === 'restart_morning') {
      const currentTime = getUserDateTime(tgId);
      const currentHour = new Date(currentTime).getHours();
      const eveningHour = parseInt(SCHEDULE.EVENING_TIME.split(':')[0]);
      if (currentHour >= eveningHour) {
        await ctx.reply('Ранкові питання недоступні після 20:00. Спробуй вечірні питання або зачекай до завтра.', keyboards.mainMenuKeyboard());
        await ctx.answerCbQuery();
        return;
      }
      await userService.updateUserStep(tgId, ANSWER_STEPS.MORNING_1);
      await ctx.reply(`🌞 Ранкова рефлексія\n\n1️⃣/6 ${MORNING_QUESTIONS[0]}`);
      await ctx.answerCbQuery();
    } else if (data === 'restart_evening') {
      await userService.updateUserStep(tgId, ANSWER_STEPS.EVENING_1);
      await ctx.reply(`🌙 Вечірня рефлексія\n\n1️⃣/5 ${EVENING_QUESTIONS[0]}`);
      await ctx.answerCbQuery();
    }
  });

  const showUserProgress = async (ctx, user) => {
    if (!user) {
      await ctx.reply('Спочатку зареєструйтесь /start');
      return;
    }

    try {
      const tgId = ctx.from.id;
      const records = await responseService.getUserRecords(tgId, 30);
      const totalDays = records.length;
      let morningCompleted = 0;
      let eveningCompleted = 0;

      records.forEach(({ fields = {} }) => {
        const morning = fields.affirmation_m || fields.Q_m_1 || fields.Q_m_2 || fields.Q_m_3 || fields.Q_m_4 || fields.Q_m_5 || fields.Q_m_6;
        const evening = fields.affirmation_e || fields.Q_e_1 || fields.Q_e_2 || fields.Q_e_3 || fields.Q_e_4 || fields.Q_e_5;
        if (morning) morningCompleted++;
        if (evening) eveningCompleted++;
      });

      const progressText = `📊 ВАШ ПРОГРЕС (за 30 днів):\n\n📝 Всього днів: ${totalDays}\n🌅 Ранкові: ${morningCompleted}\n🌙 Вечірні: ${eveningCompleted}\n\n💡 Для детального аналізу використовуй кнопки "📈 Щотижневий звіт" і "📈 Щомісячний звіт"`;
      await ctx.reply(progressText, keyboards.mainMenuKeyboard());
    } catch (error) {
      console.error('[showUserProgress] Error:', error);
      await ctx.reply('📊 Прогрес тимчасово недоступний', keyboards.mainMenuKeyboard());
    }
  };

  const showSubscriptionInfo = async (ctx, user) => {
    const status = user['Active_Subscription_Status'] || '❌ Неактивна';
    const plan = user['Active Subscription Plan'] || 'Базовий';

    await ctx.reply(
      `💰 Твоя підписка:\n\n📊 План: ${plan}\n📅 Статус: ${status}\n\n💎 Активна підписка дає доступ до:\n• Щотижневих AI-звітів\n• Щомісячних AI-звітів\n• Персоналізованих рекомендацій`,
      keyboards.mainMenuKeyboard()
    );
  };
};

export default botController;