// src/services/affirmationService.js
import { getBase } from '../../config/database.js';
const base = getBase();
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
  ]
};

const getAffirmationAndMarkUsed = async (type = 'morning') => {
  try {
    console.log(`[affirmationService] Looking for unused ${type} affirmations...`);

    // вибираємо правильне поле
    const fieldName = type === 'morning' ? 'affirmation_m' : 'affirmation_e';

    const records = await base(AFFIRMATIONS).select({
      filterByFormula: `OR({Used} = 0, {Used} = "", NOT({Used}))`,
      maxRecords: 1
    }).firstPage();

    if (!records || records.length === 0) {
      console.log('[affirmationService] No unused affirmations, using fallback');
      const fallbackArray = type === 'morning' ? FALLBACK.morning : FALLBACK.evening;
      return fallbackArray[Math.floor(Math.random() * fallbackArray.length)];
    }

    const rec = records[0];
    const text = rec.fields[fieldName];  // ✅ тепер беремо з правильного поля

    if (typeof text !== 'string' || !text.trim()) {
      console.log('[affirmationService] Invalid text in DB, using fallback');
      const fallbackArray = type === 'morning' ? FALLBACK.morning : FALLBACK.evening;
      return fallbackArray[Math.floor(Math.random() * fallbackArray.length)];
    }

    // Позначаємо як використану
    await base(AFFIRMATIONS).update([{ 
      id: rec.id, 
      fields: { Used: true } 
    }]);

    console.log(`[affirmationService] Returning ${type} affirmation from DB:`, text.trim());
    return text.trim();

  } catch (error) {
    console.error('[affirmationService] Error getting affirmation, using fallback:', error);
    const fallbackArray = type === 'morning' ? FALLBACK.morning : FALLBACK.evening;
    return fallbackArray[Math.floor(Math.random() * fallbackArray.length)];
  }
};

export default { getAffirmationAndMarkUsed };
