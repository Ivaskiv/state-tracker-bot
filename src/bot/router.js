// src/bot/router.js
import initOnboarding from '../features/onboarding/index.js';
import initDailySessions from '../features/dailySessions/index.js';
import initWheelBalance from '../features/wheelBalance/index.js';
import initAIMentor from '../features/aiMentor/index.js';
import initSubscription from '../features/subscription/index.js';
import initDashboard from '../features/dashboard/index.js';
import initReports from '../features/reports/index.js';
import initAffirmations from '../features/affirmations/index.js';
import initGamification from '../features/gamification/index.js';

export const initRouter = (bot) => {
  console.log('🤖 [router] Підключення модулів…');

  initOnboarding(bot);
  initDailySessions(bot);
  initWheelBalance(bot);
  initAIMentor(bot);
  initSubscription(bot);
  initDashboard(bot);
  initReports(bot);
  initAffirmations(bot);
  initGamification(bot);

  console.log('✅ [router] Всі модулі готові');
};