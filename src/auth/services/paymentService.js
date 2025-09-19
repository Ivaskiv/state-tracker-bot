// src/auth/services/paymentService.js - ВИПРАВЛЕНО WEBHOOK ТА АКТИВАЦІЯ
import { getBase, tables } from "../../config/database.js";
import { bot } from "../../../server.js"; 
import keyboards from "../../utils/keyboards.js";

const base = getBase();

export const handleWayForPayWebhook = async (processedData) => {
  try {
    console.log('[paymentService] 🔄 Обробка webhook:', processedData);
    
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
      startDate,
      endDate,
      createdDate,
      processingDate
    } = processedData;

    // ДОДАНО: зберігаємо всі платежі в таблицю Subscriptions
    const subscriptionRecord = await base(tables.SUBSCRIPTIONS).create({
      TG_id: tgId || phone,
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
    });

    console.log('[paymentService] ✅ Підписку збережено:', subscriptionRecord.id);

    // Якщо платіж успішний - активуємо підписку користувача
    if (transactionStatus === "Approved" && tgId) {
      await activateUserSubscription(tgId, {
        planName,
        planKey,
        amount,
        orderReference,
        startDate,
        endDate
      });
    }

    return {
      success: true,
      message: `Webhook оброблено для ${orderReference}`,
      subscriptionId: subscriptionRecord.id
    };

  } catch (error) {
    console.error('[paymentService] ❌ Помилка webhook:', error);
    throw error;
  }
};

// ДОДАНО: активація підписки користувача
// Замінити функцію activateUserSubscription
const activateUserSubscription = async (tgId, subscriptionData) => {
  try {
    console.log('[paymentService] 🎯 Активація підписки для:', tgId);
    
    const users = await base(tables.USERS)
      .select({ filterByFormula: `{TG_id}='${tgId}'` })
      .firstPage();

    if (users.length === 0) {
      console.error('[paymentService] ❌ Користувача не знайдено:', tgId);
      return;
    }

    const user = users[0];
    const endDate = new Date(subscriptionData.endDate);
    const endDateFormatted = endDate.toLocaleDateString("uk-UA");
    
    await base(tables.USERS).update([
      {
        id: user.id,
        fields: {
          'Subscription Status': "Active",
          'Active Subscription Plan': subscriptionData.planName,
          Active_Subscription_Status: `✅ Активна до ${endDateFormatted}`,
          Start_Date: new Date().toISOString(),
          End_Date: endDate.toISOString(),
          Last_Activity: new Date().toISOString(),
          Answer_Step: 'completed'
        },
      },
    ]);
    
    console.log('[paymentService] ✅ Користувача оновлено:', tgId);
    
    try {
      const successMessage = 
        `🎉 Підписка успішно активована!\n\n` +
        `📋 План: ${subscriptionData.planName}\n` +
        `💰 Сплачено: ${subscriptionData.amount}€\n` +
        `📅 Діє до: ${endDateFormatted}\n\n` +
        `✅ Тепер тобі доступні всі функції бота!\n\n` +
        `🚀 Можеш почати з колеса балансу або AI наставника.`;

      await bot.telegram.sendMessage(tgId, successMessage, keyboards.mainMenuKeyboard());
      
      console.log('[paymentService] ✅ Повідомлення про активацію надіслано');
    } catch (messageError) {
      console.error('[paymentService] ⚠️ Не вдалося надіслати повідомлення:', messageError);
    }

  } catch (error) {
    console.error('[paymentService] ❌ Помилка активації підписки:', error);
    throw error;
  }
};

// ДОДАНО: функція для перевірки та нагадування про закінчення підписки
export const checkExpiringSubscriptions = async (bot) => {
  try {
    console.log('[paymentService] 🔍 Перевірка підписок що закінчуються');
    
    // Знаходимо підписки що закінчуються завтра
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const expiringUsers = await base(tables.USERS)
      .select({
        filterByFormula: `AND(
          {Subscription Status} = 'Active',
          DATESTR({End_Date}) = '${tomorrowStr}'
        )`,
        fields: ['TG_id', 'User Name', 'Active Subscription Plan', 'End_Date']
      })
      .all();

    console.log('[paymentService] 📊 Знайдено підписок що закінчуються:', expiringUsers.length);

    for (const user of expiringUsers) {
      const tgId = user.fields.TG_id;
      const planName = user.fields['Active Subscription Plan'] || 'План';
      const endDate = new Date(user.fields.End_Date).toLocaleDateString('uk-UA');
      
      const reminderMessage = 
        `⚠️ Підписка закінчується завтра!\n\n` +
        `📋 План: ${planName}\n` +
        `📅 Діє до: ${endDate}\n\n` +
        `💰 Продовж підписку, щоб не втратити доступ до всіх функцій!\n\n` +
        `📞 Зв'яжися з підтримкою: nadyastarway@gmail.com`;

      try {
        await bot.telegram.sendMessage(tgId, reminderMessage, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💰 Продовжити підписку', callback_data: 'subscription_plans' }],
              [{ text: '📞 Зв\'язатися з підтримкою', callback_data: 'contact_support' }]
            ]
          }
        });
        
        console.log('[paymentService] ✅ Нагадування надіслано:', tgId);
      } catch (sendError) {
        console.error('[paymentService] ❌ Помилка надсилання нагадування:', tgId, sendError);
      }
      
      // Затримка між повідомленнями
      await new Promise(r => setTimeout(r, 1000));
    }

  } catch (error) {
    console.error('[paymentService] ❌ Помилка перевірки підписок:', error);
  }
};

export default {
  handleWayForPayWebhook,
  checkExpiringSubscriptions
};