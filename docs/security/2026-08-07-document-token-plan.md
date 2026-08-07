# Фикс #3 (IDOR документов): подписанный док-токен в ссылках

_Составлено 07.08.2026. **Черновик для разработчика.** В код не применялось. Применять АТОМАРНО одним PR: сначала enforcement в роутах + генерация токенов во всех ссылках вместе, иначе действующие ссылки на счета/накладные перестанут открываться._

## Проблема

Роуты документов (`app/(main)/documents/{invoice,nakl,avr}/[orderId]/...`) отдают счёт/накладную/АВР с ПДн (компания, БИН/ИИН, адрес, позиции, суммы) **по одному orderId, без проверки владельца** (IDOR). `orderId` = `gen_random_uuid()` (v4, 122 бита) — не перебирается, поэтому URL фактически работает как токен-возможность. Реальный риск — **утечка ссылки** (пересылка, реферер, логи). «Требовать логин» нельзя: счёт намеренно уходит клиенту в WhatsApp (`src/lib/orders/actions.ts:154`) и бухгалтеру в Telegram (`src/lib/telegram/accountant.ts:88`) — они открывают без входа.

## Решение

Заменить «голый orderId = доступ» на **HMAC-подписанный токен в query** (`?t=...`), который генерируется на сервере при создании каждой ссылки и проверяется в роутах документов. Stateless (без БД/миграций), с TTL и мгновенным отзывом через ротацию секрета. Все источники ссылок серверные, поэтому session-логика не нужна — enforcement только по токену.

Формат токена: `base64url(expMs) + "." + hex(HMAC_SHA256(secret, `${orderId}.${expMs}`))`. Проверка: распарсить exp, проверить не истёк, пересчитать HMAC над `${orderId}.${expMs}`, сравнить в постоянное время.

Env: `DOCUMENT_TOKEN_SECRET` (или переиспользовать `CLIENT_SESSION_SECRET` — но отдельный секрет позволяет отзывать только доки, не разлогинивая клиентов). Fail-fast в проде без секрета (как в `client-session.ts`).

TTL: счета/накладные должны оставаться доступными долго — предлагаю **90 дней**; отзыв всех ссылок = ротация `DOCUMENT_TOKEN_SECRET`.

## 1. Новый хелпер — `src/lib/document-token.ts` (safe-зона)

```ts
import "server-only";

// Подписанный токен доступа к документам заказа (счёт/накладная/АВР).
// URL работает как возможность: кто владеет ссылкой с валидным токеном — видит документ.
// Stateless HMAC: без БД. Отзыв всех выданных токенов = ротация DOCUMENT_TOKEN_SECRET.

const DEFAULT_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 дней — счёт остаётся доступен

function secret() {
  const value = process.env.DOCUMENT_TOKEN_SECRET || process.env.CLIENT_SESSION_SECRET;
  if (value && value.length > 0) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("DOCUMENT_TOKEN_SECRET is not set — refusing insecure fallback in production");
  }
  return "dev-only-insecure-please-set-env";
}

async function hmacKey(usage: "sign" | "verify") {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

async function sig(orderId: string, expMs: number): Promise<string> {
  const key = await hmacKey("sign");
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${orderId}.${expMs}`));
  return Buffer.from(buf).toString("hex");
}

/** Токен для ссылки на документ конкретного заказа. */
export async function signDocumentToken(orderId: string, ttlMs = DEFAULT_TTL_MS): Promise<string> {
  const expMs = Date.now() + ttlMs;
  const expB64 = Buffer.from(String(expMs)).toString("base64url");
  return `${expB64}.${await sig(orderId, expMs)}`;
}

