import { Telegraf, Markup } from "telegraf";
import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";

import { initScheduler } from "./src/utils/scheduler.js";
import { handleStart } from "./src/services/userService.js";
import { getBase, tables } from "./src/config/database.js";
import keyboards from "./src/utils/keyboards.js";
import { handleAnswer } from "./src/handlers/questionHandler.js";

dotenv.config();

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN не заданий у .env");
  process.exit(1);
}

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const base = getBase();

// =====================
// /start
// =====================
bot.start(async (ctx) => {
  const tgId = ctx.from.id;
  const name = ctx.from.first_name;
  const { user, subscriptionActive } = await handleStart({ tgId, name });

  const profileMsg =
    `👋 Привіт, ${name}!\n\n` +
    `📊 ТВІЙ ПРОФІЛЬ\n` +
    `👤 Ім'я: ${user["User Name"]}\n` +
    `🆔 ID: ${user.TG_id}\n` +
    `📅 Реєстрація: ${user.UserRegistered ? new Date(user.DateUserRegistered).toLocaleDateString("uk-UA") : "не зареєстрований"}\n` +
    `📦 ПІДПИСКА: ${subscriptionActive ? user.Active_Subscription_Status : "❌ Неактивна"}`;

  await ctx.reply(profileMsg, keyboards.mainMenuKeyboard());
});

