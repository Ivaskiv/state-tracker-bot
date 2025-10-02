// src/dialogue/services/affirmationService.js
import { getBase } from '../config/database.js';

const AFFIRMATIONS = 'Affirmations';

const FALLBACK = {
  morning: [
    'Моє бачення — мій вибір. Моя сила — в мені.',
    'Щодня я впевнено просуваюся до мети.',
    'Я обираю сміливість і дію зараз.',
    'Моя рішучість творить нові можливості.',
    'Мій фокус приносить відчутні результати.',
    'Я заслуговую на все найкраще прямо зараз.',
  ],
  evening: [
    'Кожен день я стаю сильнішою та мудрішою.',
    'Моя енергія створює позитивні зміни.',
    'Я довіряю своїй інтуїції та внутрішній силі.',
    'Сьогодні я обираю радість і впевненість.',
    'Я вдячна за всі досягнення цього дня.',
  ],
};

const getAffirmationAndMarkUsed = async (type = 'morning') => {
  try {
    const base = getBase('Affirmations');
    const fieldName = type === 'morning' ? 'affirmation_m' : 'affirmation_e';

    const records = await base(AFFIRMATIONS).select({
      filterByFormula: `OR({Used} = 0, {Used} = "", NOT({Used}))`,
      maxRecords: 1,
    }).firstPage();

    if (!records || records.length === 0) {
      const fallbackArray = type === 'morning' ? FALLBACK.morning : FALLBACK.evening;
      return fallbackArray[Math.floor(Math.random() * fallbackArray.length)];
    }

    const rec = records[0];
    const text = rec.fields[fieldName];

    if (typeof text !== 'string' || !text.trim()) {
      const fallbackArray = type === 'morning' ? FALLBACK.morning : FALLBACK.evening;
      return fallbackArray[Math.floor(Math.random() * fallbackArray.length)];
    }

    await base(AFFIRMATIONS).update([{ id: rec.id, fields: { Used: true } }]);

    return text.trim();
  } catch (error) {
    const fallbackArray = type === 'morning' ? FALLBACK.morning : FALLBACK.evening;
    return fallbackArray[Math.floor(Math.random() * fallbackArray.length)];
  }
};

export default { getAffirmationAndMarkUsed };