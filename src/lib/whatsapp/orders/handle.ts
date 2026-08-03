import "server-only";
// Единственная точка входа нового AI/голосового пути. Webhook вызывает ТОЛЬКО эту
// функцию (одна строка) — вся логика инкапсулирована здесь. Путь целиком за
// feature-флагом whatsapp_nl_orders_enabled (по умолчанию ВЫКЛ).

import { GreenApiProvider } from "./transport/green-api";
import { buildOrchestratorDeps } from "./orchestrator/services";
import { handleIncomingMessage } from "./orchestrator/orchestrator";
import { isNlOrdersEnabled } from "./settings";
import { checkRateLimit } from "@/src/lib/rate-limit";

/**
 * Попытаться обработать входящий webhook новым путём.
 * @returns true — сообщение ВЗЯТО в обработку (старый бот его дальше не трогает);
 *          false — путь выключен флагом, либо это не клиентское сообщение
 *          (тогда webhook продолжает обычным путём).
 */
export async function tryHandleNlOrder(payload: unknown): Promise<boolean> {
  try {
    const enabled = await isNlOrdersEnabled();
    console.info("[whatsapp:nl] enter", { enabled });
    if (!enabled) return false;

    const provider = new GreenApiProvider();
    const message = provider.normalizeWebhook(payload);
    // Только клиентские сообщения; менеджерский групповой чат — старый путь (команды).
    if (!message) {
      console.info("[whatsapp:nl] no normalized message");
      return false;
    }
    if (message.isManagerChat) {
      console.info("[whatsapp:nl] manager chat → skip");
      return false;
    }
    console.info("[whatsapp:nl] message", { kind: message.kind });

    // Rate limit на номер (анти-флуд/стоимость AI). Upstash Redis или in-memory fallback.
    const rl = await checkRateLimit({
      identifier: message.phone,
      limit: 30,
      namespace: "whatsapp:nl-orders",
      windowMs: 10 * 60 * 1000,
    }).catch(() => ({ allowed: true }) as { allowed: boolean });
    if (!rl.allowed) {
      await provider.sendText(message.chatId, "Слишком много сообщений подряд. Подождите пару минут и повторите, пожалуйста.");
      return true;
    }

    const deps = await buildOrchestratorDeps(provider);
    await handleIncomingMessage(message, deps);
    console.info("[whatsapp:nl] handled");
    return true;
  } catch (error) {
    // Любой сбой нового пути НЕ должен ронять webhook; логируем без пользовательских данных.
    console.error("[whatsapp:nl-orders] handler failed:", error instanceof Error ? error.message : "unknown");
    return false;
  }
}
