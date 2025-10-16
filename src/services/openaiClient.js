// src/services/openaiClient.js
/**
 * Відправити запит до Claude/OpenAI через Anthropic API
 */
export const chat = async (messages, model = 'claude-sonnet-4-20250514', maxTokens = 1000) => {
  try {
    console.log('[openaiClient] 🤖 Відправка запиту до AI...');

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        max_tokens: maxTokens,
        messages: messages
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    const result = data.content[0].text;

    console.log('[openaiClient] ✅ Відповідь отримано');
    return result;

  } catch (error) {
    console.error('[openaiClient] ❌ Помилка:', error);
    throw error;
  }
};

/**
 * Спрощена версія для коротких запитів
 */
export const simpleChat = async (userMessage, systemPrompt = 'Ти корисний асистент.') => {
  return chat([
    { role: 'user', content: userMessage }
  ]);
};

export default {
  chat,
  simpleChat
};

console.log('✅ [services/openaiClient] OpenAI клієнт завантажено');