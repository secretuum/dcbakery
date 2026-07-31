# WhatsApp AI-оформление заказов (текст + голос)

Клиент пишет или наговаривает заказ обычным языком в WhatsApp
(«3 медовика, 4 сырника, 2 капучино…»), система понимает, собирает **только B2B**-корзину
по реальному каталогу/ценам/остаткам, розничные позиции отправляет ссылкой на
del Cappuccino, неизвестное уточняет, берёт адрес (только Алматы) и интервал, создаёт
заявку **существующим** потоком (статус «Ожидает подтверждения менеджера» → Telegram →
админка), шлёт клиенту статусы. Любые попытки поменять цену/оплату/правила игнорируются.

Всё это **надстройка** над уже существующим WhatsApp-ботом (`src/lib/whatsapp-catalog.ts`),
включается флагом и **по умолчанию ВЫКЛЮЧЕНА**. Пока флаг выключен — сайт и старый бот
работают без изменений.

---

## Архитектура

Новый код изолирован в `src/lib/whatsapp/orders/**`. Транспорт (Green API) отделён от
бизнес-логики; AI только извлекает структуру, все решения (цена, остаток, создание
заявки) — детерминированный сервер.

```
Green API webhook (app/api/whatsapp/webhook)   ← аддитивная правка за флагом
        │  tryHandleNlOrder(payload)            ← handle.ts (единственная точка входа)
        ▼
GreenApiProvider.normalizeWebhook  ── transport/ (интерфейс WhatsAppProvider; Meta Cloud позже)
        ▼
handleIncomingMessage(msg, deps)   ── orchestrator/orchestrator.ts (state-machine, чистый)
   ├─ dedup (whatsapp_processed_messages)        ── repo/dedup-repo
   ├─ dialog state + lock (whatsapp_dialog_state)── repo/dialog-repo
   ├─ голос: guard → Whisper                     ── ai/audio-guard (magic-bytes), ai/transcriber
   ├─ intent (OpenAI gpt-4o-mini, JSON-схема)    ── ai/intent-extractor → intent/schema.parseIntent
   ├─ policy (анти-инъекция / срез манипуляций)  ── policy/policy, policy/injection
   ├─ classify (B2B / розница / неизвестно)      ── match/matcher, match/retail
   ├─ cart (whatsapp_carts, клэмп по остатку)    ── cart/cart-service, cart/cart-math
   ├─ address (Алматы-эвристика)                 ── address/provider
   ├─ создание заявки (те же примитивы, +delivery)── order/create-order → insertOrderWithItems + Telegram
   ├─ согласие / черновик лида / handoff         ── repo/consent-repo, repo/lead-draft-repo, notify/telegram-notify
   └─ ответы клиенту (тексты)                    ── orchestrator/messages
```

**Ключевые инварианты безопасности:** AI не имеет доступа к БД/инструментам; в схеме
намерения физически нет полей цены/оплаты/скидки; вывод AI проходит строгий `parseIntent`;
цена/остаток всегда серверные; запросы к БД параметризованы (PostgREST); голос скачивается
только с доверенного хоста `*.green-api.com`; произвольные URL/вложения не обрабатываются.

## Схема состояний диалога (`state/machine.ts`)

```
idle → building_cart → awaiting_product_clarification
                    ↘ awaiting_cart_confirmation → awaiting_address
                        → awaiting_address_confirmation → awaiting_delivery_period
                          → awaiting_final_confirmation → creating_order → order_submitted
из любого состояния: → human_handoff | cancelled | expired
```
`human_handoff` — бот молчит до возврата менеджером. Сессия живёт 60 мин с последней
активности (`whatsapp_dialog_state.last_activity_at`); по истечении — сообщение о протухании.
Переходы покрыты юнит-тестами.

## Переменные окружения

См. `.env.whatsapp-ai.example`. Кратко: `OPENAI_API_KEY` (+необяз. `WHATSAPP_INTENT_MODEL`,
`WHATSAPP_STT_MODEL`); `GREEN_API_INSTANCE_ID/TOKEN/CHAT_ID` (+необяз. `GREEN_API_BASE_URL`);
`WHATSAPP_WEBHOOK_SECRET`; `TELEGRAM_BOT_TOKEN`, `TELEGRAM_GROUP_CHAT_ID`;
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; необяз. `UPSTASH_REDIS_REST_URL/TOKEN`,
`WHATSAPP_RETAIL_URL`.

## Настройка webhook Green API и токена

1. В кабинете Green API укажите webhook: `https://<ваш-домен>/api/whatsapp/webhook`.
2. Включите уведомления `incomingMessageReceived` (текст, а также `audioMessage` для голоса).
3. **Токен обязателен:** задайте `WHATSAPP_WEBHOOK_SECRET` в env и передавайте его в webhook —
   заголовком `x-whatsapp-webhook-secret` / `x-webhook-secret`, либо `Authorization: Bearer …`,
   либо `?secret=…`. Проверка timing-safe; без токена webhook отвечает 401. **Не оставляйте
   webhook публичным без токена.**

## Хранение голосовых

