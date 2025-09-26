// src/controllers/handlers/startHandler.js - ШВИДКИЙ СТАРТ

import typing from '../../utils/typing.js';
import keyboards from '../../utils/keyboards.js';
import paymentService from '../../auth/services/paymentService.js';
import { handleStart } from '../../auth/modules/auth.js';

const FAST_TIMEOUT = 15000; // Збільшуємо до 15 секунд для Airtable

const handle = async (ctx, userService) => {
  const tgId = ctx.from.id;
  const name = ctx.from.first_name || 'Користувач';
  
  console.log(`🚀 /start від ${tgId} (${name})`);

  try {
    // Показуємо typing довше для складних операцій
    await typing(ctx, 1500);

    // 1. СПОЧАТКУ НАМАГАЄМОСЯ ОТРИМАТИ КОРИСТУВАЧА (з більшим timeout)
    let user = null;
    let dbError = null;
    
    try {
      console.log(`[startHandler] 🔍 Пошук користувача ${tgId}...`);
      
      // Нормальний запит з розумним timeout
      user = await Promise.race([
        userService.getUserByTelegramId(tgId),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Search timeout')), FAST_TIMEOUT)
        )
      ]);
      
      if (user) {
        console.log(`[startHandler] ✅ Користувач ЗНАЙДЕНИЙ:`, {
          name: user['User Name'],
          registered: user.UserRegistered,
          subscription: user['Active_Subscription_Status']?.substring(0, 30)
        });
      } else {
        console.log(`[startHandler] ❌ Користувача ${tgId} НЕ ЗНАЙДЕНО в базі`);
      }
      
    } catch (error) {
      dbError = error;
      console.warn(`[startHandler] ⚠️ Помилка пошуку користувача: ${error.message}`);
      
      if (error.message.includes('Search timeout')) {
        console.log(`[startHandler] ⏰ Timeout пошуку - спробуємо ще раз без timeout`);
        
        // Спробуємо ще раз без timeout
        try {
          user = await userService.getUserByTelegramId(tgId);
          if (user) {
            console.log(`[startHandler] ✅ Користувач знайдений при повторному пошуку`);
            dbError = null; // Скидаємо помилку
          }
        } catch (retryError) {
          console.error(`[startHandler] ❌ Повторний пошук не вдався:`, retryError.message);
        }
      }
    }

    // 2. АНАЛІЗУЄМО РЕЗУЛЬТАТ
    if (!user) {
      if (dbError && !dbError.message.includes('timeout')) {
        // Серйозна помилка бази
        await ctx.reply(
          `⚠️ Тимчасові проблеми з базою даних.\n\n🔧 Спробуй через хвилину.`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔄 Спробувати ще раз', callback_data: 'restart' }],
                [{ text: '📞 Підтримка', callback_data: 'contact_support' }]
              ]
            }
          }
        );
        return;
      }
      
      // Користувача справді немає - створюємо нового
      console.log(`🆕 [startHandler] Користувача не існує - створюємо нового`);
      
      try {
        await ctx.reply('🔄 Створюємо твій профіль...');
        user = await createNewUserWithTrial(tgId, name, userService);
        
        if (user) {
          console.log(`✅ [startHandler] Користувач створений з пробною підпискою`);
          await startFirstWheelBalance(ctx, user);
          return;
        }
      } catch (createError) {
        console.error('[startHandler] ❌ Помилка створення користувача:', createError);
      }
      
      // Fallback - стандартна реєстрація
      console.log('[startHandler] 🔄 Стандартна реєстрація');
      await handleStart(ctx);
      return;
    }

    // 3. КОРИСТУВАЧ ЗНАЙДЕНИЙ - АНАЛІЗУЄМО СТАН
    console.log(`✅ [startHandler] Користувач знайдений, аналізуємо...`);
    
    if (!user.UserRegistered) {
      console.log(`[startHandler] ⚠️ Користувач не завершив реєстрацію`);
      await handleStart(ctx);
      return;
    }

    // 4. ПЕРЕВІРКА ПІДПИСКИ
    const hasActiveSubscription = userService.hasActiveAccess(user);
    console.log(`[startHandler] 💰 Підписка активна: ${hasActiveSubscription}`);
    console.log(`[startHandler] 📊 Статус підписки: "${user['Active_Subscription_Status']}"`);
    
    if (!hasActiveSubscription) {
      await showSubscriptionRequired(ctx, user);
      return;
    }

    // 5. ПЕРЕВІРКА КОЛЕСА БАЛАНСУ
    console.log(`[startHandler] 🎯 Перевіряємо колесо балансу...`);
    
    try {
      const hasCompletedWheel = await checkFirstWheelCompletion(tgId);
      console.log(`[startHandler] 🎯 Колесо завершено: ${hasCompletedWheel}`);
      
      if (!hasCompletedWheel) {
        console.log(`[startHandler] 🎯 Потрібне перше колесо`);
        await startFirstWheelBalance(ctx, user);
      } else {
        console.log(`[startHandler] ✅ Все готово - показуємо головне меню`);
        await showMainMenu(ctx, user);
      }
      
    } catch (wheelError) {
      console.error('[startHandler] Помилка перевірки колеса:', wheelError);
      // При помилці показуємо меню
      console.log(`[startHandler] 🏠 Fallback - показуємо головне меню`);
      await showMainMenu(ctx, user);
    }

  } catch (error) {
    console.error('[startHandler] ❌ Критична помилка:', error);
    await ctx.reply('❌ Помилка. Спробуй ще раз /start', keyboards.mainMenuKeyboard());
  }
};

