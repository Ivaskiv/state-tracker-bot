// ДОДАЙТЕ ЦЮ ФУНКЦІЮ ДО auth.js або створіть окремий файл wheelReminderHelper.js:

import wheelBalanceService from '../../services/wheelBalanceService.js';

const checkAndShowWheelReminder = async (ctx, user) => {
  try {
    const tgId = ctx.from.id;
    const registrationDate = user?.['Registration Date'] || user?.Created_Date || new Date().toISOString();
    
    // Перевіряємо чи потрібно колесо
    const wheelCheck = await wheelBalanceService.shouldShowWheelReminder(tgId, registrationDate);
    
    if (wheelCheck.needed) {
      // Затримка перед показом нагадування
      await new Promise(r => setTimeout(r, 1500));
      
      let reminderMessage = '';
      let reminderKeyboard = null;
      
      if (wheelCheck.type === 'first') {
        reminderMessage = 
          `🎯 ПЕРШЕ КОЛЕСО БАЛАНСУ\n\n` +
          `${wheelCheck.message}\n\n` +
          `Колесо балансу - це інструмент самоаналізу, який допоможе:\n` +
          `• Оцінити 8 ключових сфер життя\n` +
          `• Зрозуміти свої сильні та слабкі сторони\n` +
          `• Отримати персональні рекомендації від AI\n\n` +
          `⏱ Займає всього 5-10 хвилин\n` +
          `📊 Результат: детальний аналіз твого стану`;
          
        reminderKeyboard = {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎯 Заповнити колесо балансу', callback_data: 'wheel_start' }],
              [{ text: '❓ Дізнатися більше', callback_data: 'wheel_info' }],
              [{ text: '⏭ Пізніше', callback_data: 'dismiss_reminder' }]
            ]
          }
        };
      } else if (wheelCheck.type === 'continue') {
        reminderMessage = 
          `⏰ НЕЗАВЕРШЕНЕ КОЛЕСО\n\n` +
          `${wheelCheck.message}\n\n` +
          `Твій прогрес збережено, можеш продовжити з того місця, де зупинилась.`;
          
        reminderKeyboard = {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Продовжити колесо', callback_data: 'wheel_continue' }],
              [{ text: '🔄 Почати заново', callback_data: 'wheel_restart' }],
              [{ text: '🚪 Скасувати', callback_data: 'wheel_cancel' }]
            ]
          }
        };
      } else if (wheelCheck.type === 'monthly') {
        reminderMessage = 
          `📅 ЧАС ДЛЯ НОВОГО КОЛЕСА\n\n` +
          `${wheelCheck.message}\n\n` +
          `Регулярне заповнення колеса допомагає відслідковувати прогрес у розвитку та підтримувати баланс у всіх сферах життя.`;
          
        reminderKeyboard = {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎯 Заповнити нове колесо', callback_data: 'wheel_start' }],
              [{ text: '📊 Переглянути прогрес', callback_data: 'wheel_stats' }],
              [{ text: '⏭ Пізніше', callback_data: 'dismiss_reminder' }]
            ]
          }
        };
      }
      
      if (reminderMessage) {
        await ctx.reply(reminderMessage, reminderKeyboard);
        return true; // Показали нагадування
      }
    }
    
    return false; // Нагадування не потрібне
    
  } catch (error) {
    console.error('❌ Помилка перевірки колеса при /start:', error);
    return false;
  }
};

// ————————————————————————————————————————————————————————————
// ОНОВІТЬ handleStart ФУНКЦІЮ В auth.js:
// ————————————————————————————————————————————————————————————

export const handleStart = async (ctx) => {
  try {
    const tgId = ctx.from.id;
    const userName = ctx.from.first_name || ctx.from.username || 'Користувач';
    
    // Перевіряємо чи користувач існує
    let user = await userService.getUserByTelegramId(tgId);
    
    if (!user) {
      // Новий користувач - початок онбордингу
      logger.info(`🆕 [auth] Новий користувач ${tgId} (${userName})`);
      
      await ctx.reply(
        `Привіт, ${userName}! 👋\n\n` +
        `Я твій персональний асистент для саморозвитку та ведення щоденника.\n\n` +
        `Почнемо знайомство?`,
        keyboards.startOnboardingKeyboard()
      );
      return;
    }
    
    // Існуючий користувач
    const isRegistered = user['UserRegistered'] === true && user['Status'] === 'Registered User';
    
    if (!isRegistered) {
      // Користувач існує, але не завершив реєстрацію
      logger.info(`🔄 [auth] Користувач ${tgId} не завершив реєстрацію`);
      
      await ctx.reply(
        `Привіт знову, ${userName}! 👋\n\n` +
        `Давай завершимо твою реєстрацію, щоб ти міг користуватися всіма функціями бота.`,
        keyboards.continueOnboardingKeyboard()
      );
      return;
    }
    
    // Зареєстрований користувач
    logger.info(`✅ [auth] Зареєстрований користувач ${tgId} повернувся`);
    
    // Очищаємо стан
    if (ctx.session) {
      ctx.session.step = undefined;
      ctx.session.temp = {};
      ctx.session.wheel = undefined;
    }
    
    await userService.updateUserStep(tgId, ANSWER_STEPS.COMPLETED);
    
    // Вітальне повідомлення
    await ctx.reply(
      `Привіт знову, ${userName}! 👋`,
      keyboards.removeKeyboard()
    );
    
    // Показуємо головне меню
    await new Promise(r => setTimeout(r, 500));
    await ctx.reply('🏠 Головне меню:', keyboards.forceUpdateKeyboard());
    
    // ✅ ПЕРЕВІРЯЄМО ЧИ ПОТРІБНО НАГАДУВАННЯ ПРО КОЛЕСО
    const wheelReminderShown = await checkAndShowWheelReminder(ctx, user);
    
    if (wheelReminderShown) {
      logger.info(`🎯 [auth] Показано нагадування про колесо для ${tgId}`);
    }
    
  } catch (error) {
    logger.error('❌ [auth] Помилка в handleStart:', error);
    await ctx.reply(
      'Виникла помилка при запуску. Спробуй ще раз або зверніться до підтримки.',
      keyboards.mainMenuKeyboard()
    );
  }
};

// ————————————————————————————————————————————————————————————
// ТАКОЖ ДОДАЙТЕ CALLBACK ДЛЯ ВІДХИЛЕННЯ НАГАДУВАННЯ В botController.js:
// ————————————————————————————————————————————————————————————

// У bot.on('callback_query', ...) додайте:
if (data === 'dismiss_reminder') {
  await ctx.answerCbQuery('Нагадування відхилено');
  try {
    await ctx.deleteMessage();
  } catch {
    // Якщо не вдалося видалити, просто ігноруємо
  }
  return;
}

// ————————————————————————————————————————————————————————————
// ЕКСПОРТ ДОПОМІЖНОЇ ФУНКЦІЇ:
// ————————————————————————————————————————————————————————————

export { checkAndShowWheelReminder };