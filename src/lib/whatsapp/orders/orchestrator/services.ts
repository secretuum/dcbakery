import "server-only";
// Реальная сборка зависимостей оркестратора (порты → живые модули). Тестируемость
// сохранена: тесты подставляют фейки, прод — эти реализации. Ни один порт не тянет
// запретные зоны напрямую (заказ создаётся через order/create-order, который
// переиспользует insertOrderWithItems/уведомления — единые примитивы).

import type { OrchestratorDeps, DialogContext } from "./orchestrator";
import type { WhatsAppProvider } from "../transport/types";
import { fetchProducts } from "@/src/lib/catalog";
import {
  fetchClientOrderSummaries as _unused, // (оставлено для ясности: у summary нет product_id)
  fetchLatestWhatsAppOrderByPhone,
  fetchAdminOrderItems,
} from "@/src/lib/supabase/admin";
import { fetchWhatsAppClientByChatId } from "@/src/lib/whatsapp-client-store";
import { markMessageProcessed } from "../repo/dedup-repo";
import { getDialog, saveDialog, acquireDialogLock, releaseDialogLock } from "../repo/dialog-repo";
import { recordConsent, hasConsent } from "../repo/consent-repo";
import { upsertLeadDraft } from "../repo/lead-draft-repo";
import { insertVoiceMessage } from "../repo/voice-repo";
import { applyCartOps, loadCartView, setCartItems, getCartItems, clearCart } from "../cart/cart-service";
import { OpenAiIntentExtractor } from "../ai/intent-extractor";
import { OpenAiWhisperTranscriber } from "../ai/transcriber";
import { AlmatyHeuristicAddressProvider } from "../address/provider";
import { createOrderFromWhatsApp } from "../order/create-order";
import { createRegistrationLink } from "../registration/reg-link";
import { notifyManagersText } from "../notify/telegram-notify";
import { getRetailKeywords } from "../settings";

void _unused;

const RETAIL_URL = process.env.WHATSAPP_RETAIL_URL ?? "https://tap.delcappuccino.kz";

/** Собрать зависимости оркестратора для одного входящего сообщения. */
export async function buildOrchestratorDeps(provider: WhatsAppProvider): Promise<OrchestratorDeps> {
  const retailKeywords = await getRetailKeywords();
  const intent = new OpenAiIntentExtractor();
  const transcriber = new OpenAiWhisperTranscriber();
  const address = new AlmatyHeuristicAddressProvider();

  return {
    now: () => Date.now(),
    retailUrl: RETAIL_URL,
    retailKeywords,

    dedup: { markProcessed: (id, meta) => markMessageProcessed(id, meta) },

    dialog: {
      get: async (chatId) => {
        const row = await getDialog(chatId);
        if (!row) return null;
        return {
          state: row.state,
          context: row.context as DialogContext,
          phone: row.phone,
          lastActivityMs: Date.parse(row.lastActivityAt) || 0,
        };
      },
      save: (chatId, snap, nowIso) =>
        saveDialog({
          chatId,
          phone: snap.phone,
          state: snap.state,
          context: snap.context,
          handoffReason: snap.state === "human_handoff" ? "handoff" : null,
          nowIso,
        }),
      acquireLock: (chatId, token, nowIso, leaseIso) =>
        acquireDialogLock(chatId, token, nowIso, leaseIso),
      releaseLock: (chatId, token) => releaseDialogLock(chatId, token),
    },

    catalog: { getProducts: () => fetchProducts() },

    cart: {
      apply: (chatId, meta, ops, products) => applyCartOps(chatId, meta, ops, products),
      load: (chatId, products) => loadCartView(chatId, products),
      setItems: (chatId, meta, items, products) => setCartItems(chatId, meta, items, products),
      getItems: (chatId) => getCartItems(chatId),
      clear: (chatId) => clearCart(chatId),
    },

    intent: { extract: (text) => intent.extract(text) },
    transcribe: (input) => transcriber.transcribe(input),
    address: { validate: (text) => address.validate(text) },

    voice: {
      download: (ref) => provider.downloadVoice(ref),
      // Храним МЕТАДАННЫЕ + РАСШИФРОВКУ (текст), сам аудиофайл в Storage не кладём —
      // экономим место/egress; при необходимости включить uploadVoiceObject отдельно.
      store: async (input) => {
        await insertVoiceMessage({
          chatId: input.chatId,
          phone: input.phone,
          messageId: input.messageId,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          durationSeconds: input.durationSeconds,
          transcript: input.transcript ?? null,
          transcriptLang: input.lang ?? null,
          status: input.status,
          rejectReason: input.rejectReason ?? null,
        }).catch(() => {});
      },
    },

    order: {
      create: async (input) => {
        const r = await createOrderFromWhatsApp(input);
        return { orderId: r.orderId, orderNumber: r.orderNumber };
      },
    },

    registration: { createLink: (phone, nowMs) => createRegistrationLink(phone, nowMs) },

    history: {
      lastOrderItems: async (phone) => {
        const order = await fetchLatestWhatsAppOrderByPhone(phone).catch(() => null);
        if (!order) return null;
        const items = await fetchAdminOrderItems(order.id).catch(() => []);
        if (!items.length) return null;
        return items.map((it) => ({ productId: it.product_id, qty: it.qty }));
      },
    },

    profile: {
      get: async (chatId) => {
        const p = await fetchWhatsAppClientByChatId(chatId).catch(() => null);
        if (!p) return null;
        return {
          companyName: p.companyName,
          customerName: p.customerName,
          customerBin: p.customerBin,
          customerEmail: p.customerEmail,
          addresses: (p.addresses ?? [])
            .map((a) => a.address)
            .filter((a): a is string => Boolean(a && a.trim())),
        };
      },
    },

    consent: {
      has: (phone, version) => hasConsent(phone, version),
      record: (input) =>
        recordConsent({
          phone: input.phone,
          chatId: input.chatId,
          version: input.version,
          messageId: input.messageId,
          acceptedAtIso: input.acceptedAtIso,
        }),
    },

    lead: { upsertDraft: (input) => upsertLeadDraft(input) },

    notifyManager: (text) => notifyManagersText(text),
    send: async (chatId, text) => {
      await provider.sendText(chatId, text);
    },
  };
}
