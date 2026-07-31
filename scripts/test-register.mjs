// Регистрирует резолвер модулей для node:test (см. test-resolver.mjs).
// Подключается флагом: node --import ./scripts/test-register.mjs --test "<glob>"
import { register } from "node:module";

register(new URL("./test-resolver.mjs", import.meta.url));
