// Конфигурация подсистемы оформления B2B-заказов через WhatsApp (NL + голос).
// Всё, что можно крутить без изменения кода: флаги, лимиты, таймауты. Значения
// живут в env / app_settings; сам runtime-флаг включения проверяется отдельно
// (getWhatsAppNlOrdersEnabled в repo-слое), здесь — только имя ключа и константы.
//
// ВАЖНО: модуль чистый (без "server-only", без сети) — его можно импортировать в
// юнит-тестах и в клиентском коде.

/** Ключ мастер-флага нового AI/голосового пути в app_settings. По умолчанию ВЫКЛ. */
export const WHATSAPP_NL_ORDERS_FLAG = "whatsapp_nl_orders_enabled";

/** Ключ редактируемого списка розничных позиций del Cappuccino в app_settings. */
export const RETAIL_KEYWORDS_SETTING = "whatsapp_retail_keywords";

export const LIMITS = {
  /** Максимальная длина входящего текста, отдаваемого в AI (анти-флуд, стоимость). */
  maxInboundTextLength: 2000,
  /** Максимум позиций в одном разобранном намерении. */
  maxIntentItems: 40,
  /** Максимальная длина «сырого» названия позиции. */
  maxRawNameLength: 200,
  /** Максимальная длина адреса из сообщения. */
  maxAddressLength: 500,
  /** Максимальное количество единиц одного SKU за раз (клэмп до создания заказа). */
  maxItemQuantity: 1000,
  /** Максимальная длительность голосового, сек. */
  maxVoiceSeconds: 60,
  /** Максимальный размер голосового файла, байт (~60с opus ≈ 1МБ; берём с запасом). */
  maxVoiceBytes: 5 * 1024 * 1024,
  /** TTL сессии корзины, мс (60 минут с последней активности). */
  cartSessionTtlMs: 60 * 60 * 1000,
  /** Сколько ближайших вариантов показывать при неоднозначности. */
  similarSuggestions: 3,
} as const;

export const TIMEOUTS = {
  intentMs: 15000,
  transcribeMs: 20000,
  supabaseMs: 10000,
  mediaDownloadMs: 15000,
} as const;

/** Разрешённые MIME голосовых WhatsApp (voice/audio). Прочее — отклоняем. */
export const ALLOWED_AUDIO_MIME: ReadonlySet<string> = new Set([
  "audio/ogg",
  "audio/opus",
  "audio/ogg; codecs=opus",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/aac",
  "audio/amr",
  "audio/wav",
  "audio/x-wav",
]);

/** Версия текста согласия на создание профиля / обработку данных (для журнала). */
export const CONSENT_VERSION = "2026-07-31";
