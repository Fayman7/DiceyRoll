# APIs Playground

Веб-приложение с авторизацией, чатом 1-на-1, загрузкой изображений, игровыми комнатами, генератором случайных предметов и панелью администратора.

## Стек

| Слой | Технологии |
|------|------------|
| Frontend | Vue 3, Vue Router, Vite, Socket.IO Client |
| Backend | Node.js, Express, Socket.IO |
| База данных | PostgreSQL (`pg`) |
| Аутентификация | JWT (access + refresh), bcrypt |
| Файлы | Multer (загрузка изображений в `backend/public/uploads`) |
| Тесты | Vitest (frontend), Jest + Supertest (backend) |

## Требования

- Node.js 18+
- PostgreSQL 14+
- npm

## Настройка базы данных

1. Создайте базу данных в PostgreSQL.
2. Выполните SQL для базовых таблиц:

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password TEXT NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE uploads (
    img_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    img_url TEXT NOT NULL
);

CREATE TABLE chats (
    id SERIAL PRIMARY KEY,
    user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (user1_id, user2_id)
);

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_chats_users ON chats(user1_id, user2_id);
```

3. Выполните дополнительные таблицы из файла:

```bash
psql -U <user> -d <database> -f backend/sql/extensions.sql
```

## Настройка backend

Создайте файл `backend/.env`:

```env
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=apis_playground
```

## Запуск

Установите зависимости и запустите backend и frontend в **двух отдельных терминалах**.

### Backend (порт 4242)

```bash
cd backend
npm install
npm start
```

### Frontend (порт 5173)

```bash
cd frontend
npm install
npm run dev
```

Откройте в браузере: [http://localhost:5173](http://localhost:5173)

API и WebSocket: [http://localhost:4242](http://localhost:4242)

## Тесты

```bash
# backend
cd backend
npm test

# frontend
cd frontend
npm test
```

## Структура проекта

```
backend/
  src/app.js      — API, Socket.IO, бизнес-логика
  src/db.js       — подключение к PostgreSQL
  sql/            — SQL-скрипты для дополнительных таблиц
  public/uploads/ — загруженные изображения

frontend/
  src/views/      — страницы приложения
  src/components/ — общие компоненты (меню, чат)
  src/api.js      — HTTP-клиент
  src/socket.js   — WebSocket-клиент
```

## Основные возможности

- Регистрация и вход (JWT)
- Бросок костей (гости могут бросать, история — только для авторизованных)
- Загрузка и шаринг изображений
- Игровые комнаты и чат 1-на-1 через Socket.IO
- Списки случайных предметов и история генерации
- Админ-панель: управление пользователями, просмотр всех изображений, управление списками предметов