/** true, если токен валиден для этого orderId и не истёк. Сравнение — в постоянное время. */
export async function verifyDocumentToken(orderId: string, token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;
  const expMs = Number(Buffer.from(token.slice(0, dot), "base64url").toString());
  if (!Number.isFinite(expMs) || expMs < Date.now()) return false;
  const provided = token.slice(dot + 1);
  const expected = await sig(orderId, expMs);
  // timing-safe: равная длина hex + crypto.subtle.verify-эквивалент через сравнение байт
  if (provided.length !== expected.length) return false;
  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  const { timingSafeEqual } = await import("node:crypto");
  return timingSafeEqual(a, b);
}
```

## 2. Enforcement — во всех 6 роутах документов (safe-зона)

Роуты: `documents/{invoice,nakl,avr}/[orderId]/xlsx/route.ts` (3) И HTML-страницы `documents/{invoice,nakl,avr}/[orderId]/page.tsx` (3). В КАЖДОМ — сразу после получения `orderId` и проверки UUID, до `fetchAdminOrder`:

```ts
// route.ts (GET): токен из query
const token = new URL(request.url).searchParams.get("t");
if (!(await verifyDocumentToken(orderId, token))) {
  return NextResponse.json({ error: "Not found" }, { status: 404 }); // 404, не 403 — не палим существование
}
```

```tsx
// page.tsx (серверный компонент): токен из searchParams
export default async function Page({ params, searchParams }: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { orderId } = await params;
  const { t } = await searchParams;
  if (!isUuid(orderId) || !(await verifyDocumentToken(orderId, t))) notFound();
  // ... дальше как есть; при линковании на /xlsx прокидывать тот же t (см. ниже)
}
```

HTML-страница, линкующая на свой `/xlsx`, обязана прокинуть **тот же токен**: `href={`/documents/invoice/${order.id}/xlsx?t=${t}`}`.

## 3. Генерация токена во всех источниках ссылок (append `?t=`)

Каждый источник — серверный, поэтому вызывает `await signDocumentToken(order.id)` и подставляет в URL. ⚠️ помечены запретные зоны (order-флоу) — правит дев с ревью.

| Файл:строка | Что | Зона |
|---|---|---|
| `src/lib/orders/actions.ts:154` | ссылка на счёт в WhatsApp-сообщении | ⚠️ order-флоу |
| `src/lib/telegram/accountant.ts:88` | ссылка на счёт бухгалтеру в Telegram | ⚠️ order-флоу |
| `app/pay/[orderId]/page.tsx:229,244` | кнопки «счёт»/«накладная» на странице оплаты | обычная |
| `app/(main)/documents/invoice/[orderId]/page.tsx:134` | ссылка на xlsx | обычная |
| `app/(main)/documents/nakl/[orderId]/page.tsx:104,105,113` | ссылки на страницу/xlsx (учесть `?split=1` → `&t=`) | обычная |
| `app/(main)/documents/avr/[orderId]/page.tsx:75` | ссылка на xlsx | обычная |
| `app/(main)/admin/orders/[id]/page.tsx:203,209` | ссылки на счёт/накладную из карточки заказа | обычная |
| `app/(main)/admin/documents/page.tsx:142,149` | ссылки из списка документов | обычная |
| `src/components/profile/ProfileClient.tsx:1292,1293` | «Счет PDF»/«Накладная PDF» в ЛК | обычная |

Примечание для `nakl` со `?split=1`: токен добавлять как `&t=`, чтобы не сломать существующий query.

`ProfileClient.tsx` — клиентский компонент; токен нужно вычислить на сервере (в родительском серверном компоненте, где грузятся заказы) и прокинуть пропом, а не звать `signDocumentToken` из браузера (`server-only`).

## 4. Доп. усиление (дёшево, к любому варианту)

С токеном в URL важно, чтобы он не утёк через `Referer`. Добавить на ответы документов заголовок:

```ts
"Referrer-Policy": "no-referrer",
```

(`Cache-Control: no-store` в xlsx-роутах уже стоит — сохранить.)

## 5. Rollout, тесты, отзыв

- **Атомарно:** enforcement (п.2) + все источники ссылок (п.3) в одном деплое. Иначе уже разосланные ссылки без `?t=` дадут 404.
- **Старые ссылки** (уже в WhatsApp/Telegram у клиентов) перестанут работать — это цена перехода. Смягчение: короткий переходный период, когда роут принимает `t` ИЛИ (при отсутствии `t`) старое поведение с логированием — затем убрать фолбэк. Решение за владельцем.
- **Env:** задать `DOCUMENT_TOKEN_SECRET` на Render (32+ случайных байт). Без него в проде роуты документов будут падать (fail-fast) — задать ДО деплоя.
- **Отзыв всех ссылок:** сменить `DOCUMENT_TOKEN_SECRET`.
- **Тесты** (`src/lib/document-token.test.ts`, node:test): валидный токен проходит; чужой orderId с тем же токеном — нет; истёкший — нет; битый — нет; подмена секрета инвалидирует. Плюс роут: без `t` → 404, с валидным `t` → 200.

## Зоны

Хелпер (п.1), enforcement в роутах и обычные источники ссылок (п.2, часть п.3) — safe-зона, можно делать в обычной сессии. `orders/actions.ts` и `telegram/accountant.ts` (п.3) — order-флоу, ревью дева. Миграций нет.
