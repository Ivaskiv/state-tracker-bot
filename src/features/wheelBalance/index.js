// src/features/wheelBalance/index.js
import * as flow from './flow.js';
import * as analysis from './analysis.js';
import { wheelController } from './controller.js';
import logger from '../../utils/logger.js';

// ===============================================================
// 📤 ЕКСПОРТ ОСНОВНИХ ФУНКЦІЙ
// ===============================================================

// Flow функції
export const startWheelBalance = flow.startWheelBalance;
export const continueActiveWheel = flow.continueActiveWheel;
export const processWheelAnswer = flow.processWheelAnswer;
export const saveWheelNoteAndGoNext = flow.saveWheelNoteAndGoNext;
export const startNewWheelIgnoreOld = flow.startNewWheelIgnoreOld;
export const isAwaitingNote = flow.isAwaitingNote;
export const goBackWheelStep = flow.goBackWheelStep;
export const cancelWheelBalance = flow.cancelWheelBalance;

export const getWheelHistory = flow.getWheelHistory;
export const getActiveWheel = flow.getActiveWheel;
export const getLatestCompletedWheel = flow.getLatestCompletedWheel;


// Analysis функції
export const generateWheelAnalysis = analysis.generateWheelAnalysis;

// Controller функції (форматування)
export const getWheelQuestionBeautiful = wheelController.getWheelQuestionBeautiful;
export const getWheelInfoSimple = wheelController.getWheelInfoSimple;
export const getWheelQuestionQuick = wheelController.getWheelQuestionQuick;

// Для зворотної сумісності
export const getWheelInfo = wheelController.getWheelQuestionBeautiful;

// ===============================================================
// 🎯 ІНІЦІАЛІЗАЦІЯ МОДУЛЯ
// ===============================================================

export default function initWheelBalance(bot) {
  logger.info('🎯 [wheelBalance] Ініціалізація модуля...');
  logger.info('✅ [wheelBalance] Модуль готовий');
}

console.log('✅ [features/wheelBalance] Модуль завантажено');