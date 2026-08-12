# B3 — [locale]-сегмент + ISR/HTML-кэш (план миграции)

Ветка: `b3-locale-isr`. Цель: перевести публичные страницы со **динамического** рендера на **static/ISR**, чтобы Cloudflare/Render кэшировали HTML и краулеры (×3 локали) не били в динамику на каждый URL.

## Почему сейчас всё динамическое
1. `getLocale()` (`src/i18n/server.ts:10`) читает `headers()` (`x-locale`) → форс-динамика.
2. `app/(main)/layout.tsx:16` `getIsSuperAdmin()` читает `cookies()` → форс-динамика на всех (main)-страницах.

## Ключевое решение: `next/root-params`
Next 16 умеет отдавать значение корневого динамического сегмента `[locale]` через `next/root-params` в любом серверном компоненте/утилите — **без проброса `params` через ~28 файлов**. Включается флагом `experimental.rootParams: true` (уже добавлен в `next.config.ts`).

Тогда `getLocale()` переписывается на root-params — **один файл**, а все `getT()`/`getLocale()`-вызовы остаются без изменений и становятся статически-рендеримыми.

⚠️ `root-params` — compiler-magic (резолвится только при `next build`/`dev`); `tsc` его не проверяет. Верификация — обязательный `npm run build` + `npm run dev`.

## Целевая структура `app/`
Мультикорень (два корневых лэйаута, т.к. локализованным нужен `<html lang={locale}>`, а `/admin`,`/pay`,`/documents` — нет):

```
app/
  fonts.ts                    # общий (готов): geist/montserrat/mono + fontVariables
  globals.css, constants.ts   # без изменений
  global-error.tsx            # остаётся в корне (свой <html><body>)
  opengraph-image.tsx         # остаётся в корне (дефолтный OG для всех)
  robots.ts, sitemap.ts       # остаются в корне (/robots.txt, /sitemap.xml)
  api/**                      # без изменений (route handlers, лэйаут не нужен)

  [locale]/                   # ← КОРЕНЬ локализованных
    layout.tsx                # NEW: <html lang={locale}> + head/preconnect + Analytics/RouteTracker
                              #      + LocaleProvider(dict) + Cart/Toast + generateStaticParams + revalidate
                              #      + локализованные generateMetadata (перенести из app/layout.tsx)
    (main)/layout.tsx         # SiteEditProvider + Header/Footer/BottomNav/CartBottomBar (из старого (main)/layout)
    (main)/page.tsx           # ← (main)/page.tsx (home)
    (main)/not-found.tsx, error.tsx
    (main)/(shop)/**, catalog/**, product/**, cart, checkout, contacts,
    oferta, oplata-i-dostavka, optom, privacy, register   # всё локализованное из (main)

  (unlocalized)/              # ← КОРЕНЬ не-локализованных (lang="ru")
    layout.tsx                # NEW: <html lang="ru"> + head + Analytics + Cart/Toast (без LocaleProvider/Header)
    admin/**                  # ← (main)/admin/**  (AdminShell-лэйаут сохранить)
    documents/**              # ← (main)/documents/**  (проверить: они теряют Header/Footer — для печатных доков это ОК/лучше)
    pay/**                    # ← app/pay/**  (свой pay-лэйаут сохранить)

  layout.tsx                  # УДАЛИТЬ (мультикорень: единого корня быть не должно)
```

Приоритет маршрутов: статический сегмент (`/admin`, `/pay`, `/documents` в `(unlocalized)`) выигрывает у динамического `[locale]`, поэтому `/admin` не попадёт в `[locale]` как `locale="admin"`. Для страховки — в `[locale]/layout.tsx` `generateStaticParams` только kk/ru/en + `notFound()` на неизвестной локали.

## Правки по файлам

### `src/i18n/server.ts` — `getLocale()` на root-params (с фолбэком)
```ts
import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "@/src/i18n/config";
import { translate, type Translator } from "@/src/i18n/translate";

export async function getLocale(): Promise<Locale> {
  // RSC под [locale]: берём язык из корневого параметра (не форсит динамику → ISR).
  try {
    const { locale } = await import("next/root-params");
    const value = await locale();           // сгенерируется компилятором из сегмента [locale]
    if (isLocale(value)) return value;
  } catch {
    // root-params недоступен (route handler / вне [locale]) — падаем в cookie-фолбэк.
  }
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;   // для /api, /pay, /documents
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
// getT() — без изменений.
```
NB: проверить сборкой точное имя экспорта (`locale` для сегмента `[locale]`). Если динамический `import()` не резолвит compiler-magic — заменить на статический `import { locale } from "next/root-params"` в отдельном хелпере, вызываемом только из RSC под [locale].

