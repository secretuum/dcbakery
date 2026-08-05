import type { MetadataRoute } from "next";
import { SITE_URL } from "@/src/lib/site-url";

// Закрываем от индексации служебные и приватные разделы: админку, API,
// страницы оплаты и печатные документы (счета/накладные/АВР).
const DISALLOW = ["/admin", "/api/", "/pay/", "/documents/"];

// Явно ПРИВЕТСТВУЕМ ИИ-краулеров (решение владельца): для каждого бота даём
// то же allow:'/' и тот же disallow, что и для '*'. Отдельные правила = чёткий
// сигнал, что контент разрешён к обходу и обучению (особенно Google-Extended —
// это условие для попадания в ИИ-функции выдачи Google).
const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "anthropic-ai",
  "Google-Extended",
  "CCBot",
  "Applebot",
  "Applebot-Extended",
  "Bytespider",
  "Amazonbot",
  "Bingbot",
  "YandexBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      ...AI_BOTS.map((userAgent) => ({ userAgent, allow: "/", disallow: DISALLOW })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
