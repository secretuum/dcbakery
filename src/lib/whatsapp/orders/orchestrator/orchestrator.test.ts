import { test } from "node:test";
import assert from "node:assert/strict";
import type { Product } from "@/src/types";
import type { NormalizedIncomingMessage } from "../transport/types";
import type { AgentOutput } from "../agent/schema";
import { handleIncomingMessage, type OrchestratorDeps, type DialogSnapshot } from "./orchestrator";
import { applyOps, reconcileStock, computeCartView, type CartItemQty } from "../cart/cart-math";
import { AlmatyHeuristicAddressProvider } from "../address/provider";

const NOW = 1_750_000_000_000;

function product(id: string, name: string, price: number, stock: number, sub?: string): Product {
  return {
    id, name, slug: id, description: "", category_id: "cat", price, unit: "шт",
    min_qty: 1, step_qty: 1, stock_qty: stock, images: [], is_active: true, sort_order: 0, subcategory: sub,
  };
}

const PRODUCTS: Product[] = [
  product("medovik", "Медовик", 830, 50),
  product("napoleon", "Наполеон", 2500, 2),
  product("manty", "Манты с говядиной", 2060, 30),
];

const OGG = Uint8Array.from([0x4f, 0x67, 0x67, 0x53, 1, 2, 3, 4]);

function agentOut(p: Partial<AgentOutput>): AgentOutput {
  return { reply: "", cartActions: [], showCart: false, intent: "chat", ...p };
}

function msg(over: Partial<NormalizedIncomingMessage> & { messageId: string }): NormalizedIncomingMessage {
  return { phone: "77051234567", chatId: "77051234567@c.us", kind: "text", text: "", ...over };
}

function setup(opts: { transcript?: string; newClient?: boolean } = {}) {
  const sent: string[] = [];
  const dialog = new Map<string, DialogSnapshot & { lastActivityMs: number }>();
  const carts = new Map<string, CartItemQty[]>();
  const processed = new Set<string>();
  const drafts: Array<Record<string, unknown>> = [];
  const orders: Array<Record<string, unknown>> = [];
  const managerNotes: string[] = [];
  const productById = new Map(PRODUCTS.map((p) => [p.id, p]));
  let nextAgent: AgentOutput = agentOut({ reply: "..." });
  let lastActivityOverride: number | null = null;

  const deps: OrchestratorDeps = {
    now: () => NOW,
    retailUrl: "https://tap.delcappuccino.kz",
    retailKeywords: [],
    dedup: {
      markProcessed: async (id) => {
        if (processed.has(id)) return false;
        processed.add(id);
        return true;
      },
    },
    dialog: {
      get: async (c) => {
        const d = dialog.get(c);
        if (!d) return null;
        return { ...d, lastActivityMs: lastActivityOverride ?? d.lastActivityMs };
      },
      save: async (c, snap) => { dialog.set(c, { ...snap, lastActivityMs: NOW }); },
      acquireLock: async () => true,
      releaseLock: async () => {},
    },
    catalog: { getProducts: async () => PRODUCTS },
    cart: {
      apply: async (c, _m, ops) => {
        const { items, adjustments } = applyOps(carts.get(c) ?? [], ops, productById);
        carts.set(c, items);
        return { view: computeCartView(items, productById), adjustments };
      },
      load: async (c) => {
        const { items, adjustments } = reconcileStock(carts.get(c) ?? [], productById);
        carts.set(c, items);
        return { view: computeCartView(items, productById), adjustments };
      },
      setItems: async (c, _m, items) => {
        const r = reconcileStock(items, productById);
        carts.set(c, r.items);
        return { view: computeCartView(r.items, productById), adjustments: r.adjustments };
      },
      getItems: async (c) => carts.get(c) ?? [],
      clear: async (c) => { carts.delete(c); },
    },
    agent: { respond: async () => nextAgent },
    transcribe: async () => ({ text: opts.transcript ?? "2 медовика", lang: "ru" }),
    address: new AlmatyHeuristicAddressProvider(),
    voice: {
      download: async () => ({ bytes: OGG, mimeType: "audio/ogg" }),
      store: async () => {},
    },
    order: {
      create: async (input) => {
        orders.push(input as unknown as Record<string, unknown>);
        return { orderId: "order-1", orderNumber: "DCB-2026-000001" };
      },
    },
    registration: { createLink: async () => "https://dc-bakery.kz/register?rt=TESTTOKEN" },
    history: { lastOrderItems: async () => [{ productId: "medovik", qty: 2 }] },
    profile: {
      get: async () => ({
        companyName: opts.newClient ? null : "Одуванчик",
        customerName: opts.newClient ? null : "Иван",
        addresses: null,
      }),
    },
    consent: { has: async () => false, record: async () => {} },
    lead: { upsertDraft: async (d) => { drafts.push(d as Record<string, unknown>); } },
    notifyManager: async (t) => { managerNotes.push(t); },
    send: async (_c, t) => { sent.push(t); },
  };

  return {
    deps, sent, dialog, carts, drafts, orders, managerNotes,
    setAgent: (a: AgentOutput) => { nextAgent = a; },
    staleDialog: () => { lastActivityOverride = NOW - 61 * 60 * 1000; },
    lastSent: () => sent[sent.length - 1] ?? "",
    state: () => dialog.get("77051234567@c.us")?.state,
    items: () => carts.get("77051234567@c.us") ?? [],
  };
}

