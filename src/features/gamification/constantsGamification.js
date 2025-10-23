//src/config/constantsGamification
// .js
export const ACTIVITY_TRIGGERS = Object.freeze({
  MISSED_DAYS_THRESHOLD: 2,
  INACTIVE_HOURS_THRESHOLD: 48,
  LOW_ACTIVITY_WEEKS_THRESHOLD: 2,
  LOW_COMPLETION_RATE: 30,
  MAX_OFFERS_PER_MONTH: 2
});

export const PROBLEM_TYPES = Object.freeze({
  LOW_ACTIVITY: 'low_activity',
  FEAR: 'fear',
  NO_GOALS: 'no_goals',
  STATE_MASTERY: 'state_mastery'
});

export const PROBLEM_DESCRIPTIONS = Object.freeze({
  [PROBLEM_TYPES.LOW_ACTIVITY]: 'прокрастинації та відкладанні дій',
  [PROBLEM_TYPES.FEAR]: 'страхах та внутрішніх блоках',
  [PROBLEM_TYPES.NO_GOALS]: 'відсутності чіткої стратегії',
  [PROBLEM_TYPES.STATE_MASTERY]: 'управлінні станом та енергією'
});

export const BADGES = Object.freeze({
  BEGINNER:        { key: 'beginner',        icon: '🎯', title: 'Початківець',     description: 'Пройшов 1 місячний аудит', requirement: 'Заповнити Колесо балансу', points: 10 },
  WEEK_FOCUS:      { key: 'week_focus',      icon: '🔥', title: '7-днів фокус',    description: '7 днів без пропусків',     requirement: '7 днів поспіль ранок+вечір', points: 25 },
  WINNER:          { key: 'winner',          icon: '🏆', title: 'Переможець',      description: '30%+ по річній цілі',      requirement: 'Будь-яка ціль ≥30%', points: 50 },
  TRANSFORMER:     { key: 'transformer',     icon: '⭐', title: 'Перетворювач',     description: '30 днів регулярності',     requirement: '30 активних днів', points: 100 },
  CONSISTENT:      { key: 'consistent',      icon: '💎', title: 'Послідовний',     description: '14 днів без пропусків',    requirement: '14 днів поспіль', points: 40 },
  ACHIEVER:        { key: 'achiever',        icon: '🎖️', title: 'Досягатор',      description: '50% цілей виконано',       requirement: 'Completion rate ≥50%', points: 60 },
  AI_POWER_USER:   { key: 'ai_power_user',   icon: '🤖', title: 'AI Майстер',      description: '50 AI взаємодій',          requirement: '50+ діалогів', points: 30 },
  MONTHLY_WARRIOR: { key: 'monthly_warrior', icon: '📊', title: 'Місячний воїн',   description: '4 тижневі звіти',          requirement: '4 поспіль', points: 75 }
});

export const BADGE_CRITERIA = Object.freeze({
  [BADGES.BEGINNER.key]:       { check: (s) => s.wheelBalanceCompleted >= 1, field: 'wheelBalanceCompleted' },
  [BADGES.WEEK_FOCUS.key]:     { check: (s) => s.currentStreak >= 7,        field: 'currentStreak' },
  [BADGES.WINNER.key]:         { check: (s) => s.maxGoalProgress >= 30,     field: 'maxGoalProgress' },
  [BADGES.TRANSFORMER.key]:    { check: (s) => s.totalActiveDays >= 30,     field: 'totalActiveDays' },
  [BADGES.CONSISTENT.key]:     { check: (s) => s.currentStreak >= 14,       field: 'currentStreak' },
  [BADGES.ACHIEVER.key]:       { check: (s) => s.avgCompletionRate >= 50,   field: 'avgCompletionRate' },
  [BADGES.AI_POWER_USER.key]:  { check: (s) => s.totalAIInteractions >= 50, field: 'totalAIInteractions' },
  [BADGES.MONTHLY_WARRIOR.key]:{ check: (s) => s.weeklyReportsCompleted >= 4, field: 'weeklyReportsCompleted' }
});

export const PROGRESS_LEVELS = Object.freeze({
  NOVICE:       { level: 1, userName: 'Новачок',    pointsRequired: 0,    icon: '🌱', color: '#95a5a6' },
  APPRENTICE:   { level: 2, userName: 'Учень',      pointsRequired: 50,   icon: '📚', color: '#3498db' },
  PRACTITIONER: { level: 3, userName: 'Практик',    pointsRequired: 150,  icon: '⚡', color: '#9b59b6' },
  EXPERT:       { level: 4, userName: 'Експерт',    pointsRequired: 300,  icon: '🔥', color: '#e67e22' },
  MASTER:       { level: 5, userName: 'Майстер',    pointsRequired: 500,  icon: '👑', color: '#f39c12' },
  LEGEND:       { level: 6, userName: 'Легенда',    pointsRequired: 1000, icon: '💫', color: '#e74c3c' }
});

export const getProgressLevel = (totalPoints) => {
  const levels = Object.values(PROGRESS_LEVELS);
  for (let i = levels.length - 1; i >= 0; i--) {
    if (totalPoints >= levels[i].pointsRequired) {
      return {
        ...levels[i],
        nextLevel: levels[i + 1] || null,
        progress: levels[i + 1]
          ? Math.min(100, Math.round(((totalPoints - levels[i].pointsRequired) /
            (levels[i + 1].pointsRequired - levels[i].pointsRequired)) * 100))
          : 100
      };
    }
  }
  return { ...PROGRESS_LEVELS.NOVICE, nextLevel: PROGRESS_LEVELS.APPRENTICE, progress: 0 };
};
