//src/config/constantsMisc.js
export const CONFIG = Object.freeze({
  ANTI_SPAM_TTL_MS: 3000,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
  EMAIL_MAX_LENGTH: 100,
  PHONE_REGEX: /^\+380\d{9}$/,
  DEFAULT_TIMEZONE: 'Europe/Kyiv'
});
export const getNumberEmoji = (num) => {
  const emojis = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
  return emojis[num] || num;
};