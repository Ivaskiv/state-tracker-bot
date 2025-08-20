// src/handlers/questionHandler.js
import { getBase, tables } from "../config/database.js";
const base = getBase();

export async function handleAnswer(ctx, text) {
  const { questionType, questions, currentQuestion } = ctx.session;
  const tgId = ctx.from.id;
  const todayStr = new Date().toISOString().slice(0,10);

  if (!questionType || currentQuestion >= questions.length) {
    ctx.session.questionType = null;
    ctx.session.currentQuestion = 0;
    return;
  }

  // Зберігаємо відповідь в Airtable
  await base(tables.USER_REFLECTIONS).create([{
    fields: {
      "User ID": tgId,
      "Date": todayStr,
      "Question Type": questionType,
      "Question": questions[currentQuestion],
      "Answer": text
    }
  }]);

  ctx.session.currentQuestion += 1;

  if (ctx.session.currentQuestion < questions.length) {
    await ctx.reply(questions[ctx.session.currentQuestion]);
  } else {
    ctx.session.questionType = null;
    ctx.session.currentQuestion = 0;
    await ctx.reply("✅ Всі питання пройдено!");
  }
}
