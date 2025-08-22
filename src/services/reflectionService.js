// src/services/reflectionService.js
import { getBase, tables } from '../config/database.js';

const base = getBase();

export const createOrUpdateResponse = async (
  tgId,
  userName,
  questionType,
  answerStep,
  questionNumber,
  answer
) => {
  return base(tables.RESPONSES).create([
    {
      fields: {
        TG_id: tgId,
        'User Name': userName,
        'Question Type': questionType,
        Answer_Step: answerStep,
        Question_Number: questionNumber,
        Answer: answer,
        Date: new Date().toISOString().split('T')[0],
      },
    },
  ], { typecast: true });
};
