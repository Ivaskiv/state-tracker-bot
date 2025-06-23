import Airtable from 'airtable';
import { OpenAI } from 'openai';

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Мапа таблиць до підказок для генерації нових фраз
const promptMap = {
  Motivational_phrases: "Напиши 5 мотиваційних фраз українською мовою.",
  Quotes_of_the_day: "Напиши 5 надихаючих цитат українською мовою.",
  Micro_tasks: "Напиши 5 простих завдань для саморозвитку українською мовою.",
};

// Функція вибору випадкової невикористаної фрази з таблиці
async function getRandomUnusedPhrase(tableName) {
  const records = await base(tableName)
    .select({ filterByFormula: "NOT({used})" })
    .firstPage();

  if (records.length === 0) {
    // Якщо всі використані - генеруємо нові і повторюємо запит
    await generateNewPhrases(tableName);
    return getRandomUnusedPhrase(tableName);
  }

  // Вибираємо випадковий запис
  const randomRecord = records[Math.floor(Math.random() * records.length)];

  // Позначаємо як використаний
  await base(tableName).update(randomRecord.id, { used: true });

  return randomRecord.get('text'); // або 'Content' — залежить від поля в Airtable
}

// Функція генерації нових фраз через OpenAI і додавання в Airtable
async function generateNewPhrases(tableName) {
  const prompt = promptMap[tableName] || "Напиши 5 мотиваційних фраз українською мовою.";

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Ти помічник, який генерує мотиваційні фрази.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 300,
  });

  // Розбиваємо відповідь по рядках і фільтруємо короткі порожні
  const phrases = response.choices[0].message.content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 3);

  // Формуємо масив для додавання в Airtable
  const recordsToCreate = phrases.map(phrase => ({
    fields: { text: phrase, used: false }
  }));

  // Пакетне додавання (по 10 записів)
  for (let i = 0; i < recordsToCreate.length; i += 10) {
    await base(tableName).create(recordsToCreate.slice(i, i + 10));
  }
}

// Приклад використання для трьох таблиць
async function exampleUsage() {
  const motivPhrase = await getRandomUnusedPhrase('Motivational_phrases');
  console.log('Мотиваційна фраза:', motivPhrase);

  const quoteOfDay = await getRandomUnusedPhrase('Quotes_of_the_day');
  console.log('Цитата дня:', quoteOfDay);

  const microTask = await getRandomUnusedPhrase('Micro_tasks');
  console.log('Мікро-завдання:', microTask);
}

exampleUsage();
