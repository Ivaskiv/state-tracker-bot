// src/controllers/botController.js
import userService from '../auth/services/userService.js';
import responseService from '../dialogue/services/responseService.js';
import affirmationService from '../dialogue/services/affirmationService.js';
import subscriptionReminderService from '../services/subscriptionReminderService.js';
import { schedulePendingReminders, clearUserReminders } from '../middleware/pendingFlow.js';
import { refreshMenuIfDev } from '../utils/refreshMenu.js';
import typing from '../utils/typing.js';
import { aiMentorSession } from '../aiMentor/session.js';
import { globalTypingMiddleware } from '../middleware/typingMiddleware.js';
import { 
  ANSWER_STEPS, 
  QUESTION_TYPES, 
  MORNING_QUESTIONS, 
  EVENING_QUESTIONS, 
  SCHEDULE,
  SUBSCRIPTION_PLANS,
  MENU_TEXTS,
  MENU_MATCHERS,
  LIFE_SPHERES
} from '../config/constants.js';
import keyboards from '../utils/keyboards.js';
import { sendReport } from '../services/reportService.js';
import { getUserDateTime } from '../utils/timezoneUtils.js';
import wheelBalanceController from './wheelBalanceController.js';
import wheelBalanceService from '../services/wheelBalanceService.js';
import { isActiveSubscription, restrictAccessMessage } from '../utils/subscriptionUtils.js';
import { handleError } from '../utils/errorHandler.js';
import { completeSession } from '../utils/sessionUtils.js';
import logger from '../utils/logger.js';
import aiMentorController from '../aiMentor/controllers.js/aiMentorController.js';

const WHEEL_STEP = 'WheelBalance';

