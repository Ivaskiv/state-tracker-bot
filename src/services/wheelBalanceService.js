// src/services/wheelBalanceService.js - ВИПРАВЛЕНО ПОЛЯ БД
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

// ✅ СТАРТОВЕ КОЛЕСО - ВИКОРИСТОВУЄМО ПРАВИЛЬНІ ПОЛЯ
const startWheelBalance = async (tgId) => {
  try {
    console.log(`🎯 [wheelBalance] Початок колеса балансу для ${tgId}`);
    
    // ✅ ВИКОРИСТОВУЄМО ПРАВИЛЬНІ ПОЛЯ З ТАБЛИЦІ WheelBalance
    const wheelData = {
      TG_id: String(tgId),
      Status: 'active', // ✅ використовуємо 'active' замість 'Active'
      Step: 0, // ✅ правильне поле Step
      Created_Date: new Date().toISOString().split('T')[0] // YYYY-MM-DD
    };
    
    console.log(`🎯 [wheelBalance] Дані для створення:`, wheelData);
    
    const wheelRecord = await base(tables.WHEEL_BALANCE).create(wheelData);
    
    if (!wheelRecord) {
      console.error(`❌ [wheelBalance] Не вдалося створити запис!`);
      return null;
    }
    
    console.log(`🎯 [wheelBalance] ✅ Запис створено з ID:`, wheelRecord.id);
    console.log(`🎯 [wheelBalance] ✅ Поля запису:`, wheelRecord.fields);
    
    const firstSphere = LIFE_SPHERES[0];
    const message = `🎯 КОЛЕСО БАЛАНСУ\n\nОціни кожну сферу життя від 1 до 10, де:\n1 = дуже погано\n10 = ідеально\n\n1️⃣/8 ${firstSphere}\n\nОцінка (1-10):`;
    
    return {
      message,
      recordId: wheelRecord.id,
      currentSphere: 0,
      totalSpheres: LIFE_SPHERES.length
    };
  } catch (error) {
    console.error('❌ [wheelBalance] КРИТИЧНА ПОМИЛКА створення колеса:', error);
    return null;
  }
};

