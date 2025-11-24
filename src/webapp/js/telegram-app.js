// webapp/js/telegram-app.js

const tg = window.Telegram.WebApp;

// Ініціалізація
tg.ready();
tg.expand();

// Отримуємо дані користувача
const user = tg.initDataUnsafe?.user;
const tgId = user?.id;
const firstName = user?.first_name;

// Передаємо tg_id у всі форми
document.addEventListener('DOMContentLoaded', () => {
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    let hiddenField = form.querySelector('input[name="tg_id"]');
    if (!hiddenField) {
      hiddenField = document.createElement('input');
      hiddenField.type = 'hidden';
      hiddenField.name = 'tg_id';
      form.appendChild(hiddenField);
    }
    hiddenField.value = tgId;
  });
});

// Навігація
function navigate(page) {
  window.location.href = `/${page}.html`;
}

// Main Button (кнопка знизу в Telegram)
tg.MainButton.setText('Продовжити');
tg.MainButton.onClick(() => {
  const form = document.querySelector('form');
  if (form) form.submit();
});

// Back Button
tg.BackButton.onClick(() => {
  history.back();
});

// Відправка даних в бот
function sendDataToBot(data) {
  tg.sendData(JSON.stringify(data));
}

// Закрити Mini App
function closeApp() {
  tg.close();
}