// src/services/dailySessions/index.js
import * as repo from './repo.js';
import * as controller from './controller.js';
import * as service from './service.js';
import * as sync from './sync.js';

export default {
  // ===== REPO (ex-database) =====
  getTodayRecord: repo.getTodayRecord,
  createTodayRecord: repo.createTodayRecord,
  updateTodayRecord: repo.updateTodayRecord,
  ensureTodayRecord: repo.ensureTodayRecord,
  isMorningCompleted: repo.isMorningCompleted,
  isEveningCompleted: repo.isEveningCompleted,
  resetSession: repo.resetSession,
  getRecentRecords: repo.getRecentRecords,

  // ===== CONTROLLER =====
  startMorningSession: controller.startMorningSession,
  handleMorningAnswer: controller.handleMorningAnswer,
  restartMorningSession: controller.restartMorningSession,
  continueMorningSession: controller.continueMorningSession,
  exitMorningSession: controller.exitMorningSession,

  startEveningSession: controller.startEveningSession,
  handleEveningAnswer: controller.handleEveningAnswer,
  restartEveningSession: controller.restartEveningSession,
  continueEveningSession: controller.continueEveningSession,
  exitEveningSession: controller.exitEveningSession,

  // ===== SYNC =====
  syncMorningData: sync.syncMorningData,
  syncEveningData: sync.syncEveningData,
  syncGoals: sync.syncGoals,
  syncActions: sync.syncActions,

  // ===== SERVICE (parsers/formatters/utils + колишній shared) =====
  parseMorningAnswer: service.parseMorningAnswer,
  parseEveningAnswer: service.parseEveningAnswer,
  analyzeActionCompletion: service.analyzeActionCompletion,
  analyzeGoalProgress: service.analyzeGoalProgress,

  todayStr: service.todayStr,
  normalize: service.normalize,
  chunk: service.chunk,
  getHoursSince: service.getHoursSince,
  getDaysDiff: service.getDaysDiff,

  formatQuestionMessage: service.formatQuestionMessage,
  formatCompletionMessage: service.formatCompletionMessage,
  formatRestartWarning: service.formatRestartWarning,
  formatEveningWithoutMorning: service.formatEveningWithoutMorning,
  getStepNumber: service.getStepNumber,

  // ⬇️ перенесені з shared.js у service.js
  checkAndCompleteSession: service.checkAndCompleteSession,
  showCompletionWithAnalysis: service.showCompletionWithAnalysis,
  restartSession: service.restartSession,
  exitSession: service.exitSession,
};
