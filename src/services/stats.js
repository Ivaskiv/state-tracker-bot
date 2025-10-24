// src/services/stats.js
import { getBase, tables } from '../config/database.js';
import { toISODate as toISODateHelper } from '../utils/helpers.js';

const base = getBase();

const toISODate = (d) => toISODateHelper(d);

const calcStreak = (responses) => {
  if (!responses?.length) return 0;

  const days = new Set(
    responses
      .map((r) => r.fields?.Date_Response)
      .map(toISODate)
      .filter(Boolean)
  );

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  while (true) {
    const d = new Date(today);
    d.setDate(today.getDate() - streak);
    const key = d.toISOString().slice(0, 10);
    if (days.has(key)) streak += 1;
    else break;
  }
  return streak;
};

export const getUserStats = async (tgId) => {
  try {
    const users = await base(tables.USERS)
      .select({
        filterByFormula: `{TG_id} = "${tgId}"`,
        maxRecords: 1,
        fields: [
          'User Name',
          'Status',
          'Active_Subscription_Plan',   
          'Active_Subscription_Status', 
          'Subscription_Status',
          'End_Date',
          'Total_Sessions',
          'Total_Points'
        ]
      })
      .firstPage();

    const userFields = users[0]?.fields || {};

    let responses = [];
    try {
      responses = await base(tables.RESPONSES)
        .select({
          filterByFormula: `{TG_id} = "${tgId}"`,
          fields: ['Date_Response']
        })
        .all();
    } catch {

    }

    const currentStreak = calcStreak(responses);

    const lastRespDate = responses
      .map((r) => r.fields?.Date_Response)
      .map((d) => (d ? new Date(d) : null))
      .filter((d) => d && !isNaN(d))
      .sort((a, b) => b - a)[0];

    let aiConvos = [];
    try {
      aiConvos = await base(tables.AI_CONVERSATIONS)
        .select({
          filterByFormula: `{TG_id} = "${tgId}"`,
          fields: ['Created_At']
        })
        .all();
    } catch {
      
    }

    const lastAiDate = aiConvos
      .map((r) => r.fields?.Created_At)
      .map((d) => (d ? new Date(d) : null))
      .filter((d) => d && !isNaN(d))
      .sort((a, b) => b - a)[0];

    const lastSessionDateObj =
      [lastRespDate, lastAiDate].filter(Boolean).sort((a, b) => b - a)[0] || null;

    const lastSessionStr = lastSessionDateObj
      ? lastSessionDateObj.toISOString().slice(0, 10)
      : null;

    let wheelCompleted = false;
    try {
      const wheels = await base(tables.WHEEL_BALANCE)
        .select({
          filterByFormula: `AND({TG_id} = "${tgId}", {Status} = "Completed")`,
          sort: [{ field: 'Completed_Date', direction: 'desc' }],
          maxRecords: 1,
          fields: ['Status', 'Completed_Date', 'Total_Score']
        })
        .firstPage();
      wheelCompleted = (wheels?.length || 0) > 0;
    } catch {
      
    }

    let maxGoalProgress = 0;
    let avgCompletionRate = 0;
    try {
      const goals = await base(tables.USER_GOALS)
        .select({
          filterByFormula: `AND({TG_id} = "${tgId}", {Status} = "active")`,
          fields: ['Progress']
        })
        .all();
      if (goals.length) {
        const arr = goals.map((g) => Number(g.fields?.Progress || 0));
        maxGoalProgress = Math.max(...arr);
        avgCompletionRate = Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);
      }
    } catch { 
      
    }

    let weeklyReportsCompleted = 0;
    try {
      const reps = await base(tables.USER_REPORTS)
        .select({
          filterByFormula: `{TG_id} = "${tgId}"`,
          fields: ['TG_id']
        })
        .all();
      weeklyReportsCompleted = reps.length;
    } catch { 
      
     }

    const plan = String(userFields['Active_Subscription_Plan'] || '');
    const status = String(userFields['Subscription_Status'] || '').toLowerCase();

    let hasAccess = status === 'active' || /пробний|trial/i.test(plan);
    if (!hasAccess && userFields.End_Date) {
      const end = new Date(`${userFields.End_Date}T23:59:59`);
      hasAccess = new Date() <= end;
    }

    const subscriptionLabel =
      userFields['Active_Subscription_Status'] ||
      (hasAccess ? '✅ Активна' : '❌ Немає активної підписки');

    return {
      userName: userFields['User Name'] || '',
      subscriptionStatus: hasAccess ? 'active' : 'inactive',
      subscriptionLabel, 

      currentStreak,
      lastSessionDate: lastSessionStr,
      completedSessions: Number(userFields.Total_Sessions || 0),

      wheelCompleted,
      weeklyReportsCompleted,
      totalAIInteractions: aiConvos.length,

      maxGoalProgress,
      avgCompletionRate,
      totalPoints: Number(userFields.Total_Points || 0)
    };
  } catch (e) {
    console.error('[stats/getUserStats] error:', e.message);
    return {
      userName: '',
      subscriptionStatus: 'inactive',
      subscriptionLabel: '❌ Немає активної підписки',
      currentStreak: 0,
      lastSessionDate: null,
      completedSessions: 0,
      wheelCompleted: false,
      weeklyReportsCompleted: 0,
      totalAIInteractions: 0,
      maxGoalProgress: 0,
      avgCompletionRate: 0,
      totalPoints: 0
    };
  }
};

export default { getUserStats };
