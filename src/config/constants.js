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
  END_MORNING: 'End_m',
  EVENING_1: 'Q_e_1',
  EVENING_2: 'Q_e_2',
  EVENING_3: 'Q_e_3',
  EVENING_4: 'Q_e_4',
  EVENING_5: 'Q_e_5',
  END_EVENING: 'End_e',
});

export const MORNING_QUESTIONS = [
  '1️⃣ Хто я сьогодні? Опиши себе як нову версію — з позиції сили.',
  '2️⃣ Яка я? (сильна, смілива, любляча, щира, рішуча...)',
  '3️⃣ Мої 10 цілей на рік. Пиши як вже реальність.',
  '4️⃣ На яку одну ціль я фокусуюсь сьогодні?',
  '5️⃣ Який мій стан сьогодні?',
  '6️⃣ Чому я гідна мати все це прямо зараз?',
];

export const EVENING_QUESTIONS = [
  '1️⃣ Що мене сьогодні наповнило енергією?',
  '2️⃣ Де я сьогодні злила енергію чи втратила стан?',
  '3️⃣ Яка програма або переконання активувалась сьогодні?',
  '4️⃣ З якої точки я діяла сьогодні: сили чи страху?',
  '5️⃣ Яка моя головна перемога сьогодні?',
];

export const SCHEDULE = Object.freeze({
  MORNING_TIME: '12:40',
  EVENING_TIME: '20:30',
  MORNING_START: 7,
  MORNING_END: 11,
  EVENING_START: 19,
  EVENING_END: 23,
  TIMEZONE: 'Europe/Kiev',
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