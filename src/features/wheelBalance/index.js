// Головний експорт
// src/services/wheelBalance/index.js
import * as core from './database.js';
import * as flow from './flow.js';
import * as analysis from './analysis.js';
import * as reminders from './reminders.js';
import * as utils from './utils.js';

// Експортуємо все разом
export default {
  // Core
  ...core,
  
  // Flow
  ...flow,
  
  // Analysis
  ...analysis,
  
  // Reminders
  ...reminders,
  
  // Utils
  ...utils,
  
  getActiveWheel: core.getActiveWheel,
  isAwaitingNote: core.isAwaitingNote,
  cancelActiveWheel: core.cancelActiveWheel,
  getUserWheelStats: core.getUserWheelStats,
  startWheelBalance: flow.startWheelBalance,
  continueActiveWheel: flow.continueActiveWheel,
  processWheelAnswer: flow.processWheelAnswer,
  saveWheelNoteAndGoNext: flow.saveWheelNoteAndGoNext,
  shouldShowWheelReminder: reminders.shouldShowWheelReminder,
  sendMonthlyWheelReminders: reminders.sendMonthlyWheelReminders,
  getWheelInfo: utils.getWheelInfo,
  buildScoreKeyboard: utils.buildScoreKeyboard,
  buildExitKeyboard: utils.buildExitKeyboard,
  LIFE_SPHERES: utils.LIFE_SPHERES
};