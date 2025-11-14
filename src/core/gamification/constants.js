// src/core/gamification/constants.js
export const BADGES = Object.freeze({
  BEGINNER: { 
    key: 'beginner', 
    icon: '🎯', 
    title: 'Початківець', 
    description: 'Пройшов перше Колесо балансу', 
    points: 10 
  },
  FIRST_VIDEO: { 
    key: 'first_video', 
    icon: '🎬', 
    title: 'Перше відео', 
    description: 'Переглянув перше відео', 
    points: 5 
  },
  ALL_VIDEOS: { 
    key: 'all_videos', 
    icon: '🏆', 
    title: '5 відео', 
    description: 'Завершив всі 5 відео', 
    points: 50 
  },
  WEEK_STREAK: { 
    key: 'week_focus', 
    icon: '🔥', 
    title: '7-днів фокус', 
    description: '7 днів без пропусків', 
    points: 25 
  },
  CONSISTENT: { 
    key: 'consistent', 
    icon: '💎', 
    title: 'Послідовний', 
    description: '14 днів без пропусків', 
    points: 40 
  },
  TRANSFORMER: { 
    key: 'transformer', 
    icon: '⭐', 
    title: 'Перетворювач', 
    description: '30 днів регулярності', 
    points: 100 
  },
  AI_MASTER: { 
    key: 'ai_power_user', 
    icon: '🤖', 
    title: 'AI Майстер', 
    description: '50 AI взаємодій', 
    points: 30 
  },
  WHEEL_GURU: { 
    key: 'wheel_guru', 
    icon: '🎡', 
    title: 'Гуру балансу', 
    description: 'Завершив Колесо балансу', 
    points: 20 
  },
  WINNER: { 
    key: 'winner', 
    icon: '🏅', 
    title: 'Переможець', 
    description: '30%+ по річній цілі', 
    points: 50 
  },
  ACHIEVER: { 
    key: 'achiever', 
    icon: '🎖️', 
    title: 'Досягатор', 
    description: '50% цілей виконано', 
    points: 60 
  },
  MONTHLY_WARRIOR: { 
    key: 'monthly_warrior', 
    icon: '📊', 
    title: 'Місячний воїн', 
    description: '4 тижневі звіти поспіль', 
    points: 75 
  }
});

export const BADGE_CRITERIA = Object.freeze({
  [BADGES.BEGINNER.key]: { check: (s) => s.wheelBalanceCompleted >= 1 },
  [BADGES.FIRST_VIDEO.key]: { check: (s) => s.videosCompleted >= 1 },
  [BADGES.ALL_VIDEOS.key]: { check: (s) => s.videosCompleted >= 5 },
  [BADGES.WEEK_STREAK.key]: { check: (s) => s.currentStreak >= 7 },
  [BADGES.CONSISTENT.key]: { check: (s) => s.currentStreak >= 14 },
  [BADGES.TRANSFORMER.key]: { check: (s) => s.totalActiveDays >= 30 },
  [BADGES.AI_MASTER.key]: { check: (s) => s.totalAIInteractions >= 50 },
  [BADGES.WHEEL_GURU.key]: { check: (s) => s.wheelBalanceCompleted >= 1 },
  [BADGES.WINNER.key]: { check: (s) => s.maxGoalProgress >= 30 },
  [BADGES.ACHIEVER.key]: { check: (s) => s.avgCompletionRate >= 50 },
  [BADGES.MONTHLY_WARRIOR.key]: { check: (s) => s.weeklyReportsCompleted >= 4 }
});

export const PROGRESS_LEVELS = Object.freeze({
  NOVICE: { level: 1, userName: 'Новачок', pointsRequired: 0, icon: '🌱', color: '#95a5a6' },
  APPRENTICE: { level: 2, userName: 'Учень', pointsRequired: 50, icon: '📚', color: '#3498db' },
  PRACTITIONER: { level: 3, userName: 'Практик', pointsRequired: 150, icon: '⚡', color: '#9b59b6' },
  EXPERT: { level: 4, userName: 'Експерт', pointsRequired: 300, icon: '🔥', color: '#e67e22' },
  MASTER: { level: 5, userName: 'Майстер', pointsRequired: 500, icon: '👑', color: '#f39c12' },
  LEGEND: { level: 6, userName: 'Легенда', pointsRequired: 1000, icon: '💫', color: '#e74c3c' }
});

export const REWARDS = {
  REGISTRATION: 10,
  VIDEO_COMPLETE: 5,
  AI_INTERACTION: 2,
  WHEEL_COMPLETE: 20,
  DAILY_SESSION: 3,
  FUNNEL_COMPLETE: 50,
  GOAL_PROGRESS: 5
};