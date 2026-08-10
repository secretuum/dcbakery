import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAdminRole, isManagerMutationAllowed, parseEmailSet } from "./admin-role";

const NONE = new Set<string>();

test("resolveAdminRole: app_metadata.role=admin → admin", () => {
  assert.equal(resolveAdminRole({ app_metadata: { role: "admin" } }, NONE, NONE), "admin");
});

test("resolveAdminRole: email в ADMIN_EMAILS → admin (регистр не важен)", () => {
  assert.equal(resolveAdminRole({ email: "A@x.kz" }, new Set(["a@x.kz"]), NONE), "admin");
});

test("resolveAdminRole: role=manager → manager", () => {
  assert.equal(resolveAdminRole({ app_metadata: { role: "manager" } }, NONE, NONE), "manager");
});

test("resolveAdminRole: email в MANAGER_EMAILS → manager", () => {
  assert.equal(resolveAdminRole({ email: "m@x.kz" }, NONE, new Set(["m@x.kz"])), "manager");
});

test("resolveAdminRole: admin приоритетнее manager", () => {
  assert.equal(
    resolveAdminRole({ app_metadata: { role: "admin" }, email: "m@x.kz" }, NONE, new Set(["m@x.kz"])),
    "admin",
  );
});

test("resolveAdminRole: не сотрудник → null", () => {
  assert.equal(resolveAdminRole(null, NONE, NONE), null);
  assert.equal(resolveAdminRole(undefined, NONE, NONE), null);
  assert.equal(resolveAdminRole({ email: "x@x.kz" }, NONE, NONE), null);
  assert.equal(resolveAdminRole({ app_metadata: { role: "client" } }, NONE, NONE), null);
});

test("parseEmailSet: сплит/трим/нижний регистр/пустые", () => {
  const s = parseEmailSet(" A@x.kz , b@y.kz ,, ");
  assert.equal(s.has("a@x.kz"), true);
  assert.equal(s.has("b@y.kz"), true);
  assert.equal(s.size, 2);
  assert.equal(parseEmailSet(undefined).size, 0);
});

const ALLOW = ["/api/admin/clients"];

test("gate: чтение (GET/HEAD/OPTIONS) торгпреду разрешено везде", () => {
  assert.equal(isManagerMutationAllowed("GET", "/api/admin/orders", ALLOW), true);
  assert.equal(isManagerMutationAllowed("HEAD", "/admin/products", ALLOW), true);
  assert.equal(isManagerMutationAllowed("OPTIONS", "/api/admin/settings", ALLOW), true);
});

test("gate: create клиента (POST /api/admin/clients) разрешён", () => {
  assert.equal(isManagerMutationAllowed("POST", "/api/admin/clients", ALLOW), true);
});

test("gate: опасные мутации запрещены — ТОЧНОЕ совпадение, не префикс", () => {
  // именно эта дыра: /clients/credit не должен открыться вместе с /clients
  assert.equal(isManagerMutationAllowed("POST", "/api/admin/clients/credit", ALLOW), false);
  assert.equal(isManagerMutationAllowed("PATCH", "/api/admin/clients/abc123", ALLOW), false);
  assert.equal(isManagerMutationAllowed("POST", "/api/admin/orders/1/mark-paid", ALLOW), false);
  assert.equal(isManagerMutationAllowed("PATCH", "/api/admin/settings", ALLOW), false);
  // server action = POST на страницу /admin/*
  assert.equal(isManagerMutationAllowed("POST", "/admin/products", ALLOW), false);
});

test("gate: пустой белый список (стадия 1) — все мутации запрещены", () => {
  assert.equal(isManagerMutationAllowed("POST", "/api/admin/clients", []), false);
  assert.equal(isManagerMutationAllowed("GET", "/api/admin/clients", []), true);
});
