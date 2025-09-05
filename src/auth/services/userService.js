// src/auth/services/userService.js
import { getBase, tables } from '../../config/database.js';

const base = getBase();

const getUserByTelegramId = async (tgId) => {
  try {
    const records = await base(tables.USERS).select({
      filterByFormula: `{TG_id} = "${tgId}"`,
      maxRecords: 1
    }).firstPage();
    
    return records.length > 0 ? records[0].fields : null;
  } catch (error) {
    console.error('[userService] Error getting user by TG ID:', error);
    return null;
  }
};

const createUser = async (userData) => {
  try {
    const [record] = await base(tables.USERS).create([{
      fields: {
        TG_id: String(userData.tgId),
        'User Name': userData.name,
        Email: userData.email || null,
        'Date Response': new Date().toISOString(),
        Answer_Step: 'completed'
      }
    }]);
    
    return record.fields;
  } catch (error) {
    console.error('[userService] Error creating user:', error);
    throw error;
  }
};

const updateUserStep = async (tgId, step) => {
  try {
    const records = await base(tables.USERS).select({
      filterByFormula: `{TG_id} = "${tgId}"`,
      maxRecords: 1
    }).firstPage();
    
    if (records.length > 0) {
      await base(tables.USERS).update([{
        id: records[0].id,
        fields: { Answer_Step: step }
      }]);
    }
  } catch (error) {
    console.error('[userService] Error updating user step:', error);
  }
};

const getAllUsers = async () => {
  try {
    const records = await base(tables.USERS).select().all();
    return records.map(record => record.fields);
  } catch (error) {
    console.error('[userService] Error getting all users:', error);
    return [];
  }
};

export default {
  getUserByTelegramId,
  createUser,
  updateUserStep,
  getAllUsers
};