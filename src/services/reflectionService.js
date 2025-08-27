// src/services/reflectionService.js
import { tables, selectFromTable, createRows, updateRows } from '../config/database.js';
import { QUESTION_TYPES, ANSWER_STEPS, MORNING_QUESTIONS, EVENING_QUESTIONS } from '../config/constants.js';

const todayStr = () => new Date().toISOString().split('T')[0]; // YYYY-MM-DD

const reminderKey = (userName, tgId, dateISO, type) => {
  const d = dateISO.replace(/-/g,'');
  return `${userName}_${tgId}_${d}_${type}`;
};

export const createOrUpdateResponse = async (
  tgId,
  userName,
  questionType,
  answer,
  fieldName,
  isCompleted = false
) => {
  const base = getBase();
  const today = new Date().toISOString().split('T')[0];
  const tgIdString = String(tgId);

  // 🔹 Знаходимо 1 рядок на день
  const records = await base('Responses').select({
    filterByFormula: `AND({TG_id}="${tgIdString}", {Date Response}="${today}")`,
    maxRecords: 1
  }).firstPage();

  // Дані для збереження
  const fields = {
    'TG_id': tgIdString,
    'User Name': userName,
    'Date Response': today,
    [fieldName]: answer
  };

  if (isCompleted) {
    const completedField = questionType === 'Morning' ? 'morning_completed' : 'evening_completed';
    fields[completedField] = true;
  }

  if (records.length > 0) {
    // 🔹 Оновлюємо існуючий рядок
    await base('Responses').update([{ id: records[0].id, fields }]);
    console.log(`[responseService] Оновлено рядок на день для ${tgIdString}`);
  } else {
    // 🔹 Створюємо новий рядок
    await base('Responses').create([{ fields }]);
    console.log(`[responseService] Створено новий рядок на день для ${tgIdString}`);
  }
};