// Швидке створення користувача з пробною підпискою
const createNewUserWithTrial = async (tgId, name, userService) => {
  try {
    console.log(`[createNewUserWithTrial] Швидке створення ${tgId}`);
    
    const user = await userService.createUser({
      tgId,
      name,
      registrationStatus: 'New'
    });

    if (user) {
      // Активуємо пробну підписку в фоні (не чекаємо)
      paymentService.activateTrialSubscription(tgId, 7)
        .then(() => console.log(`[createNewUserWithTrial] ✅ Пробна підписка активована для ${tgId}`))
        .catch(e => console.warn(`[createNewUserWithTrial] ⚠️ Помилка пробної підписки:`, e.message));
    }

    return user;
  } catch (error) {
    console.error('[createNewUserWithTrial] Помилка:', error);
    throw error;
  }
};

// Швидка перевірка колеса
const checkFirstWheelCompletion = async (tgId) => {
  try {
    const { getBase, tables } = await import('../../config/database.js');
    const base = getBase();
    
    const records = await Promise.race([
      base(tables.WHEEL_BALANCE)
        .select({
          filterByFormula: `AND({TG_id}="${tgId}", {Status}="Completed")`,
          maxRecords: 1
        })
        .firstPage(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Wheel check timeout')), 3000)
      )
    ]);
    
    return records.length > 0;
  } catch (error) {
    console.warn('[checkFirstWheelCompletion] Помилка або timeout:', error.message);
    return false; // При помилці вважаємо що колесо не пройдено
  }
};

// Запуск першого колеса
const startFirstWheelBalance = async (ctx, user) => {
  const userName = user?.['User Name'] || ctx.from.first_name || 'Користувач';
  
  const message = 
    `🎯 ПЕРШЕ КОЛЕСО БАЛАНСУ\n\n` +
    `Привіт, ${userName}! 👋\n\n` +
    `Щоб персоналізувати AI-наставника, заповн перше колесо балансу.\n\n` +
    `📊 Оцініш 8 сфер життя (5-10 хв)\n` +
    `🎯 Отримаєш персональні рекомендації\n\n` +
    `Готова почати?`;

  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎯 Почати колесо балансу', callback_data: 'wheel_start' }],
        [{ text: '❓ Що це таке?', callback_data: 'wheel_info' }],
        [{ text: '⏭ Пізніше', callback_data: 'main_menu' }]
      ]
    }
  });
};

// Показ головного меню
const showMainMenu = async (ctx, user) => {
  const userName = user?.['User Name'] || ctx.from.first_name || 'Користувач';
  const status = user?.['Active_Subscription_Status'] || '✅ Активна';
  
  // Перевіряємо чи це повернення користувача
  const lastActivity = user?.Last_Activity;
  const isReturningUser = lastActivity && 
    (new Date() - new Date(lastActivity)) > 3600000; // більше години

  let message = '';
  
  if (isReturningUser) {
    message = 
      `👋 Привіт, ${userName}!\n\n` +
      `${status}\n\n` +
      `Готова продовжувати свій розвиток? 💪`;
  } else {
    message = 
      `🎉 Вітаю, ${userName}!\n\n` +
      `${status}\n` +
      `🚀 Готова до продуктивного дня?`;
  }

  await ctx.reply(message, keyboards.mainMenuKeyboard());
  
  // Оновлюємо активність в фоні
  userService.updateUser(ctx.from.id, { 
    Last_Activity: new Date().toISOString() 
  }).catch(e => console.warn('Не вдалося оновити Last_Activity:', e.message));
};

// Показ повідомлення про підписку
const showSubscriptionRequired = async (ctx, user) => {
  const userName = user?.['User Name'] || ctx.from.first_name || 'Користувач';
  
  const message = 
    `👋 З поверненням, ${userName}!\n\n` +
    `💡 Для повного доступу потрібна активна підписка:\n\n` +
    `🎯 AI коучинг 24/7\n` +
    `📊 Колесо балансу\n` +
    `📈 Персональна аналітика\n\n` +
    `💰 Активуй підписку:`;

  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎁 Пробний період 7 днів', callback_data: 'activate_trial' }],
        [{ text: '💰 Переглянути плани', callback_data: 'subscription_plans' }],
        [{ text: '🔄 Оновити статус', callback_data: 'sync_subscription' }]
      ]
    }
  });
};

export default { handle };