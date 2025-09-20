// src/auth/services/paymentService.js - ВИПРАВЛЕНО АКТИВАЦІЮ ПІДПИСКИ ВІДПОВІДНО ДО ТЗ

import { getBase, tables } from "../../config/database.js";
import { bot } from "../../../server.js"; 
import keyboards from "../../utils/keyboards.js";
import userService from "./userService.js";

const base = getBase();

// ✅ ОБРОБКА WEBHOOK WAYFORPAY
export const handleWayForPayWebhook = async (processedData) => {
  try {
    console.log('[paymentService] 🔄 Обробка webhook:', JSON.stringify(processedData, null, 2));
    
    const {
      tgId,
      orderReference,
      transactionStatus,
      amount,
      currency,
      email,
      phone,
      planName,
      planKey,
      planDuration,
      startDate,
      endDate,
      createdDate,
      processingDate
    } = processedData;

    // ✅ 1. ЗБЕРІГАЄМО ВСІ ПЛАТЕЖІ В ТАБЛИЦЮ SUBSCRIPTIONS
    console.log('[paymentService] 💾 Збереження платежу в Subscriptions...');
    
    const subscriptionRecord = await base(tables.SUBSCRIPTIONS).create({
      TG_id: String(tgId),
      'User Name': email || `User_${tgId}`,
      Order_Reference: orderReference,
      Payment_Status: transactionStatus,
      Status: transactionStatus === "Approved" ? "Active" : transactionStatus,
      Plan_Name: planName,
      Amount: amount,
      Currency: currency,
      Start_Date: startDate,
      End_Date: endDate,
      Is_Active: transactionStatus === "Approved" ? "✅ Активна" : "❌ Неактивна",
      Created_At: createdDate || new Date().toISOString(),
      Processing_Date: processingDate || null
    });

    console.log('[paymentService] ✅ Підписку збережено в Subscriptions:', subscriptionRecord.id);

    // ✅ 2. ЯКЩО ПЛАТІЖ УСПІШНИЙ - АКТИВУЄМО ПІДПИСКУ КОРИСТУВАЧА
    if (transactionStatus === "Approved" && tgId) {
      console.log('[paymentService] 🎯 Активація підписки користувача...');
      
      await activateUserSubscription(tgId, {
        planName,
        planKey,
        amount,
        orderReference,
        startDate,
        endDate,
        planDuration
      });
    } else {
      console.log(`[paymentService] ⚠️ Платіж не схвалено або немає TG_id. Status: ${transactionStatus}, TG_id: ${tgId}`);
    }

    return {
      success: true,
      message: `Webhook оброблено для ${orderReference}`,
      subscriptionId: subscriptionRecord.id,
      activated: transactionStatus === "Approved"
    };

  } catch (error) {
    console.error('[paymentService] ❌ Помилка webhook:', error);
    throw error;
  }
};

// ✅ АКТИВАЦІЯ ПІДПИСКИ КОРИСТУВАЧА
const activateUserSubscription = async (tgId, subscriptionData) => {
  try {
    console.log(`[paymentService] 🎯 Активація підписки для ${tgId}:`, JSON.stringify(subscriptionData, null, 2));
    
    // ✅ Знаходимо користувача
    const user = await userService.getUserByTelegramId(tgId);
    if (!user) {
      console.error(`[paymentService] ❌ Користувача ${tgId} не знайдено`);
      return;
    }

    const endDate = new Date(subscriptionData.endDate);
    const endDateFormatted = endDate.toLocaleDateString("uk-UA");
    const userName = user['User Name'] || 'Користувач';
    
    // ✅ Оновлюємо дані користувача в таблиці Users
    const updatedUser = await userService.updateUser(tgId, {
      'Subscription Status': "Active",
      'Active Subscription Plan': subscriptionData.planName,
      Active_Subscription_Status: `✅ Активна до ${endDateFormatted}`,
      Start_Date: subscriptionData.startDate,
      End_Date: subscriptionData.endDate,
      Last_Activity: new Date().toISOString(),
      Answer_Step: 'completed'
    });
    
    console.log(`[paymentService] ✅ Користувача ${tgId} оновлено:`, {
      plan: subscriptionData.planName,
      status: `✅ Активна до ${endDateFormatted}`,
      endDate: endDateFormatted
    });
    
    // ✅ Надсилаємо повідомлення користувачу про успішну активацію
    try {
      const successMessage = 
        `🎉 Підписка успішно активована!\n\n` +
        `👋 Привіт, ${userName}!\n\n` +
        `📋 План: ${subscriptionData.planName}\n` +
        `💰 Сплачено: ${subscriptionData.amount}€\n` +
        `📅 Діє до: ${endDateFormatted}\n\n` +
        `✅ Тепер тобі доступні всі функції бота:\n` +
        `• 🌞 Ранкові питання (08:00)\n` +
        `• 🌙 Вечірні питання (21:30)\n` +
        `• 🤖 AI наставник\n` +
        `• 🎯 Колесо балансу\n` +
        `• 📊 Персональні звіти\n\n` +
        `🚀 Готова почати трансформацію?`;

      await bot.telegram.sendMessage(tgId, successMessage, keyboards.mainMenuKeyboard());
      
      console.log(`[paymentService] ✅ Повідомлення про активацію надіслано користувачу ${tgId}`);

      // ✅ Додатково пропонуємо запустити колесо балансу
      setTimeout(async () => {
        try {
          await bot.telegram.sendMessage(
            tgId, 
            '🎯 Рекомендую почати з колеса балансу — це займе лише 3 хвилини і дасть чіткий план дій!',
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🎯 Запустити колесо балансу', callback_data: 'wheel_start' }],
                  [{ text: '🤖 Запитати AI наставника', callback_data: 'ai_continue' }]
                ]
              }
            }
          );
        } catch (laterError) {
          console.error('[paymentService] ⚠️ Помилка додаткового повідомлення:', laterError);
        }
      }, 2000);
      
    } catch (messageError) {
      console.error(`[paymentService] ⚠️ Не вдалося надіслати повідомлення користувачу ${tgId}:`, messageError);
    }

  } catch (error) {
    console.error(`[paymentService] ❌ Помилка активації підписки для ${tgId}:`, error);
    throw error;
  }
};

