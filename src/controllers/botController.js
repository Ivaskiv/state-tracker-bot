// src/controllers/botController.js
import userService from '../auth/services/userService.js';
import responseService from '../dialogue/services/responseService.js';
import affirmationService from '../dialogue/services/affirmationService.js';
import aiMentorController from '../aiMentor/controllers/aiMentorController.js';
import subscriptionReminderService from '../services/subscriptionReminderService.js';
import { schedulePendingReminders, clearUserReminders } from '../middleware/pendingFlow.js';
import { refreshMenuIfDev } from '../utils/refreshMenu.js';
import { 
  ANSWER_STEPS, 
  QUESTION_TYPES, 
  MORNING_QUESTIONS, 
  EVENING_QUESTIONS, 
  SCHEDULE,
  SUBSCRIPTION_PLANS,
  MENU_TEXTS,
  MENU_MATCHERS
} from '../config/constants.js';
import keyboards from '../utils/keyboards.js';
import { sendReport } from '../services/reportService.js';
import { getUserDateTime } from '../utils/timezoneUtils.js';
import typing from '../utils/typing.js';
import { aiMentorSession } from '../aiMentor/session.js';

const botController = (bot) => {
  console.log('[botController] Initializing bot controller...');

  bot.start(async (ctx) => {
    const tgId = ctx.from.id;
    const name = ctx.from.first_name || 'Користувач';
    
    try {
      await typing(ctx);
      
      let user = await userService.getUserByTelegramId(tgId);
      
      if (!user) {
        user = await userService.createUser({
          tgId,
          name,
          email: ctx.from.username ? `${ctx.from.username}@telegram.user` : null,
        });
        
        const welcomeMessage = `🌟 Вітаю в aiMentor, ${name}!\n\nЯ твій персональний коуч трансформації. Готова допомогти тобі відстежувати щоденний прогрес та досягати цілей! ✨\n\n${MENU_TEXTS.PLAN_SELECTION}`;
        
        await ctx.reply(welcomeMessage, keyboards.subscriptionKeyboard());
        await userService.updateUserStep(tgId, ANSWER_STEPS.PLAN_SELECTION);
        console.log(`[botController] Created new user: ${tgId}, awaiting plan selection`);
        return;
      }
      
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      clearUserReminders(tgId);
      
      const isActive = user['Active_Subscription_Status']?.includes('✅ Активна');
      const welcomeMessage = isActive 
        ? `Привіт знову, ${name}! 👋\n\nГотова продовжити свою трансформацію? ✨`
        : `Привіт, ${name}! 👋\n\nДля користування aiMentor потрібна активна підписка.`;
        
      await ctx.reply(welcomeMessage, keyboards.mainMenuKeyboard());
      
    } catch (error) {
      console.error('[botController.start] Error:', error);
      await ctx.reply('Виникла помилка. Спробуйте ще раз.', keyboards.mainMenuKeyboard());
    }
  });

  bot.command('menu', async (ctx) => {
    const tgId = ctx.from.id;
    
    try {
      console.log(`[/menu] Оновлення меню для ${tgId}`);
      
      const user = await userService.getUserByTelegramId(tgId);
      if (!user) {
        await typing(ctx);
        await ctx.reply('Будь ласка, спочатку натисніть /start');
        return;
      }
      
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      clearUserReminders(tgId);
      
      await refreshMenuIfDev(ctx);
      
      if (process.env.NODE_ENV === 'production') {
        await typing(ctx);
        await ctx.reply('🔄 Меню оновлено!', keyboards.mainMenuKeyboard());
      }
      
    } catch (error) {
      console.error('[/menu] Помилка:', error);
      await typing(ctx);
      await ctx.reply('Виникла помилка при оновленні меню');
    }
  });

  bot.on('text', async (ctx) => {
    const tgId = ctx.from.id;
    const text = ctx.message.text?.trim();
    if (!text) return;

    try {
      const user = await userService.getUserByTelegramId(tgId);
      // AI-наставник перевірка
if (aiMentorSession.isActive(tgId)) {
  await aiMentorController.handleAIMentorQuestion(ctx, text);
  return;
}
      if (!user) {
        await typing(ctx);
        await ctx.reply('Будь ласка, спочатку натисніть /start', keyboards.mainMenuKeyboard());
        return;
      }

      console.log(`🔍 [USER] Answer_Step: ${user.Answer_Step}`);
// ДОДАТИ ЦЕ ТУТ (всередині функції):
    console.log(`=== ДІАГНОСТИКА AI MENTOR ===`);
    console.log(`👤 Користувач: ${tgId}`);
    console.log(`💬 Текст: "${text}"`);
    console.log(`📋 Answer_Step: "${user.Answer_Step}"`);
    console.log(`🎯 AI_MENTOR_ACTIVE: "${ANSWER_STEPS.AI_MENTOR_ACTIVE}"`);
    console.log(`✅ Збігається: ${user.Answer_Step === ANSWER_STEPS.AI_MENTOR_ACTIVE}`);
    console.log(`================================`);
      // AI-наставник має найвищий пріоритет
if (user.Answer_Step === ANSWER_STEPS.AI_MENTOR_ACTIVE) {
  console.log(`🤖 [AI-MENTOR] Обробка питання: "${text}"`);
  
  if (isExitCommand(text)) {
    await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
    await ctx.reply('👋 Дякую за спілкування! Повертаємося до головного меню.', keyboards.mainMenuKeyboard());
    return;
  }  
  // Обробляємо питання через AI-наставника
  await aiMentorController.handleAIMentorQuestion(ctx, text);
  return;
}
      if (user.Answer_Step === ANSWER_STEPS.PLAN_SELECTION) {
        await typing(ctx);
        await ctx.reply(MENU_TEXTS.SELECT_MENU, keyboards.mainMenuKeyboard());
        return;
      }

      if (await handleQuestionAnswer(ctx, user, text)) return;

      console.log(`📋 [MENU] Обробка команди: "${text}"`);
      await handleMenuCommands(ctx, user, text);
      
    } catch (error) {
      console.error('[botController.onText] Error:', error);
      await typing(ctx);
      await ctx.reply('Виникла помилка. Спробуйте ще раз.', keyboards.mainMenuKeyboard());
    }
  });

  const isExitCommand = (text) => {
    const exitCommands = ['вихід', 'exit', '🏠 головне меню', 'меню'];
    return exitCommands.includes(text.toLowerCase());
  };

  const handleQuestionAnswer = async (ctx, user, text) => {
    const step = user.Answer_Step;
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
      console.error('[handleQuestionAnswer] Error:', error);
      await typing(ctx);
      await ctx.reply('Виникла помилка. Спробуйте ще раз.', keyboards.mainMenuKeyboard());
      return true;
    }
  };

  const processMorningQuestions = async (ctx, user, text, step, tgId, userName) => {
    const currentTime = getUserDateTime(tgId);
    const currentHour = new Date(currentTime).getHours();
    const eveningHour = parseInt(SCHEDULE.EVENING_TIME.split(':')[0]);
    
    if (currentHour >= eveningHour) {
      await typing(ctx);
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
      await typing(ctx);
      await ctx.reply(`${questionNum + 1}️⃣/6 ${MORNING_QUESTIONS[questionNum]}`);
    } else {
      await completeSession(ctx, tgId, userName, QUESTION_TYPES.MORNING, 'morning');
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
      await typing(ctx);
      await ctx.reply(`${questionNum + 1}️⃣/5 ${EVENING_QUESTIONS[questionNum]}`);
    } else {
      await completeSession(ctx, tgId, userName, QUESTION_TYPES.EVENING, 'evening');
    }
    return true;
  };

  const completeSession = async (ctx, tgId, userName, questionType, sessionType) => {
    const affirmation = await affirmationService.getAffirmationAndMarkUsed(sessionType);
    const affirmationField = questionType === QUESTION_TYPES.MORNING ? 'affirmation_m' : 'affirmation_e';
    const affirmationStep = questionType === QUESTION_TYPES.MORNING ? ANSWER_STEPS.AFFIRMATION_MORNING : ANSWER_STEPS.AFFIRMATION_EVENING;
    
    await responseService.createOrUpdateResponse(
      tgId, userName, questionType, affirmationStep, 0, affirmation, affirmationField, true
    );
    
    await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
    
    const sessionName = questionType === QUESTION_TYPES.MORNING ? 'Ранкові' : 'Вечірні';
    await typing(ctx);
    await ctx.reply(`✅ ${sessionName} питання завершено!\n\n💎 ${affirmation}`, keyboards.mainMenuKeyboard());
    await refreshMenuIfDev(ctx);
  };

  const handleMenuCommands = async (ctx, user, text) => {
    const isActiveSubscription = user['Active_Subscription_Status']?.includes('✅ Активна');
    const currentTime = getUserDateTime(ctx.from.id);
    const currentHour = new Date(currentTime).getHours();
    const eveningHour = parseInt(SCHEDULE.EVENING_TIME.split(':')[0]);

    if (MENU_MATCHERS.AI_MENTOR(text)) {
      console.log(`🤖 [AI НАСТАВНИК] Активація для ${ctx.from.id}`);
      
      if (!isActiveSubscription) {
        await typing(ctx);
        await ctx.reply('🤖 AI-наставник доступний тільки з активною підпискою', keyboards.mainMenuKeyboard());
        return;
      }
      
      await aiMentorController.handleAIMentorRequest(ctx);
      return;
    }

    if (text === '🌅 Ранкові питання') {
      if (currentHour >= eveningHour) {
        await typing(ctx);
        await ctx.reply('Ранкові питання недоступні після 20:00. Спробуй вечірні питання або зачекай до завтра.', keyboards.mainMenuKeyboard());
        return;
      }
      await startMorningQuestions(ctx, user);
      return;
    }

    if (text === '🌙 Вечірні питання') {
      await startEveningQuestions(ctx, user);
      return;
    }

    if (MENU_MATCHERS.AFFIRM(text)) {
      const affirmation = await affirmationService.getAffirmationAndMarkUsed('morning');
      await typing(ctx);
      await ctx.reply(`✨ ${affirmation}`, keyboards.mainMenuKeyboard());
      await refreshMenuIfDev(ctx);
      return;
    }

    if (MENU_MATCHERS.WEEKLY(text)) {
      if (!isActiveSubscription) {
        await typing(ctx);
        await ctx.reply('📋 Ця функція доступна тільки з активною підпискою', keyboards.mainMenuKeyboard());
        return;
      }
      await sendReport(bot, ctx.from.id, 'weekly');
      await refreshMenuIfDev(ctx);
      return;
    }

    if (MENU_MATCHERS.MONTHLY(text)) {
      if (!isActiveSubscription) {
        await typing(ctx);
        await ctx.reply('📋 Ця функція доступна тільки з активною підпискою', keyboards.mainMenuKeyboard());
        return;
      }
      await sendReport(bot, ctx.from.id, 'monthly');
      await refreshMenuIfDev(ctx);
      return;
    }

    if (MENU_MATCHERS.SUBSCRIPTION(text)) {
      await showSubscriptionInfo(ctx, user);
      await refreshMenuIfDev(ctx);
      return;
    }

    if (MENU_MATCHERS.PROGRESS(text)) {
      await showUserProgress(ctx, user);
      await refreshMenuIfDev(ctx);
      return;
    }

    if (MENU_MATCHERS.HELP(text)) {
      await typing(ctx);
      await ctx.reply(MENU_TEXTS.HELP, keyboards.mainMenuKeyboard());
      await refreshMenuIfDev(ctx);
      return;
    }

    if (MENU_MATCHERS.CONTACT(text)) {
      await typing(ctx);
      await ctx.reply(MENU_TEXTS.CONTACT, keyboards.supportKeyboard());
      return;
    }

    if (MENU_MATCHERS.INSTRUCTIONS(text)) {
      await typing(ctx);
      await ctx.reply(MENU_TEXTS.INSTRUCTIONS, keyboards.mainMenuKeyboard());
      await refreshMenuIfDev(ctx);
      return;
    }

    if (MENU_MATCHERS.PROFILE(text)) {
      await showUserProfile(ctx, user);
      await refreshMenuIfDev(ctx);
      return;
    }

    console.log(`❓ [MENU] Невідома команда: "${text}"`);
    await typing(ctx);
    await ctx.reply(MENU_TEXTS.SELECT_MENU, keyboards.mainMenuKeyboard());
    await refreshMenuIfDev(ctx);
  };

  const startMorningQuestions = async (ctx, user) => {
    const tgId = ctx.from.id;
    const currentTime = getUserDateTime(tgId);
    const currentHour = new Date(currentTime).getHours();
    const eveningHour = parseInt(SCHEDULE.EVENING_TIME.split(':')[0]);

    if (currentHour >= eveningHour) {
      await typing(ctx);
      await ctx.reply('Ранкові питання недоступні після 20:00. Спробуй вечірні питання або зачекай до завтра.', keyboards.mainMenuKeyboard());
      return;
    }

    const isMorningCompleted = await responseService.isSessionCompleted(tgId, QUESTION_TYPES.MORNING);
    if (isMorningCompleted) {
      await typing(ctx);
      await ctx.reply('Ти вже завершив(ла) ранкові питання за сьогодні. Хочеш оновити відповіді?', {
        reply_markup: { inline_keyboard: [[{ text: 'Так, оновити', callback_data: 'restart_morning' }]] },
      });
      return;
    }

    await userService.updateUserStep(tgId, ANSWER_STEPS.MORNING_1);
    await typing(ctx);
    await ctx.reply(`🌞 Ранкова рефлексія\n\n1️⃣/6 ${MORNING_QUESTIONS[0]}`);
    schedulePendingReminders(bot, tgId, 'Morning');
  };

  const startEveningQuestions = async (ctx, user) => {
    const tgId = ctx.from.id;
    const isEveningCompleted = await responseService.isSessionCompleted(tgId, QUESTION_TYPES.EVENING);
    
    if (isEveningCompleted) {
      await typing(ctx);
      await ctx.reply('Ти вже завершив(ла) вечірні питання за сьогодні. Хочеш оновити відповіді?', {
        reply_markup: { inline_keyboard: [[{ text: 'Так, оновити', callback_data: 'restart_evening' }]] },
      });
      return;
    }

    await userService.updateUserStep(tgId, ANSWER_STEPS.EVENING_1);
    await typing(ctx);
    await ctx.reply(`🌙 Вечірня рефлексія\n\n1️⃣/5 ${EVENING_QUESTIONS[0]}`);
    schedulePendingReminders(bot, tgId, 'Evening');
  };

  bot.on('callback_query', async (ctx) => {
    const tgId = ctx.from.id;
    const data = ctx.callbackQuery.data;

    try {
      console.log(`📱 [CALLBACK] ${data} від ${tgId}`);

      if (data === 'ai_continue' || data === 'ai_exit') {
        console.log(`🤖 [CALLBACK] AI-наставник: ${data}`);
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
        await typing(ctx);
        await ctx.reply(MENU_TEXTS.SELECT_MENU, keyboards.mainMenuKeyboard());
        await ctx.answerCbQuery();
      }
      
    } catch (error) {
      console.error('[botController.callbackQuery] Error:', error);
      await typing(ctx);
      await ctx.reply('Виникла помилка. Спробуйте ще раз.', keyboards.mainMenuKeyboard());
      await ctx.answerCbQuery();
    }
  });

  const handleSubscriptionCallback = async (ctx, data, tgId) => {
    const planKey = data.replace('subscribe_', '').toUpperCase();
    const planInfo = SUBSCRIPTION_PLANS[planKey];
    
    if (!planInfo) {
      await ctx.answerCbQuery('Невірний план');
      return;
    }

    const paymentUrl = generatePaymentUrl(tgId, planKey, planInfo);
    
    await typing(ctx);
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
      const eveningHour = parseInt(SCHEDULE.EVENING_TIME.split(':')[0]);
      
      if (currentHour >= eveningHour) {
        await typing(ctx);
        await ctx.reply('Ранкові питання недоступні після 20:00. Спробуй вечірні питання або зачекай до завтра.', keyboards.mainMenuKeyboard());
        await ctx.answerCbQuery();
        return;
      }
      
      await userService.updateUserStep(tgId, ANSWER_STEPS.MORNING_1);
      await typing(ctx);
      await ctx.reply(`🌞 Ранкова рефлексія\n\n1️⃣/6 ${MORNING_QUESTIONS[0]}`);
      schedulePendingReminders(bot, tgId, 'Morning');
      
    } else if (data === 'restart_evening') {
      await userService.updateUserStep(tgId, ANSWER_STEPS.EVENING_1);
      await typing(ctx);
      await ctx.reply(`🌙 Вечірня рефлексія\n\n1️⃣/5 ${EVENING_QUESTIONS[0]}`);
      schedulePendingReminders(bot, tgId, 'Evening');
    }
    
    await ctx.answerCbQuery();
  };

  const showUserProgress = async (ctx, user) => {
    if (!user) {
      await typing(ctx);
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
      await typing(ctx);
      await ctx.reply(progressText, keyboards.mainMenuKeyboard());
      
    } catch (error) {
      console.error('[showUserProgress] Error:', error);
      await typing(ctx);
      await ctx.reply(MENU_TEXTS.PROGRESS_UNAVAILABLE, keyboards.mainMenuKeyboard());
    }
  };

  const showSubscriptionInfo = async (ctx, user) => {
    try {
      const status = user['Active_Subscription_Status'] || '❌ Неактивна';
      const plan = user['Active Subscription Plan'] || 'Базовий';
      const startDate = user['Start_Date'] ? new Date(user['Start_Date']).toLocaleDateString('uk-UA') : '—';
      const endDate = user['End_Date'] ? new Date(user['End_Date']).toLocaleDateString('uk-UA') : '—';

      const isActive = status.includes('✅ Активна');
      const subscriptionText = isActive 
        ? MENU_TEXTS.SUBSCRIPTION_ACTIVE(plan, startDate, endDate)
        : MENU_TEXTS.SUBSCRIPTION_INACTIVE;

      const keyboard = isActive ? keyboards.mainMenuKeyboard() : keyboards.subscriptionKeyboard();
      await typing(ctx);
      await ctx.reply(subscriptionText, keyboard);
      
    } catch (error) {
      console.error('[showSubscriptionInfo] Error:', error);
      await typing(ctx);
      await ctx.reply(MENU_TEXTS.SUBSCRIPTION_UNAVAILABLE, keyboards.mainMenuKeyboard());
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
      await typing(ctx);
      await ctx.reply(profileText, keyboards.mainMenuKeyboard());
      
    } catch (error) {
      console.error('[showUserProfile] Error:', error);
      await typing(ctx);
      await ctx.reply('ℹ️ Інформація про профіль тимчасово недоступна', keyboards.mainMenuKeyboard());
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
        merchantAccount, merchantDomainName, orderReference,
        orderDate: orderDate.toString(), amount: amount.toString(), currency,
        orderTimeout: '3600', clientFirstName: 'aiMentor', clientLastName: 'User',
        clientEmail: `user${tgId}@telegram.user`, clientPhone: '+380000000000',
        language: 'UA', serviceUrl: `${process.env.WEBHOOK_URL || 'https://yourdomain.com'}/api/wayforpay/webhook`,
        returnUrl: `https://t.me/${process.env.BOT_USERNAME || 'your_bot'}`,
        merchantSignature: signature, clientAccountId: tgId.toString(),
        socialUri: `tg://user?id=${tgId}`, TG_id: tgId.toString(),
        planKey: planKey, planDuration: planInfo.duration.toString()
      }).forEach(([key, value]) => url.searchParams.append(key, value));
      
      url.searchParams.append('productName[]', productName);
      url.searchParams.append('productPrice[]', productPrice.toString());
      url.searchParams.append('productCount[]', '1');

      return url.toString();
    } catch (error) {
      console.error('[generatePaymentUrl] Помилка:', error);
      return `https://secure.wayforpay.com/payment/fallback_${planKey.toLowerCase()}_${tgId}`;
    }
  };
};
export default botController;