const botController = (bot) => {
  logger.info('[botController] Initializing bot controller...');

  bot.use(globalTypingMiddleware());

  bot.start(async (ctx) => {
    const tgId = ctx.from.id;
    const name = ctx.from.first_name || 'Користувач';
    
    try {
      let user = await userService.getUserByTelegramId(tgId);
      
      if (!user) {
        user = await userService.createUser({
          tgId,
          name,
          email: ctx.from.username ? `${ctx.from.username}@telegram.user` : null,
        });
        
        const welcomeMessage = `🌟 Вітаю в aiMentor, ${name}!\n\nЯ твій персональний коуч трансформації. Готова допомогти тобі відстежувати щоденний прогрес та досягати цілей! ✨\n\n🎯 Для початку пропоную заповнити твоє колесо балансу — це допоможе оцінити всі сфери життя і створити план розвитку.`;
        
        await ctx.reply(welcomeMessage);
        await wheelBalanceController.handleWheelBalanceRequest(ctx);
        return;
      }
      
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      clearUserReminders(tgId);
      
      const isActive = isActiveSubscription(user);
      const welcomeMessage = isActive 
        ? `Привіт знову, ${name}! 👋\n\nГотова продовжити свою трансформацію? ✨`
        : `Привіт, ${name}! 👋\n\nДля користування aiMentor потрібна активна підписка.`;
        
      await ctx.reply(welcomeMessage, keyboards.mainMenuKeyboard());
      
    } catch (error) {
      await handleError(ctx, error);
    }
  });

  bot.command('menu', async (ctx) => {
    const tgId = ctx.from.id;
    
    try {
      logger.info(`[/menu] Оновлення меню для ${tgId}`);
      
      const user = await userService.getUserByTelegramId(tgId);
      if (!user) {
        await ctx.reply('Будь ласка, спочатку натисніть /start');
        return;
      }
      
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      clearUserReminders(tgId);
      
      await refreshMenuIfDev(ctx);
      
      if (process.env.NODE_ENV === 'production') {
        await ctx.reply('🔄 Меню оновлено!', keyboards.mainMenuKeyboard());
      }
      
    } catch (error) {
      await handleError(ctx, error, 'Виникла помилка при оновленні меню');
    }
  });

  bot.on('text', async (ctx) => {
    const tgId = ctx.from.id;
    const rawText = ctx.message.text?.trim();
    if (!rawText) return;

    // Нормалізація тексту для уникнення проблем з емодзі чи пробілами
    const text = rawText.replace(/\s+/g, ' ').trim();

    try {
      logger.info(`=== ДІАГНОСТИКА TEXT HANDLER ===`);
      logger.info(`👤 Користувач: ${tgId}`);
      logger.info(`💬 Текст: "${text}"`);

      const user = await userService.getUserByTelegramId(tgId);
      if (!user) {
        logger.info(`❌ Користувача ${tgId} не знайдено`);
        await ctx.reply('Будь ласка, спочатку натисніть /start', keyboards.mainMenuKeyboard());
        return;
      }

      logger.info(`📋 Answer_Step: "${user.Answer_Step || 'undefined'}"`);
      const isActiveMorning = user.Answer_Step && (user.Answer_Step.startsWith('Q_m_') || user.Answer_Step === ANSWER_STEPS.MORNING_PENDING);
      const isActiveEvening = user.Answer_Step && (user.Answer_Step.startsWith('Q_e_') || user.Answer_Step === ANSWER_STEPS.EVENING_PENDING);
      const isActiveAI = aiMentorSession.isActive(tgId);
      const isActiveWheel = user.Answer_Step === WHEEL_STEP;

      logger.info(`🎯 AI_MENTOR_WAITING: "${isActiveAI ? 'true' : 'undefined'}"`);
      logger.info(`✅ Збігається: ${isActiveMorning || isActiveEvening || isActiveAI || isActiveWheel}`);

      if (isActiveWheel) {
        const result = await wheelBalanceService.processWheelAnswer(tgId, text);
        if (result?.error && result.message.includes('введи число від 1 до 10')) {
          const activeWheel = await wheelBalanceService.getActiveWheel(tgId);
          if (activeWheel) {
            const currentSphere = Number.isInteger(activeWheel.fields.Step) ? activeWheel.fields.Step : 0;
            const sphereName = LIFE_SPHERES[currentSphere] || LIFE_SPHERES[0];
            await ctx.reply(
              `❌ ${result.message}\n\n${currentSphere + 1}️⃣/8 ${sphereName}\n\nОцінка (1-10):`
            );
            return;
          }
        }
        await wheelBalanceController.handleWheelBalanceAnswer(ctx, text);
        return;
      }

      if (isActiveAI) {
        if (text === '🔚 Вийти з AI' || text.toLowerCase().includes('вихід') || text.toLowerCase().includes('exit')) {
          aiMentorSession.end(tgId);
          await completeSession(tgId, ctx, '👋 Дякую за спілкування! Повертаємося до головного меню.');
          return;
        }
        
        await aiMentorController.handleAIMentorQuestion(ctx, text);
        return;
      }

      if (isActiveMorning || isActiveEvening) {
        if (text === '🔄 Продовжити відповіді' || text === '⏭️ Пропустити') {
          return;
        }
        
        const menuCommands = [
          '💎 Афірмація', '📈 Щотижневий звіт', '📈 Щомісячний звіт', 
          '🤖 AI наставник', '🎯 Колесо балансу', '💰 Підписка',
          '📊 Мій прогрес', '❓ Допомога', '📞 Зв\'язок з нами',
          '📝 Інструкції', 'ℹ️ Профіль'
        ];
        
        if (menuCommands.includes(text)) {
          logger.info(`🚫 [BLOCK] Блокуємо команду "${text}" при активній сесії`);
          
          let sessionType = isActiveMorning ? 'ранкові питання' : 'вечірні питання';
          await ctx.reply(
            `🔒 Спочатку заверши ${sessionType} або пропусти сесію.\n\n📝 У тебе незавершена сесія відповідей.`,
            keyboards.continueAnswersKeyboard()
          );
          return;
        }
        
        await handleQuestionAnswer(ctx, user, text);
        return;
      }

      if (user.Answer_Step === ANSWER_STEPS.PLAN_SELECTION) {
        await ctx.reply(MENU_TEXTS.SELECT_MENU, keyboards.mainMenuKeyboard());
        return;
      }

      logger.info(`📋 [MENU] Обробка команди: "${text}"`);
      await handleMenuCommands(ctx, user, text);
      
    } catch (error) {
      await handleError(ctx, error);
    }
  });

  const handleQuestionAnswer = async (ctx, user, text, step) => {
    if (!step || step === ANSWER_STEPS.COMPLETED) return false;
    
    const tgId = ctx.from.id;
    const userName = user['User Name'] || 'Користувач';

    try {
      if (step.startsWith('Q_m_')) {
        return await processMorningQuestions(ctx, user, text, step, tgId, userName);
      }

      if (step.startsWith('Q_e_')) {
        return await processEveningQuestions(ctx, user, text, step, tgId, userName);
      }

      return false;
    } catch (error) {
      await handleError(ctx, error);
      return true;
    }
  };

  const processMorningQuestions = async (ctx, user, text, step, tgId, userName) => {
    const currentTime = getUserDateTime(tgId);
    const currentHour = new Date(currentTime).getHours();
    const eveningHour = SCHEDULE.EVENING_HOUR;
    
    if (currentHour >= eveningHour) {
      await ctx.reply('Ранкові питання недоступні після 20:00. Спробуй вечірні питання або зачекай до завтра.', keyboards.mainMenuKeyboard());
      await userService.updateUserStep(tgId, ANSWER_STEPS.EVENING_PENDING);
      return true;
    }

    const questionNum = parseInt(step.split('_')[2]);
    const fieldName = `Q_m_${questionNum}`;
    
    await responseService.createOrUpdateResponse(
      tgId, userName, QUESTION_TYPES.MORNING, step, questionNum, text, fieldName
    );

    clearUserReminders(tgId);

    if (questionNum < 6) {
      const nextStep = `Q_m_${questionNum + 1}`;
      await userService.updateUserStep(tgId, nextStep);
      await ctx.reply(`${questionNum + 1}️⃣/6 ${MORNING_QUESTIONS[questionNum]}`);
    } else {
      await completeSessionWithAffirmation(ctx, tgId, userName, QUESTION_TYPES.MORNING, 'morning');
    }
    return true;
  };

  const processEveningQuestions = async (ctx, user, text, step, tgId, userName) => {
    const questionNum = parseInt(step.split('_')[2]);
    const fieldName = `Q_e_${questionNum}`;
    
    await responseService.createOrUpdateResponse(
      tgId, userName, QUESTION_TYPES.EVENING, step, questionNum, text, fieldName
    );

    clearUserReminders(tgId);

    if (questionNum < 5) {
      const nextStep = `Q_e_${questionNum + 1}`;
      await userService.updateUserStep(tgId, nextStep);
      await ctx.reply(`${questionNum + 1}️⃣/5 ${EVENING_QUESTIONS[questionNum]}`);
    } else {
      await completeSessionWithAffirmation(ctx, tgId, userName, QUESTION_TYPES.EVENING, 'evening');
    }
    return true;
  };

  const completeSessionWithAffirmation = async (ctx, tgId, userName, questionType, sessionType) => {
    const affirmation = await affirmationService.getAffirmationAndMarkUsed(sessionType);
    const affirmationField = questionType === QUESTION_TYPES.MORNING ? 'affirmation_m' : 'affirmation_e';
    const affirmationStep = questionType === QUESTION_TYPES.MORNING ? ANSWER_STEPS.AFFIRMATION_MORNING : ANSWER_STEPS.AFFIRMATION_EVENING;
    
    await responseService.createOrUpdateResponse(
      tgId, userName, questionType, affirmationStep, 0, affirmation, affirmationField, true
    );
    
    const sessionName = questionType === QUESTION_TYPES.MORNING ? 'Ранкові' : 'Вечірні';
    await completeSession(tgId, ctx, `✅ ${sessionName} питання завершено!\n\n💎 ${affirmation}`);
  };

  const menuHandlers = {
    [MENU_MATCHERS.AI_MENTOR]: async (ctx, user) => {
      logger.info(`🤖 [AI НАСТАВНИК] Активація для ${ctx.from.id}`);
      if (!isActiveSubscription(user)) {
        return await restrictAccessMessage('🤖 AI-наставник', ctx);
      }
      await aiMentorController.handleAIMentorRequest(ctx);
    },
    '🎯 Колесо балансу': async (ctx, user) => {
      logger.info(`🎯 [КОЛЕСО БАЛАНСУ] ========== ПОЧАТОК ЗАПИТУ ==========`);
      logger.info(`🎯 [КОЛЕСО БАЛАНСУ] Користувач: ${ctx.from.id}`);
      logger.info(`🎯 [КОЛЕСО БАЛАНСУ] Ім'я: ${ctx.from.first_name}`);
      
      if (!isActiveSubscription(user)) {
        logger.info(`❌ [КОЛЕСО БАЛАНСУ] Доступ заборонено - немає підписки`);
        return await restrictAccessMessage('🎯 Колесо балансу', ctx);
      }
      
      await userService.updateUserStep(ctx.from.id, WHEEL_STEP);
      logger.info(`✅ [КОЛЕСО БАЛАНСУ] Встановлено Answer_Step: ${WHEEL_STEP}`);
      
      try {
        await wheelBalanceController.handleWheelBalanceRequest(ctx);
        logger.info(`✅ [КОЛЕСО БАЛАНСУ] Успішно викликано handleWheelBalanceRequest`);
      } catch (controllerError) {
        logger.error(`❌ [КОЛЕСО БАЛАНСУ] Помилка в контролері:`, controllerError);
        await ctx.reply('❌ Помилка запуску колеса балансу. Спробуйте пізніше.', keyboards.mainMenuKeyboard());
      }
    },
    '🌅 Ранкові питання': async (ctx, user) => {
      const currentTime = getUserDateTime(ctx.from.id);
      const currentHour = new Date(currentTime).getHours();
      const eveningHour = SCHEDULE.EVENING_HOUR;
      if (currentHour >= eveningHour) {
        return await ctx.reply('Ранкові питання недоступні після 20:00. Спробуй вечірні питання або зачекай до завтра.', keyboards.mainMenuKeyboard());
      }
      await startMorningQuestions(ctx, user);
    },
    '🌙 Вечірні питання': async (ctx, user) => {
      await startEveningQuestions(ctx, user);
    },
    [MENU_MATCHERS.AFFIRM]: async (ctx, user) => {
      const affirmation = await affirmationService.getAffirmationAndMarkUsed('morning');
      await ctx.reply(`✨ ${affirmation}`, keyboards.mainMenuKeyboard());
      await refreshMenuIfDev(ctx);
    },
    [MENU_MATCHERS.WEEKLY]: async (ctx, user) => {
      if (!isActiveSubscription(user)) {
        return await restrictAccessMessage('📋 Щотижневий звіт', ctx);
      }
      await sendReport(bot, ctx.from.id, 'weekly');
      await refreshMenuIfDev(ctx);
    },
    [MENU_MATCHERS.MONTHLY]: async (ctx, user) => {
      if (!isActiveSubscription(user)) {
        return await restrictAccessMessage('📋 Щомісячний звіт', ctx);
      }
      await sendReport(bot, ctx.from.id, 'monthly');
      await refreshMenuIfDev(ctx);
    },
    [MENU_MATCHERS.SUBSCRIPTION]: async (ctx, user) => {
      await showSubscriptionInfo(ctx, user);
      await refreshMenuIfDev(ctx);
    },
    [MENU_MATCHERS.PROGRESS]: async (ctx, user) => {
      await showUserProgress(ctx, user);
      await refreshMenuIfDev(ctx);
    },
    [MENU_MATCHERS.HELP]: async (ctx, user) => {
      await ctx.reply(MENU_TEXTS.HELP, keyboards.mainMenuKeyboard());
      await refreshMenuIfDev(ctx);
    },
    [MENU_MATCHERS.CONTACT]: async (ctx, user) => {
      await ctx.reply(MENU_TEXTS.CONTACT, keyboards.supportKeyboard());
    },
    [MENU_MATCHERS.INSTRUCTIONS]: async (ctx, user) => {
      await ctx.reply(MENU_TEXTS.INSTRUCTIONS, keyboards.mainMenuKeyboard());
      await refreshMenuIfDev(ctx);
    },
    [MENU_MATCHERS.PROFILE]: async (ctx, user) => {
      await showUserProfile(ctx, user);
      await refreshMenuIfDev(ctx);
    }
  };

  const handleMenuCommands = async (ctx, user, text) => {
    // Додаткове логування ключів для діагностики
    const availableCommands = Object.keys(menuHandlers).filter(key => typeof key === 'string');
    logger.info(`📋 [MENU] Доступні команди:`, availableCommands);
    logger.info(`📋 [MENU] Вхідний текст: "${text}"`);

    // Пошук ключа з нормалізацією
    const handlerKey = Object.keys(menuHandlers).find(key => 
      typeof key === 'function' 
        ? key(text.replace(/\s+/g, ' ').trim()) 
        : key.replace(/\s+/g, ' ').trim() === text
    );

    if (handlerKey) {
      logger.info(`✅ [MENU] Знайдено обробник для: "${handlerKey}"`);
      await menuHandlers[handlerKey](ctx, user);
    } else {
      logger.info(`❓ [MENU] Невідома команда: "${text}"`);
      await ctx.reply(MENU_TEXTS.SELECT_MENU, keyboards.mainMenuKeyboard());
      await refreshMenuIfDev(ctx);
    }
  };

  const startMorningQuestions = async (ctx, user) => {
    const tgId = ctx.from.id;
    const currentTime = getUserDateTime(tgId);
    const currentHour = new Date(currentTime).getHours();
    const eveningHour = SCHEDULE.EVENING_HOUR;

    if (currentHour >= eveningHour) {
      await ctx.reply('Ранкові питання недоступні після 20:00. Спробуй вечірні питання або зачекай до завтра.', keyboards.mainMenuKeyboard());
      return;
    }

    const isMorningCompleted = await responseService.isSessionCompleted(tgId, QUESTION_TYPES.MORNING);
    if (isMorningCompleted) {
      await ctx.reply('Ти вже завершив(ла) ранкові питання за сьогодні. Хочеш оновити відповіді?', {
        reply_markup: { inline_keyboard: [[{ text: 'Так, оновити', callback_data: 'restart_morning' }]] },
      });
      return;
    }

    await userService.updateUserStep(tgId, ANSWER_STEPS.MORNING_1);
    await ctx.reply(`🌞 Ранкова рефлексія\n\n1️⃣/6 ${MORNING_QUESTIONS[0]}`);
    schedulePendingReminders(bot, tgId, 'Morning');
  };

  const startEveningQuestions = async (ctx, user) => {
    const tgId = ctx.from.id;
    const isEveningCompleted = await responseService.isSessionCompleted(tgId, QUESTION_TYPES.EVENING);
    
    if (isEveningCompleted) {
      await ctx.reply('Ти вже завершив(ла) вечірні питання за сьогодні. Хочеш оновити відповіді?', {
        reply_markup: { inline_keyboard: [[{ text: 'Так, оновити', callback_data: 'restart_evening' }]] },
      });
      return;
    }

    await userService.updateUserStep(tgId, ANSWER_STEPS.EVENING_1);
    await ctx.reply(`🌙 Вечірня рефлексія\n\n1️⃣/5 ${EVENING_QUESTIONS[0]}`);
    schedulePendingReminders(bot, tgId, 'Evening');
  };

  bot.on('callback_query', async (ctx) => {
    const tgId = ctx.from.id;
    const data = ctx.callbackQuery.data;

    try {
      logger.info(`📱 [CALLBACK] ${data} від ${tgId}`);

      if (data === 'continue_answers') {
        const user = await userService.getUserByTelegramId(tgId);
        if (!user) {
          await ctx.answerCbQuery('Користувача не знайдено');
          return;
        }
        await handleContinueAnswers(ctx, user);
        return;
      }
      
      if (data === 'skip_session') {
        await handleSkipSession(ctx, tgId);
        return;
      }

      if (data === 'ai_continue' || data === 'ai_exit') {
        logger.info(`🤖 [CALLBACK] AI-наставник: ${data}`);
        await aiMentorController.handleAIMentorCallback(ctx);
        return;
      }

      if (data.startsWith('renew_') || data === 'contact_support') {
        await subscriptionReminderService.handleRenewalCallback(ctx);
        return;
      }

      if (data.startsWith('subscribe_')) {
        await handleSubscriptionCallback(ctx, data, tgId);
        return;
      }

      if (data === 'restart_morning' || data === 'restart_evening') {
        await handleRestartCallback(ctx, data, tgId);
        return;
      }

      if (data === 'main_menu') {
        await ctx.reply(MENU_TEXTS.SELECT_MENU, keyboards.mainMenuKeyboard());
        await ctx.answerCbQuery();
      }
      
    } catch (error) {
      await handleError(ctx, error);
      await ctx.answerCbQuery();
    }
  });

  const handleContinueAnswers = async (ctx, user) => {
    const step = user.Answer_Step;
    
    if (step === WHEEL_STEP) {
      const activeWheel = await wheelBalanceService.getActiveWheel(user.TG_id);
      if (activeWheel) {
        const currentSphere = Number.isInteger(activeWheel.fields.Step) ? activeWheel.fields.Step : 0;
        const sphereName = LIFE_SPHERES[currentSphere] || LIFE_SPHERES[0];
        
        await typing(ctx);
        await ctx.reply(`🎯 КОЛЕСО БАЛАНСУ\n\n${currentSphere + 1}️⃣/8 ${sphereName}\n\nОцінка (1-10):`);
        await ctx.answerCbQuery('Продовжуємо колесо балансу');
      } else {
        await completeSession(user.TG_id, ctx, 'Колесо балансу завершено!');
        await ctx.answerCbQuery('Готово');
      }
      return;
    }
    
    const currentQuestion = getCurrentQuestion(step);
    if (currentQuestion && !currentQuestion.includes('🎯 Колесо балансу')) {
      await typing(ctx);
      await ctx.reply(currentQuestion);
      await ctx.answerCbQuery('Продовжуємо відповіді');
    } else {
      await completeSession(user.TG_id, ctx, 'Питання завершені!');
      await ctx.answerCbQuery('Готово');
    }
  };

  const handleSkipSession = async (ctx, tgId) => {
    if (aiMentorSession.isActive(tgId)) {
      aiMentorSession.end(tgId);
    }
    await completeSession(tgId, ctx, '✅ Сесію пропущено. Тепер всі кнопки меню доступні!');
    await ctx.answerCbQuery('Сесію пропущено');
    logger.info(`✅ [SKIP] Сесію пропущено для ${tgId}, всі функції розблоковано`);
  };

  const getCurrentQuestion = (step) => {
    if (step.startsWith('Q_m_')) {
      const questionNum = parseInt(step.split('_')[2]) - 1;
      return `${questionNum + 1}️⃣/6 ${MORNING_QUESTIONS[questionNum]}`;
    }
    
    if (step.startsWith('Q_e_')) {
      const questionNum = parseInt(step.split('_')[2]) - 1;
      return `${questionNum + 1}️⃣/5 ${EVENING_QUESTIONS[questionNum]}`;
    }
    
    if (step === WHEEL_STEP) {
      return '🎯 Колесо балансу в процесі...';
    }
    
    return null;
  };

  const handleSubscriptionCallback = async (ctx, data, tgId) => {
    const planKey = data.replace('subscribe_', '').toUpperCase();
    const planInfo = SUBSCRIPTION_PLANS[planKey];
    
    if (!planInfo) {
      await ctx.answerCbQuery('Невірний план');
      return;
    }

    const paymentUrl = generatePaymentUrl(tgId, planKey, planInfo);
    
    await ctx.reply(
      `💳 ОБРАНИЙ ПЛАН\n\n📋 ${planInfo.name}\n💰 Вартість: ${planInfo.price}€\n⏰ Тривалість: ${planInfo.duration} днів\n📝 ${planInfo.description}\n\n🔗 Посилання для оплати:\n${paymentUrl}\n\n✅ Після оплати всі функції aiMentor будуть доступні!`,
      keyboards.mainMenuKeyboard()
    );
    
    await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
    await ctx.answerCbQuery(`Обрано: ${planInfo.name}`);
  };

  const handleRestartCallback = async (ctx, data, tgId) => {
    if (data === 'restart_morning') {
      const currentTime = getUserDateTime(tgId);
      const currentHour = new Date(currentTime).getHours();
      const eveningHour = SCHEDULE.EVENING_HOUR;
      
      if (currentHour >= eveningHour) {
        await ctx.reply('Ранкові питання недоступні після 20:00. Спробуй вечірні питання або зачекай до завтра.', keyboards.mainMenuKeyboard());
        await ctx.answerCbQuery();
        return;
      }
      
      await userService.updateUserStep(tgId, ANSWER_STEPS.MORNING_1);
      await ctx.reply(`🌞 Ранкова рефлексія\n\n1️⃣/6 ${MORNING_QUESTIONS[0]}`);
      schedulePendingReminders(bot, tgId, 'Morning');
      
    } else if (data === 'restart_evening') {
      await userService.updateUserStep(tgId, ANSWER_STEPS.EVENING_1);
      await ctx.reply(`🌙 Вечірня рефлексія\n\n1️⃣/5 ${EVENING_QUESTIONS[0]}`);
      schedulePendingReminders(bot, tgId, 'Evening');
    }
    
    await ctx.answerCbQuery();
  };

  const showUserProgress = async (ctx, user) => {
    if (!user) {
      await ctx.reply(MENU_TEXTS.REGISTER_FIRST, keyboards.mainMenuKeyboard());
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

      const progressText = MENU_TEXTS.PROGRESS(totalDays, morningCompleted, eveningCompleted);
      await ctx.reply(progressText, keyboards.mainMenuKeyboard());
      
    } catch (error) {
      await handleError(ctx, error, MENU_TEXTS.PROGRESS_UNAVAILABLE);
    }
  };

  const showSubscriptionInfo = async (ctx, user) => {
    try {
      const status = user['Active_Subscription_Status'] || '❌ Неактивна';
      const plan = user['Active Subscription Plan'] || 'Базовий';
      const startDate = user['Start_Date'] ? new Date(user['Start_Date']).toLocaleDateString('uk-UA') : '—';
      const endDate = user['End_Date'] ? new Date(user['End_Date']).toLocaleDateString('uk-UA') : '—';

      const isActive = isActiveSubscription(user);
      const subscriptionText = isActive 
        ? MENU_TEXTS.SUBSCRIPTION_ACTIVE(plan, startDate, endDate)
        : MENU_TEXTS.SUBSCRIPTION_INACTIVE;

      const keyboard = isActive ? keyboards.mainMenuKeyboard() : keyboards.subscriptionKeyboard();
      await ctx.reply(subscriptionText, keyboard);
      
    } catch (error) {
      await handleError(ctx, error, MENU_TEXTS.SUBSCRIPTION_UNAVAILABLE);
    }
  };

  const showUserProfile = async (ctx, user) => {
    try {
      const tgId = ctx.from.id;
      const name = user['User Name'] || 'Користувач';
      const email = user['Email'] || 'Не вказано';
      const status = user['Active_Subscription_Status'] || '❌ Неактивна';
      const plan = user['Active Subscription Plan'] || 'Базовий';
      
      const profileText = `ℹ️ ТВІЙ ПРОФІЛЬ\n\n👤 Ім'я: ${name}\n📧 Email: ${email}\n🆔 ID: ${tgId}\n💰 План: ${plan}\n📅 Статус: ${status}`;
      await ctx.reply(profileText, keyboards.mainMenuKeyboard());
      
    } catch (error) {
      await handleError(ctx, error, 'ℹ️ Інформація про профіль тимчасово недоступна');
    }
  };

  const generatePaymentUrl = (tgId, planKey, planInfo) => {
    try {
      const orderReference = `ORDER_${planKey}_${tgId}_${Date.now()}`;
      const orderDate = Math.floor(Date.now() / 1000);
      const amount = planInfo.price;
      const currency = 'EUR';
      
      const merchantAccount = process.env.WAYFORPAY_MERCHANT || 'test_merch_n1';
      const merchantDomainName = process.env.WAYFORPAY_DOMAIN || 'aimentor.com';
      const productName = planInfo.name;
      const productCount = 1;
      const productPrice = amount;
      
      const signString = [
        merchantAccount, merchantDomainName, orderReference, orderDate,
        amount, currency, productName, productCount, productPrice
      ].join(';');
      
      const crypto = require('crypto');
      const secretKey = process.env.WAYFORPAY_SECRET || 'flk3409refn54t54t*FNJRET';
      const signature = crypto.createHmac('md5', secretKey).update(signString).digest('hex');
      
      const url = new URL('https://secure.wayforpay.com/pay');
      Object.entries({
        merchantAccount,
        merchantDomainName,
        orderReference,
        orderDate: orderDate.toString(),
        amount: amount.toString(),
        currency,
        orderTimeout: '3600',
        clientFirstName: 'aiMentor',
        clientLastName: 'User',
        clientEmail: `user${tgId}@telegram.user`,
        clientPhone: '+380000000000',
        language: 'UA',
        serviceUrl: `${process.env.WEBHOOK_URL || 'https://yourdomain.com'}/api/wayforpay/webhook`,
        returnUrl: `https://t.me/${process.env.BOT_USERNAME || 'your_bot'}`,
        merchantSignature: signature,
        clientAccountId: tgId.toString(),
        productName,
        productCount: productCount.toString(),
        productPrice: productPrice.toString()
      }).forEach(([key, value]) => url.searchParams.append(key, value));
      
      logger.info(`✅ [PAYMENT] Generated payment URL for ${tgId}: ${url.toString().substring(0, 50)}...`);
      return url.toString();
    } catch (error) {
      logger.error(`❌ [PAYMENT] Error generating payment URL for ${tgId}:`, error);
      return 'https://secure.wayforpay.com/pay?error=generation_failed';
    }
  };

  return {
    startMorningQuestions,
    startEveningQuestions,
  };
};

export default botController;