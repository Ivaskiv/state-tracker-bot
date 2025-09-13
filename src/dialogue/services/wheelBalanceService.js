// src/services/wheelBalanceService.js
// import airtableService from './airtableService.js';

// ✅ 8 СФЕР ЖИТТЯ
const LIFE_SPHERES = [
  '💰 Фінанси і кар\'єра',
  '❤️ Любов і стосунки', 
  '🏠 Сім\'я і близькі',
  '🎯 Особисте зростання',
  '💪 Здоров\'я і енергія',
  '🎨 Творчість і хобі',
  '🤝 Соціальне життя',
  '🧘 Духовність і гармонія'
];

// ✅ ОТРИМАННЯ АКТИВНОГО КОЛЕСА
const getActiveWheel = async (tgId) => {
  try {
    console.log(`🎯 [WHEEL SERVICE] Пошук активного колеса для ${tgId}`);
    
    const records = await airtableService.getRecords('WheelBalance', {
      filterByFormula: `AND({TG_id} = '${tgId}', {Status} = 'Active')`,
      maxRecords: 1,
      sort: [{ field: 'Created_Date', direction: 'desc' }]
    });
    
    if (records.length === 0) {
      console.log(`❌ [WHEEL SERVICE] Активне колесо не знайдено для ${tgId}`);
      return null;
    }
    
    console.log(`✅ [WHEEL SERVICE] Знайдено активне колесо для ${tgId}`);
    return records[0];
    
  } catch (error) {
    console.error('[WHEEL SERVICE] Помилка пошуку активного колеса:', error);
    return null;
  }
};

// ✅ ПЕРЕВІРКА ПОТРЕБИ В КОЛЕСІ
const needsWheelBalance = async (tgId) => {
  try {
    console.log(`🎯 [WHEEL SERVICE] Перевірка потреби в колесі для ${tgId}`);
    
    // Шукаємо останнє завершене колесо
    const records = await airtableService.getRecords('WheelBalance', {
      filterByFormula: `AND({TG_id} = '${tgId}', {Status} = 'Completed')`,
      maxRecords: 1,
      sort: [{ field: 'Completed_Date', direction: 'desc' }]
    });
    
    if (records.length === 0) {
      console.log(`✅ [WHEEL SERVICE] Перше колесо для ${tgId}`);
      return true; // перше колесо
    }
    
    const lastWheel = records[0];
    const completedDate = new Date(lastWheel.fields.Completed_Date);
    const now = new Date();
    const daysDiff = Math.floor((now - completedDate) / (1000 * 60 * 60 * 24));
    
    const needsNew = daysDiff >= 30; // раз на місяць
    console.log(`🎯 [WHEEL SERVICE] Останнє колесо ${daysDiff} днів тому. Потреба: ${needsNew}`);
    
    return needsNew;
    
  } catch (error) {
    console.error('[WHEEL SERVICE] Помилка перевірки потреби:', error);
    return false;
  }
};

// ✅ ЗАПУСК НОВОГО КОЛЕСА
const startWheelBalance = async (tgId) => {
  try {
    console.log(`🎯 [WHEEL SERVICE] Запуск нового колеса для ${tgId}`);
    
    // Перевіряємо чи немає активного колеса
    const activeWheel = await getActiveWheel(tgId);
    if (activeWheel) {
      console.log(`❌ [WHEEL SERVICE] Вже є активне колесо для ${tgId}`);
      return null;
    }
    
    // Створюємо нове колесо
    const wheelData = {
      TG_id: tgId.toString(),
      Status: 'Active',
      Current_Sphere: 0,
      Created_Date: new Date().toISOString(),
      Total_Score: 0
    };
    
    const newRecord = await airtableService.createRecord('WheelBalance', wheelData);
    
    if (!newRecord) {
      console.error(`❌ [WHEEL SERVICE] Не вдалося створити колесо для ${tgId}`);
      return null;
    }
    
    console.log(`✅ [WHEEL SERVICE] Колесо створено для ${tgId}, ID: ${newRecord.id}`);
    
    return {
      record: newRecord,
      message: `🎯 КОЛЕСО БАЛАНСУ ЖИТТЯ\n\nОцінимо 8 ключових сфер твого життя від 1 до 10!\n\n1️⃣/8 ${LIFE_SPHERES[0]}\n\nОцінка (1-10):`
    };
    
  } catch (error) {
    console.error('[WHEEL SERVICE] Помилка запуску колеса:', error);
    return null;
  }
};

