// Оркестратор диалога оформления заказа. Связывает всё: dedup → lock → TTL →
// state-machine → (голос: guard+transcribe) → intent → policy → классификация →
// корзина → адрес → интервал → создание заявки. Все внешние эффекты — через
// инъектируемые порты (OrchestratorDeps), поэтому модуль ЧИСТЫЙ и тестируется
// фейками (без реальных Green API/Telegram/OpenAI/Supabase). Тип CreateOrderInput
// импортируется как type (стирается — server-only не подтягивается).

import type { Product } from "@/src/types";
import { MIN_ORDER_AMOUNT } from "@/app/constants";
import type { NormalizedIncomingMessage, IncomingVoiceRef, IncomingMediaRef, IncomingLocationRef } from "../transport/types";
import { build2gisPointLink, isValidLatLng } from "../geo/gis";
import type { DialogState } from "../state/machine";
import { isBotSuppressed } from "../state/machine";
import { detectEscalation } from "../policy/escalation";
import { buildEscalationMessage, describeLeadReason, urgencyFromText } from "../policy/escalation-context";
import { scanForInjection } from "../policy/injection";
import { buildCatalogContext, catalogProductIds } from "../agent/catalog-context";
import type { AgentResponse } from "../agent/schema";
import type { CartView, CartItemQty, CartOp, CartAdjustment } from "../cart/cart-math";
import { guardAudio } from "../ai/audio-guard";
import { guardMedia } from "../ai/media-guard";
import type { CreateOrderInput } from "../order/create-order";
import { LIMITS, CONSENT_VERSION } from "../config";
import * as M from "./messages";

/** Один ход диалога, хранимый для памяти агента (компактно, в context JSONB). */
export type HistoryTurn = { role: "user" | "bot"; text: string };

export type DialogContext = {
  clarifications?: Array<{ rawName: string; candidates: Array<{ id: string; name: string }> }>;
  retail?: string[];
  address?: string;
  period?: "morning" | "afternoon";
  /** Сохранённые адреса клиента, показанные для выбора номером. */
  savedAddresses?: string[];
  /** Недавние ходы диалога — передаём агенту как контекст (без миграции, в JSONB). */
  history?: HistoryTurn[];
  /** Геометка клиента (WhatsApp location): координаты + подпись. Идёт в заявку 2ГИС-ссылкой. */
  geo?: { lat: number; lng: number; label?: string | null };
};

export type DialogSnapshot = { state: DialogState; context: DialogContext; phone: string | null };

export type OrchestratorDeps = {
  now(): number;
  retailUrl: string;
  retailKeywords: string[];
  dedup: {
    markProcessed(messageId: string, meta: { chatId?: string; kind?: string }): Promise<boolean>;
  };
  dialog: {
    get(chatId: string): Promise<(DialogSnapshot & { lastActivityMs: number }) | null>;
    save(chatId: string, snap: DialogSnapshot, nowIso: string): Promise<void>;
    acquireLock(chatId: string, token: string, nowIso: string, leaseIso: string): Promise<boolean>;
    releaseLock(chatId: string, token: string): Promise<void>;
  };
  catalog: { getProducts(): Promise<Product[]> };
  cart: {
    apply(
      chatId: string,
      meta: { phone?: string | null; senderName?: string | null },
      ops: CartOp[],
      products: Product[],
    ): Promise<{ view: CartView; adjustments: CartAdjustment[] }>;
    load(chatId: string, products: Product[]): Promise<{ view: CartView; adjustments: CartAdjustment[] }>;
    setItems(
      chatId: string,
      meta: { phone?: string | null; senderName?: string | null },
      items: CartItemQty[],
      products: Product[],
    ): Promise<{ view: CartView; adjustments: CartAdjustment[] }>;
    getItems(chatId: string): Promise<CartItemQty[]>;
    clear(chatId: string): Promise<void>;
  };
  agent: {
    respond(input: {
      message: string;
      catalogContext: string;
      validProductIds: Set<string>;
      cartSummary: string;
      history: string;
      shouldGreet: boolean;
    }): Promise<AgentResponse>;
  };
  transcribe(input: { bytes: Uint8Array; mimeType: string }): Promise<{ text: string; lang?: string }>;
  address: {
    validate(text: string): Promise<{ status: "in_almaty" | "outside_almaty" | "uncertain"; normalized: string; reason?: string; lat?: number; lon?: number }>;
  };
  voice: {
    download(ref: IncomingVoiceRef): Promise<{ bytes: Uint8Array; mimeType: string | null } | null>;
    store(input: {
      chatId: string;
      phone: string | null;
      messageId: string;
      mimeType: string | null;
      sizeBytes: number | null;
      durationSeconds: number | null;
      transcript?: string;
      lang?: string;
      status: string;
      rejectReason?: string;
    }): Promise<void>;
  };
  media: {
    download(ref: IncomingMediaRef): Promise<{ bytes: Uint8Array; mimeType: string | null } | null>;
    read(input: {
      bytes: Uint8Array;
      mimeType: string | null;
      fileName: string | null;
    }): Promise<{ text: string }>;
  };
  order: { create(input: CreateOrderInput): Promise<{ orderId: string; orderNumber: string }> };
  /** Опционально: одноразовая ссылка регистрации (дозаполнение профиля на сайте). */
  registration?: { createLink(phone: string, nowMs: number): Promise<string | null> };
  history: { lastOrderItems(phone: string): Promise<CartItemQty[] | null> };
  profile: {
    get(chatId: string): Promise<{
      companyName?: string | null;
      customerName?: string | null;
      customerBin?: string | null;
      customerEmail?: string | null;
      addresses?: string[] | null;
    } | null>;
  };
  consent: {
    has(phone: string, version: string): Promise<boolean>;
    record(input: { phone: string; chatId: string; version: string; messageId: string; acceptedAtIso: string }): Promise<void>;
  };
  lead: {
    upsertDraft(input: {
      chatId: string;
      phone: string | null;
      cart: CartItemQty[];
      address?: string | null;
      period?: string | null;
      stage: string;
      reason: string;
      transcript?: string | null;
    }): Promise<void>;
  };
  notifyManager(text: string): Promise<void>;
  /** Отправка сообщения клиенту. Возвращает id сообщения при успехе или null (для эскалации). */
  send(chatId: string, text: string): Promise<string | null>;
};

