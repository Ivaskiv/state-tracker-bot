// src/services/reflectionService.js
import base from '../config/airtable.js';
import userService from './userService.js';
import affirmationService from './affirmationService.js';

const MORNING_TABLE = 'Morning_Responses';
const EVENING_TABLE = 'Evening_Responses';
const USERS = 'Users';

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
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function reminderKey(userName, tgId, dateISO, type) {
  const d = dateISO.replace(/-/g,'');
  return `${userName}_${tgId}_${d}_${type}`;
}

async function alreadyAnsweredToday(tgId, type) {
  const date = todayISODate();
  const table = type === 'morning' ? MORNING_TABLE : EVENING_TABLE;
  const records = await base(table).select({
    filterByFormula: `AND({user_id} = "${String(tgId)}", {date} = "${date}")`,
    maxRecords: 1
  }).firstPage();
  return records.length > 0;
}

// використовуємо поля Users: Question Type, Answer_Step
async function setFlowState(userId, { questionType, step }) {
  await userService.updateUser(userId, {
    'Question Type': questionType === 'morning' ? 'Morning' : 'Evening',
    'Answer_Step': step
  });
}

async function getFlowState(tgId) {
  const user = await userService.getUserByTelegramId(tgId);
  if (!user) return { questionType: null, step: null, user };
  const qt = user.fields['Question Type'] || '';
  const st = user.fields['Answer_Step'] || '';
  const questionType = qt.toLowerCase() === 'morning' ? 'morning' : (qt.toLowerCase() === 'evening' ? 'evening' : null);
  return { questionType, step: st, user };
}

async function startDailyQuestions(bot, tgId, type) {
  const { user } = await getFlowState(tgId);
  if (!user) return;

  const answered = await alreadyAnsweredToday(tgId, type);
  if (answered) return; // не дублюємо

  const questions = type === 'morning' ? MORNING_QUESTIONS : EVENING_QUESTIONS;
  await setFlowState(user.id, { questionType: type, step: 'Begin_answer' });

  await bot.telegram.sendMessage(tgId,
    type === 'morning'
      ? '🌞 Ранкові питання. Відповідай послідовно:'
      : '🌙 Вечірні питання. Відповідай послідовно:'
  );

  await bot.telegram.sendMessage(tgId, questions[0]);
  await setFlowState(user.id, { questionType: type, step: 'Q1' });
}

async function handleIncomingText(bot, ctx) {
  const tgId = ctx.from.id;
  const text = ctx.message.text?.trim();
  if (!text) return;

  // керуємося станом у Users.Answer_Step
  const { user, questionType, step } = await getFlowState(tgId);
  if (!user || !questionType || !step || step === 'Completed_Answer') return;

  const questions = questionType === 'morning' ? MORNING_QUESTIONS : EVENING_QUESTIONS;
  const table = questionType === 'morning' ? MORNING_TABLE : EVENING_TABLE;
  const date = todayISODate();
  const key = reminderKey(user.fields['User Name'] || 'User', tgId, date, questionType);

  // читаємо існуючий запис за сьогодні (або створимо на Q1)
  const existing = await base(table).select({
    filterByFormula: `AND({user_id} = "${String(tgId)}", {date} = "${date}")`,
    maxRecords: 1
  }).firstPage();

  let recordId = existing[0]?.id || null;
  const fieldsBase = {
    'user_id': String(tgId),
    'user_name': user.fields['User Name'] || 'Користувач',
    'date': date
  };
  if (questionType === 'morning') {
    fieldsBase['Reminder Key Morning'] = key;
  } else {
    fieldsBase['Reminder Key Evening'] = key;
  }

  // мапимо крок → поле
  const stepToField = {
    'Q1': 'question_1',
    'Q2': 'question_2',
    'Q3': 'question_3',
    'Q4': 'question_4',
    'Q5': 'question_5',
    'Q6': 'question_6'
  };

  // записуємо відповідь
  let nextStep = null;
  let nextIndex = null;

  if (step === 'Begin_answer') {
    // користувач має відповісти на Q1, але якщо текст прийшов — вважаємо це відповіддю на Q1
    const f = stepToField['Q1'];
    if (recordId) {
      await base(table).update([{ id: recordId, fields: { [f]: text } }], { typecast: true });
    } else {
      const created = await base(table).create([{ fields: { ...fieldsBase, [f]: text } }], { typecast: true });
      recordId = created[0].id;
    }
    nextStep = 'Q2';
    nextIndex = 1;
  } else {
    const f = stepToField[step];
    if (!f) return;

    if (recordId) {
      await base(table).update([{ id: recordId, fields: { [f]: text } }], { typecast: true });
    } else {
      const created = await base(table).create([{ fields: { ...fieldsBase, [f]: text } }], { typecast: true });
      recordId = created[0].id;
    }

    // визначаємо наступне питання
    const order = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'];
    const idx = order.indexOf(step);
    nextIndex = idx + 1;
    nextStep = order[nextIndex] || 'Completed_Answer';
  }

  if (nextStep === 'Completed_Answer' || (questionType === 'evening' && nextStep === 'Q6')) {
    // вечірні мають 5 питань, тому після Q5 завершуємо
    if (questionType === 'evening') {
      await userService.updateUser(user.id, { 'Answer_Step': 'Completed_Answer' });
    } else {
      await userService.updateUser(user.id, { 'Answer_Step': 'Completed_Answer' });
    }

    await bot.telegram.sendMessage(tgId, '✅ Ти відповіла на всі запитання!');
    const aff = await affirmationService.getAffirmationAndMarkUsed();
    await bot.telegram.sendMessage(tgId, `🌀 Афірмація:\n${aff}`);
    // очистимо індикатор типу, щоб не ловити випадкові повідомлення
    await userService.updateUser(user.id, { 'Question Type': '', 'Answer_Step': 'Completed_Answer' });
    return;
  }

  // якщо вечірні — тільки 5 питань
  const max = questionType === 'morning' ? 6 : 5;
  if (nextIndex >= max) {
    await userService.updateUser(user.id, { 'Answer_Step': 'Completed_Answer' });
    await bot.telegram.sendMessage(tgId, '✅ Ти відповіла на всі запитання!');
    const aff = await affirmationService.getAffirmationAndMarkUsed();
    await bot.telegram.sendMessage(tgId, `🌀 Афірмація:\n${aff}`);
    await userService.updateUser(user.id, { 'Question Type': '', 'Answer_Step': 'Completed_Answer' });
    return;
  }

  // надіслати наступне питання
  await userService.updateUser(user.id, { 'Answer_Step': ['Q1','Q2','Q3','Q4','Q5','Q6'][nextIndex] });
  await bot.telegram.sendMessage(tgId, questions[nextIndex]);
}

export default {
  startDailyQuestions,
  handleIncomingText,
  alreadyAnsweredToday
};
