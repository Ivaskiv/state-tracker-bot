import { getBase, tables } from '../config/database.js';
import userService from './userService.js';
import dataSyncService from './dataSyncService.js';
import { QUESTION_PARSERS, ANSWER_STEPS } from '../config/constants.js';

const base = getBase();

const responseService = {

  /** ====================== HELPERS ====================== */

  async _getTodayRecord(tgId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const records = await base(tables.RESPONSES)
        .select({ 
          filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date_Response})="${today}")`, 
          maxRecords: 1 
        })
        .firstPage();
      return records[0] || null;
    } catch (error) {
      console.error('[responseService] ❌ _getTodayRecord error:', error);
      throw error;
    }
  },

  async _createOrUpdateRecord(tgId, fields) {
    try {
      let record = await this._getTodayRecord(tgId);

      if (!record) {
        const user = await userService.getUserByTgId(tgId);
        const created = await base(tables.RESPONSES).create([{
          fields: {
            'TG_id': String(tgId),
            'Date_Response': new Date().toISOString().split('T')[0],
            'User Name': user?.['User Name'] || 'Користувач',
            ...fields
          }
        }]);
        record = created[0];
      } else {
        await base(tables.RESPONSES).update(record.id, fields);
      }

      return record;
    } catch (error) {
      console.error('[responseService] ❌ _createOrUpdateRecord error:', error);
      throw error;
    }
  },

  /** ====================== MORNING ====================== */

  _parseMorningAnswer(qNum, answer) {
    try {
      switch (qNum) {
        case 3: return QUESTION_PARSERS?.parseGoals?.(answer) || {};
        case 4: return QUESTION_PARSERS?.parseDailyFocus?.(answer) || {};
        case 5: return QUESTION_PARSERS?.parseState?.(answer) || {};
        case 6: {
          const parsed = QUESTION_PARSERS?.parseActions?.(answer) || {};
          return parsed.affirmation ? { affirmation_m: parsed.affirmation } : parsed;
        }
        default: return {};
      }
    } catch (error) {
      console.error(`[responseService] ❌ _parseMorningAnswer Q${qNum}:`, error);
      return {};
    }
  },

  async saveMorningAnswer(tgId, qNum, answer) {
    try {
      const field = `Q_m_${qNum}`;
      const nextStep = qNum < 6 ? `Q_m_${qNum + 1}` : 'affirmation_m';

      const fields = { [field]: answer, Current_Activity: nextStep };
      Object.assign(fields, this._parseMorningAnswer(qNum, answer));

      await this._createOrUpdateRecord(tgId, fields);
      await userService.updateUserFields(tgId, { Answer_Step: nextStep, Last_Activity: new Date().toISOString() });

      console.log(`[responseService] ✅ Morning Q${qNum} saved, next step: ${nextStep}`);
    } catch (error) {
      console.error('[responseService] ❌ saveMorningAnswer error:', error);
      throw error;
    }
  },

  async saveMorningAffirmation(tgId, affirmation) {
    try {
      const record = await this._getTodayRecord(tgId);
      if (!record) throw new Error('Responses not found');

      await base(tables.RESPONSES).update(record.id, { affirmation_m: affirmation, Current_Activity: 'morning_completed' });
      await userService.updateUserFields(tgId, { Answer_Step: 'morning_completed', Last_Activity: new Date().toISOString() });

      try { await dataSyncService.syncMorningData(tgId); } catch (e) { console.error(e); }

      console.log(`[responseService] ✅ Morning affirmation saved, session completed`);
    } catch (error) {
      console.error('[responseService] ❌ saveMorningAffirmation error:', error);
      throw error;
    }
  },

  async isMorningCompleted(tgId) {
    try {
      const record = await this._getTodayRecord(tgId);
      if (!record) return false;
      return record.fields.Current_Activity === 'morning_completed' || !!record.fields.Q_m_6;
    } catch (error) {
      console.error('[responseService] ❌ isMorningCompleted error:', error);
      return false;
    }
  },

  /** ====================== EVENING ====================== */

  _parseEveningAnswer(qNum, answer, todayData) {
    try {
      if (qNum === 5) return this.analyzeActionCompletion(answer, todayData);
      if (qNum === 6) return this.analyzeGoalProgress(answer, todayData);
      return {};
    } catch (error) {
      console.error(`[responseService] ❌ _parseEveningAnswer Q${qNum}:`, error);
      return {};
    }
  },

  async saveEveningAnswer(tgId, qNum, answer) {
    try {
      const record = await this._getTodayRecord(tgId);
      const todayData = record?.fields || {};
      const field = `Q_e_${qNum}`;
      const nextStep = qNum < 6 ? `Q_e_${qNum + 1}` : 'affirmation_e';

      const fields = { [field]: answer, Current_Activity: nextStep };
      Object.assign(fields, this._parseEveningAnswer(qNum, answer, todayData));

      await this._createOrUpdateRecord(tgId, fields);
      await userService.updateUserFields(tgId, { Answer_Step: nextStep, Last_Activity: new Date().toISOString() });

      console.log(`[responseService] ✅ Evening Q${qNum} saved, next step: ${nextStep}`);
    } catch (error) {
      console.error('[responseService] ❌ saveEveningAnswer error:', error);
      throw error;
    }
  },

  async saveEveningAffirmation(tgId, affirmation) {
    try {
      const record = await this._getTodayRecord(tgId);
      if (!record) throw new Error('Responses not found');

      await base(tables.RESPONSES).update(record.id, { affirmation_e: affirmation, Current_Activity: 'evening_completed' });
      await userService.updateUserFields(tgId, { Answer_Step: 'evening_completed', Last_Activity: new Date().toISOString() });

      try { await dataSyncService.syncEveningData(tgId); } catch (e) { console.error(e); }

      console.log(`[responseService] ✅ Evening affirmation saved, session completed`);
    } catch (error) {
      console.error('[responseService] ❌ saveEveningAffirmation error:', error);
      throw error;
    }
  },

  async isEveningCompleted(tgId) {
    try {
      const record = await this._getTodayRecord(tgId);
      if (!record) return false;
      return record.fields.Current_Activity === 'evening_completed' || !!record.fields.Q_e_6;
    } catch (error) {
      console.error('[responseService] ❌ isEveningCompleted error:', error);
      return false;
    }
  },

  /** ====================== ANALYSIS ====================== */

  analyzeActionCompletion(answer, todayData) {
    try {
      const lower = answer.toLowerCase();
      const actions = [todayData.Daily_Action_1, todayData.Daily_Action_2, todayData.Daily_Action_3].filter(Boolean);
      const completed = [], skipped = [];
      const doneMarkers = ['✅','зроблено','виконано','так','+','done'];
      const skipMarkers = ['⏭','не зроблено','ні','-','пропустила'];

      actions.forEach((act, i) => {
        const l = act.toLowerCase();
        if (doneMarkers.some(m => lower.includes(m) && lower.includes(l.slice(0,10)))) completed.push(i+1);
        else if (skipMarkers.some(m => lower.includes(m) && lower.includes(l.slice(0,10)))) skipped.push(i+1);
      });

      return {
        Actions_Completed_Count: completed.length,
        Actions_Completed_List: completed.join(','),
        Actions_Skipped_List: skipped.join(','),
        Completion_Rate: actions.length ? Math.round((completed.length / actions.length)*100) : 0
      };
    } catch (error) {
      console.error('[responseService] ❌ analyzeActionCompletion error:', error);
      return {};
    }
  },
  async resetSession(tgId, type) {
  const record = await this._getTodayRecord(tgId);
  if (!record) return;

  const fieldsToReset = {};

  if (type === 'morning') {
    for (let i = 1; i <= 6; i++) fieldsToReset[`Q_m_${i}`] = null;
    fieldsToReset.affirmation_m = null;
    fieldsToReset.Current_Activity = ANSWER_STEPS.MORNING_1;
  } else {
    for (let i = 1; i <= 7; i++) fieldsToReset[`Q_e_${i}`] = null;
    fieldsToReset.affirmation_e = null;
    fieldsToReset.Actions_Completed_Count = null;
    fieldsToReset.Actions_Completed_List = null;
    fieldsToReset.Actions_Skipped_List = null;
    fieldsToReset.Completion_Rate = null;
    fieldsToReset.Current_Activity = ANSWER_STEPS.EVENING_1;
  }

  await this._createOrUpdateRecord(tgId, fieldsToReset);
  await userService.updateUserFields(tgId, { Answer_Step: fieldsToReset.Current_Activity, Last_Activity: new Date().toISOString() });
  console.log(`[responseService] 🔄 Session reset for ${type} (${tgId})`);
},


  analyzeGoalProgress(answer) { 
    return { Goal_Progress: answer }; 
  },

};

export default responseService;
