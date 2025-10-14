// src/features/wheelBalance/index.js
// Головний модуль Колеса балансу

import { getBase, tables } from '../../config/database.js';
import * as core from './database.js';
import * as flow from './flow.js';
import * as analysis from './analysis.js';
import * as reminders from './reminders.js';
import * as utils from './utils.js';

const base = getBase();

/**
 * Отримати останнє завершене колесо користувача
 */
export const getLatestCompletedWheel = async (tgId) => {
  try {
    const formula = `AND({TG_id} = "${tgId}", {Status} = "Completed")`;
    
    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: formula,
        sort: [{ field: 'Created_Date', direction: 'desc' }],
        maxRecords: 1
      })
      .firstPage();

    if (records.length === 0) {
      console.log(`[wheelBalance] ℹ️ Завершених коліс не знайдено для ${tgId}`);
      return null;
    }

    console.log(`[wheelBalance] ✅ Знайдено колесо від ${records[0].fields.Created_Date}`);
    return records[0];

  } catch (error) {
    console.error('[wheelBalance] ❌ Помилка getLatestCompletedWheel:', error);
    return null;
  }
};

/**
 * Отримати історію всіх коліс користувача
 */
export const getWheelHistory = async (tgId) => {
  try {
    const formula = `AND({TG_id} = "${tgId}", {Status} = "Completed")`;
    
    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: formula,
        sort: [{ field: 'Created_Date', direction: 'desc' }],
        maxRecords: 12
      })
      .all();

    console.log(`[wheelBalance] 📊 Знайдено ${records.length} коліс для ${tgId}`);
    return records;

  } catch (error) {
    console.error('[wheelBalance] ❌ Помилка getWheelHistory:', error);
    return [];
  }
};

// ✅ РЕЕКСПОРТ ФУНКЦІЙ З ПІДМОДУЛІВ
export const getActiveWheel = core.getActiveWheel;
export const isAwaitingNote = core.isAwaitingNote;
export const cancelActiveWheel = core.cancelActiveWheel;
export const getUserWheelStats = core.getUserWheelStats;

export const startWheelBalance = flow.startWheelBalance;
export const continueActiveWheel = flow.continueActiveWheel;
export const processWheelAnswer = flow.processWheelAnswer;
export const saveWheelNoteAndGoNext = flow.saveWheelNoteAndGoNext;

export const generateWheelAnalysis = analysis.generateWheelAnalysis;

export const shouldShowWheelReminder = reminders.shouldShowWheelReminder;
export const sendMonthlyWheelReminders = reminders.sendMonthlyWheelReminders;

export const getWheelInfo = utils.getWheelInfo;
export const buildScoreKeyboard = utils.buildScoreKeyboard;
export const buildExitKeyboard = utils.buildExitKeyboard;
export const { LIFE_SPHERES } = utils;

/**
 * Ініціалізація модуля (default export)
 */
export default function initWheelBalance(bot) {
  console.log('🎯 [wheelBalance] Ініціалізація модуля...');
  console.log('✅ [wheelBalance] Модуль готовий');
}

console.log('✅ [features/wheelBalance] Модуль завантажено');