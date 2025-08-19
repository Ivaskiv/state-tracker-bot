// controllers/botController.js
import { MESSAGES } from '../utils/messages.js';
import { 
  mainMenuKeyboard, 
  subscriptionKeyboard, 
  registrationKeyboard,
  progressKeyboard,
  helpKeyboard,
  removeKeyboard
} from '../utils/keyboards.js';
import registrationHandler from '../handlers/registrationHandler.js';
import subscriptionHandler from '../handlers/subscriptionHandler.js';
import reflectionHandler from '../handlers/reflectionHandler.js';
import commandHandler from '../handlers/commandHandler.js';
import userService from '../services/userService.js';
import affirmationService from '../services/affirmationService.js';

export default function setupBot(bot) {
  
  // Start command
  bot.start(async (ctx) => {
    try {
      const telegramId = ctx.from.id;
      const user = await userService.getUserByTelegramId(telegramId);
      
      if (user) {
        // User exists
        const hasActiveSubscription = await userService.hasActiveSubscription(telegramId);
        
        if (hasActiveSubscription) {
          await ctx.reply(MESSAGES.ALREADY_REGISTERED, mainMenuKeyboard());
        } else {
          await ctx.reply(MESSAGES.ALREADY_REGISTERED);
          await ctx.reply(MESSAGES.SUBSCRIPTION_INFO, subscriptionKeyboard());
        }
      } else {
        // New user
        await ctx.reply(MESSAGES.WELCOME);
        await ctx.reply(MESSAGES.REGISTRATION_START, registrationKeyboard());
        ctx.session.step = 'registration_name';
      }
    } catch (error) {
      console.error('Error in start command:', error);
      await ctx.reply(MESSAGES.ERROR_GENERIC);
    }
  });

  // Help command
  bot.help(async (ctx) => {
    await ctx.reply(MESSAGES.HELP_MENU, helpKeyboard());
  });

  // Quick support responses
  bot.hears(['+', 'ок', 'ok', 'OK', 'Ок'], async (ctx) => {
    const affirmation = await affirmationService.getRandomAffirmation();
    await ctx.reply(`${MESSAGES.QUICK_SUPPORT}\n\n💫 ${affirmation}`);
  });

  // Main menu handlers
  bot.hears('📝 Ранкові питання', async (ctx) => {
    await reflectionHandler.startMorningQuestions(ctx);
  });

  bot.hears('🌙 Вечірні питання', async (ctx) => {
    await reflectionHandler.startEveningQuestions(ctx);
  });

  bot.hears('💰 Підписка', async (ctx) => {
    await ctx.reply(MESSAGES.SUBSCRIPTION_INFO, subscriptionKeyboard());
  });

  bot.hears('📊 Мій прогрес', async (ctx) => {
    const telegramId = ctx.from.id;
    const hasActiveSubscription = await userService.hasActiveSubscription(telegramId);
    
    if (hasActiveSubscription) {
      await ctx.reply('📊 ТВІЙ ПРОГРЕС', progressKeyboard());
    } else {
      await ctx.reply(MESSAGES.NO_ACTIVE_SUBSCRIPTION, subscriptionKeyboard());
    }
  });

  bot.hears('💎 Афірмація', async (ctx) => {
    const affirmation = await affirmationService.getRandomAffirmation();
    await ctx.reply(`${MESSAGES.AFFIRMATION_REQUEST}\n\n✨ ${affirmation}`);
  });

  bot.hears('❓ Допомога', async (ctx) => {
    await ctx.reply(MESSAGES.HELP_MENU, helpKeyboard());
  });

  bot.hears('🏠 Головне меню', async (ctx) => {
    ctx.session = {};
    await ctx.reply(MESSAGES.MAIN_MENU, mainMenuKeyboard());
  });

  // Registration handlers
  bot.hears('📝 Продовжити реєстрацію', async (ctx) => {
    ctx.session.step = 'registration_name';
    await ctx.reply(MESSAGES.REGISTRATION_START, removeKeyboard());
  });

  // Subscription action handlers
  bot.action('subscribe_week', (ctx) => subscriptionHandler.selectPlan(ctx, 'week'));
  bot.action('subscribe_month', (ctx) => subscriptionHandler.selectPlan(ctx, 'month'));
  bot.action('subscribe_year', (ctx) => subscriptionHandler.selectPlan(ctx, 'year'));
  bot.action(/confirm_(.+)/, (ctx) => subscriptionHandler.confirmPayment(ctx));
  bot.action('back_to_subscription', (ctx) => {
    ctx.editMessageText(MESSAGES.SUBSCRIPTION_INFO, subscriptionKeyboard());
  });

  // Progress action handlers
  bot.action('weekly_report', (ctx) => commandHandler.generateWeeklyReport(ctx));
  bot.action('monthly_report', (ctx) => commandHandler.generateMonthlyReport(ctx));

  // Help action handlers
  bot.action('reset_progress', (ctx) => commandHandler.resetProgress(ctx));
  bot.action('contact_support', (ctx) => {
    ctx.editMessageText(MESSAGES.CONTACT_SUPPORT);
  });

  // Back to main menu handlers
  bot.action('back_to_main', async (ctx) => {
    await ctx.editMessageText(MESSAGES.MAIN_MENU);
    await ctx.reply(MESSAGES.MAIN_MENU, mainMenuKeyboard());
  });

  // Continue handlers for questions
  bot.hears('▶️ Продовжити', async (ctx) => {
    if (ctx.session.questionType === 'morning') {
      await reflectionHandler.handleMorningQuestion(ctx);
    } else if (ctx.session.questionType === 'evening') {
      await reflectionHandler.handleEveningQuestion(ctx);
    }
  });

  bot.hears('⏭️ Пропустити', async (ctx) => {
    if (ctx.session.step && ctx.session.step.includes('registration')) {
      await registrationHandler.skipField(ctx);
    } else if (ctx.session.questionType) {
      await reflectionHandler.skipQuestion(ctx);
    }
  });

  // Text message handler
  bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    
    try {
      // Registration flow
      if (ctx.session.step) {
        switch (ctx.session.step) {
          case 'registration_name':
            await registrationHandler.handleName(ctx, text);
            break;
          case 'registration_email':
            await registrationHandler.handleEmail(ctx, text);
            break;
          case 'registration_phone':
            await registrationHandler.handlePhone(ctx, text);
            break;
          default:
            break;
        }
      }
      
      // Question answering flow
      else if (ctx.session.questionType) {
        if (ctx.session.questionType === 'morning') {
          await reflectionHandler.handleMorningAnswer(ctx, text);
        } else if (ctx.session.questionType === 'evening') {
          await reflectionHandler.handleEveningAnswer(ctx, text);
        }
      }
      
      // Default response for unrecognized text
      else {
        const telegramId = ctx.from.id;
        const user = await userService.getUserByTelegramId(telegramId);
        
        if (!user) {
          await ctx.reply(MESSAGES.REGISTRATION_START, registrationKeyboard());
          ctx.session.step = 'registration_name';
        } else {
          await ctx.reply('Використовуй меню для навігації 👇', mainMenuKeyboard());
        }
      }
    } catch (error) {
      console.error('Error in text handler:', error);
      await ctx.reply(MESSAGES.ERROR_GENERIC);
    }
  });

  // Error handler
  bot.catch((err, ctx) => {
    console.error('Bot error:', err);
    ctx.reply(MESSAGES.ERROR_GENERIC).catch(console.error);
  });
}