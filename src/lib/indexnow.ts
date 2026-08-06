import "server-only";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { LOCALES } from "@/src/i18n/config";
import { SITE_URL } from "@/src/lib/site-url";

// IndexNow — мгновенное уведомление поисковиков об изменившихся страницах вместо
// ожидания обхода по sitemap. Одна отправка на api.indexnow.org расходится по всем
// участникам протокола (Bing, Яндекс, Seznam, Naver); Google в протоколе НЕ участвует,
// для него по-прежнему работает только sitemap.
//
// Env-gated: без INDEXNOW_KEY — полный no-op (на локальной машине и в превью ничего
// никуда не уходит). Best-effort: не бросает исключений и не задерживает вызывающий
// код — админка не должна падать или тормозить из-за недоступного поисковика.
//
// Ключ НЕ является секретом: протокол требует опубликовать его по адресу
// https://<домен>/<ключ>.txt, поэтому файл лежит в public/ и коммитится в репозиторий.

const ENDPOINT = "https://api.indexnow.org/indexnow";

/** Предохранитель на объём одной отправки (протокол допускает до 10 000). */
const MAX_URLS = 1000;

/** Требование протокола к ключу: 8–128 символов [a-zA-Z0-9-]. */
const KEY_RE = /^[a-zA-Z0-9-]{8,128}$/;

function readKey(): string | null {
  const key = process.env.INDEXNOW_KEY?.trim();

  if (!key) {
    return null;
  }

  if (!KEY_RE.test(key)) {
    console.warn("[indexnow] INDEXNOW_KEY не соответствует формату (8–128 символов a-zA-Z0-9-) — пропускаю отправку");
    return null;
  }

  return key;
}

// Проверяем НАЛИЧИЕ файла-подтверждения один раз на процесс: если env-ключ и имя
// файла в public/ разъехались, поисковик молча ответит 403 и об этом никто не
// узнает. Проверка только предупреждает — отправку не блокирует (файл может
// раздаваться CDN/прокси, а не из public/).
let keyFileChecked = false;

function warnIfKeyFileMissing(key: string) {
  if (keyFileChecked) {
    return;
  }
  keyFileChecked = true;

  try {
    if (!existsSync(join(process.cwd(), "public", `${key}.txt`))) {
      console.warn(
        `[indexnow] нет файла public/${key}.txt — поисковик отклонит отправку (403). Создайте файл с содержимым, равным ключу.`,
      );
    }
  } catch {
    // Файловая система недоступна (нестандартный рантайм) — просто пропускаем проверку.
  }
}

/**
 * Пути БЕЗ языкового префикса ("/", "/catalog", "/product/tort") → абсолютные URL
 * по всем локалям. У сайта равновесные языковые URL (/kk, /ru, /en), в sitemap
 * каждая страница отдаётся ×3 — уведомлять надо так же, иначе казахская и
 * английская версии останутся с устаревшим индексом.
 */
function expandToLocalizedUrls(paths: string[]): string[] {
  const urls = new Set<string>();

  for (const raw of paths) {
    // Принимаем только внутренние пути — чужой хост в urlList протокол отклоняет целиком.
    if (!raw || !raw.startsWith("/")) {
      continue;
    }

    const clean = raw === "/" ? "" : raw.replace(/\/+$/, "");

    for (const locale of LOCALES) {
      urls.add(`${SITE_URL}/${locale}${clean}`);
    }
  }

  return [...urls];
}

/**
 * Уведомить поисковики об изменившихся страницах. Принимает пути без языкового
 * префикса. Никогда не бросает исключений: вызывать можно прямо из server action.
 */
export async function pingIndexNow(paths: string[]): Promise<void> {
  const key = readKey();

  if (!key) {
    return;
  }

  const host = new URL(SITE_URL).host;

  // Локальную разработку не пингуем: поисковик не сможет проверить ключ, а в логах
  // будет мусор. Отдельного флага «это прод» в проекте нет — смотрим на хост.
  if (/^(localhost|127\.|0\.0\.0\.0|\[?::1)/i.test(host)) {
    console.warn("[indexnow] хост", host, "— локальный, отправку пропускаю");
    return;
  }

  const all = expandToLocalizedUrls(paths);

  if (all.length === 0) {
    return;
  }

  const urlList = all.slice(0, MAX_URLS);

  if (urlList.length < all.length) {
    // Молчаливое усечение недопустимо: иначе «отправили всё» выглядит правдой, а часть
    // страниц осталась без уведомления.
    console.warn(`[indexnow] отправляю ${urlList.length} URL из ${all.length} — остальные усечены лимитом`);
  }

  warnIfKeyFileMissing(key);

  const keyLocation = process.env.INDEXNOW_KEY_LOCATION?.trim() || `${SITE_URL}/${key}.txt`;

  // Таймаут: вызов идёт из сохранения товара в админке — зависший поисковик не должен
  // задерживать ответ менеджеру.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key, keyLocation, urlList }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Тело ответа НЕ логируем целиком: в него попадает отправленный ключ.
      console.warn("[indexnow] endpoint вернул", response.status, `(${urlList.length} URL)`);
    }
  } catch (error) {
    console.warn("[indexnow] ошибка отправки:", error instanceof Error ? error.message : "unknown");
  } finally {
    clearTimeout(timer);
  }
}
