import { getBase, tables } from '../config/database.js';
import logger from '../utils/logger.js';
import userService from './userService.js';
import dataSyncService from './dataSyncService.js';
import { QUESTION_PARSERS } from '../config/constants.js';

const base = getBase();

const responseService = {

  async _getTodayRecord(tgId) {
    const today = new Date().toISOString().split('T')[0];
    const records = await base(tables.RESPONSES)
      .select({ filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date_Response})="${today}")`, maxRecords: 1 })
      .firstPage();
    return records[0] || null;
  },

async _createOrUpdateRecord(tgId, fields) {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();
  let record = await this._getTodayRecord(tgId);

  if (!record) {
    const user = await userService.getUserByTgId(tgId);
    const created = await base(tables.RESPONSES).create([{
      fields: {
        'TG_id': String(tgId),
        'Date_Response': today,
        'User Name': user?.['User Name'] || 'Користувач',
        ...fields
      }
    }]);
    record = created[0]; // ⚠️ Обовʼязково беремо перший запис з масиву
  } else {
    await base(tables.RESPONSES).update(record.id, { fields });
  }

  await userService.updateUserFields(tgId, { Answer_Step: fields.Current_Activity, Last_Activity: now });
  return record;
},

  _parseMorningAnswer(qNum, answer) {
    switch (qNum) {
      case 3: return QUESTION_PARSERS.parseGoals(answer);
      case 4: return QUESTION_PARSERS.parseDailyFocus(answer);
      case 5: return QUESTION_PARSERS.parseState(answer);
      case 6: {
        const parsed = QUESTION_PARSERS.parseActions(answer);
        return parsed.affirmation ? { affirmation_m: parsed.affirmation } : parsed;
      }
      default: return {};
    }
  },

  async saveMorningAnswer(tgId, qNum, answer) {
    const field = `Q_m_${qNum}`;
    const fields = { [field]: answer, ...this._parseMorningAnswer(qNum, answer), Current_Activity: field };
    await this._createOrUpdateRecord(tgId, fields);
    if (qNum === 6) await dataSyncService.syncMorningData(tgId);
  },

  _parseEveningAnswer(qNum, answer, todayData) {
    if (qNum === 5) return this.analyzeActionCompletion(answer, todayData);
    if (qNum === 6) return this.analyzeGoalProgress(answer, todayData);
    return {};
  },

  async saveEveningAnswer(tgId, qNum, answer) {
    const record = await this._getTodayRecord(tgId);
    const todayData = record?.fields || {};
    const field = `Q_e_${qNum}`;
    const fields = { [field]: answer, ...this._parseEveningAnswer(qNum, answer, todayData), Current_Activity: field };
    await this._createOrUpdateRecord(tgId, fields);
    if (qNum === 5 && fields.Actions_Completed_List) await this.updateMicroActionsStatus(tgId, fields);
  },

  analyzeActionCompletion(answer, todayData) {
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
  },

  async updateMicroActionsStatus(tgId, completionData) {
    const today = new Date().toISOString().split('T')[0];
    const completedList = completionData.Actions_Completed_List.split(',').filter(n => n);
    const records = await base(tables.MICRO_ACTIONS)
      .select({ filterByFormula: `AND({TG_id}="${tgId}", DATESTR({Date})="${today}", {Source}="user_input")`, sort:[{field:'Created_At',direction:'asc'}] })
      .firstPage();

const completedActions = completionData.Actions_Completed_List.split(',').filter(Boolean);

const updates = records.map(r => ({
  id: r.id,
  fields: {
    Status: completedActions.includes(r.fields.Action_Text) ? 'completed' : 'skipped',
    Completed_At: completedActions.includes(r.fields.Action_Text) ? new Date().toISOString() : null
  }
}));
    if(updates.length) await base(tables.MICRO_ACTIONS).update(updates);
  },

  async saveAffirmationAndFinalize(tgId, type, affirmation) {
    const field = type==='morning'?'affirmation_m':'affirmation_e';
    const completed = type==='morning'?'morning_completed':'evening_completed';
    const record = await this._getTodayRecord(tgId);
    if(!record) throw new Error('Responses not found');
    await base(tables.RESPONSES).update(record.id, { [field]: affirmation, Current_Activity: completed });
    await userService.updateUserFields(tgId, { Answer_Step: completed, Last_Activity: new Date().toISOString() });
    if(type==='evening') await dataSyncService.syncEveningData(tgId);
  },

  async isSessionCompleted(tgId, type) {
    const r = await this._getTodayRecord(tgId);
    if(!r) return false;
    const f = r.fields;
    if(type==='morning') return f.Current_Activity==='morning_completed'||!!f.Q_m_6;
    if(type==='evening') return f.Current_Activity==='evening_completed'||!!f.Q_e_5;
    return false;
  },

  analyzeGoalProgress(answer) { return { Goal_Progress: answer }; }
};

export default responseService;
