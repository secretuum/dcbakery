import { test } from "node:test";
import assert from "node:assert/strict";
import type { Product } from "@/src/types";
import type { NormalizedIncomingMessage } from "../transport/types";
import type { AgentResponse } from "../agent/schema";
import { handleIncomingMessage, type OrchestratorDeps, type DialogSnapshot } from "./orchestrator";
import * as M from "./messages";
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

function agentOut(p: Partial<AgentResponse>): AgentResponse {
  return { reply: "", cartActions: [], showCart: false, clearCart: false, intent: "chat", mood: "", handoffReason: "", ...p };
}

type AgentInput = Parameters<OrchestratorDeps["agent"]["respond"]>[0];

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
  let nextAgent: AgentResponse = agentOut({ reply: "..." });
  let lastAgentInput: AgentInput | null = null;
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
    agent: { respond: async (input) => { lastAgentInput = input; return nextAgent; } },
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
    send: async (_c, t) => { sent.push(t); return "sent"; },
  };

  return {
    deps, sent, dialog, carts, drafts, orders, managerNotes,
    setAgent: (a: AgentResponse) => { nextAgent = a; },
    staleDialog: () => { lastActivityOverride = NOW - 61 * 60 * 1000; },
    lastSent: () => sent[sent.length - 1] ?? "",
    agentInput: () => lastAgentInput,
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

test("критичный шаг: подтверждение заказа не доставлено → эскалация менеджеру", async () => {
  const t = setup();
  // Green API молчит даже после ретрая — отправка всегда возвращает null.
  t.deps.send = async () => null;
  const m = (id: string, text: string) => msg({ messageId: id, text });

  t.setAgent(agentOut({ cartActions: [{ productId: "medovik", quantity: 2, operation: "add" }], showCart: true }));
  await handleIncomingMessage(m("e1", "2 медовика"), t.deps);
  t.setAgent(agentOut({ intent: "checkout", reply: "Оформляем." }));
  await handleIncomingMessage(m("e2", "да, оформляй"), t.deps);
  await handleIncomingMessage(m("e3", "г. Алматы, ул. Абая 10"), t.deps);
  await handleIncomingMessage(m("e4", "да, верно"), t.deps);
  await handleIncomingMessage(m("e5", "утро"), t.deps);
  await handleIncomingMessage(m("e6", "да, оформляй"), t.deps);

  assert.equal(t.orders.length, 1);
  assert.ok(
    t.managerNotes.some((n) => /не доставлено/i.test(n)),
    "менеджер должен получить эскалацию о недоставленном подтверждении заказа",
  );
});

test("идемпотентность: повторный webhook игнорируется", async () => {
  const t = setup();
  t.setAgent(agentOut({ reply: "ок" }));
  await handleIncomingMessage(msg({ messageId: "dup", text: "1 медовик" }), t.deps);
  const after = t.sent.length;
  await handleIncomingMessage(msg({ messageId: "dup", text: "1 медовик" }), t.deps);
  assert.equal(t.sent.length, after);
});

test("гонка лока: промах лока не «сжигает» dedup — ретрай переобрабатывается", async () => {
  const t = setup();
  t.setAgent(agentOut({ reply: "Здравствуйте!" }));
  // Первый заход: лок занят параллельным сообщением того же чата → выходим, ничего не шлём.
  t.deps.dialog.acquireLock = async () => false;
  await handleIncomingMessage(msg({ messageId: "race1", text: "привет" }), t.deps);
  assert.equal(t.sent.length, 0);
  // Ретрай ТОГО ЖЕ messageId, лок свободен → сообщение обязано обработаться (dedup не сгорел).
  t.deps.dialog.acquireLock = async () => true;
  await handleIncomingMessage(msg({ messageId: "race1", text: "привет" }), t.deps);
  assert.match(t.lastSent(), /Здравствуйте/);
});

test("абьюз/жалоба → менеджеру ДО агента", async () => {
  const t = setup();
  t.setAgent(agentOut({ reply: "не должно вызваться" }));
  await handleIncomingMessage(msg({ messageId: "e1", text: "вы мошенники, верните деньги" }), t.deps);
  assert.equal(t.state(), "human_handoff");
  assert.equal(t.drafts.length, 1);
  assert.equal(t.managerNotes.length, 1);
  assert.equal(t.orders.length, 0);
  // Эскалация уходит менеджеру КОНТЕКСТОМ, а не голым текстом: что хотел, настроение, «горит».
  assert.match(t.managerNotes[0], /ГОРИТ/);
  assert.match(t.managerNotes[0], /мошенники, верните деньги/);
  assert.match(t.managerNotes[0], /Настроение: недоволен/);
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

test("хендофф → бот молчит, а через час авто-возобновляет ответы (Q84)", async () => {
  const t = setup();
  t.setAgent(agentOut({ intent: "handoff", reply: "Передаю менеджеру." }));
  await handleIncomingMessage(msg({ messageId: "r1", text: "позовите человека" }), t.deps);
  assert.equal(t.state(), "human_handoff");

  // Меньше часа: новое сообщение — бот молчит (ничего не отправлено, состояние держится).
  const sentBefore = t.sent.length;
  t.setAgent(agentOut({ reply: "не должно ответить" }));
  await handleIncomingMessage(msg({ messageId: "r2", text: "ну что там?" }), t.deps);
  assert.equal(t.sent.length, sentBefore);
  assert.equal(t.state(), "human_handoff");

  // Прошёл час (>60 мин с момента хендофа) → бот снова отвечает.
  t.staleDialog();
  t.setAgent(agentOut({ reply: "Снова на связи, чем помочь?" }));
  await handleIncomingMessage(msg({ messageId: "r3", text: "здравствуйте" }), t.deps);
  assert.match(t.lastSent(), /Снова на связи/);
  assert.notEqual(t.state(), "human_handoff");
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

// ——— Улучшения разговорного агента (память, устойчивость, намерения) ———

test("«Привет» при сбое LLM (первый контакт) → приветствие, НЕ «нет товаров»", async () => {
  const t = setup();
  t.setAgent(agentOut({ degraded: true }));
  await handleIncomingMessage(msg({ messageId: "gd1", text: "Привет" }), t.deps);
  assert.match(t.lastSent(), /DC Bakery/);
  assert.doesNotMatch(t.lastSent(), /обычными словами/); // не MSG_UNKNOWN
  assert.notEqual(t.lastSent(), M.MSG_CLARIFY);
});

test("сбой LLM в продолжающемся диалоге → мягкое «тех. неполадки», НЕ «нет товаров»", async () => {
  const t = setup();
  t.setAgent(agentOut({ reply: "Здравствуйте!" }));
  await handleIncomingMessage(msg({ messageId: "gd2a", text: "привет" }), t.deps);
  t.setAgent(agentOut({ degraded: true }));
  await handleIncomingMessage(msg({ messageId: "gd2b", text: "а что есть?" }), t.deps);
  assert.equal(t.lastSent(), M.MSG_TEMPORARY_ISSUE);
});

test("вопрос про доставку без товаров → ответ агента проходит, без «нет товаров»", async () => {
  const t = setup();
  t.setAgent(agentOut({ reply: "Доставка по Алматы: до 10 000 ₸ — 3 000 ₸, дальше дешевле." }));
  await handleIncomingMessage(msg({ messageId: "dlv1", text: "сколько стоит доставка?" }), t.deps);
  assert.match(t.lastSent(), /Доставка/);
  assert.doesNotMatch(t.lastSent(), /обычными словами/);
  assert.equal(t.items().length, 0);
});

test("история диалога передаётся агенту следующим сообщением", async () => {
  const t = setup();
  t.setAgent(agentOut({ reply: "Здравствуйте! Что интересует?" }));
  await handleIncomingMessage(msg({ messageId: "h1", text: "привет" }), t.deps);
  t.setAgent(agentOut({ reply: "Есть медовик и наполеон." }));
  await handleIncomingMessage(msg({ messageId: "h2", text: "что есть?" }), t.deps);
  const input = t.agentInput();
  assert.ok(input);
  assert.match(input!.history, /Клиент: привет/);
  assert.match(input!.history, /Ассистент: Здравствуйте/);
});

test("сводка корзины содержит productId (для контекстных remove/set)", async () => {
  const t = setup();
  t.setAgent(agentOut({ cartActions: [{ productId: "medovik", quantity: 3, operation: "add" }], showCart: true }));
  await handleIncomingMessage(msg({ messageId: "cs1", text: "3 медовика" }), t.deps);
  t.setAgent(agentOut({ reply: "Есть ещё наполеон." }));
  await handleIncomingMessage(msg({ messageId: "cs2", text: "а что ещё посоветуете?" }), t.deps);
  assert.match(t.agentInput()!.cartSummary, /id=medovik/);
});

test("контекстное уменьшение количества (remove по id из корзины)", async () => {
  const t = setup();
  t.setAgent(agentOut({ cartActions: [{ productId: "medovik", quantity: 3, operation: "add" }] }));
  await handleIncomingMessage(msg({ messageId: "rm1", text: "3 медовика" }), t.deps);
  t.setAgent(agentOut({ reply: "Убрал два.", cartActions: [{ productId: "medovik", quantity: 2, operation: "remove" }], showCart: true }));
  await handleIncomingMessage(msg({ messageId: "rm2", text: "убери два" }), t.deps);
  assert.deepEqual(t.items(), [{ productId: "medovik", qty: 1 }]);
});

test("несколько действий в одном сообщении", async () => {
  const t = setup();
  t.setAgent(agentOut({
    reply: "Добавил медовик и наполеон.",
    cartActions: [
      { productId: "medovik", quantity: 3, operation: "add" },
      { productId: "napoleon", quantity: 1, operation: "add" },
    ],
    showCart: true,
  }));
  await handleIncomingMessage(msg({ messageId: "multi1", text: "3 медовика и 1 наполеон" }), t.deps);
  assert.deepEqual(
    t.items().sort((a, b) => a.productId.localeCompare(b.productId)),
    [{ productId: "medovik", qty: 3 }, { productId: "napoleon", qty: 1 }],
  );
});

test("пустой ответ модели (не сбой) в диалоге → уточнение, НЕ «нет товаров»", async () => {
  const t = setup();
  t.setAgent(agentOut({ reply: "Здравствуйте!" }));
  await handleIncomingMessage(msg({ messageId: "cl1", text: "привет" }), t.deps);
  t.setAgent(agentOut({ reply: "" })); // модель вернула пустой reply без действий
  await handleIncomingMessage(msg({ messageId: "cl2", text: "хм" }), t.deps);
  assert.equal(t.lastSent(), M.MSG_CLARIFY);
});

test("checkout с пустой корзиной → НЕ уходит к адресу, продолжает диалог", async () => {
  const t = setup();
  t.setAgent(agentOut({ intent: "checkout", reply: "Оформляем?" }));
  await handleIncomingMessage(msg({ messageId: "eco1", text: "оформляй" }), t.deps);
  assert.notEqual(t.state(), "awaiting_address");
  assert.match(t.lastSent(), /Оформляем/);
});

test("«да» после показанной карточки корзины детерминированно ведёт к оформлению (без LLM)", async () => {
  const t = setup();
  t.setAgent(agentOut({ cartActions: [{ productId: "medovik", quantity: 1, operation: "add" }], showCart: true }));
  await handleIncomingMessage(msg({ messageId: "bc1", text: "1 медовик" }), t.deps);
  assert.equal(t.state(), "awaiting_cart_confirmation");
  t.setAgent(agentOut({ intent: "chat", reply: "агент не должен решать за оформление" }));
  await handleIncomingMessage(msg({ messageId: "bc2", text: "да, спасибо" }), t.deps);
  assert.equal(t.state(), "awaiting_address");
  assert.match(t.lastSent(), /адрес/i);
});

test("вежливое/казахское подтверждение на финале создаёт заказ (не подвисает)", async () => {
  for (const confirmText of ["да, оформляйте пожалуйста", "хорошо, оформляйте", "иә", "+"]) {
    const t = setup();
    const m = (id: string, text: string) => msg({ messageId: id, text });
    t.setAgent(agentOut({ cartActions: [{ productId: "medovik", quantity: 2, operation: "add" }] }));
    await handleIncomingMessage(m("p1", "2 медовика"), t.deps);
    await handleIncomingMessage(m("p2", "да"), t.deps);
    await handleIncomingMessage(m("p3", "г. Алматы, ул. Абая 10"), t.deps);
    await handleIncomingMessage(m("p4", "да"), t.deps);
    await handleIncomingMessage(m("p5", "утро"), t.deps);
    assert.equal(t.state(), "awaiting_final_confirmation");
    await handleIncomingMessage(m("p6", confirmText), t.deps);
    assert.equal(t.orders.length, 1, `«${confirmText}» должно оформить заказ`);
    assert.equal(t.state(), "order_submitted");
  }
});

test("голая вежливость на финале НЕ создаёт заказ (нужно слово-подтверждение)", async () => {
  const t = setup();
  const m = (id: string, text: string) => msg({ messageId: id, text });
  t.setAgent(agentOut({ cartActions: [{ productId: "medovik", quantity: 1, operation: "add" }] }));
  await handleIncomingMessage(m("gp1", "1 медовик"), t.deps);
  await handleIncomingMessage(m("gp2", "да"), t.deps);
  await handleIncomingMessage(m("gp3", "г. Алматы, ул. Абая 10"), t.deps);
  await handleIncomingMessage(m("gp4", "да"), t.deps);
  await handleIncomingMessage(m("gp5", "утро"), t.deps);
  assert.equal(t.state(), "awaiting_final_confirmation");
  t.setAgent(agentOut({ reply: "Всё готово? Напишите «да» для оформления." }));
  await handleIncomingMessage(m("gp6", "спасибо"), t.deps); // одна вежливость, без «да»
  assert.equal(t.orders.length, 0);
});

test("вежливое подтверждение адреса продвигает (не зацикливает переспрос)", async () => {
  const t = setup();
  const m = (id: string, text: string) => msg({ messageId: id, text });
  t.setAgent(agentOut({ cartActions: [{ productId: "medovik", quantity: 1, operation: "add" }] }));
  await handleIncomingMessage(m("av1", "1 медовик"), t.deps);
  await handleIncomingMessage(m("av2", "да"), t.deps);
  await handleIncomingMessage(m("av3", "г. Алматы, ул. Абая 10"), t.deps);
  assert.equal(t.state(), "awaiting_address_confirmation");
  await handleIncomingMessage(m("av4", "да, всё верно, спасибо"), t.deps);
  assert.equal(t.state(), "awaiting_delivery_period");
});

test("«давай» в ответ на Q&A-ход (building_cart, карточка не показана) не проскакивает к адресу", async () => {
  const t = setup();
  // 1) добавили товар — карточка показана → awaiting_cart_confirmation.
  t.setAgent(agentOut({ cartActions: [{ productId: "medovik", quantity: 1, operation: "add" }], showCart: true }));
  await handleIncomingMessage(msg({ messageId: "fp1", text: "1 медовик" }), t.deps);
  assert.equal(t.state(), "awaiting_cart_confirmation");
  // 2) агент отвечает вопросом БЕЗ карточки (showCart:false, без cartActions) → building_cart.
  t.setAgent(agentOut({ reply: "Есть ещё наполеон — интересно?", showCart: false }));
  await handleIncomingMessage(msg({ messageId: "fp2", text: "а что ещё есть?" }), t.deps);
  assert.equal(t.state(), "building_cart");
  // 3) «давай» отвечает на вопрос агента (не на карточку) → в гейт НЕ попадает, решает агент.
  t.setAgent(agentOut({ reply: "Добавил наполеон.", cartActions: [{ productId: "napoleon", quantity: 1, operation: "add" }], showCart: true }));
  await handleIncomingMessage(msg({ messageId: "fp3", text: "давай" }), t.deps);
  assert.notEqual(t.state(), "awaiting_address");
  assert.deepEqual(
    t.items().sort((a, b) => a.productId.localeCompare(b.productId)),
    [{ productId: "medovik", qty: 1 }, { productId: "napoleon", qty: 1 }],
  );
});

test("повтор заказа → «да» детерминированно ведёт к адресу", async () => {
  const t = setup();
  t.setAgent(agentOut({ intent: "repeat_order", reply: "Собрал прошлый заказ." }));
  await handleIncomingMessage(msg({ messageId: "rp1", text: "повтори прошлый" }), t.deps);
  assert.equal(t.state(), "awaiting_cart_confirmation");
  t.setAgent(agentOut({ intent: "chat", reply: "..." })); // НЕ checkout: не зависим от LLM
  await handleIncomingMessage(msg({ messageId: "rp2", text: "да" }), t.deps);
  assert.equal(t.state(), "awaiting_address");
});

test("«назад» на шаге адреса выводит из оформления (корзина сохранена)", async () => {
  const t = setup();
  const m = (id: string, text: string) => msg({ messageId: id, text });
  t.setAgent(agentOut({ cartActions: [{ productId: "medovik", quantity: 1, operation: "add" }], showCart: true }));
  await handleIncomingMessage(m("nb1", "1 медовик"), t.deps);
  await handleIncomingMessage(m("nb2", "да"), t.deps);
  assert.equal(t.state(), "awaiting_address");
  t.setAgent(agentOut({ reply: "Конечно, вернулись к заказу. Что добавить или изменить?" }));
  await handleIncomingMessage(m("nb3", "назад"), t.deps);
  assert.notEqual(t.state(), "awaiting_address");
  assert.deepEqual(t.items(), [{ productId: "medovik", qty: 1 }]); // корзина не потеряна
});

test("«добавь ещё …» на шаге адреса добавляет товар, а не трактуется как адрес", async () => {
  const t = setup();
  const m = (id: string, text: string) => msg({ messageId: id, text });
  t.setAgent(agentOut({ cartActions: [{ productId: "medovik", quantity: 1, operation: "add" }], showCart: true }));
  await handleIncomingMessage(m("ad1", "1 медовик"), t.deps);
  await handleIncomingMessage(m("ad2", "да"), t.deps);
  assert.equal(t.state(), "awaiting_address");
  t.setAgent(agentOut({ reply: "Добавил наполеон.", cartActions: [{ productId: "napoleon", quantity: 1, operation: "add" }], showCart: true }));
  await handleIncomingMessage(m("ad3", "добавь ещё наполеон"), t.deps);
  assert.notEqual(t.state(), "awaiting_address");
  assert.deepEqual(
    t.items().sort((a, b) => a.productId.localeCompare(b.productId)),
    [{ productId: "medovik", qty: 1 }, { productId: "napoleon", qty: 1 }],
  );
});

test("«меню» на шаге интервала доставки выводит из оформления", async () => {
  const t = setup();
  const m = (id: string, text: string) => msg({ messageId: id, text });
  t.setAgent(agentOut({ cartActions: [{ productId: "medovik", quantity: 1, operation: "add" }], showCart: true }));
  await handleIncomingMessage(m("mn1", "1 медовик"), t.deps);
  await handleIncomingMessage(m("mn2", "да"), t.deps);
  await handleIncomingMessage(m("mn3", "г. Алматы, ул. Абая 10"), t.deps);
  await handleIncomingMessage(m("mn4", "да"), t.deps);
  assert.equal(t.state(), "awaiting_delivery_period");
  t.setAgent(agentOut({ reply: "Вот что у нас есть…" }));
  await handleIncomingMessage(m("mn5", "меню"), t.deps);
  assert.notEqual(t.state(), "awaiting_delivery_period");
});

test("«позовите менеджера» на финале выводит из оформления и передаёт человеку", async () => {
  const t = setup();
  const m = (id: string, text: string) => msg({ messageId: id, text });
  t.setAgent(agentOut({ cartActions: [{ productId: "medovik", quantity: 1, operation: "add" }], showCart: true }));
  await handleIncomingMessage(m("mg1", "1 медовик"), t.deps);
  await handleIncomingMessage(m("mg2", "да"), t.deps);
  await handleIncomingMessage(m("mg3", "г. Алматы, ул. Абая 10"), t.deps);
  await handleIncomingMessage(m("mg4", "да"), t.deps);
  await handleIncomingMessage(m("mg5", "утро"), t.deps);
  assert.equal(t.state(), "awaiting_final_confirmation");
  t.setAgent(agentOut({ intent: "handoff", reply: "Передаю менеджеру." }));
  await handleIncomingMessage(m("mg6", "позовите менеджера"), t.deps);
  assert.equal(t.state(), "human_handoff");
  assert.equal(t.orders.length, 0);
});

test("«я не давал команду на доставку» на шаге адреса выводит из оформления", async () => {
  const t = setup();
  const m = (id: string, text: string) => msg({ messageId: id, text });
  t.setAgent(agentOut({ cartActions: [{ productId: "medovik", quantity: 1, operation: "add" }], showCart: true }));
  await handleIncomingMessage(m("nd1", "1 медовик"), t.deps);
  await handleIncomingMessage(m("nd2", "да"), t.deps);
  assert.equal(t.state(), "awaiting_address");
  t.setAgent(agentOut({ reply: "Прошу прощения! Вернул вас к заказу — что добавим?" }));
  await handleIncomingMessage(m("nd3", "я не давал команду на доставку"), t.deps);
  assert.notEqual(t.state(), "awaiting_address");
  assert.deepEqual(t.items(), [{ productId: "medovik", qty: 1 }]);
});

test("«хочу утром» на шаге интервала — это ответ, а не выход (адрес сохранён)", async () => {
  const t = setup();
  const m = (id: string, text: string) => msg({ messageId: id, text });
  t.setAgent(agentOut({ cartActions: [{ productId: "medovik", quantity: 1, operation: "add" }], showCart: true }));
  await handleIncomingMessage(m("hu1", "1 медовик"), t.deps);
  await handleIncomingMessage(m("hu2", "да"), t.deps);
  await handleIncomingMessage(m("hu3", "г. Алматы, ул. Абая 10"), t.deps);
  await handleIncomingMessage(m("hu4", "да"), t.deps);
  assert.equal(t.state(), "awaiting_delivery_period");
  await handleIncomingMessage(m("hu5", "хочу утром"), t.deps);
  assert.equal(t.state(), "awaiting_final_confirmation"); // ответ принят, не выкинуло
  assert.match(t.lastSent(), /Абая 10/i); // адрес сохранён в финальной сводке
});

test("адрес с «добавочный» (телефон) не выкидывает из оформления", async () => {
  const t = setup();
  const m = (id: string, text: string) => msg({ messageId: id, text });
  t.setAgent(agentOut({ cartActions: [{ productId: "medovik", quantity: 1, operation: "add" }], showCart: true }));
  await handleIncomingMessage(m("db1", "1 медовик"), t.deps);
  await handleIncomingMessage(m("db2", "да"), t.deps);
  assert.equal(t.state(), "awaiting_address");
  await handleIncomingMessage(m("db3", "г. Алматы, ул. Абая 10, добавочный 210"), t.deps);
  assert.equal(t.state(), "awaiting_address_confirmation"); // распознан как адрес, не escape
  assert.match(t.lastSent(), /добавочный/i);
});

test("исправление адреса с префиксом-подтверждением НЕ подтверждает старый адрес", async () => {
  const t = setup();
  const m = (id: string, text: string) => msg({ messageId: id, text });
  t.setAgent(agentOut({ cartActions: [{ productId: "medovik", quantity: 1, operation: "add" }] }));
  await handleIncomingMessage(m("ac1", "1 медовик"), t.deps);
  await handleIncomingMessage(m("ac2", "да"), t.deps);
  assert.equal(t.state(), "awaiting_address");
  await handleIncomingMessage(m("ac3", "г. Алматы, ул. Абая 10"), t.deps);
  assert.equal(t.state(), "awaiting_address_confirmation");
  await handleIncomingMessage(m("ac4", "давай г. Алматы, ул. Сатпаева 90"), t.deps);
  assert.notEqual(t.state(), "awaiting_delivery_period"); // не проскочил со старым адресом
  assert.match(t.lastSent(), /сатпаева/i);
  assert.doesNotMatch(t.lastSent(), /абая/i);
});

test("правка на финальном подтверждении («да, только убери…») не создаёт заказ", async () => {
  const t = setup();
  const m = (id: string, text: string) => msg({ messageId: id, text });
  t.setAgent(agentOut({ cartActions: [{ productId: "medovik", quantity: 3, operation: "add" }] }));
  await handleIncomingMessage(m("fe1", "3 медовика"), t.deps);
  await handleIncomingMessage(m("fe2", "да"), t.deps);
  await handleIncomingMessage(m("fe3", "г. Алматы, ул. Абая 10"), t.deps);
  await handleIncomingMessage(m("fe4", "да"), t.deps);
  await handleIncomingMessage(m("fe5", "утро"), t.deps);
  assert.equal(t.state(), "awaiting_final_confirmation");
  t.setAgent(agentOut({
    reply: "Убрал один медовик.",
    cartActions: [{ productId: "medovik", quantity: 1, operation: "remove" }],
    showCart: true,
  }));
  await handleIncomingMessage(m("fe6", "да, только убери один медовик"), t.deps);
  assert.equal(t.orders.length, 0);
  assert.deepEqual(t.items(), [{ productId: "medovik", qty: 2 }]);
  // Остаёмся в оформлении и заново показываем сводку (адрес не переспрашиваем).
  assert.equal(t.state(), "awaiting_final_confirmation");
  assert.match(t.lastSent(), /Абая 10|Проверьте заказ/i);
  // Следующее «да» создаёт заказ с правкой, без повторного ввода адреса.
  await handleIncomingMessage(m("fe7", "да"), t.deps);
  assert.equal(t.orders.length, 1);
  assert.equal(t.state(), "order_submitted");
});

test("повторное подтверждение уже созданной заявки → без дубля заказа", async () => {
  const t = setup();
  const m = (id: string, text: string) => msg({ messageId: id, text });
  t.setAgent(agentOut({ cartActions: [{ productId: "medovik", quantity: 2, operation: "add" }] }));
  await handleIncomingMessage(m("d1", "2 медовика"), t.deps);
  t.setAgent(agentOut({ intent: "checkout" }));
  await handleIncomingMessage(m("d2", "оформляй"), t.deps);
  await handleIncomingMessage(m("d3", "г. Алматы, ул. Абая 10"), t.deps);
  await handleIncomingMessage(m("d4", "да"), t.deps);
  await handleIncomingMessage(m("d5", "утро"), t.deps);
  await handleIncomingMessage(m("d6", "да"), t.deps);
  assert.equal(t.orders.length, 1);
  assert.equal(t.state(), "order_submitted");
  // Ещё одно «да» уже после оформления не должно создать вторую заявку.
  t.setAgent(agentOut({ reply: "Заявка уже принята, менеджер свяжется." }));
  await handleIncomingMessage(m("d7", "да"), t.deps);
  assert.equal(t.orders.length, 1);
});
