// src/aiMentor/session.js - ВИПРАВЛЕНО ЗБЕРЕЖЕННЯ СЕСІЇ

const activeSessions = new Map();

export const aiMentorSession = {
  start: (tgId) => {
    const id = String(tgId); // ✅ ЗАВЖДИ КОНВЕРТУЄМО В СТРОКУ
    activeSessions.set(id, {
      started: Date.now(),
      active: true
    });
    console.log(`[aiMentorSession] ✅ Сесію запущено для ${id}, загальна кількість: ${activeSessions.size}`);
    console.log(`[aiMentorSession] 📋 Активні сесії:`, Array.from(activeSessions.keys()));
  },
  
  end: (tgId) => {
    const id = String(tgId); // ✅ ЗАВЖДИ КОНВЕРТУЄМО В СТРОКУ
    const deleted = activeSessions.delete(id);
    console.log(`[aiMentorSession] ${deleted ? '✅' : '❌'} Сесію завершено для ${id}, залишилось: ${activeSessions.size}`);
  },
  
  isActive: (tgId) => {
    const id = String(tgId); // ✅ ЗАВЖДИ КОНВЕРТУЄМО В СТРОКУ
    const active = activeSessions.has(id);
    console.log(`[aiMentorSession] 🔍 Перевірка для ${id}: ${active ? 'АКТИВНА' : 'НЕАКТИВНА'}`);
    if (active) {
      const session = activeSessions.get(id);
      console.log(`[aiMentorSession] 📊 Деталі сесії для ${id}:`, session);
    }
    return active;
  }
};