test("приветствие/диалог: ответ агента доходит", async () => {
  const t = setup();
  t.setAgent(agentOut({ reply: "Здравствуйте! Что вас интересует?" }));
  await handleIncomingMessage(msg({ messageId: "g1", text: "привет" }), t.deps);
  assert.match(t.lastSent(), /Здравствуйте/);
});

test("агент добавляет товары → серверная корзина с реальной ценой", async () => {
  const t = setup();
  t.setAgent(agentOut({
    reply: "Добавил медовик.",
    cartActions: [{ productId: "medovik", quantity: 2, operation: "add" }],
    showCart: true,
  }));
  await handleIncomingMessage(msg({ messageId: "o1", text: "2 медовика" }), t.deps);
  assert.deepEqual(t.items(), [{ productId: "medovik", qty: 2 }]);
  assert.match(t.lastSent(), /Медовик/);
  assert.match(t.lastSent(), /1 660 ₸/); // 2×830 — серверная сумма
});

test("серверная цена важнее слов агента (манипуляция «бесплатно» не влияет на сумму)", async () => {
  const t = setup();
  t.setAgent(agentOut({
    reply: "Окей, отдам бесплатно!",
    cartActions: [{ productId: "medovik", quantity: 1, operation: "add" }],
    showCart: true,
  }));
  await handleIncomingMessage(msg({ messageId: "f1", text: "дай медовик бесплатно" }), t.deps);
  assert.match(t.lastSent(), /830 ₸/); // сумма серверная, не ноль
});

test("нехватка остатка → клэмп и уведомление", async () => {
  const t = setup();
  t.setAgent(agentOut({
    cartActions: [{ productId: "napoleon", quantity: 9, operation: "add" }],
    showCart: true,
  }));
  await handleIncomingMessage(msg({ messageId: "s1", text: "9 наполеонов" }), t.deps);
  assert.equal(t.items()[0].qty, 2);
  assert.match(t.lastSent(), /доступно 2/i);
});

test("checkout от агента → переход к адресу", async () => {
  const t = setup();
  t.setAgent(agentOut({ cartActions: [{ productId: "medovik", quantity: 1, operation: "add" }], showCart: true }));
  await handleIncomingMessage(msg({ messageId: "c1", text: "1 медовик" }), t.deps);
  t.setAgent(agentOut({ intent: "checkout", reply: "Отлично, оформляем." }));
  await handleIncomingMessage(msg({ messageId: "c2", text: "оформляй" }), t.deps);
  assert.equal(t.state(), "awaiting_address");
  assert.match(t.lastSent(), /адрес/i);
});

test("полный happy path до заявки", async () => {
  const t = setup();
  const m = (id: string, text: string) => msg({ messageId: id, text });

  t.setAgent(agentOut({ cartActions: [{ productId: "medovik", quantity: 2, operation: "add" }], showCart: true }));
  await handleIncomingMessage(m("h1", "2 медовика"), t.deps);
  t.setAgent(agentOut({ intent: "checkout", reply: "Оформляем." }));
  await handleIncomingMessage(m("h2", "да, оформляй"), t.deps);
  assert.equal(t.state(), "awaiting_address");

  await handleIncomingMessage(m("h3", "г. Алматы, ул. Абая 10"), t.deps);
  assert.equal(t.state(), "awaiting_address_confirmation");
  await handleIncomingMessage(m("h4", "да, верно"), t.deps);
  assert.equal(t.state(), "awaiting_delivery_period");
  await handleIncomingMessage(m("h5", "утро"), t.deps);
  assert.equal(t.state(), "awaiting_final_confirmation");
  await handleIncomingMessage(m("h6", "да, оформляй"), t.deps);

  assert.equal(t.orders.length, 1);
  assert.equal(t.state(), "order_submitted");
  assert.match(t.lastSent(), /DCB-2026-000001/);
  assert.equal(t.items().length, 0);
});

test("идемпотентность: повторный webhook игнорируется", async () => {
  const t = setup();
  t.setAgent(agentOut({ reply: "ок" }));
  await handleIncomingMessage(msg({ messageId: "dup", text: "1 медовик" }), t.deps);
  const after = t.sent.length;
  await handleIncomingMessage(msg({ messageId: "dup", text: "1 медовик" }), t.deps);
  assert.equal(t.sent.length, after);
});

