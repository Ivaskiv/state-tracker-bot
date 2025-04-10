// Файл services/nlp.js
import { NlpManager } from 'node-nlp';
import natural from 'natural';

// Створюємо NLP менеджер
const manager = new NlpManager({ languages: ['uk'] });

// Ініціалізація менеджера
async function initNLP() {
  // Додаємо приклади для розпізнавання намірів
  
  // Наміри для стану
  manager.addDocument('uk', 'відчуваю себе добре', 'state.positive');
  manager.addDocument('uk', 'все чудово', 'state.positive');
  manager.addDocument('uk', 'я щасливий', 'state.positive');
  manager.addDocument('uk', 'почуваюся нормально', 'state.neutral');
  manager.addDocument('uk', 'більш-менш', 'state.neutral');
  manager.addDocument('uk', 'так собі', 'state.neutral');
  manager.addDocument('uk', 'погано', 'state.negative');
  manager.addDocument('uk', 'відчуваю тривогу', 'state.negative');
  manager.addDocument('uk', 'все жахливо', 'state.negative');
  
  // Наміри для емоцій
  manager.addDocument('uk', 'радісно', 'emotion.joy');
  manager.addDocument('uk', 'щасливий', 'emotion.joy');
  manager.addDocument('uk', 'весело', 'emotion.joy');
  manager.addDocument('uk', 'злість', 'emotion.anger');
  manager.addDocument('uk', 'роздратований', 'emotion.anger');
  manager.addDocument('uk', 'бісить', 'emotion.anger');
  manager.addDocument('uk', 'сумно', 'emotion.sadness');
  manager.addDocument('uk', 'спокійно', 'emotion.calm');
  manager.addDocument('uk', 'вдячний', 'emotion.gratitude');
  manager.addDocument('uk', 'страшно', 'emotion.fear');
  
  // Треніровка моделі
  await manager.train();
  console.log('NLP Manager trained');
}

// Аналіз тексту
async function analyzeText(text) {
  try {
    const result = await manager.process('uk', text);
    
    // Визначаємо категорію та підкатегорію
    if (result.intent && result.score > 0.6) {
      const [category, subcategory] = result.intent.split('.');
      return {
        category,
        subcategory,
        score: result.score
      };
    }
    
    // Якщо не впевнені, використовуємо tokenizer
    const tokenizer = new natural.WordTokenizer();
    const tokens = tokenizer.tokenize(text.toLowerCase());
    
    // Прості правила на основі ключових слів
    if (tokens.some(token => ['добре', 'чудово', 'прекрасно'].includes(token))) {
      return { category: 'state', subcategory: 'positive', score: 0.7 };
    } else if (tokens.some(token => ['погано', 'жахливо', 'тривожно'].includes(token))) {
      return { category: 'state', subcategory: 'negative', score: 0.7 };
    }
    
    return { category: 'unknown', subcategory: 'unknown', score: 0 };
  } catch (err) {
    console.error('Error analyzing text:', err);
    return { category: 'unknown', subcategory: 'unknown', score: 0 };
  }
}

// Рекомендації на основі стану
function getRecommendation(state, emotion) {
  // Позитивні стани
  if (state === 'resourceful' || state === 'neutral') {
    if (emotion === 'joy' || emotion === 'calm' || emotion === 'gratitude') {
      return 'Твій емоційний стан позитивний. Чудово! Продовжуй практики, які тебе наповнюють.';
    } else {
      return 'Твій стан досить хороший, але емоції змішані. Зверни увагу на те, що викликає твої емоції.';
    }
  }
  
  // Напружені стани
  if (state === 'tense' || state === 'anxious') {
    return 'Ти відчуваєш напругу. Спробуй глибоке дихання (4-7-8): вдих на 4, затримка на 7, видих на 8 секунд.';
  }
  
  // Виснажені стани
  if (state === 'exhausted') {
    return 'Ти виснажений(а). Дозволь собі відпочити. Нагадую, що регулярні перерви підвищують продуктивність.';
  }
  
  // Панічні стани
  if (state === 'panic') {
    return 'Схоже, ти в стані паніки. Спробуй заземлитися: назви 5 речей, які бачиш, 4 речі, до яких можеш доторкнутися, 3 звуки, які чуєш, 2 запахи і 1 смак.';
  }
  
  // Загальна рекомендація
  return 'Продовжуй відстежувати свій стан. Це допоможе тобі краще розуміти себе і свої емоції.';
}

// Експорт функцій
export {
  initNLP,
  analyzeText,
  getRecommendation
};