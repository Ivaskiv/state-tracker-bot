// src/features/dailySessions/constants.js

// ✅ ПРАВИЛЬНИЙ ПОРЯДОК ПОЛІВ (ВЕЛИКІ ЛІТЕРИ!)
export const MORNING_ORDER = [
  'Daily_Focus',  // ✅ ПЕРШШЕ питання
  'Q_m_1',
  'Q_m_2',
  'Q_m_3',
  'Q_m_4',
  'Q_m_5',
  'Q_m_6',
];

export const EVENING_ORDER = [
  'Q_e_1',
  'Q_e_2',
  'Q_e_3',
  'Q_e_4',
  'Q_e_5',
  'Q_e_6',
  'Q_e_7'
];

// ═══════════════════════════════════════════════════════════
// ✅ ОСНОВНА СТРУКТУРА ПИТАНЬ (для controller.js)
// ═══════════════════════════════════════════════════════════

export const QUESTIONS = Object.freeze({
  morning: [
    {
      emoji: '🔑',
      title: 'Фокус на сьогодні',
      question: 'Який фокус на сьогодні?',
      hint: 'Коротко одним-двома реченнями про головний намір дня.',
      field: 'Daily_Focus'
    },
    {
      emoji: '🌞',
      title: 'Хто я?',
      question: 'Хто я сьогодні?\nОпиши себе як нову версію — з позиції сили. (1 речення)',
      hint: 'Опиши себе з позиції сили — яка ти сьогодні? (1 речення)',
      field: 'Q_m_1'
    },
    {
      emoji: '🌞',
      title: 'Мої якості',
      question: 'Яка я? Які мої сильні якості сьогодні?',
      hint: 'Обери 3–5 якостей, які відчуваєш в собі прямо зараз',
      field: 'Q_m_2'
    },
    {
      emoji: '🌞',
      title: 'Цілі на рік',
      question: 'Мої 10 цілей на рік.',
      hint: 'Пропиши їх щодня повторно, ніби вони вже реальність.',
      field: 'Q_m_3'
    },
    {
      emoji: '🌞',
      title: 'Цілі місяця',
      question: 'Мої головні цілі цього місяця.',
      hint: 'Що хочу конкретно покращити чи досягти цього місяця?',
      field: 'Q_m_4'
    },
    {
      emoji: '🌞',
      title: 'Мій стан',
      question: 'Мій стан прямо зараз? Чому я гідна цього вже зараз?',
      hint: 'Опиши своє відчуття... (1–2 речення)...',
      field: 'Q_m_5'
    },
    {
      emoji: '🌞',
      title: '3 дії на день',
      question: 'Які 3 конкретні дії я зроблю сьогодні?',
      hint: 'Формат: дія — час — результат.',
      field: 'Q_m_6'
    }
  ],

  evening: [
    {
      emoji: '🌙',
      title: 'Енергія',
      question: 'Що наповнило мене енергією сьогодні?',
      hint: 'Що давало сили та радість протягом дня?',
      field: 'Q_e_1'
    },
    {
      emoji: '🌙',
      title: 'Втрати енергії',
      question: 'Де я втратила енергію?',
      hint: 'Які ситуації або думки забирали сили?',
      field: 'Q_e_2'
    },
    {
      emoji: '🌙',
      title: 'Програма',
      question: 'Яка ментальна програма спрацювала?',
      hint: 'Автоматичні думки чи реакції?',
      field: 'Q_e_3'
    },
    {
      emoji: '🌙',
      title: 'Сила чи страх',
      question: 'Я діяла зі сили чи страху?',
      hint: 'Коротко — що більше керувало?',
      field: 'Q_e_4'
    },
    {
      emoji: '🌙',
      title: 'Виконані дії',
      question: 'Які 3 дії я заплановані на сьогодні я виконала?\n\n[ТУТ ПОКАЗАТИ СПИСОК З РАНКУ]\n\nВідмічай: ✅/⏭',
      hint: 'Чесно - що зробила, а що ні.',
      field: 'Q_e_5'
    },
    {
      emoji: '🌙',
      title: 'Прогрес',
      question: 'Чи наблизилася я до своїх 10 цілей сьогодні?\n\n[ТУТ ПОКАЗАТИ ЦІЛІ З РАНКУ]\n\nДо якої цілі ти зробила крок?',
      hint: 'Навіть маленький крок — це прогрес.',
      field: 'Q_e_6'
    },
    {
      emoji: '🌙',
      title: 'Перемога',
      question: 'Моя головна перемога сьогодні?',
      hint: 'Що найбільше тішить?',
      field: 'Q_e_7'
    }
  ]
});

// ═══════════════════════════════════════════════════════════
// ✅ АЛЬТЕРНАТИВНІ ЕКСПОРТИ (для сумісності зі старим кодом)
// ═══════════════════════════════════════════════════════════

export const MORNING_QUESTIONS = QUESTIONS.morning;
export const EVENING_QUESTIONS = QUESTIONS.evening;

export const MORNING_QUESTIONS_TEXTS = QUESTIONS.morning.map(q => q.question);
export const EVENING_QUESTIONS_TEXTS = QUESTIONS.evening.map(q => q.question);

// ═══════════════════════════════════════════════════════════
// ✅ ПАРСЕРИ (залишаємо як є)
// ═══════════════════════════════════════════════════════════

export const QUESTION_PARSERS = Object.freeze({
  parseGoals: (question) => {
    const lines = question.split('\n').filter(l => l.trim());
    const goals = {};
    lines.forEach((line, index) => {
      if (index < 10) {
        const cleaned = line.replace(/^\d+[\.\)]\s*/, '').trim();
        goals[`Goal_${index + 1}`] = cleaned;
      }
    });
    return goals;
  },

  parseDailyFocus: (question) => {
    const lines = question.split('\n').filter(l => l.trim());
    return {
      Daily_Main_Goal: lines[0] || question.substring(0, 200),
      Monthly_Priority_1: lines[0] || '',
      Monthly_Priority_2: lines[1] || '',
      Monthly_Priority_3: lines[2] || ''
    };
  },

  parseActions: (question) => {
    if (question.length < 100 && !question.includes('\n')) return { affirmation: question };
    const lines = question.split('\n').filter(l => l.trim());
    return {
      Daily_Action_1: lines[0] || '',
      Daily_Action_2: lines[1] || '',
      Daily_Action_3: lines[2] || ''
    };
  },

  parseState: (question) => ({ Daily_State: question })
});

// ═══════════════════════════════════════════════════════════
// ✅ УТИЛІТИ
// ═══════════════════════════════════════════════════════════

/**
 * Отримати питання за індексом (0-based)
 * @param {string} type - 'morning' | 'evening'
 * @param {number} index - 0, 1, 2, ...
 * @returns {Object|null} питання або null
 */
export const getQuestionByIndex = (type, index) => {
  const questions = QUESTIONS[type] || [];
  return questions[index] || null;
};

/**
 * Отримати всі питання за типом
 * @param {string} type - 'morning' | 'evening'
 * @returns {Array} масив питань
 */
export const getQuestionsByType = (type) => {
  return QUESTIONS[type] || [];
};

console.log('✅ [dailySessions/constants] Питання завантажені');