### `proxy.ts` (FORBIDDEN, согласовано) — убрать rewrite локали
- Блок админки — без изменений.
- Не-локализуемые (`/api`,`/pay`,`/documents`, RESERVED) — passthrough (без изменений).
- **Убрать** ветку «путь с префиксом → rewrite + x-locale» (сегмент теперь реальный — Next сам отдаёт `[locale]`). Оставить только cookie `NEXT_LOCALE` для не-RSC потребителей (по желанию).
- «Голый» путь без языка → 308 на `/{pickLocale}` — **оставить**.
- matcher — оставить.

### `app/[locale]/layout.tsx` (NEW) — перенести из `app/layout.tsx`
- `export const dynamicParams = false;` + `generateStaticParams(): LOCALES.map(l => ({ locale: l }))`.
- `export const revalidate = 3600;` (ISR; подобрать TTL) — **стадия 2**, после развязки superadmin.
- `generateMetadata` — перенести локализованную версию (сейчас в `app/layout.tsx`), `getLocale()` внутри уже вернёт root-param.
- Рендер `<html lang={locale}>` (locale из `params`) + `<head>` preconnect + Analytics/RouteTracker + `LocaleProvider(dict)` + Cart/Toast. Шрифты — из `app/fonts.ts` (`fontVariables`).

### `app/(unlocalized)/layout.tsx` (NEW)
- `<html lang="ru">` + `<head>` + Analytics + Cart/Toast (без LocaleProvider/Header/Footer). Шрифты — `fontVariables`.

### `app/[locale]/(main)/layout.tsx` — из старого `app/(main)/layout.tsx`
- Оставить SiteEditProvider + Header/Footer/BottomNav/CartBottomBar.
- **Стадия 1:** `getIsSuperAdmin()` (cookie) оставить → страницы пока остаются динамическими (ISR не включаем), но всё РАБОТАЕТ и собирается.
- **Стадия 2 (ISR):** развязать superadmin от статики — `SiteEditProvider` дочитывает статус суперадмина на клиенте (fetch к `/api/admin/session`-подобному эндпоинту), из layout убрать cookie-чтение; тогда `revalidate` реально включит ISR.

### Роутинг-хелперы `src/i18n/routing.ts`
- `withLocale`/`stripLocale`/`buildAlternates` — по логике не меняются (URL-схема `/{locale}/...` та же). Проверить только, что клиентские `LocaleLink`/переключатель языка работают с реальным сегментом.

## Стадии (каждую — `npm run build` + `dev` на ветке)
1. **Каркас + root-params:** структура `[locale]`/`(unlocalized)`, перенос файлов, `getLocale` на root-params, `proxy.ts`, удалить `app/layout.tsx`. superadmin-cookie ОСТАВИТЬ (динамика ок). Цель этапа: **собирается и роутится** (kk/ru/en/admin/pay/documents/api). ← самый рискованный кирпич (root-params) проверяется здесь.
2. **ISR:** развязать `getIsSuperAdmin` от статики (клиентский дочит), добавить `revalidate` + `dynamicParams=false`. Цель: публичные страницы реально static/ISR (проверить в build-выводе ○/●, и заголовки кэша).

## Чек-лист верификации (владелец)
- `npm run build` — без ошибок; в выводе публичные страницы `[locale]` помечены ● (SSG)/ISR, а не ƒ (Dynamic) — **после стадии 2**.
- `npm run dev`: открываются `/kk`, `/ru`, `/en` (герой/каталог/«о нас»); «голый» `/` и `/catalog` → 308 на `/{locale}`.
- `/admin/login` → вход работает; `/pay/<id>`, `/documents/...` открываются.
- hreflang/canonical в исходнике страниц верные (3 локали + x-default); `/sitemap.xml`, `/robots.txt` отдаются.
- `<html lang>` = kk/ru/en на локализованных, ru на admin/pay.
- Режим правки суперадмина (C1) работает.
- 404 на `/xx` (несуществующая локаль).

## Откат
Ветка изолирована. Если что — `git checkout main`; в прод ничего не уходит до мержа.

## Статус (сделано на ветке)
- ✅ `next.config.ts` — `experimental.rootParams: true`.
- ✅ `app/fonts.ts` — общий модуль шрифтов (+ `fontVariables`).
- ⏳ Остальное — по этому плану, стадия 1, с `dev`/`build` в контуре владельца.
