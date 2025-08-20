// server.js
import { Telegraf, Markup } from "telegraf";
import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";

import { initScheduler, startQuestions } from "./src/utils/scheduler.js";
import { handleStart } from "./src/services/userService.js";
import { getBase, tables } from "./src/config/database.js";
import keyboards from "./src/utils/keyboards.js";
import { handleAnswer } from "./src/handlers/questionHandler.js";

const processingUsers = {};

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

  // Якщо користувач відповідає на питання
  if (ctx.session?.questionType) {
    await handleAnswer(ctx, text);
    return;
  }

  switch (text) {
    // case "📝 Ранкові питання":
    //   await startQuestions(ctx, "morning");
    //   break;

    // case "🌙 Вечірні питання":
    //   await startQuestions(ctx, "evening");
    //   break;

      

case "💎 Афірмація":
  try {
    const tgIdStr = String(ctx.from.id);
    const todayStr = new Date().toISOString().slice(0, 10);

    // 1️⃣ Перевіряємо, чи користувач вже отримав афірмацію сьогодні
    const existing = await base(tables.USER_AFFIRMATIONS)
      .select({
        filterByFormula: `AND({User ID}='${tgIdStr}', {Date}='${todayStr}')`,
        maxRecords: 1
      })
      .firstPage();

    if (existing.length > 0) {
      // ✅ Користувач вже отримав афірмацію сьогодні - просто показуємо її знову БЕЗ дублювання в БД
      const todayAffirmation = existing[0].fields["AffirmationText"];
      await ctx.reply(
        `💎 Твоя афірмація на сьогодні:\n\n"${todayAffirmation}"\n\n✨ Повторюй її як натхнення для дня!`
      );
      return; // ВАЖЛИВО: виходимо тут, нічого не записуємо в БД
    }

    // 2️⃣ Дістаємо першу невикористану афірмацію (ТІЛЬКИ для нових записів)
    const unsentAff = await base(tables.AFFIRMATIONS)
      .select({
        filterByFormula: `NOT({Used})`,
        maxRecords: 1,
        sort: [{ field: "Date Created", direction: "asc" }]
      })
      .firstPage();

    let affText = "";

    if (unsentAff.length > 0) {
      const aff = unsentAff[0];
      affText =
        (typeof aff.fields["Affirmation"] === "object"
          ? aff.fields["Affirmation"]?.value
          : aff.fields["Affirmation"]) || "";

      // Позначаємо афірмацію як використану
      await base(tables.AFFIRMATIONS).update([
        { id: aff.id, fields: { Used: true } }
      ]);
    }

    // 3️⃣ Якщо афірмацій ще немає, ставимо стандартну підтримуючу
    if (!affText) {
      affText =
        "Кожен день приносить нові можливості для зростання, впевненості та радості у ваших діях.";
    }

    // 4️⃣ ТІЛЬКИ ТУТ зберігаємо нову афірмацію (тільки при першому натисканні за день)
    await base(tables.USER_AFFIRMATIONS).create([
      {
        fields: {
          "User ID": tgIdStr,
          "Date": todayStr,
          "AffirmationText": affText
        }
      }
    ]);

    // 5️⃣ Відправляємо користувачу нову афірмацію
    await ctx.reply(`💎 Твоя афірмація на сьогодні:\n\n"${affText}"\n\n✨ Нехай вона надихає тебе весь день!`);
    
  } catch (err) {
    console.error("❌ Error handling affirmation:", err);

    // Фолбек афірмація, якщо щось пішло не так
    await ctx.reply(
      "💎 Виникла невелика помилка при отриманні афірмації. Спробуйте ще раз трохи пізніше."
    );
  }
  break;

      case "💰 Підписка":
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
      break;

    case "📊 Мій прогрес":
      const reflections = await base(tables.USER_REFLECTIONS)
        .select({ filterByFormula: `{User ID}='${tgId}'` })
        .firstPage();
      const total = reflections.length;
      const morningCount = reflections.filter(r => r.fields["Question Type"]==="morning").length;
      const eveningCount = reflections.filter(r => r.fields["Question Type"]==="evening").length;
      const progressMsg =
        `📊 Ваш прогрес:\n` +
        `📝 Всього відповідей: ${total}\n` +
        `🌅 Ранкові: ${morningCount}\n🌙 Вечірні: ${eveningCount}\n` +
        `💡 Пропозиція: продовжуйте відповідати щодня для кращої інтроспекції та розвитку.`;
      await ctx.reply(progressMsg);
      break;

    case "❓ Допомога":
      await ctx.reply(
        "❓ Допомога та контакти\n" +
        "Якщо виникли питання — пишіть на nadyastarway@gmail.com\n" +
        "Або перегляньте інструкції у головному меню."
      );
      break;

case "📋 Інструкції":
  const instructionMsg = 
    `📋 ЯК КОРИСТУВАТИСЯ БОТОМ\n\n` +
    `🚀 **ПОЧАТОК РОБОТИ:**\n` +
    `• Натисни /start для реєстрації\n` +
    `• Перевір свою підписку в розділі "💰 Підписка"\n` +
    `• Активуй підписку за потреби\n\n` +
    
    `📝 **ЩОДЕННІ ПРАКТИКИ:**\n` +
    `• "📝 Ранкові питання" — відповідай вранці для налаштування на день\n` +
    `• "🌙 Вечірні питання" — рефлексія в кінці дня\n` +
    `• "💎 Афірмація" — отримуй 1 натхненну фразу щодня\n\n` +
    
    `📊 **ВІДСТЕЖЕННЯ ПРОГРЕСУ:**\n` +
    `• "📊 Мій прогрес" — переглянь статистику відповідей\n` +
    `• Відповідай на питання регулярно для кращого результату\n\n` +
    
    `🎯 **21-ДЕННИЙ МАРАФОН:**\n` +
    `• Кожен день: відео → аудіо → PDF → завдання\n` +
    `• Наступний урок відкривається тільки після виконання завдання\n` +
    `• Проходь крок за кроком для максимального ефекту\n\n` +
    
    `💡 **ПОРАДИ:**\n` +
    `• Використовуй бота щодня для формування звичок\n` +
    `• Будь чесною у відповідях — це для твого розвитку\n` +
    `• У разі технічних проблем звертайся через "📞 Зв'язок з нами"`;
  
  await ctx.reply(instructionMsg);
  break;

case "📞 Зв'язок з нами":
  const contactMsg =
    `📞 ЗВ'ЯЗОК З НАМИ\n\n` +
    `💬 **ТЕХНІЧНА ПІДТРИМКА:**\n` +
    `Email: nadyastarway@gmail.com\n` +
    `Telegram: @Nadya2316 (ментор)\n` +
    `Telegram: @vira_333 (техпідтримка)\n\n` +
    `Напиши нам, якщо:\n` +
    `• Виникли проблеми з ботом\n` +
    `• Не працює підписка\n` +
    `• Потрібна допомога з налаштуванням\n\n` +
    
    `📋 **ПИТАННЯ ПРО МАРАФОН:**\n` +
    `Якщо у тебе є питання про програму або методику — пиши ментору.\n\n` +
    
    `⏰ **ЧАС ВІДПОВІДІ:**\n` +
    `Зазвичай відповідаємо протягом 24 годин.\n\n` +
    
    `🎯 **ЗАМОВИТИ ПЕРСОНАЛЬНУ КОНСУЛЬТАЦІЮ:**\n` +
    `Хочеш особисту роботу з ментором?\n` +
    `Напиши на Email з темою "Персональна консультація" — обговоримо можливості.`;

      await ctx.reply(contactMsg, keyboards.supportKeyboard() );
  break;

    default:
      await ctx.reply("📝 Для перегляду профілю введіть /profile або /start для реєстрації.");
      break;
  }
});

// =====================
// Express webhook та запуск
// =====================
const app = express();
app.use(bodyParser.json());
app.post("/wayforpay-webhook", async (req,res)=>{
  res.status(200).send("OK");
});

bot.launch().then(()=>console.log("🚀 Bot started"));
const port = process.env.PORT || 3000;
app.listen(port, ()=>console.log(`🌐 Server listening on port ${port}`));

initScheduler();
