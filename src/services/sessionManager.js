// src/services/sessionManager.js - ЦЕНТРАЛІЗОВАНЕ УПРАВЛІННЯ СЕСІЯМИ

import { aiMentorSession } from '../utils/session.js';

// ===== ТИПИ СЕСІЙ =====
const SESSION_TYPES = {
  MORNING: 'morning',
  EVENING: 'evening',
  WHEEL: 'wheel',
  AI_MENTOR: 'ai_mentor',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly'
};

// ===== ЗБЕРІГАННЯ СЕСІЙ =====
const activeSessions = new Map(); // { tgId: { type, startTime, data } }

// ===== CORE FUNCTIONS =====

/**
 * Початок сесії
 */
export const startSession = (tgId, type, data = {}) => {
  const id = String(tgId);
  const session = {
    type,
    startTime: new Date(),
    data,
    reminded: false
  };
  
  activeSessions.set(id, session);
  console.log(`[sessionManager] ✅ Started ${type} session for ${id}`);
  
  return session;
};

/**
 * Отримання активної сесії
 */
export const getSession = (tgId) => {
  return activeSessions.get(String(tgId)) || null;
};

/**
 * Перевірка чи активна сесія
 */
export const hasActiveSession = (tgId) => {
  return activeSessions.has(String(tgId));
};

/**
 * Оновлення даних сесії
 */
export const updateSession = (tgId, updates) => {
  const id = String(tgId);
  const session = activeSessions.get(id);
  
  if (!session) return false;
  
  Object.assign(session, updates);
  activeSessions.set(id, session);
  
  return true;
};

/**
 * Завершення сесії
 */
export const endSession = (tgId) => {
  const id = String(tgId);
  const session = activeSessions.get(id);
  
  if (!session) return false;
  
  const duration = Date.now() - session.startTime.getTime();
  console.log(`[sessionManager] ✅ Ended ${session.type} session for ${id} (${Math.round(duration/1000)}s)`);
  
  activeSessions.delete(id);
  return true;
};

/**
 * Позначити як нагадували
 */
export const markReminded = (tgId) => {
  return updateSession(tgId, { reminded: true });
};

// ===== СПЕЦІАЛІЗОВАНІ ФУНКЦІЇ =====

/**
 * Початок ранкової сесії
 */
export const startMorningSession = (tgId) => {
  return startSession(tgId, SESSION_TYPES.MORNING, {
    questionsAnswered: 0,
    totalQuestions: 6
  });
};

/**
 * Початок вечірньої сесії
 */
export const startEveningSession = (tgId) => {
  return startSession(tgId, SESSION_TYPES.EVENING, {
    questionsAnswered: 0,
    totalQuestions: 5
  });
};

/**
 * Початок колеса балансу
 */
export const startWheelSession = (tgId, wheelId) => {
  return startSession(tgId, SESSION_TYPES.WHEEL, {
    wheelId,
    currentSphere: 0,
    totalSpheres: 8,
    awaitingNote: false
  });
};

/**
 * Початок AI наставника
 */
export const startAIMentorSession = (tgId) => {
  // Використовуємо існуючий aiMentorSession
  const sessionId = aiMentorSession.start(tgId);
  
  return startSession(tgId, SESSION_TYPES.AI_MENTOR, {
    sessionId,
    messagesCount: 0
  });
};

// ===== ІНТЕГРАЦІЯ З ІСНУЮЧИМ AI MENTOR SESSION =====

/**
 * Перевірка AI Mentor сесії (сумісність)
 */
export const isAIMentorActive = (tgId) => {
  return aiMentorSession.isActive?.(tgId) || false;
};

/**
 * Завершення AI Mentor сесії (сумісність)
 */
export const endAIMentorSession = (tgId) => {
  aiMentorSession.end?.(tgId);
  endSession(tgId);
};

// ===== УТИЛІТИ =====

/**
 * Отримати всі активні сесії
 */
export const getAllActiveSessions = () => {
  return Array.from(activeSessions.entries()).map(([tgId, session]) => ({
    tgId,
    ...session
  }));
};

/**
 * Отримати сесії по типу
 */
export const getSessionsByType = (type) => {
  return getAllActiveSessions().filter(s => s.type === type);
};

/**
 * Очистити застарілі сесії (старше 2 годин)
 */
export const cleanupStaleSessions = () => {
  const now = Date.now();
  const MAX_AGE = 2 * 60 * 60 * 1000; // 2 години
  let cleaned = 0;
  
  for (const [tgId, session] of activeSessions.entries()) {
    const age = now - session.startTime.getTime();
    if (age > MAX_AGE) {
      activeSessions.delete(tgId);
      cleaned++;
      console.log(`[sessionManager] 🧹 Cleaned stale ${session.type} session for ${tgId}`);
    }
  }
  
  return cleaned;
};

/**
 * Статистика
 */
export const getStats = () => {
  const sessions = getAllActiveSessions();
  const byType = {};
  
  for (const type of Object.values(SESSION_TYPES)) {
    byType[type] = sessions.filter(s => s.type === type).length;
  }
  
  return {
    total: sessions.length,
    byType,
    avgDuration: sessions.length > 0 
      ? Math.round(sessions.reduce((sum, s) => sum + (Date.now() - s.startTime.getTime()), 0) / sessions.length / 1000)
      : 0
  };
};

// ===== ПЕРІОДИЧНЕ ОЧИЩЕННЯ =====
setInterval(() => {
  const cleaned = cleanupStaleSessions();
  if (cleaned > 0) {
    console.log(`[sessionManager] 🧹 Cleaned ${cleaned} stale sessions`);
  }
}, 15 * 60 * 1000); // кожні 15 хвилин

// ===== ЕКСПОРТ =====
export default {
  SESSION_TYPES,
  
  // Core
  startSession,
  getSession,
  hasActiveSession,
  updateSession,
  endSession,
  markReminded,
  
  // Specialized
  startMorningSession,
  startEveningSession,
  startWheelSession,
  startAIMentorSession,
  
  // AI Mentor compatibility
  isAIMentorActive,
  endAIMentorSession,
  
  // Utilities
  getAllActiveSessions,
  getSessionsByType,
  cleanupStaleSessions,
  getStats
};

console.log('✅ [sessionManager] Centralized session manager initialized');