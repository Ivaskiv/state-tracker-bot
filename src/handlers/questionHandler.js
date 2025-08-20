//src/handlers/questionHandler.js
import reflectionService from '../services/reflectionService.js';

const morningQuestions = [
  "1️⃣ Хто я сьогодні?",
  "2️⃣ Яка я?",
  "3️⃣ Мої 10 цілей на рік",
  "4️⃣ На яку одну ціль я фокусуюсь сьогодні?",
  "5️⃣ Який мій стан сьогодні?",
  "6️⃣ Чому я гідна мати все це прямо зараз?"
];

const eveningQuestions = [
  "1️⃣ Що мене сьогодні наповнило енергією?",
  "2️⃣ Де я сьогодні злила енергію чи втратила стан?",
  "3️⃣ Яка програма або переконання активувалась сьогодні?",
  "4️⃣ З якої точки я діяла сьогодні: сили чи страху?",
  "5️⃣ Яка моя головна перемога сьогодні?"
];

export async function startQuestions(ctx, type) {
  ctx.session.questionType = type;
  ctx.session.currentQuestion = 0;
  await sendNextQuestion(ctx);
}

export async function handleAnswer(ctx, text) {
  const type = ctx.session.questionType;
  const current = ctx.session.currentQuestion;

  if (!type) return;

  if (type === 'morning') {
    await reflectionService.saveMorningAnswer(ctx, text, current + 1);
  } else {
    await reflectionService.saveEveningAnswer(ctx, text, current + 1);
  }

  ctx.session.currentQuestion += 1;
  await sendNextQuestion(ctx);
}

export async function sendNextQuestion(ctx) {
  const type = ctx.session.questionType;
  const current = ctx.session.currentQuestion;
  const questions = type === 'morning' ? morningQuestions : eveningQuestions;

  if (current < questions.length) {
    await ctx.reply(questions[current]);
  } else {
    await ctx.reply('✅ Всі питання пройдено!');
    ctx.session.currentQuestion = 0;
    ctx.session.questionType = null;
  }
}

export async function skipQuestion(ctx) {
  ctx.session.currentQuestion += 1;
  await sendNextQuestion(ctx);
}