// ✅ ПЕРЕВІРКА ТА НАГАДУВАННЯ ПРО ЗАКІНЧЕННЯ ПІДПИСКИ
export const checkExpiringSubscriptions = async (bot) => {
  try {
    console.log('[paymentService] 🔍 Перевірка підписок що закінчуються');
    
    // Знаходимо підписки що закінчуються завтра
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const expiringUsers = await userService.getUsersWithExpiringSubscriptions(1);
    
    if (!expiringUsers.length) {
      console.log('[paymentService] ℹ️ Немає підписок що закінчуються завтра');
      return 0;
    }

    console.log(`[paymentService] 📊 Знайдено ${expiringUsers.length} підписок що закінчуються завтра`);

    let remindersSent = 0;

    for (const user of expiringUsers) {
      const tgId = user.TG_id;
      const planName = user['Active Subscription Plan'] || 'План';
      const endDate = new Date(user.End_Date).toLocaleDateString('uk-UA');
      const userName = user['User Name'] || 'Користувач';
      
      const reminderMessage = 
        `⚠️ Підписка закінчується завтра!\n\n` +
        `👋 ${userName}, твоя підписка на завершенні.\n\n` +
        `📋 План: ${planName}\n` +
        `📅 Діє до: ${endDate}\n\n` +
        `💰 Продовж підписку зараз, щоб не втратити доступ до всіх функцій бота!\n\n` +
        `📞 Питання? Пиши: nadyastarway@gmail.com`;

      try {
        await bot.telegram.sendMessage(tgId, reminderMessage, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💰 Продовжити підписку', callback_data: 'subscription_plans' }],
              [{ text: '📞 Зв\'язатися з підтримкою', callback_data: 'contact_support' }]
            ]
          }
        });
        
        remindersSent++;
        console.log(`[paymentService] ✅ Нагадування надіслано користувачу ${tgId}`);
      } catch (sendError) {
        console.error(`[paymentService] ❌ Помилка надсилання нагадування ${tgId}:`, sendError.message);
      }
      
      // Затримка між повідомленнями
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`[paymentService] 📊 Відправлено ${remindersSent}/${expiringUsers.length} нагадувань`);
    return remindersSent;

  } catch (error) {
    console.error('[paymentService] ❌ Помилка перевірки підписок:', error);
    return 0;
  }
};

