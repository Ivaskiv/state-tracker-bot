import { getBase, tables } from "../../config/database.js";
import { bot } from "../../../server.js"; 

const base = getBase();

export const handleWayForPayWebhook = async (data) => {
  const parsed = typeof data === "string" ? JSON.parse(data) : data;
  const {
    orderReference,
    transactionStatus,
    amount,
    currency,
    email,
    phone,
    createdDate,
    processingDate,
    products,
    TG_id,
  } = parsed;

  const productName = products && products.length ? products[0].name : "Без назви";
  const startDate = createdDate ? new Date(createdDate * 1000).toISOString() : new Date().toISOString();
  const endDate = processingDate ? new Date(processingDate * 1000).toISOString() : null;

  await base(tables.SUBSCRIPTIONS).create([
    {
      fields: {
        TG_id: TG_id || phone,
        UserName: email,
        Order_Reference: orderReference,
        Payment_Status: transactionStatus,
        Status: transactionStatus === "Approved" ? "Active" : transactionStatus,
        Plan_Name: productName,
        Amount: amount,
        Currency: currency,
        Start_Date: startDate,
        End_Date: endDate,
        Is_Active: transactionStatus === "Approved" ? "✅ Активна" : "❌ Неактивна",
      },
    },
  ]);

if (transactionStatus === "Approved" && TG_id) {
  const records = await base(tables.USERS)
    .select({ filterByFormula: `{TG_id}='${TG_id}'` })
    .firstPage();

  if (records.length > 0) {
    const endDateFormatted = endDate ? new Date(endDate).toLocaleDateString("uk-UA") : "не відомо";
    await base(tables.USERS).update([
      {
        id: records[0].id,
        fields: {
          Active_Subscription_Status: `✅ Активна до ${endDateFormatted}`,
          'Active Subscription Plan': productName,
          'Subscription Status': "Active",
          Start_Date: startDate,
          End_Date: endDate,
          Answer_Step: 'completed'
        },
      },
    ]);
    
    // Надсилаємо оновлене меню з клавіатурою
    await bot.telegram.sendMessage(TG_id, "🎉 Підписка активована! Тепер доступні всі функції:", {
      reply_markup: {
        keyboard: [
          ["📈 Щотижневий звіт", "📈 Щомісячний звіт"],    
          ["💎 Афірмація", "📊 Мій прогрес"],
          ["💰 Підписка", "❓ Допомога"],
          ["📝  Інструкції", "📞 Зв'язок з нами"]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      }
    });
  }
}

  let statusText;
  switch (transactionStatus) {
    case "Approved":
      statusText = `💰 Оплата успішна!\nПлан "${productName}" активовано до ${endDate ? new Date(endDate).toLocaleDateString("uk-UA") : "не відомо"}`;
      break;
    case "Declined":
      statusText = `❌ Оплата не пройшла. Будь ласка, спробуйте ще раз.`;
      break;
    case "Pending":
      statusText = `⏳ Оплата очікує підтвердження.`;
      break;
    default:
      statusText = `⚠️ Статус оплати: ${transactionStatus}`;
  }

  if (TG_id) {
    await bot.telegram.sendChatAction(TG_id, "typing");
    await new Promise((r) => setTimeout(r, 1500));
    await bot.telegram.sendMessage(TG_id, statusText);
  }

  return statusText;
};