function tomorrowDate(nowMs: number): string {
  const d = new Date(nowMs + 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function parsePeriodFromText(text: string): "morning" | "afternoon" | null {
  const t = text.toLowerCase();
  if (/утр|первая половина|до обед|с утра/.test(t)) return "morning";
  if (/день|дня|вечер|вторая половина|после обед/.test(t)) return "afternoon";
  return null;
}

// Слова-подтверждения + вежливость/филлеры (рус/каз/англ). Сообщение считаем
// подтверждением, только если ВСЕ его слова из этого набора. Такой allow-list
// безопасен: любое «постороннее» слово (товар/улица/число — «убери», «сатпаева»,
// «90») отсутствует в наборе → НЕ подтверждение → уходит агенту/валидации адреса.
// Значит «да, но убери один» и «давай ул. Сатпаева 90» не создадут заказ/не
// подтвердят старый адрес, а вежливые «да, спасибо», «хорошо оформляйте», «иә» —
// корректно продвигают диалог (не подвисают).
// Слова, ДОСТАТОЧНЫЕ для подтверждения (рус/каз/англ).
const CONFIRM_WORDS = new Set([
  "да", "даа", "ага", "угу", "конечно", "верно", "ок", "окей", "подтверждаю", "подтвердить",
  "подтверждено", "подтверждаем", "оформляй", "оформляйте", "оформляем", "оформляю", "оформим",
  "оформи", "оформить", "давай", "давайте", "погнали", "годится", "договорились", "пойдет", "беру",
  "заказывай", "заказываю", "заказываем", "хорошо", "отлично", "супер", "класс", "все", "точно", "именно",
  "иа", "иә", "ия", "жарайды", "болды", "макул", "мақул", "дурыс",
  "yes", "yeah", "ok", "okay", "confirm",
]);
// Вежливость/филлеры — допустимы рядом с подтверждением, но САМИ по себе подтверждением не являются
// («спасибо» в одиночку ≠ «оформляем»).
const FILLER_WORDS = new Set(["спасибо", "пожалуйста", "плиз", "please", "рахмет", "благодарю"]);

// Сигналы «вырваться из шага оформления»: назад/меню/каталог/добавить ещё/передумал/
// поменять/отмена/подожди/менеджер. В шагах адрес/интервал/финал это НЕ ответ на
// текущий вопрос — значит клиент хочет вернуться к диалогу. Отдаём агенту: он поймёт
// нюанс («назад»→продолжить, «отмени»→отмена, «добавь X»→добавить, «менеджер»→handoff).
// Без \b — в JS \b не работает с кириллицей. Матчим по подстрокам/явным формам
// (формы «верну/верни…» вместо «верн», чтобы не задеть «верно» = подтверждение).
const ESCAPE_RE =
  /(наза[дн]|верну|верни|верня|вернут|в начал|снача|заново|меню|катал|добав|дозаказ|докуп|еще|переду[мй]ал|отмен|стоп|стой|подожд|погоди|секунд|минут|поменя|замен|измен|не надо|не хочу|не буду|не готов|не оформл|не давал|не заказыв|не просил|ошибк|хватит|покажи|что есть|а есть|менеджер|человек|оператор|помощ)/;

/** Похоже ли сообщение на «выход» из шага оформления (навигация/добавление/отмена/менеджер). */
function isCheckoutEscape(text: string): boolean {
  return ESCAPE_RE.test(text.toLowerCase().replace(/ё/g, "е"));
}

/**
 * true, если сообщение — подтверждение: есть хотя бы одно слово-подтверждение, а всё
 * остальное — вежливость. Любое постороннее слово (товар/улица/число: «убери»,
 * «сатпаева», «90») делает его НЕ подтверждением → уходит агенту/валидации адреса.
 * Голый «+»/эмодзи-лайк тоже считаем подтверждением.
 */
function isConfirmation(text: string): boolean {
  const raw = text.trim();
  if (/^[+👍✅🆗\s]+$/u.test(raw) && /[+👍✅🆗]/u.test(raw)) return true;
  const tokens = raw
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0 || tokens.length > 6) return false;
  let hasConfirm = false;
  for (const t of tokens) {
    if (CONFIRM_WORDS.has(t)) hasConfirm = true;
    else if (!FILLER_WORDS.has(t)) return false; // постороннее слово → не подтверждение
  }
  return hasConfirm;
}

const GREET_GAP_MS = 6 * 60 * 60 * 1000;

// После передачи менеджеру бот молчит, но НЕ вечно: через 15 минут авто-возобновляет
// ответы (владелец, уточнение к Q84). Отсчёт — от lastActivityMs (момент хендофа): в
// режиме молчания входящие выходят раньше сохранения, поэтому lastActivityMs остаётся
// временем передачи, и окно НЕ сбрасывается, даже если клиент продолжает писать.
const HANDOFF_RESUME_MS = 15 * 60 * 1000;

// Память диалога: сколько ходов и по сколько символов держим в context (анти-раздувание JSONB/токенов).
const HISTORY_MAX_TURNS = 12;
const HISTORY_TEXT_CAP = 400;

/** Компактный рендер истории для промпта агента. */
function renderHistory(history: HistoryTurn[]): string {
  return history
    .map((t) => `${t.role === "user" ? "Клиент" : "Ассистент"}: ${t.text}`)
    .join("\n");
}

/** Дописать обмен (клиент → ассистент) в историю с обрезкой длины и числа ходов. */
function appendExchange(history: HistoryTurn[], userText: string, botText: string): HistoryTurn[] {
  return [
    ...history,
    { role: "user" as const, text: userText.slice(0, HISTORY_TEXT_CAP) },
    { role: "bot" as const, text: botText.slice(0, HISTORY_TEXT_CAP) },
  ].slice(-HISTORY_MAX_TURNS);
}

/** Сводка корзины С id — чтобы агент адресовал remove/set по реальному productId. */
function buildCartSummary(view: CartView): string {
  return view.lines.map((l) => `id=${l.productId} ${l.name} ×${l.qty}`).join("; ");
}

/** Уникальные категории каталога (для детерминированного приветствия при сбое LLM). */
function catalogCategories(products: Product[]): string[] {
  const seen = new Set<string>();
  const cats: string[] = [];
  for (const p of products) {
    const cat = p.category?.name ?? p.subcategory ?? "";
    if (cat && !seen.has(cat)) {
      seen.add(cat);
      cats.push(cat);
    }
  }
  return cats.slice(0, 6);
}

/** Главный обработчик входящего сообщения клиента. Все эффекты — через deps. */
export async function handleIncomingMessage(
  msg: NormalizedIncomingMessage,
  deps: OrchestratorDeps,
): Promise<void> {
  // Менеджерский групповой чат — не наш путь (обрабатывает существующий бот).
  if (msg.isManagerChat) return;

  const nowMs = deps.now();
  const nowIso = new Date(nowMs).toISOString();

  const existing = await deps.dialog.get(msg.chatId).catch(() => null);
  const phone = msg.phone || existing?.phone || null;

  // Берём per-chat лок ПЕРВЫМ делом. Порядок критичен: раньше dedup (markProcessed) стоял
  // ДО лока, и при промахе лока (параллельное сообщение того же чата держит 30-сек lease)
  // обработчик выходил, а messageId уже был помечен обработанным → ретрай Green API тоже
  // отсекался, и сообщение клиента терялось навсегда. Теперь dedup помечаем только ПОД локом.
  if (!existing) {
    await deps.dialog.save(msg.chatId, { state: "idle", context: {}, phone }, nowIso).catch(() => {});
  }
  const lockToken = crypto.randomUUID();
  const leaseIso = new Date(nowMs + 30_000).toISOString();
  const locked = await deps.dialog.acquireLock(msg.chatId, lockToken, nowIso, leaseIso).catch(() => false);
  if (!locked) return; // другое сообщение уже обрабатывается — dedup НЕ трогаем, ретрай переобработает

  try {
    // 1) Идемпотентность: повторный webhook с тем же messageId игнорируем — но уже ПОД локом,
    // поэтому промах лока выше не «сжигает» слот dedup.
    const fresh = await deps.dedup
      .markProcessed(msg.messageId, { chatId: msg.chatId, kind: msg.kind })
      .catch(() => true);
    if (!fresh) return;

    let state: DialogState = existing?.state ?? "idle";
    let context: DialogContext = existing?.context ?? {};
    const senderName = msg.profileName ?? null;

    // Передан менеджеру — бот молчит. Но не вечно: через час авто-возобновляем ответы (Q84).
    if (isBotSuppressed(state)) {
      const sinceHandoffMs = nowMs - (existing?.lastActivityMs ?? 0);
      if (sinceHandoffMs < HANDOFF_RESUME_MS) {
        console.info("[whatsapp:nl] suppressed (human_handoff)", { chat: msg.chatId.slice(0, 6) });
        return;
      }
      // Час прошёл — снова отвечаем: сбрасываем в idle и обрабатываем сообщение штатно
      // (корзину/память НЕ трогаем — клиент может продолжить с того же места).
      console.info("[whatsapp:nl] handoff auto-resume", { chat: msg.chatId.slice(0, 6) });
      state = "idle";
      await deps.dialog.save(msg.chatId, { state: "idle", context, phone }, nowIso).catch(() => {});
    }

    // TTL сессии (60 мин): не продолжаем старое оформление молча.
    const stale =
      existing &&
      nowMs - existing.lastActivityMs > LIMITS.cartSessionTtlMs &&
      state !== "idle" &&
      state !== "order_submitted";
    if (stale) {
      // Корзину тоже очищаем: иначе после «сессия истекла» старые позиции остаются и
      // клиент видит несуществующий заказ (рассинхрон TTL диалога и корзины).
      await deps.cart.clear(msg.chatId).catch(() => {});
      await deps.dialog.save(msg.chatId, { state: "expired", context: {}, phone }, nowIso).catch(() => {});
      await deps.send(msg.chatId, M.MSG_EXPIRED);
      return;
    }

    const persist = (s: DialogState, c: DialogContext) => {
      state = s;
      context = c;
      return deps.dialog.save(msg.chatId, { state: s, context: c, phone }, nowIso);
    };
    const reply = (text: string) => deps.send(msg.chatId, text);

    // 2) Получить текст: голос → guard+transcribe; вложение → отказ; иначе текст.
    let text: string;
    if (msg.kind === "unsupported") {
      // B2B часто присылает заявку файлом/фото. Прочитать не можем, но заказ НЕ теряем:
      // заводим лид и зовём менеджера обработать вложение вручную (иначе — тихий отказ).
      await reply(M.MSG_ATTACHMENT);
      // createLead сам зовёт менеджера богатым сообщением (причина = вложение); отдельный
      // 📎-пинг убран, чтобы не было дубля уведомления на один и тот же случай.
      await createLead("unsupported_attachment", "[вложение]");
      return;
    }
    if (msg.kind === "location") {
      await handleLocation(msg.location);
      return;
    }
    if (msg.kind === "voice") {
      const media = await deps.voice.download(msg.voice ?? {}).catch(() => null);
      const guard = media
        ? guardAudio({
            bytes: media.bytes,
            mimeType: media.mimeType,
            durationSeconds: msg.voice?.durationSeconds ?? null,
          })
        : ({ ok: false, reason: "download_failed" } as const);
      if (!guard.ok) {
        await deps.voice
          .store({
            chatId: msg.chatId,
            phone,
            messageId: msg.messageId,
            mimeType: msg.voice?.mimeType ?? null,
            sizeBytes: media?.bytes.byteLength ?? null,
            durationSeconds: msg.voice?.durationSeconds ?? null,
            status: "rejected",
            rejectReason: guard.reason,
          })
          .catch(() => {});
        await reply(guard.reason === "too_long" ? M.MSG_VOICE_TOO_LONG : M.MSG_VOICE_BAD);
        return;
      }
      const tr = await deps
        .transcribe({ bytes: media!.bytes, mimeType: media!.mimeType ?? "audio/ogg" })
        .catch(() => null);
      if (!tr || !tr.text.trim()) {
        await deps.voice
          .store({
            chatId: msg.chatId,
            phone,
            messageId: msg.messageId,
            mimeType: media!.mimeType,
            sizeBytes: media!.bytes.byteLength,
            durationSeconds: msg.voice?.durationSeconds ?? null,
            status: "rejected",
            rejectReason: "empty_transcript",
          })
          .catch(() => {});
        await reply(M.MSG_VOICE_BAD);
        return;
      }
      await deps.voice
        .store({
          chatId: msg.chatId,
          phone,
          messageId: msg.messageId,
          mimeType: media!.mimeType,
          sizeBytes: media!.bytes.byteLength,
          durationSeconds: msg.voice?.durationSeconds ?? null,
          status: "transcribed",
          transcript: tr.text,
          lang: tr.lang,
        })
        .catch(() => {});
      text = tr.text;
    } else if (msg.kind === "image" || msg.kind === "document") {
      // Фото/документ: скачиваем доверенно → проверяем формат/размер → читаем (OCR/exceljs).
      // Не смогли — не теряем заказ: зовём менеджера (как с нечитаемым голосовым/вложением).
      const media = await deps.media.download(msg.media ?? {}).catch(() => null);
      const guard = media
        ? guardMedia({
            bytes: media.bytes,
            mimeType: msg.media?.mimeType ?? media.mimeType,
            fileName: msg.media?.fileName ?? null,
            maxBytes: LIMITS.maxMediaBytes,
          })
        : ({ ok: false, reason: "download_failed" } as const);
      if (!guard.ok) {
        await reply(M.MSG_MEDIA_BAD);
        await createLead("unreadable_media", "[файл]");
        return;
      }
      const read = await deps.media
        .read({ bytes: media!.bytes, mimeType: media!.mimeType, fileName: msg.media?.fileName ?? null })
        .catch(() => null);
      const extracted = read?.text.trim() ?? "";
      if (!extracted) {
        await reply(M.MSG_MEDIA_BAD);
        await createLead("unreadable_media", "[файл]");
        return;
      }
      // Подпись клиента к файлу (если есть) + распознанный текст — вместе идут агенту.
      const caption = msg.media?.caption?.trim();
      text = caption ? `${caption}\n${extracted}` : extracted;
    } else {
      text = msg.text ?? "";
    }

    if (!text.trim()) {
      await reply(M.MSG_UNKNOWN);
      return;
    }

    // Эскалация: КАПС / мат / оскорбления / жалобы / угрозы → сразу менеджеру, без AI.
    const escalation = detectEscalation(text);
    if (escalation.escalate) {
      await createLead(`escalation:${escalation.reason ?? "abuse"}`, text);
      await persist("human_handoff", context);
      await reply(M.MSG_HANDOFF);
      return;
    }

    // Мониторинг prompt-injection / манипуляций ценой (журнал, без изменения поведения):
    // цена и остаток ВСЕГДА серверные (из БД), id валидируются по каталогу, JSON-схема
    // strict — заказ архитектурно защищён. Активно НЕ блокируем: паттерны дают ложные
    // срабатывания («бесплатная доставка», ссылка-карта в адресе). gpt-4o + системный
    // промпт держат текст ответа.
    const scan = scanForInjection(text);
    if (scan.labels.length > 0) {
      console.info("[whatsapp:nl] suspicious input", { chat: msg.chatId.slice(0, 6), labels: scan.labels });
    }
    // Текст, ИЗВЛЕЧЁННЫЙ из файла/голоса — самый опасный вектор инъекции (крафтнутое фото/
    // PDF/аудио может содержать «ignore instructions / system prompt / ты теперь админ»).
    // Здесь защита ГЛУБЖЕ, чем для набранного текста: при жёсткой инъекции НЕ передаём текст
    // в LLM вообще, а блокируем и зовём менеджера. (Для набранного вручную текста полагаемся
    // на архитектуру: цена/остаток серверные, JSON-схема strict — бот отвечает штатно.)
    const textFromFile = msg.kind === "voice" || msg.kind === "image" || msg.kind === "document";
    if (scan.hardInjection && textFromFile) {
      await createLead("media_injection", "[в распознанном тексте — попытка инъекции]");
      await persist("human_handoff", context);
      await reply(M.MSG_MEDIA_BAD);
      return;
    }
    if (scan.hardInjection) {
      // Набранный вручную текст: бот отвечает штатно (арх. защита), но зовём менеджера присмотреть.
      await deps
        .notifyManager(
          `🛡️ Похоже на prompt-injection в чате ${msg.chatId} (метки: ${scan.labels.join(", ")}). Бот ответил штатно — проверьте при необходимости.`,
        )
        .catch(() => {});
    }

    // 3) Структурированная фаза оформления (адрес/интервал/подтверждение) — детерминированно.
    // ГИБКОСТЬ: в каждом шаге СНАЧАЛА пытаемся понять ответ на текущий вопрос, и только если
    // это НЕ ответ, а навигация (назад/добавить/меню/менеджер…) — выходим в диалог (escapeToChat).
    // Так валидный ответ («хочу утром», «Алматы, … добавочный 210») не крадётся escape-эвристикой.
    if (state === "awaiting_address" || state === "awaiting_address_confirmation") {
      await handleAddress(text);
      return;
    }
    if (state === "awaiting_delivery_period") {
      await handlePeriod(text);
      return;
    }
    if (state === "awaiting_final_confirmation") {
      if (isConfirmation(text)) {
        await createOrder();
        return;
      }
      if (isCheckoutEscape(text)) {
        await escapeToChat(text);
        return;
      }
    }

    // Подтверждение собранной корзины («да» после ПОКАЗАННОЙ карточки корзины) → к адресу.
    // Только в awaiting_cart_confirmation (карточка реально показана и обещала «да — оформим»);
    // в обычном building_cart «давай»/«ок» может отвечать на другой вопрос — тогда решает агент.
    if (state === "awaiting_cart_confirmation" && isConfirmation(text)) {
      const products = await deps.catalog.getProducts();
      const { view } = await deps.cart.load(msg.chatId, products);
      if (view.lines.length > 0) {
        await goToAddress();
        return;
      }
      // Корзина опустела (изменился остаток) — не роняем «да» в общий диалог.
      await persist("building_cart", {});
      await reply(M.MSG_EMPTY_AFTER_POLICY);
      return;
    }

    // 4) Разговорная фаза — LLM-агент (диалог, вопросы по каталогу, сбор корзины, оформление).
    await runAgent(text);
    return;

    // ——— вложенные хелперы (замыкание на deps/persist/reply/context) ———

    async function createLead(
      reason: string,
      lastText: string,
      extra?: { botAnswered?: string | null; mood?: string | null; why?: string | null; urgent?: boolean },
    ) {
      const items = await deps.cart.getItems(msg.chatId).catch(() => [] as CartItemQty[]);
      await deps.lead
        .upsertDraft({
          chatId: msg.chatId,
          phone,
          cart: items,
          address: context.address ?? null,
          period: context.period ?? null,
          stage: state,
          reason,
          transcript: msg.kind === "voice" ? lastText : null,
        })
        .catch(() => {});
      // Богатое уведомление менеджеру: номер клиента, что хотел, что ответил бот, почему
      // не решилось, настроение одним словом и флаг «горит». Значения от LLM (extra) в
      // приоритете над дефолтами по причине (describeLeadReason).
      const d = describeLeadReason(reason);
      const message = buildEscalationMessage({
        chatId: msg.chatId,
        clientPhone: phone,
        clientWanted: lastText,
        botAnswered: extra?.botAnswered ?? null,
        reason,
        whyUnresolved: extra?.why || d.why,
        mood: extra?.mood ?? d.mood,
        urgent: extra?.urgent ?? d.urgent,
      });
      await deps.notifyManager(message).catch(() => {});
    }

    // Выход из шага оформления обратно в диалог: корзину сохраняем, адрес/интервал сбрасываем,
    // отдаём сообщение агенту (он поймёт «назад»/«добавь X»/«отмени»/«менеджер»).
    async function escapeToChat(userText: string) {
      await persist("building_cart", {
        ...context,
        address: undefined,
        period: undefined,
        savedAddresses: undefined,
      });
      await runAgent(userText);
    }

    async function runAgent(userText: string) {
      const products = await deps.catalog.getProducts();
      const { view: beforeView } = await deps.cart.load(msg.chatId, products);
      const cartSummary = buildCartSummary(beforeView);
      const history = context.history ?? [];
      const shouldGreet = !existing || nowMs - existing.lastActivityMs > GREET_GAP_MS;
      // Клиент был на финальном подтверждении (адрес+интервал уже собраны). Если он вместо
      // «да» правит корзину / спрашивает — НЕ выкидываем из оформления и не переспрашиваем адрес.
      const wasFinalConfirm = state === "awaiting_final_confirmation";

      const out = await deps.agent.respond({
        message: userText,
        catalogContext: buildCatalogContext(products),
        validProductIds: catalogProductIds(products),
        cartSummary,
        history: renderHistory(history),
        shouldGreet,
      });

      // Деградация LLM (недоступен/мусор): мягкий фолбэк — приветствие на первом контакте,
      // иначе «тех. неполадки». НИКОГДА не «перечислите товары».
      if (out.degraded) {
        const fallback = shouldGreet ? M.formatGreeting(catalogCategories(products)) : M.MSG_TEMPORARY_ISSUE;
        await persist(state, { ...context, history: appendExchange(history, userText, fallback) });
        await reply(fallback);
        return;
      }

      if (out.intent === "cancel") {
        await deps.cart.clear(msg.chatId).catch(() => {});
        await persist("cancelled", {});
        await reply(out.reply || M.MSG_CANCELLED);
        return;
      }
      if (out.intent === "handoff") {
        await createLead("agent_handoff", userText, {
          botAnswered: out.reply || null,
          mood: out.mood || null,
          why: out.handoffReason || null,
          urgent: urgencyFromText(userText),
        });
        await persist("human_handoff", { ...context, history: appendExchange(history, userText, out.reply || M.MSG_HANDOFF) });
        await reply(out.reply || M.MSG_HANDOFF);
        return;
      }
      if (out.intent === "repeat_order") {
        if (out.reply) await reply(out.reply);
        await repeatOrder();
        return;
      }

      // Действия с корзиной — сервер валидирует id, клэмпит остаток, ставит цену.
      let view = beforeView;
      let adjustments: CartAdjustment[] = [];
      // Детерминированная очистка: модель ставит clearCart, сервер реально опустошает
      // корзину (надёжнее, чем remove по каждой позиции — LLM их путал/пропускал).
      if (out.clearCart) {
        await deps.cart.clear(msg.chatId).catch(() => {});
        view = { lines: [], itemsTotal: 0, delivery: 0, grandTotal: 0 };
      }
      if (out.cartActions.length > 0) {
        const ops: CartOp[] = out.cartActions.map((a) => ({
          productId: a.productId,
          qty: a.quantity,
          operation: a.operation,
        }));
        const res = await deps.cart.apply(msg.chatId, { phone, senderName }, ops, products);
        view = res.view;
        adjustments = res.adjustments;
      }

      if (out.intent === "checkout" && !wasFinalConfirm) {
        // Готов оформлять только если в корзине что-то есть — иначе продолжаем диалог.
        if (view.lines.length > 0) {
          if (out.reply) await reply(out.reply);
          await goToAddress();
          return;
        }
      }

      // Правка/вопрос на шаге финального подтверждения: остаёмся в оформлении, отвечаем и
      // ЗАНОВО показываем финальную сводку (адрес/интервал не переспрашиваем). Следующее «да»
      // создаст заказ. Если корзину опустошили — падаем в обычную ветку (уйдём в idle).
      if (wasFinalConfirm && view.lines.length > 0) {
        const nameById = new Map(view.lines.map((l) => [l.productId, l.name]));
        const summary = M.formatFinalSummary({
          view,
          address: context.address ?? "—",
          period: context.period ? M.periodLabel(context.period) : "—",
          phone: phone ?? "—",
        });
        const parts = [out.reply || null, M.formatAdjustments(adjustments, nameById), summary].filter(
          (p): p is string => Boolean(p),
        );
        const replyText = parts.join("\n\n");
        await persist("awaiting_final_confirmation", {
          ...context,
          history: appendExchange(history, userText, replyText),
        });
        await reply(replyText);
        return;
      }

      // Обычный диалог: ответ агента + (при изменении/показе) серверная корзина с реальной суммой.
      const nameById = new Map(view.lines.map((l) => [l.productId, l.name]));
      const showCart = (out.showCart || out.cartActions.length > 0) && view.lines.length > 0;
      // Очистили корзину, но модель не дала текст — явно сообщим об очистке.
      const clearedNote = out.clearCart && !out.reply ? "Очистил корзину." : null;
      const parts = [
        out.reply || clearedNote,
        M.formatAdjustments(adjustments, nameById),
        showCart ? M.formatCart(view) : null,
      ].filter((p): p is string => Boolean(p));

      // Пусто (модель вернула пустой reply без действий): не «нет товаров», а мягко —
      // приветствие на первом контакте, иначе уточнение.
      const replyText =
        parts.length > 0
          ? parts.join("\n\n")
          : shouldGreet
            ? M.formatGreeting(catalogCategories(products))
            : M.MSG_CLARIFY;

      // Показали карточку корзины («да — оформим») → awaiting_cart_confirmation: следующее «да»
      // детерминированно ведёт к оформлению. Q&A-ход без карточки (showCart=false) при непустой
      // корзине → building_cart (там «да»/«давай» может отвечать на вопрос — решает агент).
      const nextState =
        view.lines.length === 0 ? "idle" : showCart ? "awaiting_cart_confirmation" : "building_cart";
      await persist(nextState, { ...context, history: appendExchange(history, userText, replyText) });
      await reply(replyText);
    }

    async function goToAddress() {
      const products = await deps.catalog.getProducts();
      const { view } = await deps.cart.load(msg.chatId, products);
      if (view.lines.length === 0) {
        await persist("building_cart", context);
        await reply(M.MSG_EMPTY_AFTER_POLICY);
        return;
      }
      // Гейт минимальной суммы заказа: ниже минимума в оформление не пускаем — просим добрать.
      if (view.itemsTotal < MIN_ORDER_AMOUNT) {
        await persist("building_cart", context);
        await reply(M.belowMinimum(view.itemsTotal));
        return;
      }
      // Существующий клиент с сохранёнными адресами — предлагаем выбрать номером.
      const profile = await deps.profile.get(msg.chatId).catch(() => null);
      const saved = (profile?.addresses ?? [])
        .filter((a): a is string => Boolean(a && a.trim()))
        .slice(0, 5);
      if (saved.length > 0) {
        await persist("awaiting_address", { ...context, savedAddresses: saved });
        await reply(M.askAddressWithSaved(saved));
        return;
      }
      await persist("awaiting_address", context);
      await reply(M.askAddress());
    }

    async function handleLocation(loc: IncomingLocationRef | undefined) {
      if (!loc || !isValidLatLng(loc.latitude, loc.longitude)) {
        await reply("Не удалось разобрать геолокацию. Напишите адрес доставки текстом.");
        return;
      }
      const label = [loc.name, loc.address].map((s) => s?.trim()).filter(Boolean).join(", ") || null;
      const geo = { lat: loc.latitude, lng: loc.longitude, label };
      if (state === "awaiting_address" || state === "awaiting_address_confirmation") {
        // Геометка точнее текста — принимаем как адрес и сразу спрашиваем интервал (без шага подтверждения).
        await persist("awaiting_delivery_period", { ...context, geo, address: label ?? "Геолокация (см. карту)" });
        await reply(`Принял геолокацию. ${M.askDeliveryPeriod()}`);
        return;
      }
      // Вне шага адреса: запоминаем геометку и мягко ведём к заказу.
      await persist(state, { ...context, geo });
      await reply("Спасибо, вижу вашу геолокацию — учту при доставке. Что хотите заказать?");
    }

    async function handleAddress(rawText: string) {
      const trimmed = rawText.trim();
      // Подтверждение ранее показанного адреса — только если сообщение это ТОЛЬКО «да»
      // (иначе внутри исправленный адрес — его надо перепроверить, а не подтвердить старый).
      if (state === "awaiting_address_confirmation" && isConfirmation(trimmed)) {
        await persist("awaiting_delivery_period", context);
        await reply(M.askDeliveryPeriod());
        return;
      }

      // Выбор сохранённого адреса номером (1..N), иначе — адрес из сообщения.
      const saved = context.savedAddresses ?? [];
      // Чистая цифра при наличии сохранённых адресов — это выбор номера. Вне диапазона —
      // подсказываем, а не трактуем «4» как текст адреса.
      if (/^\d+$/.test(trimmed) && saved.length > 0) {
        const n = Number(trimmed);
        if (n < 1 || n > saved.length) {
          await persist("awaiting_address", { ...context, savedAddresses: saved });
          await reply(`Адреса №${n} нет. Выберите 1–${saved.length} или напишите адрес.`);
          return;
        }
      }
      const pick = /^\d+$/.test(trimmed) ? Number(trimmed) : 0;
      const addrText = pick >= 1 && pick <= saved.length ? saved[pick - 1] : rawText;

      const res = await deps.address.validate(addrText);
      if (res.status === "outside_almaty") {
        await createLead("delivery_outside_almaty", rawText);
        await persist("human_handoff", context);
        await reply(M.addressOutsideAlmaty());
        return;
      }
      if (res.status === "uncertain") {
        // Навигация (назад/меню/добавить/менеджер…) — выходим в диалог.
        if (isCheckoutEscape(rawText)) {
          await escapeToChat(rawText);
          return;
        }
        // Слишком короткое/мусор — переспрашиваем. Но нормальный адрес без явного
        // «Алматы» (reason no_city_marker) ПРИНИМАЕМ как адрес по Алматы: доставка
        // только по Алматы, клиенты пишут просто улицу; менеджер сверит на подтверждении.
        if (res.reason === "too_short_or_empty") {
          await persist("awaiting_address", context);
          await reply(M.addressUncertain());
          return;
        }
        // Принимаем как адрес по Алматы, только если это ПОХОЖЕ на адрес: есть цифра
        // (номер дома) или несколько слов. Набор букв без структуры («абвгдежзи») —
        // переспрашиваем, а не создаём заказ с мусорным адресом.
        const almatyAddr = addrText.trim();
        if (!/\d/.test(almatyAddr) && !/\s/.test(almatyAddr)) {
          await persist("awaiting_address", context);
          await reply(M.addressUncertain());
          return;
        }
        await persist("awaiting_address_confirmation", { ...context, address: almatyAddr });
        await reply(M.confirmAddress(almatyAddr));
        return;
      }
      // Координаты от геокодера (если есть) → точная 2ГИС-точка в заявке даже для текстового адреса.
      const geo =
        res.lat != null && res.lon != null
          ? { lat: res.lat, lng: res.lon, label: res.normalized }
          : context.geo;
      await persist("awaiting_address_confirmation", { ...context, address: res.normalized, geo });
      await reply(M.confirmAddress(res.normalized));
    }

    async function handlePeriod(rawText: string) {
      const period = parsePeriodFromText(rawText);
      if (!period) {
        // Не интервал: навигация (назад/меню/менеджер…) → выходим в диалог; иначе переспрашиваем.
        if (isCheckoutEscape(rawText)) {
          await escapeToChat(rawText);
          return;
        }
        await persist("awaiting_delivery_period", context);
        await reply(M.askDeliveryPeriod());
        return;
      }
      const products = await deps.catalog.getProducts();
      const { view } = await deps.cart.load(msg.chatId, products);
      if (view.lines.length === 0) {
        await persist("building_cart", {});
        await reply(M.MSG_EMPTY_AFTER_POLICY);
        return;
      }
      await persist("awaiting_final_confirmation", { ...context, period });
      await reply(
        M.formatFinalSummary({
          view,
          address: context.address ?? "—",
          period: M.periodLabel(period),
          phone: phone ?? "—",
        }),
      );
    }

    async function repeatOrder() {
      if (!phone) {
        await reply(M.MSG_UNKNOWN);
        return;
      }
      const items = await deps.history.lastOrderItems(phone).catch(() => null);
      if (!items || items.length === 0) {
        await reply("Не нашёл прошлых заказов. Напишите новый список товаров.");
        await persist("building_cart", {});
        return;
      }
      const products = await deps.catalog.getProducts();
      const { view, adjustments } = await deps.cart.setItems(msg.chatId, { phone, senderName }, items, products);
      const nameById = new Map(view.lines.map((l) => [l.productId, l.name]));
      const parts = [
        "Собрал по прошлому заказу (цены и наличие — актуальные):",
        M.formatAdjustments(adjustments, nameById),
        M.formatCart(view),
      ].filter((p): p is string => Boolean(p));
      await persist("awaiting_cart_confirmation", context);
      await reply(parts.join("\n\n"));
    }

    async function createOrder() {
      const products = await deps.catalog.getProducts();
      const productById = new Map(products.map((p) => [p.id, p]));
      const { view, adjustments } = await deps.cart.load(msg.chatId, products);

      if (view.lines.length === 0) {
        await persist("building_cart", {});
        await reply(M.MSG_EMPTY_AFTER_POLICY);
        return;
      }
      // Без телефона заказ не создаём (иначе осиротевший заказ без client_id, невидимый
      // кредит-системе) — передаём менеджеру.
      if (!phone) {
        await createLead("missing_phone", text);
        await persist("human_handoff", context);
        await reply(M.MSG_HANDOFF);
        return;
      }
      // Изменилось наличие перед созданием — показываем и просим подтвердить заново.
      if (adjustments.length > 0) {
        const nameById = new Map(view.lines.map((l) => [l.productId, l.name]));
        await persist("awaiting_final_confirmation", context);
        await reply(
          [M.formatAdjustments(adjustments, nameById), M.formatCart(view)]
            .filter((p): p is string => Boolean(p))
            .join("\n\n"),
        );
        return;
      }

      const profile = await deps.profile.get(msg.chatId).catch(() => null);
      const items = view.lines
        .map((l) => ({ product: productById.get(l.productId)!, qty: l.qty }))
        .filter((i) => i.product);

      if (phone) {
        await deps.consent
          .record({ phone, chatId: msg.chatId, version: CONSENT_VERSION, messageId: msg.messageId, acceptedAtIso: nowIso })
          .catch(() => {});
      }

      // Геометка клиента → 2ГИС-ссылка на точку в комментарии заявки (менеджер откроет карту).
      const geoLink = context.geo ? build2gisPointLink(context.geo.lat, context.geo.lng) : null;
      const created = await deps.order
        .create({
          chatId: msg.chatId,
          phone,
          items,
          companyName: profile?.companyName ?? "WhatsApp клиент",
          customerName: profile?.customerName ?? senderName ?? "WhatsApp клиент",
          customerBin: profile?.customerBin ?? null,
          customerEmail: profile?.customerEmail ?? null,
          deliveryAddress: context.address ?? "",
          deliveryDate: tomorrowDate(nowMs),
          deliveryTime: context.period ? M.periodLabel(context.period) : "Договориться с менеджером",
          comment: geoLink ? `📍 Геометка (2ГИС): ${geoLink}` : null,
          ofertaAcceptedAtIso: nowIso,
          idempotencyKey: `wa:${msg.messageId}`,
        })
        .catch(() => null);

      // Ошибка создания заказа: НЕ оставляем на awaiting_final_confirmation (повторное «да»
      // создало бы ДУБЛЬ) и НЕ чистим корзину — передаём менеджеру.
      if (!created) {
        await createLead("order_create_failed", text);
        await persist("human_handoff", context);
        await reply(M.MSG_HANDOFF);
        return;
      }

      await deps.cart.clear(msg.chatId).catch(() => {});
      await persist("order_submitted", {});
      const confirmSent = await reply(M.formatOrderCreated(created.orderNumber));
      if (!confirmSent) {
        // Критичный шаг: заказ СОЗДАН, но подтверждение НЕ доставлено клиенту (Green API молчит
        // даже после ретрая). Эскалируем менеджеру — иначе заказ висит, а клиент об этом не знает.
        await deps
          .notifyManager(
            `⚠️ Заказ ${created.orderNumber} создан, но подтверждение НЕ доставлено клиенту (чат ${msg.chatId}). Свяжитесь вручную.`,
          )
          .catch(() => {});
      }

      // Новый клиент (профиль не заполнен) — одноразовая ссылка для дозаполнения на сайте.
      const isNewClient = !profile?.companyName || profile.companyName === "WhatsApp клиент";
      if (isNewClient && phone && deps.registration) {
        const link = await deps.registration.createLink(phone, nowMs).catch(() => null);
        if (link) await reply(M.formatRegistrationLink(link));
      }
    }
  } finally {
    await deps.dialog.releaseLock(msg.chatId, lockToken).catch(() => {});
  }
}