// ✅ ДЕАКТИВАЦІЯ ЗАКІНЧЕНИХ ПІДПИСОК
export const deactivateExpiredSubscriptions = async () => {
  try {
    console.log('[paymentService] 🔍 Пошук закінчених підписок');
    
    const today = new Date().toISOString().split('T')[0];
    
    // Знаходимо всіх користувачів з активними підписками, що закінчилися
    const users = await userService.getActiveUsers();
    const expiredUsers = [];
    
    for (const user of users) {
      const endDate = user['End_Date'];
      const isActive = user['Active_Subscription_Status']?.includes('✅ Активна');
      
      if (isActive && endDate) {
        const expiry = new Date(endDate).toISOString().split('T')[0];
        if (expiry < today) {
          expiredUsers.push(user);
        }
      }
    }

    if (expiredUsers.length === 0) {
      console.log('[paymentService] ✅ Немає закінчених підписок для деактивації');
      return 0;
    }

    console.log(`[paymentService] 📊 Знайдено ${expiredUsers.length} закінчених підписок`);

    let deactivated = 0;

    for (const user of expiredUsers) {
      const tgId = user.TG_id;
      const userName = user['User Name'] || 'Користувач';
      const planName = user['Active Subscription Plan'] || 'План';
      
      try {
        // Деактивуємо підписку
        await userService.updateUser(tgId, {
          'Active_Subscription_Status': '❌ Закінчена',
          'Subscription Status': 'Expired',
          Answer_Step: 'completed'
        });

        deactivated++;
        console.log(`[paymentService] ✅ Деактивовано підписку для ${tgId} (${userName})`);

      } catch (updateError) {
        console.error(`[paymentService] ❌ Помилка деактивації для ${tgId}:`, updateError);
      }
    }

    console.log(`[paymentService] 📊 Деактивовано ${deactivated}/${expiredUsers.length} підписок`);
    return deactivated;

  } catch (error) {
    console.error('[paymentService] ❌ Помилка деактивації підписок:', error);
    return 0;
  }
};

// ✅ АКТИВАЦІЯ ПРОБНОЇ ПІДПИСКИ
export const activateTrialSubscription = async (tgId, days = 3) => {
  try {
    console.log(`[paymentService] 🧪 Активація пробної підписки для ${tgId} на ${days} днів`);
    
    const user = await userService.getUserByTelegramId(tgId);
    if (!user) {
      console.error(`[paymentService] ❌ Користувача ${tgId} не знайдено`);
      return false;
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    
    const endDateFormatted = endDate.toLocaleDateString('uk-UA');
    const userName = user['User Name'] || 'Користувач';

    // Оновлюємо користувача
    await userService.updateUser(tgId, {
      'Subscription Status': 'Active',
      'Active Subscription Plan': '🧪 Пробний період',
      Active_Subscription_Status: `✅ Активна до ${endDateFormatted}`,
      Start_Date: startDate.toISOString(),
      End_Date: endDate.toISOString(),
      Last_Activity: new Date().toISOString(),
      Answer_Step: 'completed'
    });

    // Зберігаємо в таблицю Subscriptions
    await base(tables.SUBSCRIPTIONS).create({
      TG_id: String(tgId),
      'User Name': userName,
      Order_Reference: `TRIAL_${tgId}_${Date.now()}`,
      Payment_Status: 'Approved',
      Status: 'Active',
      Plan_Name: '🧪 Пробний період',
      Amount: 0,
      Currency: 'EUR',
      Start_Date: startDate.toISOString(),
      End_Date: endDate.toISOString(),
      Is_Active: '✅ Активна',
      Created_At: new Date().toISOString()
    });

    console.log(`[paymentService] ✅ Пробну підписку активовано для ${tgId} до ${endDateFormatted}`);

    // Надсилаємо повідомлення
    try {
      const trialMessage = 
        `🧪 Пробний період активовано!\n\n` +
        `👋 ${userName}, вітаємо!\n\n` +
        `📅 Діє до: ${endDateFormatted}\n` +
        `🎁 Усі функції безкоштовно ${days} дні!\n\n` +
        `✅ Тепер доступні:\n` +
        `• 🌞 Ранкові питання\n` +
        `• 🌙 Вечірні питання\n` +
        `• 🤖 AI наставник\n` +
        `• 🎯 Колесо балансу\n` +
        `• 📊 Персональні звіти\n\n` +
        `🚀 Почнемо з колеса балансу?`;

      await bot.telegram.sendMessage(tgId, trialMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎯 Запустити колесо балансу', callback_data: 'wheel_start' }],
            [{ text: '🏠 Головне меню', callback_data: 'main_menu' }]
          ]
        }
      });

    } catch (messageError) {
      console.error(`[paymentService] ⚠️ Помилка надсилання повідомлення про пробну підписку:`, messageError);
    }

    return true;

  } catch (error) {
    console.error(`[paymentService] ❌ Помилка активації пробної підписки для ${tgId}:`, error);
    return false;
  }
};

export default {
  handleWayForPayWebhook,
  checkExpiringSubscriptions,
  deactivateExpiredSubscriptions,
  activateTrialSubscription
};