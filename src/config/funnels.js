// src/config/funnels.js
import { registerFunnel } from '../services/funnelEngine.js';
import { tables } from './database.js';

// ═══════════════════════════════════════════════════════════
// ВОРОНКА 1: 5 безкоштовних відео
// ═══════════════════════════════════════════════════════════

registerFunnel('free_5_videos', {
  name: '5 відео від вигорання',
  totalSteps: 5,
  durationHours: 72,
  maxLives: 5,
  tableName: tables.FREE5_PROGRESS,
  metadata: {
    reward: '7 днів AI-наставника',
    videos: [
      { id: 1, url: 'https://youtube.com/...', title: 'Розпізнай шаблон' },
      { id: 2, url: 'https://youtube.com/...', title: 'Чому курси не працюють' },
      { id: 3, url: 'https://youtube.com/...', title: 'Алгоритм виходу' },
      { id: 4, url: 'https://youtube.com/...', title: 'Інтеграція в життя' },
      { id: 5, url: 'https://youtube.com/...', title: 'Перший крок' }
    ]
  }
});

// ═══════════════════════════════════════════════════════════
// ВОРОНКА 2: 7 днів trial
// ═══════════════════════════════════════════════════════════

registerFunnel('trial_7_days', {
  name: '7 днів з AI-наставником',
  totalSteps: 7,
  durationHours: 168,
  maxLives: 0,
  tableName: tables.TRIAL_PROGRESS,
  metadata: {
    includes: ['Колесо балансу', 'Щоденні сесії', 'AI-коучинг']
  }
});

// ═══════════════════════════════════════════════════════════
// ВОРОНКА 3: Платний продукт
// ═══════════════════════════════════════════════════════════

registerFunnel('paid_course_28_days', {
  name: '28 днів внутрішньої опори',
  totalSteps: 28,
  durationHours: 672,
  maxLives: 0,
  tableName: tables.PAID_PROGRESS,
  metadata: {
    price: '45€',
    modules: ['Стан', 'Бачення', 'Звільнення', 'Рішення', 'Система']
  }
});

export const FUNNELS = {
  FREE_5_VIDEOS: 'free_5_videos',
  TRIAL_7_DAYS: 'trial_7_days',
  PAID_COURSE: 'paid_course_28_days'
};