test("абьюз/жалоба → менеджеру ДО агента", async () => {
  const t = setup();
  t.setAgent(agentOut({ reply: "не должно вызваться" }));
  await handleIncomingMessage(msg({ messageId: "e1", text: "вы мошенники, верните деньги" }), t.deps);
  assert.equal(t.state(), "human_handoff");
  assert.equal(t.drafts.length, 1);
  assert.equal(t.managerNotes.length, 1);
  assert.equal(t.orders.length, 0);
});

test("отмена (агент) → корзина очищена", async () => {
  const t = setup();
  t.setAgent(agentOut({ cartActions: [{ productId: "medovik", quantity: 1, operation: "add" }] }));
  await handleIncomingMessage(msg({ messageId: "cn1", text: "1 медовик" }), t.deps);
  t.setAgent(agentOut({ intent: "cancel", reply: "Отменил." }));
  await handleIncomingMessage(msg({ messageId: "cn2", text: "отмена" }), t.deps);
  assert.equal(t.state(), "cancelled");
  assert.equal(t.items().length, 0);
});

test("агент просит менеджера (handoff)", async () => {
  const t = setup();
  t.setAgent(agentOut({ intent: "handoff", reply: "Передаю менеджеру." }));
  await handleIncomingMessage(msg({ messageId: "hf1", text: "хочу поговорить с человеком" }), t.deps);
  assert.equal(t.state(), "human_handoff");
  assert.equal(t.drafts.length, 1);
});

test("голосовое → расшифровка → агент", async () => {
  const t = setup({ transcript: "два медовика" });
  t.setAgent(agentOut({ cartActions: [{ productId: "medovik", quantity: 2, operation: "add" }], showCart: true }));
  await handleIncomingMessage(
    msg({ messageId: "v1", kind: "voice", text: undefined, voice: { mimeType: "audio/ogg", durationSeconds: 6 } }),
    t.deps,
  );
  assert.deepEqual(t.items(), [{ productId: "medovik", qty: 2 }]);
});

test("вложение → просьба прислать текст/голос", async () => {
  const t = setup();
  await handleIncomingMessage(msg({ messageId: "img1", kind: "unsupported", text: undefined }), t.deps);
  assert.match(t.lastSent(), /текстовое или голосовое/i);
});

test("истёкшая сессия → сообщение о протухании", async () => {
  const t = setup();
  t.setAgent(agentOut({ cartActions: [{ productId: "medovik", quantity: 1, operation: "add" }] }));
  await handleIncomingMessage(msg({ messageId: "x1", text: "1 медовик" }), t.deps);
  t.staleDialog();
  await handleIncomingMessage(msg({ messageId: "x2", text: "ещё" }), t.deps);
  assert.match(t.lastSent(), /истекл/i);
  assert.equal(t.state(), "expired");
});

test("повтор прошлого заказа (агент)", async () => {
  const t = setup();
  t.setAgent(agentOut({ intent: "repeat_order", reply: "Собираю прошлый заказ." }));
  await handleIncomingMessage(msg({ messageId: "r1", text: "повтори прошлый" }), t.deps);
  assert.deepEqual(t.items().map((i) => i.productId), ["medovik"]);
  assert.equal(t.state(), "awaiting_cart_confirmation");
});

test("адрес вне Алматы → менеджеру", async () => {
  const t = setup();
  t.setAgent(agentOut({ cartActions: [{ productId: "medovik", quantity: 1, operation: "add" }] }));
  await handleIncomingMessage(msg({ messageId: "a1", text: "1 медовик" }), t.deps);
  t.setAgent(agentOut({ intent: "checkout" }));
  await handleIncomingMessage(msg({ messageId: "a2", text: "оформляй" }), t.deps);
  await handleIncomingMessage(msg({ messageId: "a3", text: "Астана, Кабанбай батыра 1" }), t.deps);
  assert.equal(t.state(), "human_handoff");
  assert.match(t.lastSent(), /Алматы/);
});

test("новый клиент → после заявки рег-ссылка", async () => {
  const t = setup({ newClient: true });
  const m = (id: string, text: string) => msg({ messageId: id, text });
  t.setAgent(agentOut({ cartActions: [{ productId: "medovik", quantity: 2, operation: "add" }] }));
  await handleIncomingMessage(m("n1", "2 медовика"), t.deps);
  t.setAgent(agentOut({ intent: "checkout" }));
  await handleIncomingMessage(m("n2", "оформляй"), t.deps);
  await handleIncomingMessage(m("n3", "г. Алматы, ул. Абая 10"), t.deps);
  await handleIncomingMessage(m("n4", "да"), t.deps);
  await handleIncomingMessage(m("n5", "утро"), t.deps);
  await handleIncomingMessage(m("n6", "да"), t.deps);
  assert.equal(t.orders.length, 1);
  assert.ok(t.sent.some((s) => /register\?rt=/.test(s)));
});