// =====================
// Обробка кнопок головного меню та відповідей на питання
// =====================
bot.on("text", async (ctx) => {
  const text = ctx.message.text;
  const tgId = ctx.from.id;
  const name = ctx.from.first_name;

  if (ctx.session?.questionType) {
    await handleAnswer(ctx, text);
    return;
  }

  switch (text) {
    case "💎 Афірмація":
      try {
        const tgIdStr = String(tgId);
        const todayStr = new Date().toISOString().slice(0, 10);

        const existing = await base(tables.USER_AFFIRMATIONS)
          .select({ filterByFormula: `AND({User ID}='${tgIdStr}', {Date}='${todayStr}')`, maxRecords: 1 })
          .firstPage();

        if (existing.length > 0) {
          const todayAffirmation = existing[0].fields["AffirmationText"];
          await ctx.reply(`💎 Твоя афірмація на сьогодні:\n\n"${todayAffirmation}"\n\n✨ Повторюй її як натхнення для дня!`);
          return;
        }

        const unsentAff = await base(tables.AFFIRMATIONS)
          .select({ filterByFormula: `NOT({Used})`, maxRecords: 1, sort: [{ field: "Date Created", direction: "asc" }] })
          .firstPage();

        let affText = "";
        if (unsentAff.length > 0) {
          const aff = unsentAff[0];
          affText = typeof aff.fields["Affirmation"] === "object" ? aff.fields["Affirmation"]?.value : aff.fields["Affirmation"];
          await base(tables.AFFIRMATIONS).update([{ id: aff.id, fields: { Used: true } }]);
        }

        if (!affText) affText = "Кожен день приносить нові можливості для зростання, впевненості та радості у ваших діях.";

        await base(tables.USER_AFFIRMATIONS).create([{ fields: { "User ID": tgIdStr, "Date": todayStr, "AffirmationText": affText } }]);
        await ctx.reply(`💎 Твоя афірмація на сьогодні:\n\n"${affText}"\n\n✨ Нехай вона надихає тебе весь день!`);
      } catch (err) {
        console.error("❌ Error handling affirmation:", err);
        await ctx.reply("💎 Виникла невелика помилка при отриманні афірмації. Спробуйте ще раз пізніше.");
      }
      break;

    case "💰 Підписка":
      {
        const { user, subscriptionActive } = await handleStart({ tgId, name });
        const subMsg =
          `📊 ТВІЙ ПРОФІЛЬ\n👤 Ім'я: ${user["User Name"]}\n🆔 ID: ${user.TG_id}\n` +
          `📅 Реєстрація: ${user.UserRegistered ? new Date(user.DateUserRegistered).toLocaleDateString("uk-UA") : "не зареєстрований"}\n` +
          `📦 ПІДПИСКА: ${subscriptionActive ? user.Active_Subscription_Status : "❌ Неактивна"}`;
        const buttons = [];
        if (!subscriptionActive) {
          buttons.push(Markup.button.url("Продовжити підписку", user.subscriptionLink));
          buttons.push(Markup.button.url("Обрати інший план", user.otherPlansLink));
        }
        await ctx.reply(subMsg, buttons.length ? Markup.inlineKeyboard(buttons) : undefined);
      }
      break;

    case "📊 Мій прогрес":
      {
        const reflections = await base(tables.USER_REFLECTIONS).select({ filterByFormula: `{User ID}='${tgId}'` }).firstPage();
        const total = reflections.length;
        const morningCount = reflections.filter(r => r.fields["Question Type"] === "morning").length;
        const eveningCount = reflections.filter(r => r.fields["Question Type"] === "evening").length;
        const progressMsg =
          `📊 Ваш прогрес:\n📝 Всього відповідей: ${total}\n🌅 Ранкові: ${morningCount}\n🌙 Вечірні: ${eveningCount}\n💡 Пропозиція: продовжуйте відповідати щодня для кращої інтроспекції та розвитку.`;
        await ctx.reply(progressMsg);
      }
      break;

    case "❓ Допомога":
      await ctx.reply("❓ Допомога та контакти\nЯкщо виникли питання — пишіть на nadyastarway@gmail.com\nАбо перегляньте інструкції у головному меню.");
      break;

    case "📋 Інструкції":
      await ctx.reply(
        `📋 ЯК КОРИСТУВАТИСЯ БОТОМ\n\n🚀 **ПОЧАТОК РОБОТИ:**\n• Натисни /start для реєстрації\n• Перевір свою підписку в розділі "💰 Підписка"\n• Активуй підписку за потреби\n\n📝 **ЩОДЕННІ ПРАКТИКИ:**\n• "📝 Ранкові питання"\n• "🌙 Вечірні питання"\n• "💎 Афірмація"\n\n📊 **ВІДСТЕЖЕННЯ ПРОГРЕСУ:**\n• "📊 Мій прогрес"\n\n🎯 **21-ДЕННИЙ МАРАФОН:**\n• Кожен день: відео → аудіо → PDF → завдання\n\n💡 **ПОРАДИ:**\n• Використовуй бота щодня\n• Будь чесною у відповідях\n• Технічні проблеми через "📞 Зв'язок з нами"`
      );
      break;

    case "📞 Зв'язок з нами":
      await ctx.reply(
        `📞 ЗВ'ЯЗОК З НАМИ\n\n💬 **ТЕХНІЧНА ПІДТРИМКА:**\nEmail: nadyastarway@gmail.com\nTelegram: @Nadya2316\nTelegram: @vira_333\n\n📋 **ПИТАННЯ ПРО МАРАФОН:**\nПиши ментору за питаннями\n\n⏰ **ЧАС ВІДПОВІДІ:**\nПротягом 24 годин\n\n🎯 **ЗАМОВИТИ ПЕРСОНАЛЬНУ КОНСУЛЬТАЦІЮ:**\nНапиши на Email "Персональна консультація"`,
        keyboards.supportKeyboard()
      );
      break;

    default:
      await ctx.reply("📝 Для перегляду профілю введіть /profile або /start для реєстрації.");
      break;
  }
});

// =====================
// Express + webhook/polling
// =====================
const app = express();
app.use(bodyParser.json());

app.post("/wayforpay-webhook", async (req, res) => res.status(200).send("OK"));

const PORT = process.env.PORT || 3000;

if (process.env.WEBHOOK_URL) {
  const path = `/webhook/${process.env.TELEGRAM_BOT_TOKEN}`;
  app.use(path, bot.webhookCallback(path));
  bot.telegram.setWebhook(`${process.env.WEBHOOK_URL}${path}`).then(() => {
    console.log(`✅ Webhook встановлено: ${process.env.WEBHOOK_URL}${path}`);
  }).catch(console.error);

  app.listen(PORT, () => console.log(`🌐 Server running with webhook on port ${PORT}`));
} else {
  bot.launch().then(() => console.log("🤖 Bot running locally with polling"));
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));

  app.listen(PORT, () => console.log(`🌐 Server listening on port ${PORT}`));
}

// =====================
// Scheduler
// =====================
initScheduler();
