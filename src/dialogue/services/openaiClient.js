import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const chat = async (messages, model = 'gpt-4o-mini', maxTokens = 300) => {
  try {
    const completion = await openai.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens
    });
    return completion.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('OpenAI error:', error);
    return '';
  }
};