
#!/bin/bash

# Завантажуємо змінні з .env файлу
export $(cat .env | xargs)

# Запускаємо бот
node src/bot.js