import { getBase } from '../config/database.js';
const base = getBase();
const AFFIRMATIONS = 'Affirmations';

const FALLBACK = [
  'Моє бачення — мій вибір. Моя сила — в мені.',
  'Щодня я впевнено просуваюся до мети.',
  'Я обираю сміливість і дію зараз.',
  'Моя рішучість творить нові можливості.',
  'Мій фокус приносить відчутні результати.'
];

const getAffirmationAndMarkUsed = async () => {
  try {
    const records = await base(AFFIRMATIONS).select({
      filterByFormula: `OR({Used} = 0, {Used} = "", NOT({Used}))`,
      maxRecords: 1
    }).firstPage();

    if (records.length) {
      const rec = records[0];
      const text = rec.fields['Affirmation'] || FALLBACK[Math.floor(Math.random()*FALLBACK.length)];
      await base(AFFIRMATIONS).update([{ id: rec.id, fields: { Used: true } }]);
      return text;
    }

    return FALLBACK[Math.floor(Math.random()*FALLBACK.length)];
  } catch {
    return FALLBACK[Math.floor(Math.random()*FALLBACK.length)];
  }
};

export default { getAffirmationAndMarkUsed };
