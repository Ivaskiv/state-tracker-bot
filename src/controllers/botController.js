// src/controllers/botController.js - ДОДАНО WHEEL CALLBACK

import userService from '../auth/services/userService.js';
import wheelBalanceController from './wheelBalanceController.js';
import subscriptionService from '../auth/services/subscriptionService.js';
import { clearUserReminders } from '../middleware/pendingFlow.js';
import { aiMentorSession } from '../aiMentor/session.js';
import { globalTypingMiddleware } from '../middleware/typingMiddleware.js';
import { ANSWER_STEPS} from '../config/constants.js';
import keyboards from '../utils/keyboards.js';
import { isActiveSubscription } from '../utils/subscriptionUtils.js';
import { handleError } from '../utils/errorHandler.js';
import { completeSession } from '../utils/sessionUtils.js';
import logger from '../utils/logger.js';
import aiMentorController from '../aiMentor/controllers/aiMentorController.js';
import { handleMenuCommands } from '../dialogue/handlers/menuHandlers.js';
import { handleQuestionAnswer, handleRestartCallback } from '../dialogue/handlers/sessionHandlers.js';

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
        
        await ctx.reply(`🌟 Вітаю в aiMentor, ${name}!\n\nГотова допомогти тобі відстежувати прогрес та досягати цілей! ✨`);
        await wheelBalanceController.handleWheelBalanceRequest(ctx);
        return;
      }
      
      // ✅ ПЕРЕВІРКА СТАТУСУ ПІДПИСКИ
      const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(tgId);
      
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      clearUserReminders(tgId);
      
      const welcomeMessage = subscriptionStatus.active 
        ? `Привіт знову, ${name}! 👋\n\nГотова продовжити трансформацію? ✨`
        : `Привіт, ${name}! 👋\n\n❌ Твоя підписка закінчилася.\n\nДля користування aiMentor потрібна активна підписка.\n\n📞 Зв'яжіться з підтримкою: nadyastarway@gmail.com`;
        
      await ctx.reply(welcomeMessage, keyboards.mainMenuKeyboard());
    } catch (error) {
      await handleError(ctx, error);
    }
  });

  bot.command('menu', async (ctx) => {
    try {
      const user = await userService.getUserByTelegramId(ctx.from.id);
      if (!user) return ctx.reply('Натисніть /start');
      
      await userService.updateUserStep(ctx.from.id, ANSWER_STEPS.COMPLETED);
      clearUserReminders(ctx.from.id);
      await ctx.reply('🔄 Меню оновлено!', keyboards.mainMenuKeyboard());
    } catch (error) {
      await handleError(ctx, error);
    }
  });

  bot.on('text', async (ctx) => {
    const tgId = ctx.from.id;
    const text = ctx.message.text?.trim();
    if (!text) return;

    try {
      const user = await userService.getUserByTelegramId(tgId);
      if (!user) return ctx.reply('Натисніть /start', keyboards.mainMenuKeyboard());

      // ✅ ПЕРЕВІРКА ПІДПИСКИ ДЛЯ ВСІХ ДІЙ
      const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(tgId);
      
      if (!subscriptionStatus.active && text !== '💰 Підписка' && text !== '📞 Зв\'язок з нами') {
        await ctx.reply(
          '❌ Твоя підписка закінчилася.\n\nЩоб користуватися всіма функціями бота, оформи або продовжи підписку.\n\n📞 Зв\'яжіться з підтримкою: nadyastarway@gmail.com',
          keyboards.mainMenuKeyboard()
        );
        return;
      }

      const step = user.Answer_Step;
      const isActiveWheel = step === WHEEL_STEP;
      const isActiveQuestions = step && (step.startsWith('Q_m_') || step.startsWith('Q_e_'));
      const isActiveAI = aiMentorSession.isActive(String(tgId));

      console.log(`[botController] 📋 ДІАГНОСТИКА для ${tgId}:`);
      console.log(`- Текст: "${text}"`);
      console.log(`- Answer_Step: "${step}"`);
      console.log(`- isActiveAI: ${isActiveAI}`);
      console.log(`- isActiveWheel: ${isActiveWheel}`);
      console.log(`- isActiveQuestions: ${isActiveQuestions}`);

      // AI наставник
      if (isActiveAI) {
        console.log(`🤖 [botController] AI ментор активний для ${tgId}`);
        
        if (text.includes('вихід') || text.includes('exit') || text === '🚪 Вийти із сесії') {
          aiMentorSession.end(String(tgId));
          await completeSession(tgId, ctx, '👋 Повертаємося до меню.');
          return;
        }
        
        const menuCommands = [
          '📈 Щотижневий звіт', '📈 Щомісячний звіт', '🤖 AI наставник',
          '🎯 Колесо балансу', '💰 Підписка', '📊 Мій прогрес',
          '❓ Допомога', '📞 Зв\'язок з нами', '📝 Інструкції', 'ℹ️ Профіль'
        ];
        
        if (menuCommands.includes(text)) {
          console.log(`🚫 [botController] БЛОКУЄМО команду "${text}" через активний AI ментор`);
          await ctx.reply(
            `🤖 Зараз в тебе активна сесія AI наставника.\n\nЩоб використати кнопки меню:`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '📝 Продовжити відповідати', callback_data: 'continue_answers' }],
                  [{ text: '🚪 Вийти із сесії', callback_data: 'skip_session' }]
                ]
              }
            }
          );
          return;
        }
        
        if (text === '💎 Афірмація') {
          aiMentorSession.end(String(tgId));
          await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
          await handleMenuCommands(ctx, user, text, bot);
          return;
        }
        
        await aiMentorController.handleAIMentorQuestion(ctx, text);
        return;
      }

      // Колесо балансу
      if (isActiveWheel) {
        logger.info(`🎯 [botController] Обробка колеса балансу для ${tgId}: "${text}"`);
        await wheelBalanceController.handleWheelBalanceAnswer(ctx, text);
        return;
      }

      // Ранкові/вечірні питання
      if (isActiveQuestions) {
        const answered = await handleQuestionAnswer(ctx, user, text);
        if (answered) return;
      }

      // Команди меню
      await handleMenuCommands(ctx, user, text, bot);
    } catch (error) {
      await handleError(ctx, error);
    }
  });

  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const tgId = ctx.from.id;

    console.log(`[botController] 📱 Callback: ${data} від ${tgId}`);

    try {
      // ✅ ПЕРЕВІРКА ПІДПИСКИ ДЛЯ CALLBACK
      const subscriptionStatus = await subscriptionService.checkSubscriptionStatus(tgId);
      
      if (!subscriptionStatus.active && !data.includes('subscription') && !data.includes('support')) {
        await ctx.answerCbQuery('Потрібна активна підписка');
        return;
      }

      // Обробка рестарту сесій
      if (data === 'restart_morning' || data === 'restart_evening' || data === 'cancel_restart') {
        await handleRestartCallback(ctx);
        return;
      }

      if (data === 'ai_continue' || data === 'ai_exit') {
        await aiMentorController.handleAIMentorCallback(ctx);
        return;
      }

      // ✅ КОЛЕСО БАЛАНСУ CALLBACK
      if (data.startsWith('wheel_score_') || data === 'wheel_exit') {
        await wheelBalanceController.handleWheelCallback(ctx);
        return;
      }

      if (data === 'wheel_retry' || data === 'wheel_start_new' || data === 'wheel_to_menu') {
        await wheelBalanceController.handleWheelRetryCallback(ctx);
        return;
      }

      // Підписка та підтримка
      if (data === 'subscription_info') {
        await ctx.reply('💰 Підписка\n\nДля оформлення або продовження підписки зв\'яжіться з підтримкою:\n\nEmail: nadyastarway@gmail.com\nTelegram: @Nadya2316', keyboards.mainMenuKeyboard());
        await ctx.answerCbQuery('Інформація про підписку');
        return;
      }

      if (data === 'contact_support') {
        await ctx.reply('📞 Підтримка\n\nEmail: nadyastarway@gmail.com\nTelegram: @Nadya2316\n\nОпишіть свою ситуацію, і ми допоможемо!', keyboards.mainMenuKeyboard());
        await ctx.answerCbQuery('Контакти підтримки');
        return;
      }

      console.log(`[botController] ❓ Невідомий callback: ${data}`);
      await ctx.answerCbQuery('Команда не розпізнана');
      
    } catch (error) {
      await handleError(ctx, error);
      await ctx.answerCbQuery('Помилка обробки');
    }
  });

  return { bot };
};

export default botController;