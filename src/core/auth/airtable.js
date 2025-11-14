// src/core/auth/airtable.js
import { getBase, tables } from '../../config/database.js';

const base = getBase();

export const saveToAirtable = async (user) => {
  try {
    await base(tables.USERS).update([{
      id: user.id,
      fields: user.fields
    }]);
    return true;
  } catch (e) {
    console.error('[auth/airtable] Error:', e.message);
    return false;
  }
};

export const syncUserProgress = async (tgId, progressData) => {
  try {
    await base(tables.USER_PROGRESS).create([{
      fields: {
        TG_id: String(tgId),
        ...progressData,
        Updated_At: new Date().toISOString()
      }
    }]);
    return true;
  } catch (e) {
    console.error('[auth/airtable] Progress sync error:', e.message);
    return false;
  }
};