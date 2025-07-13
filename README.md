# Blood Pressure Tracker

Приложение для учета кровяного давления утром и вечером каждый день.

## Описание

Веб-приложение состоит из:
- Frontend: HTML + JavaScript + CSS + Bootstrap 5
- Backend: Node.js + Express + SQLite

## Функциональность

- Запись показаний тонометра (систолическое/диастолическое давление + пульс)
- Просмотр истории измерений
- Экспорт данных в CSV
- Аутентификация пользователей

## Установка

```bash
npm install
```

## Запуск

```bash
npm start
```

Для разработки:
```bash
npm run dev
```

## API

- `POST /api/auth/register` - Регистрация
- `POST /api/auth/login` - Вход
- `POST /api/measurements` - Добавление измерения
- `GET /api/measurements` - Получение измерений
- `GET /api/measurements/export` - Экспорт в CSV