//src/config/constantsSchedule.js
// ONE SOURCE OF TRUTH
export const SCHEDULE = Object.freeze({
  MORNING_TIME: '17:58',
  EVENING_TIME: '21:00',
  TIMEZONE: 'Europe/Kyiv'
});

// утиліта для розбору HH:MM (локальна)
const parseHm = (t) => {
  const [h, m] = String(t).split(':').map(n => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) throw new Error(`Bad time: ${t}`);
  return { h, m };
};

const { h: MH, m: MM } = parseHm(SCHEDULE.MORNING_TIME);
const { h: EH, m: EM } = parseHm(SCHEDULE.EVENING_TIME);

// cron: формат "M H * * *"
export const CRON_SCHEDULES = Object.freeze({
  MORNING_QUESTIONS: `${MM} ${MH} * * *`,
  EVENING_QUESTIONS: `${EM} ${EH} * * *`,
  WEEKLY_REPORTS: '0 19 * * 0',
  WEEKLY_ACTIVITY: '0 20 * * 0',
  MONTHLY_WHEEL_CHECK: '0 10 1 * *',
  SUBSCRIPTION_CHECK: '0 10 * * *',
  DAILY_FINALIZATION: '59 23 * * *'
});

export const SCHEDULER_MESSAGES = Object.freeze({
  MORNING_SESSION_START: (userName) =>
    `🌞 Доброго ранку, ${userName}!\n\nЧас для ранкової рефлексії та налаштування на день! ✨`,
  EVENING_SESSION_START: (userName) =>
    `🌙 Добрий вечір, ${userName}!\n\nЧас підсумувати день і зафіксувати перемоги! 🏆`,
  MORNING_REMINDER: '🔔 Нагадування: ранкова сесія ще не завершена.',
  EVENING_REMINDER: '🔔 Нагадування: вечірня сесія ще не завершена.',
  WEEKLY_PROMPT:
    '📊 ЩОТИЖНЕВИЙ ЗВІТ\n\nЧас проаналізувати тиждень і скоригувати стратегію. ⏱ Займе кілька хвилин.',
  MIDDAY_SUMMARY: (done, total) => {
    if (total === 0) return '⏰ СЕРЕДИНА ДНЯ\n\nНа сьогодні дій не заплановано.';
    if (done === 0) return `⏰ СЕРЕДИНА ДНЯ\n\nЗаплановано: ${total}\n✅ Виконано: 0\n\nПочни з найкоротшої дії — 10 хв.`;
    if (done < total) return `⏰ СЕРЕДИНА ДНЯ\n\n✅ Виконано: ${done}/${total}\nПродовжуй у тому ж дусі! 💪`;
    return `🎉 ЧУДОВО!\n\nВсі дії виконано: ${total}/${total}\nТримаємо курс!`;
  },
  TASK_REMINDER: (task) =>
    `⏰ НАГАДУВАННЯ\n\nЧерез 5 хв стартує:\n${task.action}\n\n🎯 Результат: ${task.result_metric}\n⏱ Тривалість: ${task.duration_min} хв\n\n💪 Тримай фокус!`
});
