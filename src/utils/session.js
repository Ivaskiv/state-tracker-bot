// src/aiMentor/session.js - ОНОВЛЕНО

const activeSessions = new Map();

export const aiMentorSession = {
  // Запуск сесії
  start(tgId) {
    const id = String(tgId);
    const sessionId = `AI_${id}_${Date.now()}`;
    
    activeSessions.set(id, {
      sessionId,
      startTime: new Date(),
      isActive: true,
      questionsCount: 0,
      lastActivity: new Date()
    });
    
    console.log(`[AI SESSION] ✅ Сесію запущено: ${sessionId}`);
    return sessionId;
  },

  // Перевірка активності
  isActive(tgId) {
    const id = String(tgId);
    const session = activeSessions.get(id);
    
    if (!session || !session.isActive) {
      return false;
    }
    
    // Перевіряємо час неактивності (2 години)
    const now = new Date();
    const timeDiff = now - session.lastActivity;
    const maxInactivity = 2 * 60 * 60 * 1000;
    
    if (timeDiff > maxInactivity) {
      this.end(id);
      console.log(`[AI SESSION] ⏰ Сесія закрита через неактивність`);
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
      
      console.log(`[AI SESSION] 🏁 Сесія ${session.sessionId} завершена: ${minutes} хв, ${session.questionsCount} питань`);
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
  }
};

export default aiMentorSession;