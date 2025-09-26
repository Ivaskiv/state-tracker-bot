// src/aiMentor/session.js - СЕСІЯ AI НАСТАВНИКА

const activeSessions = new Map();

export const aiMentorSession = {
  // Запуск сесії
  start(tgId) {
    const id = String(tgId);
    activeSessions.set(id, {
      startTime: new Date(),
      isActive: true,
      questionsCount: 0,
      lastActivity: new Date()
    });
    console.log(`[AI SESSION] ✅ Сесію запущено для ${id}`);
  },

  // Перевірка активності
  isActive(tgId) {
    const id = String(tgId);
    const session = activeSessions.get(id);
    
    if (!session || !session.isActive) {
      return false;
    }
    
    // Перевіряємо чи не застаріла сесія (більше 2 годин)
    const now = new Date();
    const timeDiff = now - session.lastActivity;
    const maxInactivity = 2 * 60 * 60 * 1000; // 2 години
    
    if (timeDiff > maxInactivity) {
      this.end(id);
      console.log(`[AI SESSION] ⏰ Сесія ${id} закрита через неактивність`);
      return false;
    }
    
    return true;
  },

  // Завершення сесії
  end(tgId) {
    const id = String(tgId);
    const session = activeSessions.get(id);
    
    if (session) {
      const duration = new Date() - session.startTime;
      const minutes = Math.round(duration / 60000);
      
      console.log(`[AI SESSION] 🏁 Сесія ${id} завершена, тривалість: ${minutes} хв, питань: ${session.questionsCount}`);
    }
    
    activeSessions.delete(id);
  },

  // Оновлення активності
  updateActivity(tgId) {
    const id = String(tgId);
    const session = activeSessions.get(id);
    
    if (session) {
      session.lastActivity = new Date();
      session.questionsCount += 1;
    }
  },

  // Отримання інформації про сесію
  get(tgId) {
    const id = String(tgId);
    return activeSessions.get(id) || null;
  },

  // Очищення всіх сесій
  clear() {
    const count = activeSessions.size;
    activeSessions.clear();
    console.log(`[AI SESSION] 🧹 Очищено ${count} сесій`);
  },

  // Отримання кількості активних сесій
  getActiveCount() {
    return activeSessions.size;
  },

  // Отримання списку всіх активних сесій
  getAllActive() {
    return Array.from(activeSessions.entries()).map(([tgId, session]) => ({
      tgId,
      ...session
    }));
  },

  // Очищення застарілих сесій (викликається періодично)
  cleanupExpiredSessions() {
    const now = new Date();
    const maxInactivity = 2 * 60 * 60 * 1000; // 2 години
    let cleanedCount = 0;
    
    for (const [tgId, session] of activeSessions.entries()) {
      const timeDiff = now - session.lastActivity;
      
      if (timeDiff > maxInactivity) {
        activeSessions.delete(tgId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[AI SESSION] 🧹 Очищено ${cleanedCount} застарілих сесій`);
    }
    
    return cleanedCount;
  }
};

// Автоматичне очищення застарілих сесій кожні 30 хвилин
setInterval(() => {
  aiMentorSession.cleanupExpiredSessions();
}, 30 * 60 * 1000);

export default aiMentorSession;