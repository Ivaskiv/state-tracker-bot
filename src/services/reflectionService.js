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

export function todayISODate() {
  return new Date().toISOString().split('T')[0];
}

// Отримати стан поточного потоку
async function getFlowState(tgId) {
  const user = await userService.getUserByTelegramId(tgId);
  if (!user) return { user: null, questionType: null, step: null, lastAnswerDate: null };
  const qt = user.fields['Question Type'] || null;
  const step = user.fields['Answer_Step'] || null;
  const lastDate = user.fields['Last_Answer_Date'] || null;
  const questionType = qt ? qt.toLowerCase() : null;
  return { user, questionType, step, lastAnswerDate: lastDate };
}

// Встановити стан потоку
async function setFlowState(userId, questionType, step) {
  await userService.updateUser(userId, {
    'Question Type': questionType ? (questionType === 'morning' ? 'Morning' : 'Evening') : null,
    'Answer_Step': step,
    'Last_Answer_Date': todayISODate()
  });
}

// Отримати питання за номером step
function getQuestion(type, step) {
  const questions = type === 'morning' ? MORNING_QUESTIONS : EVENING_QUESTIONS;
  const index = step === 'Begin_answer' ? 0 : parseInt(step.replace('Q', '')) - 1;
  return questions[index] || null;
}

// Перевірка, чи користувач вже відповів на сьогодні
async function alreadyAnsweredToday(tgId, type) {
  const date = todayISODate();
  const table = type === 'morning' ? MORNING_TABLE : EVENING_TABLE;
  const records = await base(table).select({
    filterByFormula: `{user_id} = "${tgId}" AND {date} = "${date}"`,
    maxRecords: 1
  }).firstPage();
  return records.length > 0;
}

// Обробка відповіді користувача
async function handleIncomingText(bot, ctx) {
  const tgId = ctx.from.id;
  const text = ctx.message.text;
  const { user, questionType, step, lastAnswerDate } = await getFlowState(tgId);
  if (!user) return;

  // Перевірка нового дня
  let currentStep = step;
  if (lastAnswerDate !== todayISODate()) {
    currentStep = 'Begin_answer';
  }

  const questions = questionType === 'morning' ? MORNING_QUESTIONS : EVENING_QUESTIONS;
  const table = questionType === 'morning' ? MORNING_TABLE : EVENING_TABLE;
  const stepIndex = currentStep === 'Begin_answer' ? 0 : parseInt(currentStep.replace('Q', '')) - 1;

  // Зберігаємо відповідь (створюємо запис, якщо новий день)
  const questionField = `question_${stepIndex + 1}`;
  const existingRecords = await base(table).select({
    filterByFormula: `{user_id} = "${tgId}" AND {date} = "${todayISODate()}"`,
    maxRecords: 1
  }).firstPage();

  if (existingRecords.length === 0) {
    // новий запис
    await base(table).create([{
      fields: {
        user_id: tgId,
        date: todayISODate(),
        [questionField]: text
      }
    }]);
  } else {
    // оновлюємо існуючий
    await base(table).update([{
      id: existingRecords[0].id,
      fields: { [questionField]: text }
    }]);
  }

  // Визначаємо наступний step
  const nextStepIndex = stepIndex + 1;

  if (nextStepIndex < questions.length) {
    const nextStep = `Q${nextStepIndex + 1}`;
    await setFlowState(user.id, questionType, nextStep);
    await bot.telegram.sendMessage(tgId, questions[nextStepIndex]);
  } else {
    // завершення потоку
    await setFlowState(user.id, null, null);
    const message = questionType === 'morning'
      ? '✅ Ти завершила всі ранкові питання на сьогодні!'
      : '✅ Ти завершила всі вечірні питання на сьогодні!';
    await bot.telegram.sendMessage(tgId, message);
  }
}

// Запуск щоденних питань (для scheduler)
async function startDailyQuestions(bot, tgId, type) {
  const { user, step, lastAnswerDate } = await getFlowState(tgId);
  if (!user) return;

  // перевірка активної підписки
  const subActive = user.fields['Active_Subscription_Status']?.includes('✅ Активна');
  if (!subActive) return;

  // новий день або ще не почав
  const currentStep = (lastAnswerDate !== todayISODate() || !step) ? 'Begin_answer' : step;

  const firstQuestion = getQuestion(type, currentStep);
  if (!firstQuestion) return;

  await setFlowState(user.id, type, currentStep);

  const prefix = type === 'morning' ? '🌞 Ранкові питання. Відповідай послідовно:' : '🌙 Вечірні питання. Відповідай послідовно:';
  await bot.telegram.sendMessage(tgId, prefix);
  await bot.telegram.sendMessage(tgId, firstQuestion);
}

export default {
  startDailyQuestions,
  handleIncomingText,
  alreadyAnsweredToday
};
