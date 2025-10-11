// src/services/dailySessions/index.js
import * as db from './database.js';
import * as morning from './morning.js';
import * as evening from './evening.js';
import * as sync from './sync.js';
import * as helpers from './helpers.js';
import * as utils from './utils.js';
import * as formatter from './formatter.js';
import * as keyboards from './keyboards.js';
import * as shared from './shared.js';

export default {
  // ===== DATABASE =====
  getTodayRecord: db.getTodayRecord,
  createTodayRecord: db.createTodayRecord,
  updateTodayRecord: db.updateTodayRecord,
  ensureTodayRecord: db.ensureTodayRecord,
  isMorningCompleted: db.isMorningCompleted,
  isEveningCompleted: db.isEveningCompleted,
  resetSession: db.resetSession,
  getRecentRecords: db.getRecentRecords,
  
  // ===== MORNING =====
  startMorningSession: morning.startMorningSession,
  handleMorningAnswer: morning.handleMorningAnswer,
  restartMorningSession: morning.restartMorningSession,
  continueMorningSession: morning.continueMorningSession,
  exitMorningSession: morning.exitMorningSession,
  
  // ===== EVENING =====
  startEveningSession: evening.startEveningSession,
  handleEveningAnswer: evening.handleEveningAnswer,
  restartEveningSession: evening.restartEveningSession,
  continueEveningSession: evening.continueEveningSession,
  exitEveningSession: evening.exitEveningSession,
  
  // ===== SYNC =====
  syncMorningData: sync.syncMorningData,
  syncEveningData: sync.syncEveningData,
  syncGoals: sync.syncGoals,
  syncActions: sync.syncActions,
  
  // ===== HELPERS =====
  parseMorningAnswer: helpers.parseMorningAnswer,
  parseEveningAnswer: helpers.parseEveningAnswer,
  analyzeActionCompletion: helpers.analyzeActionCompletion,
  analyzeGoalProgress: helpers.analyzeGoalProgress,
  
  // ===== UTILS =====
  todayStr: utils.todayStr,
  normalize: utils.normalize,
  chunk: utils.chunk,
  getHoursSince: utils.getHoursSince,
  getDaysDiff: utils.getDaysDiff,
  
  // ===== FORMATTER =====
  formatQuestionMessage: formatter.formatQuestionMessage,
  formatCompletionMessage: formatter.formatCompletionMessage,
  formatRestartWarning: formatter.formatRestartWarning,
  formatEveningWithoutMorning: formatter.formatEveningWithoutMorning,
  getStepNumber: formatter.getStepNumber,
  
  // ===== KEYBOARDS =====
  buildExitKeyboard: keyboards.buildExitKeyboard,
  buildRestartWarningKeyboard: keyboards.buildRestartWarningKeyboard,
  buildEveningWithoutMorningKeyboard: keyboards.buildEveningWithoutMorningKeyboard,
  buildSessionStartKeyboard: keyboards.buildSessionStartKeyboard,
  
  // ===== ✅ SHARED (НОВА ЛОГІКА) =====
  checkAndCompleteSession: shared.checkAndCompleteSession,
  showCompletionWithAnalysis: shared.showCompletionWithAnalysis,
  restartSession: shared.restartSession,
  exitSession: shared.exitSession
};