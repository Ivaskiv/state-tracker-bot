// src/aiMentor/session.js  <-- НОВИЙ ФАЙЛ
const activeSessions = new Map();

export const aiMentorSession = {
  start: (tgId) => activeSessions.set(tgId, true),
  end: (tgId) => activeSessions.delete(tgId),
  isActive: (tgId) => activeSessions.has(tgId)
};