// ✅ ОБРОБКА ВІДПОВІДІ НА СФЕРУ - ВИКОРИСТОВУЄМО ПРАВИЛЬНІ ПОЛЯ
const processWheelAnswer = async (tgId, score) => {
  try {
    console.log(`🎯 [wheelBalance] Обробка відповіді від ${tgId}: "${score}"`);
    
    const scoreNum = parseInt(score);
    if (isNaN(scoreNum) || scoreNum < 1 || scoreNum > 10) {
      console.log(`❌ [wheelBalance] Невалідний бал: ${score}`);
      return {
        error: true,
        message: 'Будь ласка, введи число від 1 до 10'
      };
    }
    
    console.log(`🎯 [wheelBalance] Валідний бал: ${scoreNum}`);
    
    // ✅ ШУКАЄМО АКТИВНЕ КОЛЕСО З ПРАВИЛЬНИМИ ПОЛЯМИ
    const filterFormula = `AND({TG_id}="${tgId}", {Status}="active")`;
    console.log(`🎯 [wheelBalance] Фільтр формула:`, filterFormula);
    
    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: filterFormula,
        maxRecords: 1,
        sort: [{ field: 'Created_Date', direction: 'desc' }]
      })
      .firstPage();
    
    console.log(`🎯 [wheelBalance] Знайдено записів: ${records.length}`);
    
    if (!records.length) {
      console.log(`❌ [wheelBalance] Активне колесо не знайдено для ${tgId}`);
      return {
        error: true,
        message: 'Активне колесо не знайдено. Почни спочатку.'
      };
    }
    
    const record = records[0];
    console.log(`🎯 [wheelBalance] Знайдений запис ID: ${record.id}`);
    console.log(`🎯 [wheelBalance] Поля запису:`, record.fields);
    
    const currentSphere = record.fields.Step || 0; // ✅ правильне поле Step
    const sphereName = LIFE_SPHERES[currentSphere];
    
    console.log(`🎯 [wheelBalance] Поточна сфера: ${currentSphere} (${sphereName})`);
    
    // ✅ ПРАВИЛЬНІ НАЗВИ ПОЛІВ ДЛЯ СФЕР
    const fieldName = `Sphere_${currentSphere + 1}`;
    const updateFields = {
      [fieldName]: scoreNum
    };
    
    console.log(`🎯 [wheelBalance] Оновлюємо поле: ${fieldName} = ${scoreNum}`);
    
    const nextSphere = currentSphere + 1;
    
    if (nextSphere < LIFE_SPHERES.length) {
      updateFields.Step = nextSphere; // ✅ правильне поле Step
      
      console.log(`🎯 [wheelBalance] Переходимо до сфери: ${nextSphere}`);
      console.log(`🎯 [wheelBalance] Дані для оновлення:`, updateFields);
      
      await base(tables.WHEEL_BALANCE).update(record.id, updateFields);
      
      const nextSphereName = LIFE_SPHERES[nextSphere];
      const message = `✅ ${sphereName}: ${scoreNum}/10\n\n${nextSphere + 1}️⃣/8 ${nextSphereName}\n\nОцінка (1-10):`;
      
      console.log(`🎯 [wheelBalance] ✅ Наступна сфера: ${nextSphereName}`);
      
      return {
        message,
        currentSphere: nextSphere,
        totalSpheres: LIFE_SPHERES.length,
        completed: false
      };
    } else {
      // ✅ РОЗРАХОВУЄМО ЗАГАЛЬНИЙ БАЛ
      console.log(`🎯 [wheelBalance] 🏁 Завершуємо колесо балансу`);
      
      // Отримуємо всі бали для підрахунку
      const allScores = [];
      for (let i = 1; i <= 8; i++) {
        const sphereScore = i === currentSphere + 1 ? scoreNum : record.fields[`Sphere_${i}`];
        if (sphereScore) allScores.push(sphereScore);
      }
      
      const totalScore = allScores.reduce((sum, score) => sum + score, 0);
      
      updateFields.Status = 'completed'; // ✅ правильне значення статусу
      updateFields.Completed_Date = new Date().toISOString().split('T')[0];
      updateFields.Total_Score = totalScore;
      
      console.log(`🎯 [wheelBalance] Дані для завершення:`, updateFields);
      
      await base(tables.WHEEL_BALANCE).update(record.id, updateFields);
      
      console.log(`🎯 [wheelBalance] ✅ Колесо завершено, генеруємо аналіз`);
      
      const analysis = await generateWheelAnalysis(tgId, record.id);
      
      return {
        message: `✅ ${sphereName}: ${scoreNum}/10\n\n🎯 КОЛЕСО БАЛАНСУ ЗАВЕРШЕНО!\n\nЗагальний бал: ${totalScore}/80\n\n${analysis}`,
        completed: true,
        analysis
      };
    }
  } catch (error) {
    console.error('❌ [wheelBalance] КРИТИЧНА ПОМИЛКА обробки відповіді:', error);
    return {
      error: true,
      message: 'Виникла помилка. Спробуй ще раз.'
    };
  }
};

