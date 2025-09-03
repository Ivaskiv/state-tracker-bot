import userService from '../services/userService.js';
import responseService from '../services/responseService.js';
import affirmationService from '../services/affirmationService.js';
import { ANSWER_STEPS, QUESTION_TYPES, MORNING_QUESTIONS, EVENING_QUESTIONS } from '../config/constants.js';
import keyboards from '../utils/keyboards.js';
import { sendReport } from '../services/reportService.js';

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
        email: ctx.from.username ? `${ctx.from.username}@telegram.user` : null 
      });
    }

    const welcomeMessage = `Привіт, ${name}! 👋\n\nЯ твій персональний коуч трансформації. Готова допомогти тобі відслідковувати щоденний прогрес та досягати цілей! ✨`;
    
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
  if (!step || step === 'completed') return false;

  const tgId = ctx.from.id;
  const userName = user['User Name'] || 'Користувач';
  
  try {
    // Morning questions logic
    if (step.startsWith('Q_m_')) {
      const questionNum = parseInt(step.split('_')[2]);
      const fieldName = `Q_m_${questionNum}`;
      
      await responseService.createOrUpdateResponse(
        tgId, userName, QUESTION_TYPES.MORNING, step, questionNum, text, fieldName
      );
      
      if (questionNum < 6) {
        const nextStep = `Q_m_${questionNum + 1}`;
        await userService.updateUserStep(tgId, nextStep);
        await ctx.reply(`${questionNum + 1}️⃣/6 ${MORNING_QUESTIONS[questionNum]}`);
      } else {
        // Після 6 питання показуємо афірмацію і чекаємо на відповідь
        const affirmation = await affirmationService.getAffirmationAndMarkUsed('morning');
        await ctx.reply(`✨ Ось твоя ранкова афірмація:\n\n${affirmation}\n\nНапиши цю афірмацію своїми словами:`);
        await userService.updateUserStep(tgId, 'affirmation_m');
      }
      return true;
    }
    
    // Handle morning affirmation - використовуємо валідний step
    if (step === 'affirmation_m') {
      await responseService.createOrUpdateResponse(
        tgId, userName, QUESTION_TYPES.MORNING, 'End_m', 7, text, 'affirmation_m'
      );
      await userService.updateUserStep(tgId, 'completed');
      await ctx.reply('🎉 Дякую! Ранкову сесію завершено!', keyboards.mainMenuKeyboard());
      return true;
    }
    
    // Evening questions logic
    if (step.startsWith('Q_e_')) {
      const questionNum = parseInt(step.split('_')[2]);
      const fieldName = `Q_e_${questionNum}`;
      
      await responseService.createOrUpdateResponse(
        tgId, userName, QUESTION_TYPES.EVENING, step, questionNum, text, fieldName
      );
      
      if (questionNum < 5) {
        const nextStep = `Q_e_${questionNum + 1}`;
        await userService.updateUserStep(tgId, nextStep);
        await ctx.reply(`${questionNum + 1}️⃣/5 ${EVENING_QUESTIONS[questionNum]}`);
      } else {
        // Після 5 питання показуємо афірмацію і чекаємо на відповідь
        const affirmation = await affirmationService.getAffirmationAndMarkUsed('evening');
        await ctx.reply(`✨ Ось твоя вечірня афірмація:\n\n${affirmation}\n\nНапиши цю афірмацію своїми словами:`);
        await userService.updateUserStep(tgId, 'affirmation_e');
      }
      return true;
    }
    
    // Handle evening affirmation
    if (step === 'affirmation_e') {
      await responseService.createOrUpdateResponse(
        tgId, userName, QUESTION_TYPES.EVENING, 'End_e', 6, text, 'affirmation_e'
      );
      await userService.updateUserStep(tgId, 'completed');
      await ctx.reply('🎉 Дякую! Вечірню сесію завершено!', keyboards.mainMenuKeyboard());
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
    
    switch (text) {
      case '🌅 Ранкові питання':
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
          await ctx.reply('📋 Ця функція доступна тільки з активною підпискою', keyboards.subscriptionKeyboard());
          return;
        }
        await sendReport(bot, ctx.from.id, 'weekly');
        break;
        
      case '📈 Щомісячний звіт':
        if (!isActiveSubscription) {
          await ctx.reply('📋 Ця функція доступна тільки з активною підпискою', keyboards.subscriptionKeyboard());
          return;
        }
        await sendReport(bot, ctx.from.id, 'monthly');
        break;
        
      case '💰 Підписка':
        await showSubscriptionInfo(ctx, user);
        break;
        
      default:
        await ctx.reply('Оберіть опцію з меню:', keyboards.mainMenuKeyboard());
    }
  };

  const startMorningQuestions = async (ctx, user) => {
    const isCompleted = await responseService.isSessionCompleted(ctx.from.id, QUESTION_TYPES.MORNING);
    if (isCompleted) {
      await ctx.reply('✅ Ти вже відповіла на ранкові питання сьогодні!');
      return;
    }
    
    await userService.updateUserStep(ctx.from.id, 'Q_m_1');
    await ctx.reply(`🌞 Ранкова рефлексія\n\n1️⃣/6 ${MORNING_QUESTIONS[0]}`);
  };

  const startEveningQuestions = async (ctx, user) => {
    const isCompleted = await responseService.isSessionCompleted(ctx.from.id, QUESTION_TYPES.EVENING);
    if (isCompleted) {
      await ctx.reply('✅ Ти вже відповіла на вечірні питання сьогодні!');
      return;
    }
    
    await userService.updateUserStep(ctx.from.id, 'Q_e_1');
    await ctx.reply(`🌙 Вечірня рефлексія\n\n1️⃣/5 ${EVENING_QUESTIONS[0]}`);
  };

  const showSubscriptionInfo = async (ctx, user) => {
    const status = user['Active_Subscription_Status'] || '❌ Неактивна';
    const plan = user['Active Subscription Plan'] || 'Базовий';
    
    await ctx.reply(
      `💰 Твоя підписка:\n\n📋 План: ${plan}\n📅 Статус: ${status}\n\n💎 Активна підписка дає доступ до:\n• Щотижневих AI-звітів\n• Щомісячних AI-звітів\n• Персоналізованих рекомендацій`,
      keyboards.subscriptionKeyboard()
    );
  };
};

export default botController;