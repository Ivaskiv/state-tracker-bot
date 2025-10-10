// src/controllers/flows/wheelController.js
import wheelBalanceService from '../../services/wheelBalance/index.js';
import userService from '../../services/userService.js';
import keyboards from '../../utils/keyboards.js';

// Helper для надсилання повідомлень
const sendMessage = async (ctx, text, keyboard = null) => {
  const options = keyboard ? keyboard : keyboards.mainMenuKeyboard();
  
  try {
    if (ctx.callbackQuery) {
      try {
        await ctx.reply(text, options);
      } catch {
        await ctx.reply(text, options);
      }
    } else {
      await ctx.reply(text, options);
    }
  } catch (error) {
    console.error('[WHEEL] ❌ Помилка відправки:', error.message);
    await ctx.reply(text, keyboards.mainMenuKeyboard());
  }
};

// ===== ГОЛОВНИЙ ОБРОБНИК CALLBACK =====
export const handleCallback = async (ctx, data = null) => {
  const tgId = ctx.from.id;
  const callbackData = data || ctx.callbackQuery?.data || '';
  
  console.log(`[WHEEL] 📱 Callback: ${callbackData} від ${tgId}`);

  try {
    const user = await userService.getUserByTgId(tgId, { skipCache: true });
    
    if (!user) {
      await ctx.reply('Користувача не знайдено. Натисни /start');
      return;
    }

    // ===== ПОЧАТОК КОЛЕСА =====
    if (callbackData === 'wheel_start') {
      await handleStartWheel(ctx, user);
      return;
    }

    // ===== ІНФОРМАЦІЯ ПРО КОЛЕСО =====
    if (callbackData === 'wheel_info') {
      const info = wheelBalanceService.getWheelInfo();
      await sendMessage(ctx, info.message, info.keyboard);
      return;
    }

    // ===== СТАТИСТИКА =====
    if (callbackData === 'wheel_stats') {
      await handleWheelStats(ctx, user);
      return;
    }

    // ===== ПРОДОВЖЕННЯ КОЛЕСА =====
    if (callbackData === 'wheel_continue') {
      const result = await wheelBalanceService.continueActiveWheel(tgId, ctx);
      
      if (result.error) {
        await sendMessage(ctx, result.message);
      } else {
        await sendMessage(ctx, result.message, result.keyboard);
      }
      return;
    }

    // ===== ПЕРЕЗАПУСК КОЛЕСА =====
    if (callbackData === 'wheel_restart') {
      await wheelBalanceService.cancelActiveWheel(tgId);
      await handleStartWheel(ctx, user);
      return;
    }

    // ===== ВИХІД З КОЛЕСА =====
    if (callbackData === 'wheel_exit' || callbackData === 'wheel_cancel') {
      await wheelBalanceService.cancelActiveWheel(tgId);
      await sendMessage(ctx, '🚪 Колесо скасовано. Можеш почати заново будь-коли.');
      return;
    }

    // ===== ОЦІНКИ (0-10) =====
    if (callbackData.startsWith('wheel_score_')) {
      const score = parseInt(callbackData.replace('wheel_score_', ''), 10);
      await handleWheelScore(ctx, score);
      return;
    }

    // ===== ІНШІ CALLBACK =====
    if (callbackData === 'dismiss_reminder') {
      await ctx.answerCbQuery('Добре, нагадаємо пізніше');
      await ctx.deleteMessage().catch(() => {});
      return;
    }

  } catch (error) {
    console.error('[WHEEL] ❌ Помилка handleCallback:', error);
    await ctx.reply('❌ Виникла помилка. Спробуй /start', keyboards.mainMenuKeyboard());
  }
};

