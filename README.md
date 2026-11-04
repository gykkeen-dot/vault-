# VAULT (рабочее название)

Мобильное приложение (Expo / React Native, iPhone + Android) для высокой моды, архива и винтажа:
аутфиты, поиск вещей, легитчек, замеры. Монетизация: подписка Premium + платные проверки экспертом.

## Запуск
    npm install
    cp .env.example .env   # вставь Supabase URL и anon-ключ
    npx expo start

## Статус
Этап 0: каркас (4 вкладки, бренды, лимиты, заготовка Supabase). Полный план: docs/PLAN.md.

## Структура
- `src/config/brands.js`: бренды (legit: true — первая версия легитчека)
- `src/config/limits.js`: лимиты Free / Premium
- `src/lib/supabase.js`: клиент (ключи из env); `src/lib/usage.js`: дневные счётчики (пока локально)
- `supabase/schema.sql`: профили, счётчики, RLS
