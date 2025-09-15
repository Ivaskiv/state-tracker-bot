// src/controllers/botController.js - ВИПРАВЛЕНО ЛОГІКУ AI МЕНТОРА

import userService from '../auth/services/userService.js';
import wheelBalanceController from './wheelBalanceController.js';
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
      
      await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
      clearUserReminders(tgId);
      
      const welcomeMessage = isActiveSubscription(user) 
        ? `Привіт знову, ${name}! 👋\n\nГотова продовжити трансформацію? ✨`
        : `Привіт, ${name}! 👋\n\nДля користування aiMentor потрібна активна підписка.`;
        
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

      const step = user.Answer_Step;
      const isActiveWheel = step === WHEEL_STEP;
      const isActiveAI = aiMentorSession.isActive(tgId);
      const isActiveQuestions = step && (step.startsWith('Q_m_') || step.startsWith('Q_e_'));

      // ✅ ПРІОРИТЕТ 1: AI НАСТАВНИК (блокує всі команди меню крім виходу)
      if (isActiveAI) {
        console.log(`🤖 [botController] AI ментор активний для ${tgId}, текст: "${text}"`);
        
        if (text.includes('вихід') || text.includes('exit') || text === '🚪 Вийти із сесії') {
          aiMentorSession.end(tgId);
          await completeSession(tgId, ctx, '👋 Повертаємося до меню.');
          return;
        }
        
        // ✅ БЛОКУЄМО ВСІ КОМАНДИ МЕНЮ КРІМ АФІРМАЦІЇ
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
        
        // ✅ ДОЗВОЛЯЄМО АФІРМАЦІЮ НАВІТЬ В AI МЕНТОРІ
        if (text === '💎 Афірмація') {
          aiMentorSession.end(tgId);
          await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
          logger.info(`🚪 [botController] Вихід з AI ментора для афірмації ${tgId}`);
          await handleMenuCommands(ctx, user, text, bot);
          return;
        }
        
        // Обробляємо як питання до AI
        await aiMentorController.handleAIMentorQuestion(ctx, text);
        return;
      }

      // ✅ ПРІОРИТЕТ 2: КОЛЕСО БАЛАНСУ
      if (isActiveWheel) {
        logger.info(`🎯 [botController] Обробка колеса балансу для ${tgId}: "${text}"`);
        await wheelBalanceController.handleWheelBalanceAnswer(ctx, text);
        return;
      }

      // ✅ ПРІОРИТЕТ 3: РАНКОВІ/ВЕЧІРНІ ПИТАННЯ
      if (isActiveQuestions) {
        const answered = await handleQuestionAnswer(ctx, user, text);
        if (answered) return;
      }

      // ✅ ПРІОРИТЕТ 4: КОМАНДИ МЕНЮ
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
      // ✅ ВАЖЛИВО: НЕ ОБРОБЛЯЄМО continue_answers та skip_session тут!
      // Вони обробляються в pendingFlow.js
      
      // Обробка рестарту сесій
      if (data === 'restart_morning' || data === 'restart_evening' || data === 'cancel_restart') {
        await handleRestartCallback(ctx);
        return;
      }

      if (data === 'ai_continue' || data === 'ai_exit') {
        await aiMentorController.handleAIMentorCallback(ctx);
        return;
      }

      if (data === 'wheel_retry' || data === 'wheel_exit') {
        await wheelBalanceController.handleWheelRetryCallback(ctx);
        return;
      }

      if (data === 'wheel_start_new' || data === 'wheel_to_menu') {
        await wheelBalanceController.handleWheelMenuCallback(ctx);
        return;
      }

      // ✅ ЯКЩО CALLBACK НЕ РОЗПІЗНАНО - ВІДПОВІДАЄМО
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