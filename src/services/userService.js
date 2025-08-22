// src/services/userService.js
import { getBase, tables } from '../config/database.js';

const base = getBase();

export const findUserByTGId = async tgId => {
  const records = await base(tables.USERS)
    .select({ filterByFormula: `{TG_id} = '${tgId}'` })
    .firstPage();
  return records[0] ? records[0].fields : null;
};

export const createUser = async ({ tgId, name }) => {
  const created = await base(tables.USERS).create([
    { fields: { TG_id: tgId, 'User Name': name, Answer_Step: 'Begin_answer' } },
  ]);
  return created[0].fields;
};

export const updateUserStep = async (tgId, step) => {
  const records = await base(tables.USERS)
    .select({ filterByFormula: `{TG_id} = '${tgId}'` })
    .firstPage();
  if (records[0]) {
    await base(tables.USERS).update(records[0].id, {
      Answer_Step: step,
    });
  }
};
