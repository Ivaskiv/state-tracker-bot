import { getBase, tables } from '../config/database.js';

export const reflectionService = {
  async saveReflection(reflectionData) {
    const base = getBase();
    try {
      const userRecords = await base(tables.USERS)
        .select({ filterByFormula: `{telegram_id} = "${reflectionData.user_id}"` })
        .firstPage();
      if (!userRecords.length) throw new Error('User not found');

      const userRecordId = userRecords[0].id;

      const record = await base(tables.USER_REFLECTIONS).create([{
        fields: {
          user_id: [userRecordId],
          type: reflectionData.type,
          date: reflectionData.date,
          completed_at: reflectionData.completed_at.toISOString(),
          ...reflectionData.answers
        }
      }]);
      return record[0];
    } catch (error) {
      console.error('Save reflection error:', error);
      throw error;
    }
  },

  async findTodayReflection(telegramId, type) {
    const base = getBase();
    const today = new Date().toISOString().split('T')[0];
    try {
      const userRecords = await base(tables.USERS)
        .select({ filterByFormula: `{telegram_id} = "${telegramId}"` })
        .firstPage();
      if (!userRecords.length) return null;

      const userRecordId = userRecords[0].id;
      const records = await base(tables.USER_REFLECTIONS)
        .select({ filterByFormula: `AND({user_id} = "${userRecordId}", {type} = "${type}", {date} = "${today}")`, maxRecords: 1 })
        .firstPage();
      return records.length ? { id: records[0].id, ...records[0].fields } : null;
    } catch (error) {
      console.error('Find today reflection error:', error);
      return null;
    }
  }
};
