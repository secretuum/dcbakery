// Транспортный слой WhatsApp: абстракция над провайдером (сейчас Green API,
// в будущем — Meta Cloud API) БЕЗ бизнес-логики. Вся корзина/каталог/распознавание/
// состояние/регистрация зависят ТОЛЬКО от этих типов, а не от Green API напрямую.
// Чистый модуль (без "server-only"): типы стираются, реализации живут отдельно.

/** Тип входящего сообщения после нормализации провайдером. */
export type IncomingMessageKind = "text" | "voice" | "image" | "document" | "unsupported";

/** Дескриптор голосового — файл ещё НЕ скачан (скачивание только доверенным путём). */
export type IncomingVoiceRef = {
  /** Токен/URL для скачивания ТОЛЬКО через доверенный механизм провайдера. */
  downloadUrl?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  durationSeconds?: number | null;
};

/** Дескриптор фото/документа — файл ещё НЕ скачан (скачивание только доверенным путём). */
export type IncomingMediaRef = {
  downloadUrl?: string | null;
  mimeType?: string | null;
  /** Имя файла (для документов) — помогает определить формат (.xlsx/.pdf). */
  fileName?: string | null;
  /** Подпись к фото/документу (клиент часто пишет заказ в подписи). */
  caption?: string | null;
  sizeBytes?: number | null;
};

/** Нормализованное входящее сообщение — единый вид для любого провайдера. */
export type NormalizedIncomingMessage = {
  /** Стабильный идентификатор сообщения провайдера (для дедупликации). */
  messageId: string;
  /** Нормализованный телефон отправителя: 11 цифр 7XXXXXXXXXX (без @c.us). */
  phone: string;
  /** «Сырой» chatId провайдера (например 7XXXXXXXXXX@c.us) — для ответа. */
  chatId: string;
  kind: IncomingMessageKind;
  /** Текст (для kind==='text'); НЕДОВЕРЕННЫЕ данные. */
  text?: string;
  /** Дескриптор голосового (для kind==='voice'). */
  voice?: IncomingVoiceRef;
  /** Дескриптор фото/документа (для kind==='image'|'document'). */
  media?: IncomingMediaRef;
  /** Имя профиля WhatsApp — только как необязательная подпись, НЕ достоверное ФИО. */
  profileName?: string | null;
  /** Идентификаторы связанных сообщений (ответ/цитата), если есть. */
  relatedMessageIds?: string[];
  /** true, если это менеджерский групповой чат (не клиентский диалог). */
  isManagerChat?: boolean;
};

export type OutgoingListRow = { id: string; title: string; description?: string };

export type DownloadedMedia = { bytes: Uint8Array; mimeType: string | null };

/**
 * Транспортный провайдер WhatsApp. Реализации: GreenApiProvider, (позже)
 * MetaCloudProvider — добавляется без переписывания бизнес-логики.
 */
export interface WhatsAppProvider {
  readonly name: string;
  /** Нормализовать входящий webhook-пейлоад в сообщение (или null, если не сообщение). */
  normalizeWebhook(payload: unknown): NormalizedIncomingMessage | null;
  /** Отправить текст. Возвращает messageId или null (fail-open, ошибки не роняют поток). */
  sendText(chatId: string, text: string): Promise<string | null>;
  /**
   * Отправить список/кнопки, если провайдер поддерживает; иначе реализация сама
   * деградирует до обычного текста. Возвращает messageId или null.
   */
  sendChoices?(chatId: string, header: string, rows: OutgoingListRow[]): Promise<string | null>;
  /** Скачать голосовой файл ТОЛЬКО по доверенному дескриптору. null при отказе. */
  downloadVoice(ref: IncomingVoiceRef): Promise<DownloadedMedia | null>;
  /** Скачать фото/документ ТОЛЬКО по доверенному дескриптору. null при отказе. */
  downloadMedia(ref: IncomingMediaRef): Promise<DownloadedMedia | null>;
}
