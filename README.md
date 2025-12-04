# Mini App «7 дней без сахара»

Готовое статичное приложение на HTML/CSS/JS. Хостится как обычный сайт (Vercel, Netlify, GitHub Pages) и подключается к Telegram как Web App.

## Структура

- `index.html` — разметка экранов (главный, 7 дней, финал).
- `styles.css` — фирменный стиль (фон `#fdf9f5`, текст `#5a4a42`, акцент `#8b6b56`).
- `app.js` — логика прогресса, localStorage, интеграция с Telegram WebApp API.
- `public/cup.svg` — иллюстрация для хедера.

## Локальный просмотр

```bash
cd /Users/artemgorcakov/Desktop/noSugar/miniapp
npx serve .
# открой http://localhost:3000
```

Можно использовать любой лёгкий сервер (Live Server, python `http.server`, Vite preview и т.д.).

## Развёртывание на Vercel

1. Создай новый проект → **Import** из локальной папки `miniapp`.
2. Тип проекта: **Other** (статический сайт).  
   Build Command: `echo "skip build"` (или пусто).  
   Output Directory: `.` (корень проекта).
3. После деплоя получишь HTTPS‑ссылку вида `https://nosugar.vercel.app`.

Аналогично можно выложить на Netlify, Cloudflare Pages, GitHub Pages — нужен любой HTTPS-домен.

## Подключение к Telegram

1. В @BotFather открой `/mybots → @kobiarti_bot → Bot Settings → Menu Button → Configure` и выбери **Mini App**.
2. В разделе **Mini Apps → Main App** включи и вставь ссылку на развёрнутое приложение (из Vercel).
3. Добавь краткое описание и иконку 512×512.
4. (Опционально) Создай **Direct Link** (`Create Direct Link`) для стартовой ссылки/QR: `https://t.me/kobiarti_bot/app?startapp=nosugar`.

## Настройка оплаты

### Встроенный Telegram invoice

1. В BotFather включи **Payments** → укажи провайдера (Stripe, YooMoney и т.д.).
2. Создай invoice через `/createinvoice`. Запомни `slug`.
3. В `app.js` найди `tg.openInvoice` и замени `slug: "nosugar-full"` на созданный slug.

### Альтернативно (Boosty/ЮKassa)

1. Создай товар на платформе.
2. В `app.js` замени `PRO_UPSELL_URL` на ссылку оплаты. Кнопка вызовет `tg.openLink`.

## Напоминания

В самом клиенте напоминания не отправить — нужен бот или сервис-рассылка.

1. При первом запуске в `app.js` сохраняется `startedAt`.  
2. Используй сервер/конструктор ботов (Salebot, BotMother, Make.com), чтобы по `startapp` событию ставить отложенное сообщение на 24 часа.  
3. В сообщении используй ссылку `https://t.me/kobiarti_bot/app?startapp=nosugar`, чтобы пользователь сразу попал в Mini App.

## Что заменить перед публикацией

- `PRO_UPSELL_URL` — ссылка на оплату или лендинг усиленной версии.
- `slug` в `tg.openInvoice` — если используешь платежи Telegram.
- Иллюстрацию `public/cup.svg` можешь заменить на фирменную.
- Тексты внутри `dayPlans` — при необходимости отредактируй вкусы/советы.

После обновления файлов перезалей проект на выбранный хостинг и обнови ссылку в BotFather. Всё! Мини-приложение готово к запуску. 