// ✅ ОБРОБКА ВІДПОВІДІ
const processWheelAnswer = async (tgId, answer) => {
  try {
    console.log(`🎯 [WHEEL SERVICE] Обробка відповіді від ${tgId}: "${answer}"`);
    
    // Отримуємо активне колесо
    const activeWheel = await getActiveWheel(tgId);
    if (!activeWheel) {
      return {
        error: true,
        message: '❌ Активне колесо не знайдено. Спробуйте почати заново.'
      };
    }
    
    // Перевіряємо оцінку
    const score = parseInt(answer.trim());
    if (isNaN(score) || score < 1 || score > 10) {
      return {
        error: true,
        message: '❌ Введи число від 1 до 10'
      };
    }
    
    const currentSphere = activeWheel.fields.Current_Sphere || 0;
    const sphereField = `Sphere_${currentSphere + 1}`;
    
    // Оновлюємо дані колеса
    const updateData = {
      [sphereField]: score
    };
    
    if (currentSphere < 7) {
      // Переходимо до наступної сфери
      updateData.Current_Sphere = currentSphere + 1;
      
      await airtableService.updateRecord('WheelBalance', activeWheel.id, updateData);
      
      const nextSphere = currentSphere + 1;
      return {
        error: false,
        completed: false,
        message: `✅ ${LIFE_SPHERES[currentSphere]}: ${score}/10\n\n${nextSphere + 1}️⃣/8 ${LIFE_SPHERES[nextSphere]}\n\nОцінка (1-10):`
      };
      
    } else {
      // Завершуємо колесо
      const totalScore = await calculateTotalScore(activeWheel, score);
      
      updateData.Status = 'Completed';
      updateData.Completed_Date = new Date().toISOString();
      updateData.Total_Score = totalScore;
      
      await airtableService.updateRecord('WheelBalance', activeWheel.id, updateData);
      
      const resultMessage = await generateResultMessage(activeWheel, score, totalScore);
      
      return {
        error: false,
        completed: true,
        message: resultMessage
      };
    }
    
  } catch (error) {
    console.error('[WHEEL SERVICE] Помилка обробки відповіді:', error);
    return {
      error: true,
      message: '❌ Помилка при обробці відповіді. Спробуйте ще раз.'
    };
  }
};

// ✅ РОЗРАХУНОК ЗАГАЛЬНОГО БАЛУ
const calculateTotalScore = async (wheelRecord, lastScore) => {
  try {
    let total = 0;
    
    // Додаємо всі оцінки
    for (let i = 1; i <= 7; i++) {
      const score = wheelRecord.fields[`Sphere_${i}`] || 0;
      total += score;
    }
    
    // Додаємо останню оцінку
    total += lastScore;
    
    return Math.round(total / 8 * 10) / 10; // середнє з точністю до 1 знака
    
  } catch (error) {
    console.error('[WHEEL SERVICE] Помилка розрахунку балу:', error);
    return 0;
  }
};

