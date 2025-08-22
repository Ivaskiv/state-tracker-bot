// src/services/openaiClient.js
import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const chat = async (messages, model = 'gpt-4o-mini', max_tokens = 600) => {
  const res = await openai.chat.completions.create({ model, messages, max_tokens, temperature: 0.7 });
  return res.choices?.[0]?.message?.content?.trim() || '';
};
