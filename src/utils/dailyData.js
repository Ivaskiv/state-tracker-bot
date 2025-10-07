// src/utils/dailyData.js
import responseService from '../services/responseService.js';

export const getUserActions = async (tgId) => {
  const records = await responseService.getUserRecords(tgId, 1);
  if (!records.length) return [];
  const data = records[0].fields;
  return Object.keys(data)
    .filter(k => k.startsWith('Daily_Action'))
    .map(k => data[k])
    .filter(Boolean);
};

export const getUserGoals = async (tgId) => {
  const records = await responseService.getUserRecords(tgId, 1);
  if (!records.length) return [];
  const data = records[0].fields;
  const goals = [];
  for (let i=1;i<=10;i++) {
    const g = data[`Goal_${i}`];
    if (g?.trim()) goals.push(g);
  }
  return goals;
};
