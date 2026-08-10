import "server-only";
import { getRepoConfig, repoHeaders, repoFetch } from "@/src/lib/registration/repo-client";

// Проставляет «кто оформил» (email сотрудника) в колонку orders.created_by_email
// ПОСЛЕ вставки заказа — чтобы не менять защищённый insertOrderWithItems (admin.ts).
// Best-effort: атрибуция в колонке для отчётов; дубль «на всякий» есть в комментарии.
export async function setOrderCreatedBy(orderId: string, email: string): Promise<void> {
  const { restUrl, serviceRoleKey } = getRepoConfig();
  const response = await repoFetch(
    `${restUrl}/orders?id=eq.${encodeURIComponent(orderId)}`,
    {
      method: "PATCH",
      headers: repoHeaders(serviceRoleKey, "return=minimal"),
      body: JSON.stringify({ created_by_email: email }),
    },
  );
  if (!response.ok) {
    throw new Error(`created_by_email update failed: ${response.status}`);
  }
}