// ✅ ГЕНЕРАЦІЯ РЕЗУЛЬТАТУ
const generateResultMessage = async (wheelRecord, lastScore, totalScore) => {
  try {
    const scores = [];
    
    // Збираємо всі оцінки
    for (let i = 1; i <= 7; i++) {
      scores.push(wheelRecord.fields[`Sphere_${i}`] || 0);
    }
    scores.push(lastScore);
    
    // Формуємо результат
    let message = `🎯 ТВОЄ КОЛЕСО БАЛАНСУ ГОТОВЕ!\n\n`;
    
    // Показуємо оцінки по сферах
    for (let i = 0; i < 8; i++) {
      const sphereName = LIFE_SPHERES[i].replace(/^[^\s]+\s/, ''); // прибираємо емодзі
      message += `${getScoreEmoji(scores[i])} ${sphereName}: ${scores[i]}/10\n`;
    }
    
    message += `\n📊 Загальний баланс: ${totalScore}/10\n\n`;
    
    // Додаємо рекомендації
    message += getRecommendations(scores, totalScore);
    
    return message;
    
  } catch (error) {
    console.error('[WHEEL SERVICE] Помилка генерації результату:', error);
    return '✅ Колесо балансу завершено!';
  }
};

// ✅ ЕМОДЗІ ДЛЯ ОЦІНОК
const getScoreEmoji = (score) => {
  if (score >= 8) return '🟢';
  if (score >= 6) return '🟡';
  if (score >= 4) return '🟠';
  return '🔴';
};

// ✅ РЕКОМЕНДАЦІЇ
const getRecommendations = (scores, totalScore) => {
  let recommendations = '';
  
  // Загальна оцінка
  if (totalScore >= 8) {
    recommendations += '🌟 Вітаю! У тебе чудовий життєвий баланс!\n\n';
  } else if (totalScore >= 6) {
    recommendations += '👍 Добрий баланс! Є над чим працювати.\n\n';
  } else if (totalScore >= 4) {
    recommendations += '⚖️ Баланс потребує уваги в кількох сферах.\n\n';
  } else {
    recommendations += '⚠️ Важливо зосередитися на покращенні балансу.\n\n';
  }
  
  // Знаходимо найслабші сфери
  const weakSpheres = [];
  scores.forEach((score, index) => {
    if (score <= 4) {
      weakSpheres.push({ name: LIFE_SPHERES[index], score, index });
    }
  });
  
  if (weakSpheres.length > 0) {
    recommendations += '🎯 СФЕРИ ДЛЯ РОЗВИТКУ:\n';
    weakSpheres.slice(0, 3).forEach(sphere => {
      recommendations += `• ${sphere.name}\n`;
    });
    recommendations += '\n';
  }
  
  // Знаходимо сильні сфери
  const strongSpheres = [];
  scores.forEach((score, index) => {
    if (score >= 8) {
      strongSpheres.push({ name: LIFE_SPHERES[index], score, index });
    }
  });
  
  if (strongSpheres.length > 0) {
    recommendations += '💪 ТВОЇ СИЛЬНІ СФЕРИ:\n';
    strongSpheres.slice(0, 3).forEach(sphere => {
      recommendations += `• ${sphere.name}\n`;
    });
    recommendations += '\n';
  }
  
  recommendations += '💡 Пройди колесо знову через місяць, щоб побачити прогрес!';
  
  return recommendations;
};

// ✅ ОТРИМАННЯ СТАТИСТИКИ КОРИСТУВАЧА
const getUserWheelStats = async (tgId) => {
  try {
    const records = await airtableService.getRecords('WheelBalance', {
      filterByFormula: `AND({TG_id} = '${tgId}', {Status} = 'Completed')`,
      sort: [{ field: 'Completed_Date', direction: 'desc' }]
    });
    
    return {
      total: records.length,
      lastScore: records.length > 0 ? records[0].fields.Total_Score : null,
      lastDate: records.length > 0 ? records[0].fields.Completed_Date : null,
      records
    };
    
  } catch (error) {
    console.error('[WHEEL SERVICE] Помилка отримання статистики:', error);
    return { total: 0, lastScore: null, lastDate: null, records: [] };
  }
};

export default {
  LIFE_SPHERES,
  getActiveWheel,
  needsWheelBalance,
  startWheelBalance,
  processWheelAnswer,
  getUserWheelStats
};