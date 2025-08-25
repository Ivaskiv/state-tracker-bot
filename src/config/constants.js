// src/config/constants.js
export const SUBSCRIPTION_PLANS = Object.freeze({
  WEEK: {
    name: 'Тиждень фокусу',
    price: 7,
    duration: 7,
    description: 'Ідеально для короткого фокусу або тесту системи',
  },
  MONTH: {
    name: 'Місяць дії',
    price: 30,
    duration: 30,
    description: 'Глибинна робота з твоїми цілями та стратегією',
  },
  YEAR: {
    name: 'Рік трансформації',
    price: 300,
    duration: 365,
    description: 'Максимальна економія та підтримка протягом року',
  },
});

export const QUESTION_TYPES = Object.freeze({
  MORNING: 'Morning',
  EVENING: 'Evening',
});

export const ANSWER_STEPS = Object.freeze({
  BEGIN: 'Begin_answer',
  MORNING_1: 'Q_m_1',
  MORNING_2: 'Q_m_2',
  MORNING_3: 'Q_m_3',
  MORNING_4: 'Q_m_4',
  MORNING_5: 'Q_m_5',
  MORNING_6: 'Q_m_6',
  END_MORNING: 'End_m',
  EVENING_1: 'Q_e_1',
  EVENING_2: 'Q_e_2',
  EVENING_3: 'Q_e_3',
  EVENING_4: 'Q_e_4',
  EVENING_5: 'Q_e_5',
  END_EVENING: 'End_e',
  MORNING_PENDING: 'morning_pending',
  EVENING_PENDING: 'evening_pending',
  COMPLETED: 'completed',
});

export const STEP_ORDER = [
  ANSWER_STEPS.MORNING_1,
  ANSWER_STEPS.MORNING_2,
  ANSWER_STEPS.MORNING_3,
  ANSWER_STEPS.MORNING_4,
  ANSWER_STEPS.MORNING_5,
    ANSWER_STEPS.MORNING_6,
  ANSWER_STEPS.END_MORNING,
  ANSWER_STEPS.EVENING_1,
  ANSWER_STEPS.EVENING_2,
  ANSWER_STEPS.EVENING_3,
  ANSWER_STEPS.EVENING_4,
  ANSWER_STEPS.EVENING_5,
  ANSWER_STEPS.END_EVENING,
];

export const MORNING_QUESTIONS = [
  'Хто я сьогодні?\nОпиши себе як нову версію — з позиції сили.\n(Наприклад: я топ експерт, я власниця відомого бренду, я мільйонерка, я відома співачка...)\n_Я — ___________',
  'Яка я?\nДай відповідь на питання.\n(Наприклад: сильна, смілива, любляча, щира, рішуча...)\n_Я — ___________',
  'Мої 10 цілей на рік\nПропиши щодня наново — ніби вони вже реальність.\nНе дивись, що писала вчора.\n1. Я маю...\n2. Я живу...\n3. Я отримую...\n... до 10',
  'На яку одну ціль я фокусуюсь сьогодні?\nТе, що хочеш просунути зараз.\n_Я — ___________',
  'Який мій стан сьогодні?\nОпиши свій стан прямо зараз.\n_Я відчуваю: ___________\nЯкщо стан не ресурсний — обери новий: впевненість, рішучість, легкість, сила — і налаштуйся на нього.',
  'Чому я гідна мати все це прямо зараз?\nОдна сильна відповідь із позиції самоцінності.\n(Наприклад: бо я вже достатня / цінна / варта.)\n_Я — ___________',
];

export const EVENING_QUESTIONS = [
  'Що мене сьогодні наповнило енергією?\nЛюди, дії, ситуації, стани.\n_Мене сьогодні наповнило енергією: ___________',
  'Де я сьогодні злила енергію чи втратила стан?\nТригер, сумнів, ситуація, реакція.\n_Я сьогодні злила енергію в: ___________',
  'Яка програма або переконання активувалась сьогодні?\n(Наприклад: страх, “мені не вийде”, “я не заслуговую”...)\n_У мене сьогодні активувалась програма: ___________',
  'З якої точки я діяла сьогодні: сили чи страху?\nЧесна відповідь. Що керувало тобою?\n_Мною сьогодні керувала/керував: ___________',
  'Яка моя головна перемога сьогодні?\nДія, стан, рішення — будь-який успіх.\n_Сьогодні я: ___________',
];

export const SCHEDULE = Object.freeze({
  MORNING_TIME: '12:29',
  EVENING_TIME: '23:30',
  MORNING_HOUR: 13,
  EVENING_HOUR: 20,
  MORNING_START: 7,
  MORNING_END: 20,
  EVENING_START: 20,
  EVENING_END: 23,
  TIMEZONE: 'Europe/Prague',
});
export const REPORT_SCHEDULE = Object.freeze({
  WEEKLY: {
    dayOfWeek: 0,        
    hour: 21,
    minute: 0,
    message: '📊 Щотижневий звіт',
  },
  MONTHLY: {
    dayRange: [28, 29, 30, 31], 
    hour: 22,
    minute: 0,
    message: '📊 Місячний звіт',
  },
});


export const AFFIRMATION_CATEGORIES = [
  'Особистий розвиток',
  'Бізнес-зріст',
  'Ясність цілей',
  'Впевненість',
  'Інше',
];

export const LATE_TEXT = (nextType) =>
  `На жаль, ви не відповіли вчасно. Важливо відповідати в межах вікна — це формує дисципліну і прогрес. Будь ласка, відповідайте на ${nextType === 'Evening' ? 'вечірні' : 'ранкові'} питання.`;