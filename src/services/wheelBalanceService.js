// src/services/wheelBalanceService.js
import { getBase, tables } from '../config/database.js';
import { chat } from './openaiClient.js';

const base = getBase();

// 8 сфер життя для колеса балансу
const LIFE_SPHERES = [
  'Здоров\'я та енергія',
  'Особистісний розвиток', 
  'Стосунки (сім\'я, друзі)',
  'Кар\'єра та професія',
  'Фінанси та достаток',
  'Дозвілля та відпочинок',
  'Духовність та цінності',
  'Житло та побут'
];

// ✅ СТАРТОВЕ КОЛЕСО (при реєстрації або раз на місяць)
const startWheelBalance = async (tgId) => {
  try {
    console.log(`[wheelBalance] Початок колеса балансу для ${tgId}`);
    
    const wheelRecord = await base(tables.USER_REFLECTIONS).create({
      TG_id: String(tgId),
      Date: new Date().toISOString().split('T')[0],
      Type: 'Wheel_Balance',
      Status: 'Started',
      Current_Sphere: 0
    });
    
    const firstSphere = LIFE_SPHERES[0];
    const message = `🎯 КОЛЕСО БАЛАНСУ\n\nОціни кожну сферу життя від 1 до 10, де:\n1 = дуже погано\n10 = ідеально\n\n1️⃣/8 ${firstSphere}\n\nОцінка (1-10):`;
    
    return {
      message,
      recordId: wheelRecord.id,
      currentSphere: 0,
      totalSpheres: LIFE_SPHERES.length
    };
  } catch (error) {
    console.error('[wheelBalance] Помилка створення колеса:', error);
    return null;
  }
};

// ✅ ОБРОБКА ВІДПОВІДІ НА СФЕРУ
const processWheelAnswer = async (tgId, score) => {
  try {
    const scoreNum = parseInt(score);
    if (isNaN(scoreNum) || scoreNum < 1 || scoreNum > 10) {
      return {
        error: true,
        message: 'Будь ласка, введи число від 1 до 10'
      };
    }
    
    const records = await base(tables.USER_REFLECTIONS)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Type}="Wheel_Balance", {Status}="Started")`,
        maxRecords: 1,
        sort: [{ field: 'Date', direction: 'desc' }]
      })
      .firstPage();
    
    if (!records.length) {
      return {
        error: true,
        message: 'Активне колесо не знайдено. Почни спочатку.'
      };
    }
    
    const record = records[0];
    const currentSphere = record.fields.Current_Sphere || 0;
    const sphereName = LIFE_SPHERES[currentSphere];
    
    const fieldName = `Sphere_${currentSphere + 1}`;
    const updateFields = {
      [fieldName]: scoreNum,
      [`Sphere_${currentSphere + 1}_Name`]: sphereName
    };
    
    const nextSphere = currentSphere + 1;
    
    if (nextSphere < LIFE_SPHERES.length) {
      updateFields.Current_Sphere = nextSphere;
      
      await base(tables.USER_REFLECTIONS).update(record.id, updateFields);
      
      const nextSphereName = LIFE_SPHERES[nextSphere];
      const message = `✅ ${sphereName}: ${scoreNum}/10\n\n${nextSphere + 1}️⃣/8 ${nextSphereName}\n\nОцінка (1-10):`;
      
      return {
        message,
        currentSphere: nextSphere,
        totalSpheres: LIFE_SPHERES.length,
        completed: false
      };
    } else {
      updateFields.Status = 'Completed';
      updateFields.Completed_Date = new Date().toISOString();
      
      await base(tables.USER_REFLECTIONS).update(record.id, updateFields);
      
      const analysis = await generateWheelAnalysis(tgId, record.id);
      
      return {
        message: `✅ ${sphereName}: ${scoreNum}/10\n\n🎯 КОЛЕСО БАЛАНСУ ЗАВЕРШЕНО!\n\n${analysis}`,
        completed: true,
        analysis
      };
    }
  } catch (error) {
    console.error('[wheelBalance] Помилка обробки відповіді:', error);
    return {
      error: true,
      message: 'Виникла помилка. Спробуй ще раз.'
    };
  }
};

// ✅ ГЕНЕРАЦІЯ AI-АНАЛІЗУ КОЛЕСА
const generateWheelAnalysis = async (tgId, wheelRecordId) => {
  try {
    const wheelRecord = await base(tables.USER_REFLECTIONS).find(wheelRecordId);
    const fields = wheelRecord.fields;
    
    const sphereScores = [];
    for (let i = 1; i <= 8; i++) {
      const score = fields[`Sphere_${i}`];
      const name = fields[`Sphere_${i}_Name`] || LIFE_SPHERES[i - 1];
      if (score) {
        sphereScores.push({ name, score });
      }
    }
    
    const prompt = `Ти експертний коуч трансформації. Проаналізуй результати колеса балансу:

${sphereScores.map(s => `${s.name}: ${s.score}/10`).join('\n')}

Дай короткий аналіз (до 120 слів):
🌟 Сильні сторони: [2-3 найвищі сфери]
⚡ Точки росту: [1-2 найнижчі сфери] 
🎯 Наступні кроки: [2-3 конкретні дії]

Тон: підтримуючий, з позиції сили. Українською мовою.`;

    const analysis = await chat([
      { role: 'system', content: 'Ти експертний коуч. Аналізуй колесо балансу підтримуюче, конкретно.' },
      { role: 'user', content: prompt }
    ], 'gpt-4o-mini', 300);

    await base(tables.USER_REFLECTIONS).update(wheelRecordId, {
      AI_Analysis: analysis || 'Аналіз не вдався'
    });

    return analysis || '📊 Твоє колесо показує унікальний баланс. Продовжуй розвивати сильні сторони!';
  } catch (error) {
    console.error('[wheelBalance] Помилка генерації аналізу:', error);
    return '📊 Дякуємо за заповнення колеса балансу! Продовжуй працювати над своїм розвитком.';
  }
};

// ✅ ПЕРЕВІРКА ЧИ ПОТРІБНО КОЛЕСО (раз на місяць)
const needsWheelBalance = async (tgId) => {
  try {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const dateStr = oneMonthAgo.toISOString().split('T')[0];
    
    const records = await base(tables.USER_REFLECTIONS)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Type}="Wheel_Balance", {Status}="Completed", IS_AFTER({Date}, "${dateStr}"))`,
        maxRecords: 1
      })
      .firstPage();
    
    const needs = records.length === 0;
    console.log(`[wheelBalance] Користувач ${tgId} ${needs ? 'потребує' : 'не потребує'} колесо балансу`);
    return needs;
  } catch (error) {
    console.error('[wheelBalance] Помилка перевірки потреби:', error);
    return true;
  }
};

// ✅ ОТРИМАННЯ АКТИВНОГО КОЛЕСА
const getActiveWheel = async (tgId) => {
  try {
    const records = await base(tables.USER_REFLECTIONS)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Type}="Wheel_Balance", {Status}="Started")`,
        maxRecords: 1,
sort: [{ field: 'Created_Date', direction: 'desc' }]      })
      .firstPage();
    
    return records.length > 0 ? records[0] : null;
  } catch (error) {
    console.error('[wheelBalance] Помилка отримання активного колеса:', error);
    return null;
  }
};

export default {
  startWheelBalance,
  processWheelAnswer,
  generateWheelAnalysis,
  needsWheelBalance,
  getActiveWheel,
  LIFE_SPHERES
};