// src/services/responseServices.js
import { findOneByField, createOne, updateOne } from './airtableService.js';
import { tables } from '../config/database.js';

const todayStr = () => new Date().toISOString().slice(0, 10);

const qField = (questionType, n) => {
  const suffix = questionType === 'Morning' ? 'Morning' : 'Evening';
  return `Q${n}_${suffix}`;
};

export const createOrUpdateResponse = async (tgId, userName, questionType, answerStep, questionNumber, answer) => {
  const rec = await findOneByField('RESPONSES',
    'Reminder Key',
    `${userName}_${tgId}_${todayStr().replaceAll('-','')}_${questionType}`
  );

  const fieldsPatch = {
    'User Name': userName,
    'TG_id': String(tgId),
    'Question Type': questionType,
    'Reminder Key': `${userName}_${tgId}_${todayStr().replaceAll('-','')}_${questionType}`,
    'Answer_Step': answerStep,
    [qField(questionType, questionNumber)]: answer,
  };

  if (rec) {
    return updateOne('RESPONSES', rec.id, fieldsPatch);
  } else {
    return createOne('RESPONSES', fieldsPatch);
  }
};

export const findTodayResponse = async (tgId, questionType) => {
  const keyPrefix = `_${tgId}_${todayStr().replaceAll('-','')}_${questionType}`;
  // підбираємо по частині Reminder Key (User Name змінна)
  const records = await (await import('./airtableService.js')).then(m =>
    m.findAll('RESPONSES', { filterByFormula: `FIND("${keyPrefix}", {Reminder Key})` })
  );
  return records.find(r => r.fields['Question Type'] === questionType && String(r.fields['TG_id']) === String(tgId)) || null;
};
