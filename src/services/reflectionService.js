// src/services/reflectionService.js
import userService from './userService.js';
import { getBase } from '../config/database.js';

const base = getBase();

const MORNING_TABLE = 'Morning_Responses';
const EVENING_TABLE = 'Evening_Responses';

const MORNING_QUESTIONS = [
  "1️⃣ Хто я сьогодні?\nОпиши себе як нову версію — з позиції сили.",
  "2️⃣ Яка я?\n(сильна, смілива, любляча, щира, рішуча...)",
  "3️⃣ Мої 10 цілей на рік\nПиши як уже реальність.",
  "4️⃣ На яку одну ціль я фокусуюсь сьогодні?",
  "5️⃣ Який мій стан сьогодні?",
  "6️⃣ Чому я гідна мати все це прямо зараз?"
];

const EVENING_QUESTIONS = [
  "1️⃣ Що мене сьогодні наповнило енергією?",
  "2️⃣ Де я сьогодні злила енергію чи втратила стан?",
  "3️⃣ Яка програма або переконання активувалась сьогодні?",
  "4️⃣ З якої точки я діяла сьогодні: сили чи страху?",
  "5️⃣ Яка моя головна перемога сьогодні?"
];

function todayISODate() {
  return new Date().toISOString().split('T')[0];
}

// Перевірка чи користувач вже відповів сьогодні
async function alreadyAnsweredToday(tgId, type) {
  const date = todayISODate();
  const table = type === 'morning' ? MORNING_TABLE : EVENING_TABLE;
  const records = await base(table).select({
    filterByFormula: `{user_id} = "${tgId}"`,
    maxRecords: 1
  }).firstPage();
  return records.length > 0;
}

// Отримати стан поточного потоку
async function getFlowState(tgId) {
  const user = await userService.getUserByTelegramId(tgId);
  if (!user) return { user: null, questionType: null, step: null };
  const qt = user.fields['Question Type'] || null;
  const step = user.fields['Answer_Step'] || null;
  const questionType = qt ? qt.toLowerCase() : null;
  return { user, questionType, step };
}

// Встановити стан потоку
async function setFlowState(userId, questionType, step) {
  await userService.updateUser(userId, {
    'Question Type': questionType === 'morning' ? 'Morning' : 'Evening',
    'Answer_Step': step
  });
}

// Отримати питання за номером step
function getQuestion(type, step) {
  const questions = type === 'morning' ? MORNING_QUESTIONS : EVENING_QUESTIONS;
  const index = step ? parseInt(step.replace('Q', '')) - 1 : 0;
  return questions[index] || null;
}

// Обробка відповіді користувача та надсилання наступного питання
async function handleIncomingText(bot, ctx) {
  const tgId = ctx.from.id;
  const text = ctx.message.text;
  const { user, questionType, step } = await getFlowState(tgId);
  if (!user || !questionType || !step) return;

  const table = questionType === 'morning' ? MORNING_TABLE : EVENING_TABLE;
  const stepIndex = step === 'Begin_answer' ? 0 : parseInt(step.replace('Q', '')) - 1;

  // Зберігаємо відповідь
  const questionField = questionType === 'morning'
    ? `question_${stepIndex + 1}`
    : `question_${stepIndex + 1}`;

  await base(table).create([
    {
      fields: {
        user_id: tgId,
        date: todayISODate(),
        [questionField]: text
      }
    }
  ]);

  // Визначаємо наступний step
  const questions = questionType === 'morning' ? MORNING_QUESTIONS : EVENING_QUESTIONS;
  const nextStepIndex = stepIndex + 1;

  if (nextStepIndex < questions.length) {
    const nextStep = `Q${nextStepIndex + 1}`;
    await setFlowState(user.id, questionType, nextStep);
    await bot.telegram.sendMessage(tgId, questions[nextStepIndex]);
  } else {
    await setFlowState(user.id, null, null); // завершили потік
    await bot.telegram.sendMessage(tgId, `✅ Ти завершила всі питання на сьогодні!`);
  }
}

// Запуск щоденних питань
async function startDailyQuestions(bot, tgId, type) {
  const { user } = await getFlowState(tgId);
  if (!user) return;

  // Перевірка активної підписки
  const subActive = user.fields['Active_Subscription_Status']?.startsWith('✅');
  if (!subActive) return;

  const answered = await alreadyAnsweredToday(tgId, type);
  if (answered) return;

  await setFlowState(user.id, type, 'Begin_answer');
  const firstQuestion = getQuestion(type, 'Begin_answer');
  await bot.telegram.sendMessage(tgId,
    type === 'morning' ? '🌞 Ранкові питання. Відповідай послідовно:' : '🌙 Вечірні питання. Відповідай послідовно:'
  );
  await bot.telegram.sendMessage(tgId, firstQuestion);
}

export default {
  startDailyQuestions,
  handleIncomingText,
  alreadyAnsweredToday
};