// ✅ ГЕНЕРАЦІЯ AI-АНАЛІЗУ КОЛЕСА
const generateWheelAnalysis = async (tgId, wheelRecordId) => {
  try {
    console.log(`🎯 [wheelBalance] Генерація аналізу для запису ${wheelRecordId}`);
    
    const wheelRecord = await base(tables.WHEEL_BALANCE).find(wheelRecordId);
    const fields = wheelRecord.fields;
    
    console.log(`🎯 [wheelBalance] Поля для аналізу:`, fields);
    
    const sphereScores = [];
    for (let i = 1; i <= 8; i++) {
      const score = fields[`Sphere_${i}`];
      const name = LIFE_SPHERES[i - 1];
      if (score) {
        sphereScores.push({ name, score });
      }
    }
    
    console.log(`🎯 [wheelBalance] Бали сфер:`, sphereScores);
    
    const prompt = `Ти експертний коуч трансформації. Проаналізуй результати колеса балансу:

${sphereScores.map(s => `${s.name}: ${s.score}/10`).join('\n')}

Дай короткий аналіз (до 120 слів):
🌟 Сильні сторони: [2-3 найвищі сфери]
⚡ Точки росту: [1-2 найнижчі сфери] 
🎯 Наступні кроки: [2-3 конкретні дії]

Тон: підтримуючий, з позиції сили. Українською мовою.`;

    console.log(`🎯 [wheelBalance] Відправляємо промт до AI`);

    const analysis = await chat([
      { role: 'system', content: 'Ти експертний коуч. Аналізуй колесо балансу підтримуюче, конкретно.' },
      { role: 'user', content: prompt }
    ], 'gpt-4o-mini', 300);

    console.log(`🎯 [wheelBalance] ✅ AI аналіз отримано:`, analysis?.substring(0, 100) + '...');

    return analysis || '📊 Твоє колесо показує унікальний баланс. Продовжуй розвивати сильні сторони!';
  } catch (error) {
    console.error('❌ [wheelBalance] Помилка генерації аналізу:', error);
    return '📊 Дякуємо за заповнення колеса балансу! Продовжуй працювати над своїм розвитком.';
  }
};

// ✅ ПЕРЕВІРКА ЧИ ПОТРІБНО КОЛЕСО (раз на місяць)
const needsWheelBalance = async (tgId) => {
  try {
    console.log(`🎯 [wheelBalance] Перевірка потреби в колесі для ${tgId}`);
    
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const dateStr = oneMonthAgo.toISOString().split('T')[0];
    
    console.log(`🎯 [wheelBalance] Дата місяць тому: ${dateStr}`);
    
    // ✅ ПРАВИЛЬНИЙ ФІЛЬТР З ПОЛЕМ completed
    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Status}="completed", IS_AFTER({Created_Date}, "${dateStr}"))`,
        maxRecords: 1
      })
      .firstPage();
    
    const needs = records.length === 0;
    console.log(`🎯 [wheelBalance] Користувач ${tgId} ${needs ? 'ПОТРЕБУЄ' : 'НЕ ПОТРЕБУЄ'} колесо балансу`);
    console.log(`🎯 [wheelBalance] Знайдено завершених коліс за місяць: ${records.length}`);
    
    return needs;
  } catch (error) {
    console.error('❌ [wheelBalance] Помилка перевірки потреби:', error);
    return true;
  }
};

// ✅ ОТРИМАННЯ АКТИВНОГО КОЛЕСА З ПРАВИЛЬНИМИ ПОЛЯМИ
const getActiveWheel = async (tgId) => {
  try {
    console.log(`🎯 [wheelBalance] Пошук активного колеса для ${tgId}`);
    
    // ✅ ПРАВИЛЬНИЙ ФІЛЬТР З ПОЛЕМ active
    const records = await base(tables.WHEEL_BALANCE)
      .select({
        filterByFormula: `AND({TG_id}="${tgId}", {Status}="active")`,
        maxRecords: 1,
        sort: [{ field: 'Created_Date', direction: 'desc' }]
      })
      .firstPage();
    
    console.log(`🎯 [wheelBalance] Знайдено активних коліс: ${records.length}`);
    
    if (records.length > 0) {
      console.log(`🎯 [wheelBalance] ✅ Активне колесо знайдено:`, records[0].fields);
      return records[0];
    } else {
      console.log(`🎯 [wheelBalance] ❌ Активне колесо не знайдено`);
      return null;
    }
  } catch (error) {
    console.error('❌ [wheelBalance] КРИТИЧНА ПОМИЛКА отримання активного колеса:', error);
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