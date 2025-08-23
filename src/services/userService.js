import { getBase, tables } from '../config/database.js';
const base = getBase();

const createUser = async ({ tgId, name }) => {
  try {
    const created = await base(tables.USERS).create([
      {
        fields: {
          TG_id: tgId,
          'User Name': name,
          Answer_Step: 'Begin_answer',
        },
      },
    ]);
    return created[0].fields;
  } catch (err) {
    console.error('[userService] Error creating user:', err);
    throw err;
  }
};

const getUserByTelegramId = async (tgId) => {
  try {
    const records = await base(tables.USERS)
      .select({ filterByFormula: `{TG_id} = '${tgId}'` })
      .all();
    return records.length ? records[0].fields : null;
  } catch (err) {
    console.error('[userService] Error finding user:', err);
    throw err;
  }
};

const updateUserStep = async (tgId, step) => {
  try {
    const records = await base(tables.USERS)
      .select({ filterByFormula: `{TG_id} = '${tgId}'` })
      .all();
    if (!records.length) return null;
    const updated = await base(tables.USERS).update(records[0].id, { Answer_Step: step });
    return updated.fields;
  } catch (err) {
    console.error('[userService] Error updating step:', err);
    throw err;
  }
};

export default {
  createUser,
  getUserByTelegramId,
  updateUserStep
};
