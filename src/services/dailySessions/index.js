// src/services/dailySessions/index.js
import * as db from './database.js';
import * as morning from './morning.js';
import * as evening from './evening.js';
import * as sync from './sync.js';
import * as helpers from './helpers.js';
import * as utils from './utils.js';
import * as formatter from './formatter.js';
import * as keyboards from './keyboards.js';

export default {
  // Database
  getTodayRecord: db.getTodayRecord,
  createTodayRecord: db.createTodayRecord,
  updateTodayRecord: db.updateTodayRecord,
  ensureTodayRecord: db.ensureTodayRecord,
  isMorningCompleted: db.isMorningCompleted,
  isEveningCompleted: db.isEveningCompleted,
  resetSession: db.resetSession,
  getRecentRecords: db.getRecentRecords,
  
  // Morning
  startMorningSession: morning.startMorningSession,
  handleMorningAnswer: morning.handleMorningAnswer,
  restartMorningSession: morning.restartMorningSession,
  continueMorningSession: morning.continueMorningSession,
  exitMorningSession: morning.exitMorningSession,
  
  // Evening
  startEveningSession: evening.startEveningSession,
  handleEveningAnswer: evening.handleEveningAnswer,
  restartEveningSession: evening.restartEveningSession,
  continueEveningSession: evening.continueEveningSession,
  exitEveningSession: evening.exitEveningSession,
  
  // Sync
  syncMorningData: sync.syncMorningData,
  syncEveningData: sync.syncEveningData,
  syncGoals: sync.syncGoals,
  syncActions: sync.syncActions,
  
  // Helpers
  parseMorningAnswer: helpers.parseMorningAnswer,
  parseEveningAnswer: helpers.parseEveningAnswer,
  analyzeActionCompletion: helpers.analyzeActionCompletion,
  analyzeGoalProgress: helpers.analyzeGoalProgress,
  
  // Utils
  todayStr: utils.todayStr,
  normalize: utils.normalize,
  chunk: utils.chunk,
  getHoursSince: utils.getHoursSince,
  getDaysDiff: utils.getDaysDiff,
  
  // Formatter
  formatQuestionMessage: formatter.formatQuestionMessage,
  formatCompletionMessage: formatter.formatCompletionMessage,
  formatRestartWarning: formatter.formatRestartWarning,
  formatEveningWithoutMorning: formatter.formatEveningWithoutMorning,
  getStepNumber: formatter.getStepNumber,
  
  // Keyboards
  buildExitKeyboard: keyboards.buildExitKeyboard,
  buildRestartWarningKeyboard: keyboards.buildRestartWarningKeyboard,
  buildEveningWithoutMorningKeyboard: keyboards.buildEveningWithoutMorningKeyboard,
  buildSessionStartKeyboard: keyboards.buildSessionStartKeyboard
};