// ===== ОБРОБКА ТЕКСТУ =====
export const handleText = async (ctx, text) => {
  const tgId = ctx.from.id;
  
  console.log(`[WHEEL] 📝 Текст від ${tgId}: "${text.substring(0, 50)}..."`);

  try {
    // Перевіряємо чи очікуємо нотатку
    if (ctx.session?.wheel?.awaitingNoteFor != null) {
      const result = await wheelBalanceService.saveWheelNoteAndGoNext(ctx, text);
      
      if (result.error) {
        await ctx.reply(result.message, wheelBalanceService.buildExitKeyboard());
      } else if (result.completed) {
        await ctx.reply(result.message, keyboards.mainMenuKeyboard());
        if (result.isFirstWheel) {
          await sendWelcomeInstructions(ctx);
        }
      } else {
        await ctx.reply(result.message, result.keyboard);
      }
      return true;
    }

    // Якщо не очікуємо нотатку - перевіряємо чи є активне колесо
    const isActive = await wheelBalanceService.getActiveWheel(tgId);
    
    if (isActive) {
      await ctx.reply(
        '⚠️ У тебе є незавершене колесо балансу.\n\nОбери оцінку з кнопок або вийди з колеса.',
        wheelBalanceService.buildScoreKeyboard()
      );
      return true;
    }

    return false;
  } catch (error) {
    console.error('[WHEEL] ❌ Помилка handleText:', error);
    await ctx.reply('❌ Помилка обробки. Спробуй ще раз.', keyboards.mainMenuKeyboard());
    return true;
  }
};

