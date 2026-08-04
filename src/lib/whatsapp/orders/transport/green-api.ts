import "server-only";
// Реализация WhatsAppProvider поверх Green API. Транспорт изолирован: бизнес-логика
// зависит только от интерфейса, поэтому позже можно добавить MetaCloudProvider.

import { normalizeGreenWebhook, isTrustedGreenHost } from "./green-api-parse";
import type {
  WhatsAppProvider,
  NormalizedIncomingMessage,
  IncomingVoiceRef,
  DownloadedMedia,
} from "./types";
import { TIMEOUTS, LIMITS } from "../config";

const GREEN_BASE = (process.env.GREEN_API_BASE_URL ?? "https://api.green-api.com").replace(/\/$/, "");

function getConfig() {
  const instanceId = process.env.GREEN_API_INSTANCE_ID;
  const token = process.env.GREEN_API_TOKEN;
  if (!instanceId || !token) return null;
  return { instanceId, token };
}

export class GreenApiProvider implements WhatsAppProvider {
  readonly name = "green-api";

  normalizeWebhook(payload: unknown): NormalizedIncomingMessage | null {
    return normalizeGreenWebhook(payload, { managerChatId: process.env.GREEN_API_CHAT_ID ?? null });
  }

  async sendText(chatId: string, text: string): Promise<string | null> {
    const cfg = getConfig();
    if (!cfg) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUTS.supabaseMs);
    try {
      const res = await fetch(`${GREEN_BASE}/waInstance${cfg.instanceId}/sendMessage/${cfg.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, message: text }),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) {
        console.error("[whatsapp:nl] sendText failed", res.status, GREEN_BASE);
        return null;
      }
      const data = (await res.json()) as { idMessage?: string };
      return data.idMessage ?? null;
    } catch (error) {
      console.error(
        "[whatsapp:nl] sendText error",
        error instanceof Error ? error.message : "unknown",
        GREEN_BASE,
      );
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async downloadVoice(ref: IncomingVoiceRef): Promise<DownloadedMedia | null> {
    const url = ref.downloadUrl;
    // Скачиваем ТОЛЬКО с доверенного хоста Green API (анти-SSRF), не произвольный URL.
    if (!url || !isTrustedGreenHost(url)) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUTS.mediaDownloadMs);
    try {
      const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
      if (!res.ok) return null;

      const declaredLen = Number(res.headers.get("content-length") ?? "0");
      if (declaredLen && declaredLen > LIMITS.maxVoiceBytes) return null; // ранний отсев

      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength > LIMITS.maxVoiceBytes) return null;

      return { bytes: buf, mimeType: ref.mimeType ?? res.headers.get("content-type") };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
