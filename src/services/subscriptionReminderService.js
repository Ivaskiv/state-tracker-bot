import { getBase, tables } from "../config/database.js";
import { bot } from "../../server.js";

const base = getBase();

const formatDateUA = (dateStr) =>
  new Date(dateStr).toLocaleDateString("uk-UA");

const daysUntilEnd = (endDate) =>
  Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24));

const sendReminder = async (user, daysLeft) => {
  if (!user.TG_id) return;

  const message =
    daysLeft > 0
      ? `⏳ Привіт, ${user["User Name"]}! До закінчення твоєї підписки залишилось ${daysLeft} дн.\n📦 Закінчується: ${formatDateUA(user.End_Date)}`
      : `⚠️ Привіт, ${user["User Name"]}! Твоя підписка закінчилась сьогодні (${formatDateUA(user.End_Date)}).\n📌 Обери один із варіантів для продовження.`;

  const buttons = [
    [{ text: "Продовжити підписку", url: user.subscriptionLink }],
    [{ text: "Обрати інший план", url: user.otherPlansLink }],
  ];

  await bot.telegram.sendChatAction(user.TG_id, "typing");
  await new Promise((r) => setTimeout(r, 1000));
  await bot.telegram.sendMessage(user.TG_id, message, {
    reply_markup: { inline_keyboard: buttons },
  });
};

export const sendSubscriptionReminders = async () => {
  try {
    const users = await base(tables.USERS)
      .select({ filterByFormula: "{Subscription Status}='Active'" })
      .firstPage();

    for (const u of users) {
      const fields = u.fields;
      const daysLeft = daysUntilEnd(fields.End_Date);
      if ([3, 2, 1, 0].includes(daysLeft)) {
        await sendReminder(fields, daysLeft);
      }
    }
  } catch (err) {
    console.error("❌ Error sending subscription reminders:", err);
  }
};
