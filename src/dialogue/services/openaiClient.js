// src/services/openaiClient.js
import { Configuration, OpenAIApi } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

const chat = async (messages, model, maxTokens) => {
  try {
    const response = await openai.createChatCompletion({
      model: model || 'gpt-4o-mini',
      messages,
      max_tokens: maxTokens || 500,
    });
    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('[openaiClient] Error:', error);
    throw error;
  }
};

export { chat };