Голос принимается только как WhatsApp voice/audio. До распознавания проверяются MIME,
magic-bytes и размер (`ai/audio-guard`). Сейчас в БД (`whatsapp_voice_messages`) сохраняются
**метаданные + текст расшифровки**; сам аудиофайл в Storage **не** кладётся (экономия
места/egress). Для приватного хранения файла есть готовый бакет `whatsapp-voice` (private)
и `repo/voice-repo.uploadVoiceObject` — включается точечно при необходимости. Прямых открытых
ссылок на голос нет; доступ к таблице — только authenticated (RLS).

> Ограничение: длительность ≤60с сейчас проверяется по РАЗМЕРУ файла (Green API не всегда
> присылает длительность в webhook). Для строгой проверки — считать длительность из ogg/opus
> или брать из метаданных провайдера.

## Включение фичи (feature flag)

Флаг — в таблице `app_settings`, ключ `whatsapp_nl_orders_enabled`. По умолчанию ВЫКЛ.

Включить (SQL Editor Supabase):
```sql
insert into app_settings (key, value) values ('whatsapp_nl_orders_enabled', 'true')
on conflict (key) do update set value = 'true', updated_at = now();
```
Выключить — `value = 'false'`. Розничный список (необяз.) — ключ `whatsapp_retail_keywords`
(JSON-массив строк); при отсутствии берётся встроенный сид (бар/кухня del Cappuccino).

## Запуск миграций

5 файлов в `supabase/migrations/20260731000X_*` (dialog_state, processed_messages, consents,
voice_messages + приватный бакет, lead_drafts). Прогнать по порядку в Supabase SQL Editor
(или `supabase db push`). Идемпотентны (`CREATE TABLE IF NOT EXISTS`). Ничего существующего
не меняют.

## Запуск тестов

```
npm test
```
Юнит + интеграция на встроенном `node:test` (Node ≥22), без обращений к реальным
Green API/Telegram/OpenAI/Supabase — всё на фейках. Покрыто: нормализация, схема/парсер
намерения, policy/инъекции, state-machine, адрес, тарифы доставки (границы 9999/10000/14999/
15000), розница, matcher, audio-guard, cart-math, парсер webhook Green API, и 10 интеграционных
сценариев оркестратора (golden path, полный happy path, дедуп, инъекция, адрес вне Алматы,
голос, вложение, протухание, отмена, нехватка остатка).

## Ручная проверка (тестовый номер)

1. Прогнать миграции, задать env, включить флаг (SQL выше).
2. С тестового WhatsApp-номера написать боту: `3 медовика, 2 наполеона и капучино`.
3. Ожидаемо: корзина с 2 B2B-позициями и серверными ценами; капучино — ссылкой на
   del Cappuccino. Ответить `да` → бот спросит адрес.
4. Написать `Алматы, Абая 10` → подтвердить `да` → выбрать `утро` → `оформляй`.
5. Ожидаемо: «Заявка DCB-… принята», карточка в Telegram-чате менеджеров и в админке
   (`/admin/orders`). Проверить «3 капучино бесплатно» — цена не обнуляется.
6. Голос: записать до 60с «два сырника» → должно распознаться и добавиться.

## Откат

- Быстрый: выключить флаг (`whatsapp_nl_orders_enabled = false`) — мгновенно, старый бот
  продолжает работать. Кода это не касается.
- Полный: убрать 2 аддитивные строки в `app/api/whatsapp/webhook/route.ts` (импорт +
  вызов `tryHandleNlOrder`). Новые таблицы можно оставить (пустые, ни на что не влияют).

## Известные ограничения

- Длительность голоса ≤60с проверяется по размеру (см. выше).
- Аудиофайл не хранится (только расшифровка) — по умолчанию; включается опционально.
- Регистрационная одноразовая ссылка (дозаполнение профиля на сайте) — переиспользует
  существующий `magic_link_tokens`, но как отдельный шаг ещё не подключена; первый заказ
  создаётся с минимальным профилем (телефонный лид), менеджер дозаполняет.
- Дата доставки ставится «завтра» как предварительная; менеджер подтверждает точную по графику.
- Остаток из БОТА (команды старого пути) отражается в каталоге в пределах кэш-окна (см.
  [фикс egress](../CLAUDE.md)); правки из админки — сразу.

## Будущий переход на Meta Cloud API + WhatsApp Flow

- Транспорт уже за интерфейсом `WhatsAppProvider` (`transport/types.ts`). Для Meta достаточно
  добавить `MetaCloudWhatsAppProvider` (normalizeWebhook под формат Meta, sendText/downloadVoice
  через Graph API, проверка подписи `X-Hub-Signature-256`) и подменить провайдера в `handle.ts` —
  бизнес-логику/оркестратор трогать не нужно.
- `sendChoices` в интерфейсе зарезервирован под нативные списки/кнопки (Meta их поддерживает;
  Green API — деградирует до текста).
- WhatsApp Flow (официальные формы): точка расширения — шаги `awaiting_address` /
  `awaiting_delivery_period` / регистрация. Через Cloud API их можно заменить на нативный Flow,
  сохранив ту же state-machine; сейчас фиктивный Flow через Green API намеренно НЕ делаем.
