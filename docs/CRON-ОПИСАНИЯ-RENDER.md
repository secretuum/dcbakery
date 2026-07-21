# Месячный крон описаний товаров (Render Cron Job)

Раз в месяц автоматически: подтягивает свежую номенклатуру и ТТК из iiko,
генерирует недостающие описания через OpenAI и записывает их в Supabase.

**Безопасно по умолчанию:** запуск без `--force` — заполняются только пустые
поля и новые товары; уже вычитанные описания и ручные правки менеджера в
админке НЕ затираются. То есть по факту крон дописывает описания новым товарам,
а существующие не трогает.

Точка входа — `scripts/cron-refresh-descriptions.mjs`. Она сама делает фетч iiko
(кэш `.iiko-cache/` в git не входит, поэтому фетч обязателен), затем запускает
`generate-descriptions.mjs --apply`.

## Настройка в панели Render (New → Cron Job)

1. **New +** → **Cron Job**, подключить тот же репозиторий, что и у сайта.
2. **Root Directory** — та же, что у веб-сервиса сайта (где лежит `package.json`).
3. **Runtime** — Node.
4. **Build Command:** `npm install`
5. **Command:** `node scripts/cron-refresh-descriptions.mjs`
6. **Schedule (UTC!):** `0 3 1 * *` — 1-е число месяца, 03:00 UTC (08:00 Алматы).
7. **Environment Variables** — задать те же, что у веб-сервиса (проще всего —
   привязать общий **Environment Group**, если он есть):
   - `IIKO_BASE_URL`, `IIKO_RESTO_LOGIN`, `IIKO_RESTO_PASS` — фетч из iiko;
   - `OPENAI_API_KEY` (и при желании `OPENAI_MODEL`, по умолчанию `gpt-4o`);
   - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — запись в Supabase.
8. **Create Cron Job**.

## Проверка

- В карточке Cron Job на Render есть кнопка **Run** (запустить вручную сейчас).
  Запустите — в логах должно быть: `iiko номенклатура: N`, `iiko ТТК: M`,
  затем строки генерации и `записано в Supabase: K`.
- Первый прогон в свежем окружении сгенерирует описания заново (кэша
  `generated-content.json` там нет) — это нормально, ~80 обращений к OpenAI,
  стоимость копеечная. Запись при этом всё равно только в пустые поля.

## Если что-то не так

- `не заданы IIKO_BASE_URL / IIKO_RESTO_LOGIN / IIKO_RESTO_PASS` — не добавлены
  env-переменные iiko в Cron Job.
- `iiko resto auth не удался` — неверные логин/пароль resto или база iiko
  недоступна с серверов Render.
- `OPENAI_API_KEY не задан` — не добавлена переменная OpenAI.

## Альтернатива: render.yaml (Blueprint)

Если проект деплоится через Blueprint (`render.yaml`), добавьте сервис — но
только если сайт УЖЕ управляется Blueprint'ом (иначе настраивайте через панель,
как выше):

```yaml
services:
  - type: cron
    name: dc-descriptions-monthly
    runtime: node
    schedule: "0 3 1 * *"
    buildCommand: npm install
    startCommand: node scripts/cron-refresh-descriptions.mjs
    envVars:
      - fromGroup: dc-bakery-env   # общий Environment Group с ключами iiko/OpenAI/Supabase
```

## Хочу обновлять и существующие описания (не только новые)

По умолчанию крон существующие описания не трогает (безопасно). Если после
правки ТТК в iiko нужно пересобрать описание конкретных товаров — это разовая
ручная операция локально, осознанно:

```
node scripts/generate-descriptions.mjs --only=slug1,slug2 --apply --force
```

Ставить `--force` в месячный крон не рекомендуется: одна сломанная ТТК в iiko
затрёт хорошее описание у всех.
