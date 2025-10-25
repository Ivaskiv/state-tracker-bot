// src/features/dailySessions/constants.js
export const MORNING_ORDER = [
  'daily_focus',
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

export const QUESTIONS = {
  morning: [
    { text: 'Хто я сьогодні?\nОпиши себе як нову версію — з позиції сили. (1 речення)', hint: 'Опиши себе з позиції сили — яка ти сьогодні? (1 речення)', field: 'Q_m_1' },
    { text: 'Яка я? Які мої сильні якості сьогодні?', hint: 'Обери 3–5 якостей, які відчуваєш в собі прямо зараз', field: 'Q_m_2' },
    { text: 'Мої 10 цілей на рік.', hint: 'Пропиши їх щодня повторно, ніби вони вже реальність.', field: 'Q_m_3' },
    { text: 'Мої головні цілі цього місяця.', hint: 'Що хочу конкретно покращити чи досягти цього місяця?', field: 'Q_m_4' },
    { text: 'Мій стан прямо зараз? Чому я гідна цього вже зараз?', hint: 'Опиши своє відчуття... (1–2 речення)...', field: 'Q_m_5' },
    { text: 'Які 3 конкретні дії я зроблю сьогодні?', hint: 'Формат: дія — час — результат.', field: 'Q_m_6' }
  ],
  evening: [
    { text: 'Що наповнило мене енергією сьогодні?', hint: 'Що давало сили та радість протягом дня?', field: 'Q_e_1' },
    { text: 'Де я втратила енергію?', hint: 'Які ситуації або думки забирали сили?', field: 'Q_e_2' },
    { text: 'Яка ментальна програма спрацювала?', hint: 'Автоматичні думки чи реакції?', field: 'Q_e_3' },
    { text: 'Я діяла зі сили чи страху?', hint: 'Коротко — що більше керувало?', field: 'Q_e_4' },
    { text: 'Які 3 дії я заплановані на сьогодні я виконала?\n\n[ТУТ ПОКАЗАТИ СПИСОК З РАНКУ]\n\nВідмічай: ✅/⏭', hint: 'Чесно - що зробила, а що ні.', field: 'Q_e_5' },
    { text: 'Чи наблизилася я до своїх 10 цілей сьогодні?\n\n[ТУТ ПОКАЗАТИ ЦІЛІ З РАНКУ]\n\nДо якої цілі ти зробила крок?', hint: 'Навіть маленький крок — це прогрес.', field: 'Q_e_6' },
    { text: 'Моя головна перемога сьогодні?', hint: 'Що найбільше тішить?', field: 'Q_e_7' }
  ]
};

export const MORNING_QUESTIONS = QUESTIONS.morning.map(q => q.text);
export const EVENING_QUESTIONS = QUESTIONS.evening.map(q => q.text);

// ===== ПАРСЕРИ =====
export const QUESTION_PARSERS = {
  parseGoals: (text) => {
    const lines = text.split('\n').filter(l => l.trim());
    const goals = {};
    lines.forEach((line, index) => {
      if (index < 10) {
        const cleaned = line.replace(/^\d+[\.\)]\s*/, '').trim();
        goals[`Goal_${index + 1}`] = cleaned;
      }
    });
    return goals;
  },
  parseDailyFocus: (text) => {
    const lines = text.split('\n').filter(l => l.trim());
    return {
      Daily_Main_Goal: lines[0] || text.substring(0, 200),
      Monthly_Priority_1: lines[0] || '',
      Monthly_Priority_2: lines[1] || '',
      Monthly_Priority_3: lines[2] || ''
    };
  },
  parseActions: (text) => {
    if (text.length < 100 && !text.includes('\n')) return { affirmation: text };
    const lines = text.split('\n').filter(l => l.trim());
    return {
      Daily_Action_1: lines[0] || '',
      Daily_Action_2: lines[1] || '',
      Daily_Action_3: lines[2] || ''
    };
  },
  parseState: (text) => ({ Daily_State: text })
};