export const isSessionCompleted = async (tgId, questionType) => {
  try {
    const records = await selectFromTable(tables.RESPONSES, {
      filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date Response})="${todayStr()}", {Type}="${questionType}")`
    }).firstPage();
    if (records.length > 0) {
      return records[0].fields[`${questionType.toLowerCase()}_completed`] || false;
    }
    return false;
  } catch (error) {
    console.error('[reflectionService] Помилка в isSessionCompleted:', error);
    return false;
  }
};

const setFlowState = async (userId, { questionType, step }) => {
  await updateRows(tables.USERS, [{
    id: userId,
    fields: {
      'Question Type': questionType,
      'Answer_Step': step
    }
  }]);
};

const getFlowState = async (tgId) => {
  const records = await selectFromTable(tables.USERS, {
    filterByFormula: `{TG_id}="${tgId}"`,
    maxRecords: 1
  }).firstPage();
  const user = records[0];
  if (!user) return { questionType: null, step: null, user };
  const qt = user.fields['Question Type'] || '';
  const st = user.fields['Answer_Step'] || '';
  const questionType = qt.toLowerCase() === QUESTION_TYPES.MORNING.toLowerCase() ? QUESTION_TYPES.MORNING : (qt.toLowerCase() === QUESTION_TYPES.EVENING.toLowerCase() ? QUESTION_TYPES.EVENING : null);
  return { questionType, step: st, user };
};

const startDailyQuestions = async (bot, tgId, type) => {
  const { user } = await getFlowState(tgId);
  if (!user) return;

  const answered = await isSessionCompleted(tgId, type);
  if (answered) return;

  const questions = type === QUESTION_TYPES.MORNING ? MORNING_QUESTIONS : EVENING_QUESTIONS;
  await setFlowState(user.id, { questionType: type, step: ANSWER_STEPS.BEGIN });

  await bot.telegram.sendMessage(tgId,
    type === QUESTION_TYPES.MORNING
      ? '🌞 Ранкові питання. Відповідай послідовно:'
      : '🌙 Вечірні питання. Відповідай послідовно:'
  );

  await bot.telegram.sendMessage(tgId, questions[0]);
  await setFlowState(user.id, { questionType: type, step: type === QUESTION_TYPES.MORNING ? ANSWER_STEPS.MORNING_1 : ANSWER_STEPS.EVENING_1 });
};

const handleIncomingText = async (bot, ctx) => {
  const tgId = ctx.from.id;
  const text = ctx.message.text?.trim();
  if (!text) return;

  const { user, questionType, step } = await getFlowState(tgId);
  if (!user || !questionType || !step || step === ANSWER_STEPS.COMPLETED) return;

  if (step !== ANSWER_STEPS.BEGIN && !step.startsWith('Q_')) return;

  const questions = questionType === QUESTION_TYPES.MORNING ? MORNING_QUESTIONS : EVENING_QUESTIONS;
  const date = todayStr();
  const key = reminderKey(user.fields['User Name'] || 'User', tgId, date, questionType);

  const existing = await selectFromTable(tables.RESPONSES, {
    filterByFormula: `AND({TG_id} = "${String(tgId)}", DATESTR({Date Response}) = "${date}", {Type} = "${questionType}")`,
    maxRecords: 1
  }).firstPage();

  let recordId = existing[0]?.id || null;
  const fieldsBase = {
    'TG_id': String(tgId),
    'User Name': user.fields['User Name'] || 'Користувач',
    'Date Response': new Date().toISOString(),
    'Type': questionType
  };
  if (questionType === QUESTION_TYPES.MORNING) {
    fieldsBase['Reminder Key Morning'] = key;
  } else {
    fieldsBase['Reminder Key Evening'] = key;
  }

  const stepToField = {
    [ANSWER_STEPS.MORNING_1]: 'question_1',
    [ANSWER_STEPS.MORNING_2]: 'question_2',
    [ANSWER_STEPS.MORNING_3]: 'question_3',
    [ANSWER_STEPS.MORNING_4]: 'question_4',
    [ANSWER_STEPS.MORNING_5]: 'question_5',
    [ANSWER_STEPS.MORNING_6]: 'question_6',
    [ANSWER_STEPS.EVENING_1]: 'question_1',
    [ANSWER_STEPS.EVENING_2]: 'question_2',
    [ANSWER_STEPS.EVENING_3]: 'question_3',
    [ANSWER_STEPS.EVENING_4]: 'question_4',
    [ANSWER_STEPS.EVENING_5]: 'question_5'
  };

  let nextStep = null;
  let nextIndex = null;

  if (step === ANSWER_STEPS.BEGIN) {
    const f = stepToField[questionType === QUESTION_TYPES.MORNING ? ANSWER_STEPS.MORNING_1 : ANSWER_STEPS.EVENING_1];
    if (recordId) {
      await updateRows(tables.RESPONSES, [{ id: recordId, fields: { [f]: text } }]);
    } else {
      const created = await createRows(tables.RESPONSES, [{ fields: { ...fieldsBase, [f]: text } }]);
      recordId = created[0].id;
    }
    nextStep = questionType === QUESTION_TYPES.MORNING ? ANSWER_STEPS.MORNING_2 : ANSWER_STEPS.EVENING_2;
    nextIndex = 1;
  } else {
    const f = stepToField[step];
    if (!f) return;

    if (recordId) {
      await updateRows(tables.RESPONSES, [{ id: recordId, fields: { [f]: text } }]);
    } else {
      const created = await createRows(tables.RESPONSES, [{ fields: { ...fieldsBase, [f]: text } }]);
      recordId = created[0].id;
    }

    const order = questionType === QUESTION_TYPES.MORNING
      ? [ANSWER_STEPS.MORNING_1, ANSWER_STEPS.MORNING_2, ANSWER_STEPS.MORNING_3, ANSWER_STEPS.MORNING_4, ANSWER_STEPS.MORNING_5, ANSWER_STEPS.MORNING_6]
      : [ANSWER_STEPS.EVENING_1, ANSWER_STEPS.EVENING_2, ANSWER_STEPS.EVENING_3, ANSWER_STEPS.EVENING_4, ANSWER_STEPS.EVENING_5];
    const idx = order.indexOf(step);
    nextIndex = idx + 1;
    nextStep = order[nextIndex] || ANSWER_STEPS.COMPLETED;
  }

  if (nextStep === ANSWER_STEPS.COMPLETED || (questionType === QUESTION_TYPES.EVENING && nextStep === ANSWER_STEPS.EVENING_5)) {
    await createOrUpdateResponse(tgId, user.fields['User Name'] || 'User', questionType, ANSWER_STEPS.COMPLETED, 0, '', '', true);
    await setFlowState(user.id, { questionType: '', step: ANSWER_STEPS.COMPLETED });
    await bot.telegram.sendMessage(tgId, '✅ Ти відповіла на всі запитання!');
    const aff = await selectFromTable(tables.AFFIRMATIONS, { maxRecords: 1, sort: [{ field: 'RAND()' }] }).firstPage();
    await bot.telegram.sendMessage(tgId, `🌀 Афірмація:\n${aff[0]?.fields['Text'] || 'Будь собою!'}`);
    return;
  }

  const max = questionType === QUESTION_TYPES.MORNING ? 6 : 5;
  if (nextIndex >= max) {
    await createOrUpdateResponse(tgId, user.fields['User Name'] || 'User', questionType, ANSWER_STEPS.COMPLETED, 0, '', '', true);
    await setFlowState(user.id, { questionType: '', step: ANSWER_STEPS.COMPLETED });
    await bot.telegram.sendMessage(tgId, '✅ Ти відповіла на всі запитання!');
    const aff = await selectFromTable(tables.AFFIRMATIONS, { maxRecords: 1, sort: [{ field: 'RAND()' }] }).firstPage();
    await bot.telegram.sendMessage(tgId, `🌀 Афірмація:\n${aff[0]?.fields['Text'] || 'Будь собою!'}`);
    return;
  }

  await setFlowState(user.id, { questionType, step: nextStep });
  await bot.telegram.sendMessage(tgId, questions[nextIndex]);
};

export default {
  createOrUpdateResponse,
  isSessionCompleted,
  startDailyQuestions,
  handleIncomingText
};