// ===== ДОПОМІЖНІ ФУНКЦІЇ =====
const sendWelcomeInstructions = async (ctx) => {
  try {
    const user = await userService.getUserByTgId(ctx.from.id);
    const userName = user?.['User Name'] || 'Користувач';
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Пауза 2 сек
    
    const message = 
      `🎉 Вітаю, ${userName}!\n\n` +
      `Ти успішно пройшла перше колесо балансу! Тепер розкажу, як працює бот далі:\n\n` +
      `📅 ЩОДЕННІ РЕФЛЕКСІЇ:\n` +
      `• 🌞 Ранкові питання — щодня о ${SCHEDULE.MORNING_TIME}\n` +
      `  Налаштування на день, цілі, фокус\n\n` +
      `• 🌙 Вечірні питання — щодня о ${SCHEDULE.EVENING_TIME}\n` +
      `  Підбиття підсумків, аналіз дня, перемоги\n\n` +
      `🤖 AI НАСТАВНИК 24/7:\n` +
      `Натисни кнопку «🤖 AI Наставник» в меню внизу — отримай:\n` +
      `• Персональні поради\n` +
      `• Конкретні мікро-дії\n` +
      `• Підтримку в будь-який момент\n\n` +
      `📊 ЗВІТИ ТА ПРОГРЕС:\n` +
      `Натисни «📊 Мій прогрес та Звіти» щоб побачити:\n` +
      `• Щотижневі звіти з аналізом\n` +
      `• Щомісячні звіти та динаміку\n` +
      `• Статистику виконання цілей\n` +
      `• Прогрес по колесу балансу\n\n` +
      `🎯 НАСТУПНЕ КОЛЕСО:\n` +
      `Рекомендую заповнювати колесо балансу щомісяця — це допомагає відслідковувати зміни у всіх сферах життя.\n\n` +
      `💡 ПОРАДИ:\n` +
      `• Відповідай на щоденні питання щиро\n` +
      `• Використовуй AI Наставника для мікро-дій\n` +
      `• Переглядай звіти для розуміння прогресу\n` +
      `• Відстежуй свої перемоги — це мотивує!\n\n` +
      `✨ Використовуй кнопки меню внизу для швидкої навігації.\n\n` +
      `Готова почати свій шлях до змін? 💪`;

    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🤖 Поспілкуватися з AI Наставником', callback_data: 'ai_mentor' }],
          [{ text: '📊 Переглянути прогрес', callback_data: 'show_progress' }],
          [{ text: '💎 Отримати афірмацію', callback_data: 'show_affirmation' }],
          [{ text: '🏠 До головного меню', callback_data: 'main_menu' }]
        ]
      }
    });
    
    console.log(`[WHEEL] ✅ Надіслано welcome інструкції для ${ctx.from.id}`);
  } catch (error) {
    console.error('[WHEEL] ❌ Помилка sendWelcomeInstructions:', error);
  }
};
const handleStartWheel = async (ctx, user) => {
  const tgId = ctx.from.id;
  const userName = user['User Name'] || 'Користувач';
  
  console.log(`[WHEEL] 🎯 Старт колеса для ${tgId}`);

  try {
    // ✅ ПЕРЕВІРКА ЧИ МОЖНА ЗАПУСКАТИ КОЛЕСО
    const regDate = user['Registration Date'] || user.Created_At;
    const wheelCheck = await wheelBalanceService.shouldShowWheelReminder(tgId, regDate);
    
    if (!wheelCheck.needed) {
      await sendMessage(
        ctx,
        `⏰ ${wheelCheck.message}\n\n` +
        `📊 Наступне колесо можна буде пройти через ${30 - (wheelCheck.daysSince || 0)} днів.\n\n` +
        `Регулярне заповнення колеса допомагає відслідковувати прогрес! 💪`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📊 Переглянути статистику', callback_data: 'wheel_stats' }],
              [{ text: '🏠 До меню', callback_data: 'main_menu' }]
            ]
          }
        }
      );
      return;
    }
    
    // ✅ ЯКЩО Є НЕЗАВЕРШЕНЕ КОЛЕСО
    if (wheelCheck.type === 'continue') {
      await sendMessage(
        ctx,
        `🎯 ${wheelCheck.message}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Продовжити', callback_data: 'wheel_continue' }],
              [{ text: '🔄 Почати заново', callback_data: 'wheel_restart' }],
              [{ text: '🚪 Скасувати', callback_data: 'wheel_cancel' }]
            ]
          }
        }
      );
      return;
    }

    // ✅ ЗАПУСКАЄМО НОВЕ КОЛЕСО
    const result = await wheelBalanceService.startWheelBalance(tgId, userName);
    await sendMessage(ctx, result.message, result.keyboard);
    
  } catch (error) {
    console.error('[WHEEL] ❌ Помилка handleStartWheel:', error);
    await ctx.reply('❌ Помилка запуску колеса. Спробуй пізніше.', keyboards.mainMenuKeyboard());
  }
};

const handleWheelScore = async (ctx, score) => {
  const tgId = ctx.from.id;
  
  console.log(`[WHEEL] 🔢 Оцінка ${score} від ${tgId}`);

  try {
    const result = await wheelBalanceService.processWheelAnswer(tgId, score, ctx);
    
    if (result.error) {
      await sendMessage(ctx, result.message);
    }
    // Решта обробляється в processWheelAnswer через ctx
  } catch (error) {
    console.error('[WHEEL] ❌ Помилка handleWheelScore:', error);
    await ctx.reply('❌ Помилка збереження оцінки. Спробуй ще раз.');
  }
};

const handleWheelStats = async (ctx, user) => {
  const tgId = ctx.from.id;
  
  try {
    const stats = await wheelBalanceService.getUserWheelStats(tgId);
    
    if (stats.total === 0) {
      await sendMessage(
        ctx,
        '📊 У тебе ще немає завершених коліс балансу.\n\nПочни перше колесо!',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎯 Почати колесо', callback_data: 'wheel_start' }],
              [{ text: '🏠 До меню', callback_data: 'main_menu' }]
            ]
          }
        }
      );
      return;
    }

    const message = 
      `📊 СТАТИСТИКА КОЛІС БАЛАНСУ\n\n` +
      `✅ Завершено: ${stats.total}\n` +
      `📈 Останній бал: ${stats.lastScore}/10\n` +
      `📅 Останнє колесо: ${stats.lastDate}\n\n` +
      `Продовжуй відстежувати прогрес! 💪`;

    await sendMessage(ctx, message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎯 Нове колесо', callback_data: 'wheel_start' }],
          [{ text: '🏠 До меню', callback_data: 'main_menu' }]
        ]
      }
    });
  } catch (error) {
    console.error('[WHEEL] ❌ Помилка handleWheelStats:', error);
    await ctx.reply('❌ Помилка отримання статистики.');
  }
};

// ===== ЕКСПОРТ =====
export default {
  handleCallback,
  handleText,
  handleStartWheel
};