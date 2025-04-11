import { NlpManager } from 'node-nlp';
import natural from 'natural';
import { config } from 'dotenv';
import openai from 'openai';

// Завантажуємо змінні оточення з файлу .env
config();

// Ініціалізація GPT за допомогою OpenAI API
const openaiApiKey = process.env.OPENAI_API_KEY; // Зчитуємо API ключ з .env
openai.apiKey = openaiApiKey;

// Створюємо NLP менеджер
const manager = new NlpManager({ languages: ['uk'] });

// Ініціалізація менеджера
async function initNLP() {
  try {
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
    
    // Тренування моделі
    await manager.train();
    console.log('NLP Manager trained');
  } catch (err) {
    console.error('Error during NLP initialization:', err);
    throw new Error('NLP initialization failed');
  }
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
        score: result.score,
        emoji: getEmojiForCategory(category, subcategory)
      };
    }
    
    // Якщо не впевнені, використовуємо tokenizer
    const tokenizer = new natural.WordTokenizer();
    const tokens = tokenizer.tokenize(text.toLowerCase());
    
    // Прості правила на основі ключових слів
    if (tokens.some(token => ['добре', 'чудово', 'прекрасно'].includes(token))) {
      return { category: 'state', subcategory: 'positive', score: 0.7, emoji: '😊' };
    } else if (tokens.some(token => ['погано', 'жахливо', 'тривожно'].includes(token))) {
      return { category: 'state', subcategory: 'negative', score: 0.7, emoji: '😞' };
    }
    
    return { category: 'unknown', subcategory: 'unknown', score: 0, emoji: '🤔' };
  } catch (err) {
    console.error('Error analyzing text:', err);
    return { category: 'unknown', subcategory: 'unknown', score: 0, emoji: '❓' };
  }
}

// Рекомендації на основі GPT
async function getGPTRecommendation(state, emotion) {
  try {
    const prompt = `Я відчуваю себе в стані ${state} і маю емоцію ${emotion}. Як мені діяти або що робити, щоб покращити свій стан?`;

    const response = await openai.Completion.create({
      model: 'gpt-3.5-turbo', // або GPT-4, залежно від вашого доступу
      prompt: prompt,
      max_tokens: 150
    });

    const recommendation = response.choices[0].text.trim();
    
    // Додаємо смайлики на основі стану та емоції
    if (state === 'positive' && emotion === 'joy') {
      return `${recommendation} 😊🎉`;
    } else if (state === 'negative' && emotion === 'anger') {
      return `${recommendation} 😡`;
    } else if (state === 'neutral' && emotion === 'calm') {
      return `${recommendation} 😌`;
    } else if (state === 'anxious') {
      return `${recommendation} 😟`;
    } else {
      return `${recommendation} 🙂`;
    }
  } catch (err) {
    console.error('Error generating recommendation with GPT:', err);
    return 'Не вдалося отримати рекомендацію. Спробуйте ще раз. 😕';
  }
}

// Функція для повернення смайлика на основі категорії та підкатегорії
function getEmojiForCategory(category, subcategory) {
  if (category === 'state') {
    if (subcategory === 'positive') return '😊';
    if (subcategory === 'neutral') return '😐';
    if (subcategory === 'negative') return '😞';
  } else if (category === 'emotion') {
    if (subcategory === 'joy') return '😊';
    if (subcategory === 'anger') return '😡';
    if (subcategory === 'sadness') return '😢';
    if (subcategory === 'calm') return '😌';
    if (subcategory === 'gratitude') return '🙏';
    if (subcategory === 'fear') return '😨';
  }
  return '🤔'; // За замовчуванням
}

// Експорт функцій
export {
  initNLP,
  analyzeText,
  getGPTRecommendation
};
