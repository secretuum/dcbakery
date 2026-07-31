// Оркестратор диалога оформления заказа. Связывает всё: dedup → lock → TTL →
// state-machine → (голос: guard+transcribe) → intent → policy → классификация →
// корзина → адрес → интервал → создание заявки. Все внешние эффекты — через
// инъектируемые порты (OrchestratorDeps), поэтому модуль ЧИСТЫЙ и тестируется
// фейками (без реальных Green API/Telegram/OpenAI/Supabase). Тип CreateOrderInput
// импортируется как type (стирается — server-only не подтягивается).

import type { Product } from "@/src/types";
import type { NormalizedIncomingMessage, IncomingVoiceRef } from "../transport/types";
import type { DialogState } from "../state/machine";
import { isBotSuppressed } from "../state/machine";
import type { OrderIntent } from "../intent/schema";
import { enforcePolicy } from "../policy/policy";
import { classifyItem } from "../match/matcher";
import type { CartView, CartItemQty, CartOp, CartAdjustment } from "../cart/cart-math";
import { guardAudio } from "../ai/audio-guard";
import type { CreateOrderInput } from "../order/create-order";
import { LIMITS, CONSENT_VERSION } from "../config";
import * as M from "./messages";

export type DialogContext = {
  clarifications?: Array<{ rawName: string; candidates: Array<{ id: string; name: string }> }>;
  retail?: string[];
  address?: string;
  period?: "morning" | "afternoon";
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
  intent: { extract(text: string): Promise<OrderIntent> };
  transcribe(input: { bytes: Uint8Array; mimeType: string }): Promise<{ text: string; lang?: string }>;
  address: {
    validate(text: string): Promise<{ status: "in_almaty" | "outside_almaty" | "uncertain"; normalized: string }>;
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
  order: { create(input: CreateOrderInput): Promise<{ orderId: string; orderNumber: string }> };
  history: { lastOrderItems(phone: string): Promise<CartItemQty[] | null> };
  profile: {
    get(chatId: string): Promise<{
      companyName?: string | null;
      customerName?: string | null;
      customerBin?: string | null;
      customerEmail?: string | null;
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
  send(chatId: string, text: string): Promise<void>;
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

/** Главный обработчик входящего сообщения клиента. Все эффекты — через deps. */
export async function handleIncomingMessage(
  msg: NormalizedIncomingMessage,
  deps: OrchestratorDeps,
): Promise<void> {
  // Менеджерский групповой чат — не наш путь (обрабатывает существующий бот).
  if (msg.isManagerChat) return;

  // 1) Идемпотентность: повторный webhook игнорируем.
  const fresh = await deps.dedup
    .markProcessed(msg.messageId, { chatId: msg.chatId, kind: msg.kind })
    .catch(() => true);
  if (!fresh) return;

  const nowMs = deps.now();
  const nowIso = new Date(nowMs).toISOString();

  const existing = await deps.dialog.get(msg.chatId).catch(() => null);
  let state: DialogState = existing?.state ?? "idle";
  let context: DialogContext = existing?.context ?? {};
  const phone = msg.phone || existing?.phone || null;
  const senderName = msg.profileName ?? null;

  // Передан менеджеру — бот молчит.
  if (isBotSuppressed(state)) return;

  // TTL сессии (60 мин): не продолжаем старое оформление молча.
  const stale =
    existing &&
    nowMs - existing.lastActivityMs > LIMITS.cartSessionTtlMs &&
    state !== "idle" &&
    state !== "order_submitted";
  if (stale) {
    await deps.dialog.save(msg.chatId, { state: "expired", context: {}, phone }, nowIso).catch(() => {});
    await deps.send(msg.chatId, M.MSG_EXPIRED);
    return;
  }

  // Гарантируем строку для лока (новый чат) и берём лок от параллельных сообщений.
  if (!existing) {
    await deps.dialog.save(msg.chatId, { state, context, phone }, nowIso).catch(() => {});
  }
  const lockToken = crypto.randomUUID();
  const leaseIso = new Date(nowMs + 30_000).toISOString();
  const locked = await deps.dialog.acquireLock(msg.chatId, lockToken, nowIso, leaseIso).catch(() => false);
  if (!locked) return; // другое сообщение уже обрабатывается

  const persist = (s: DialogState, c: DialogContext) => {
    state = s;
    context = c;
    return deps.dialog.save(msg.chatId, { state: s, context: c, phone }, nowIso);
  };
  const reply = (text: string) => deps.send(msg.chatId, text);

  try {
    // 2) Получить текст: голос → guard+transcribe; вложение → отказ; иначе текст.
    let text: string;
    if (msg.kind === "unsupported") {
      await reply(M.MSG_ATTACHMENT);
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
    } else {
      text = msg.text ?? "";
    }

    if (!text.trim()) {
      await reply(M.MSG_UNKNOWN);
      return;
    }

    // 3) Извлечь намерение (AI) → policy (недоверенные данные, манипуляции игнорируются).
    let rawIntent: OrderIntent | null;
    try {
      rawIntent = await deps.intent.extract(text.slice(0, LIMITS.maxInboundTextLength));
    } catch {
      rawIntent = null;
    }
    if (!rawIntent) {
      // Сбой AI → безопасный fallback на менеджера.
      await toHumanHandoff("ai_unavailable", text);
      return;
    }
    const { intent } = enforcePolicy(rawIntent, text);

    // 4) Глобальные намерения (в любом состоянии).
    if (intent.intent === "cancel") {
      await deps.cart.clear(msg.chatId).catch(() => {});
      await persist("cancelled", {});
      await reply(M.MSG_CANCELLED);
      return;
    }
    if (intent.intent === "human_help") {
      await toHumanHandoff("client_requested", text);
      return;
    }

    // 5) Маршрутизация по состоянию.
    if (state === "awaiting_address" || state === "awaiting_address_confirmation") {
      await handleAddress(intent, text);
      return;
    }
    if (state === "awaiting_delivery_period") {
      await handlePeriod(intent, text);
      return;
    }
    if (state === "awaiting_final_confirmation") {
      if (intent.confirmation || intent.intent === "confirm_delivery" || intent.intent === "confirm_cart") {
        await createOrder();
        return;
      }
      // Иначе трактуем как правку корзины.
      await buildCart(intent);
      return;
    }
    if (state === "awaiting_cart_confirmation") {
      if (intent.confirmation || intent.intent === "confirm_cart") {
        await goToAddress();
        return;
      }
      await buildCart(intent);
      return;
    }

    // 6) Прочие намерения по составу заказа.
    if (intent.intent === "repeat_order") {
      await repeatOrder();
      return;
    }
    if (intent.intent === "confirm_cart" || intent.confirmation) {
      // Подтверждение без корзины — покажем текущую/попросим товары.
      await goToAddress();
      return;
    }
    // new_order / cart_update / new_order_instead / unknown-с-товарами
    await buildCart(intent);
    return;

    // ——— вложенные хелперы (замыкание на deps/persist/reply/context) ———

    async function createLead(reason: string, lastText: string) {
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
      await deps.notifyManager(`Нужна помощь менеджера (WhatsApp). Причина: ${reason}. Чат: ${msg.chatId}`).catch(() => {});
    }

    async function toHumanHandoff(reason: string, lastText: string) {
      await createLead(reason, lastText);
      await persist("human_handoff", context);
      await reply(M.MSG_HANDOFF);
    }

    async function buildCart(orderIntent: OrderIntent) {
      const products = await deps.catalog.getProducts();
      const ops: CartOp[] = [];
      const retail: string[] = [];
      const clarifications: DialogContext["clarifications"] = [];

      for (const item of orderIntent.items) {
        const c = classifyItem(item.rawName, products, deps.retailKeywords);
        if (c.kind === "b2b" && c.product) {
          ops.push({ productId: c.product.id, qty: item.quantity, operation: item.operation });
        } else if (c.kind === "retail") {
          retail.push(item.rawName);
        } else {
          clarifications.push({
            rawName: item.rawName,
            candidates: c.candidates.map((x) => ({ id: x.product.id, name: x.product.name })),
          });
        }
      }

      if (ops.length === 0 && retail.length === 0 && clarifications.length === 0) {
        await reply(M.MSG_EMPTY_AFTER_POLICY);
        return;
      }

      const { view, adjustments } = await deps.cart.apply(msg.chatId, { phone, senderName }, ops, products);
      const nameById = new Map(view.lines.map((l) => [l.productId, l.name]));

      const parts = [
        M.formatAdjustments(adjustments, nameById),
        M.formatRetailNotice(retail, deps.retailUrl),
        M.formatClarifications(clarifications ?? []),
        M.formatCart(view),
      ].filter((p): p is string => Boolean(p));

      const nextState: DialogState =
        clarifications && clarifications.length > 0
          ? "awaiting_product_clarification"
          : view.lines.length > 0
            ? "awaiting_cart_confirmation"
            : "building_cart";
      await persist(nextState, { ...context, retail, clarifications });
      await reply(parts.join("\n\n"));
    }

    async function goToAddress() {
      const products = await deps.catalog.getProducts();
      const { view } = await deps.cart.load(msg.chatId, products);
      if (view.lines.length === 0) {
        await persist("building_cart", context);
        await reply(M.MSG_EMPTY_AFTER_POLICY);
        return;
      }
      await persist("awaiting_address", context);
      await reply(M.askAddress());
    }

    async function handleAddress(orderIntent: OrderIntent, rawText: string) {
      const looksConfirm =
        orderIntent.confirmation ||
        /^(да|ага|верно|ок|окей|подтвержда|все верно|всё верно)/.test(rawText.trim().toLowerCase());
      // Подтверждение ранее показанного адреса (в сообщении нет нового адреса).
      if (state === "awaiting_address_confirmation" && looksConfirm && !orderIntent.addressText) {
        await persist("awaiting_delivery_period", context);
        await reply(M.askDeliveryPeriod());
        return;
      }

      const addrText = orderIntent.addressText ?? rawText;
      const res = await deps.address.validate(addrText);
      if (res.status === "outside_almaty") {
        await createLead("delivery_outside_almaty", rawText);
        await persist("human_handoff", context);
        await reply(M.addressOutsideAlmaty());
        return;
      }
      if (res.status === "uncertain") {
        await persist("awaiting_address", context);
        await reply(M.addressUncertain());
        return;
      }
      await persist("awaiting_address_confirmation", { ...context, address: res.normalized });
      await reply(M.confirmAddress(res.normalized));
    }

    async function handlePeriod(orderIntent: OrderIntent, rawText: string) {
      const period = orderIntent.deliveryPeriod ?? parsePeriodFromText(rawText);
      if (!period) {
        await persist("awaiting_delivery_period", context);
        await reply(M.askDeliveryPeriod());
        return;
      }
      const products = await deps.catalog.getProducts();
      const { view } = await deps.cart.load(msg.chatId, products);
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
      await persist("awaiting_cart_confirmation", {});
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

      const created = await deps.order.create({
        chatId: msg.chatId,
        phone: phone ?? "",
        items,
        companyName: profile?.companyName ?? "WhatsApp клиент",
        customerName: profile?.customerName ?? senderName ?? "WhatsApp клиент",
        customerBin: profile?.customerBin ?? null,
        customerEmail: profile?.customerEmail ?? null,
        deliveryAddress: context.address ?? "",
        deliveryDate: tomorrowDate(nowMs),
        deliveryTime: context.period ? M.periodLabel(context.period) : "Договориться с менеджером",
        ofertaAcceptedAtIso: nowIso,
      });

      await deps.cart.clear(msg.chatId).catch(() => {});
      await persist("order_submitted", {});
      await reply(M.formatOrderCreated(created.orderNumber));
    }
  } finally {
    await deps.dialog.releaseLock(msg.chatId, lockToken).catch(() => {});
  }
}
