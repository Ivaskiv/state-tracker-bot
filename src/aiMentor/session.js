// src/aiMentor/session.js

const activeSessions = new Map();

export const aiMentorSession = {
  start(tgId) {
    const id = String(tgId);
    activeSessions.set(id, {
      startTime: new Date(),
      isActive: true,
      questionsCount: 0
    });
    console.log(`[aiMentorSession] ✅ Сесію запущено для ${id}`);
  },

  isActive(tgId) {
    const id = String(tgId);
    const session = activeSessions.get(id);
    return Boolean(session && session.isActive);
  },

  end(tgId) {
    const id = String(tgId);
    activeSessions.delete(id);
    console.log(`[aiMentorSession] ✅ Сесію завершено для ${id}`);
  },

  get(tgId) {
    const id = String(tgId);
    return activeSessions.get(id) || null;
  },

  clear() {
    activeSessions.clear();
    console.log('[aiMentorSession] 🧹 Всі сесії очищено');
  },

  getActiveCount() {
    return activeSessions.size;
  }
};