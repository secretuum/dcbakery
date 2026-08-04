import "server-only";

// Хранилище комментариев к товарам (премодерация). Свой Supabase REST (как
// whatsapp-client-store) — forbidden admin.ts не трогаем. Требует таблицу
// product_comments (миграция применяется вручную).

export type ProductComment = {
  id: string;
  productSlug: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type ModerationComment = ProductComment & { status: string };

type CommentRow = {
  id: string;
  product_slug: string;
  author_name: string;
  author_phone?: string | null;
  author_email?: string | null;
  body: string;
  status: string;
  created_at: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function restUrl(query = ""): string | null {
  if (!supabaseUrl || !serviceRoleKey) return null;
  const base = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/product_comments`;
  return query ? `${base}?${query}` : base;
}

function authHeaders(extra?: Record<string, string>) {
  return {
    apikey: serviceRoleKey ?? "",
    Authorization: `Bearer ${serviceRoleKey ?? ""}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function toPublic(row: CommentRow): ProductComment {
  return {
    id: row.id,
    productSlug: row.product_slug,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
  };
}

/** Опубликованные комментарии товара (для витрины). */
export async function fetchPublishedComments(productSlug: string): Promise<ProductComment[]> {
  const url = restUrl(
    `product_slug=eq.${encodeURIComponent(productSlug)}&status=eq.published&order=created_at.desc&limit=100`,
  );
  if (!url) return [];

  try {
    const res = await fetch(url, { headers: authHeaders(), cache: "no-store" });
    if (!res.ok) return [];
    const rows = (await res.json()) as CommentRow[];
    return rows.map(toPublic);
  } catch {
    return [];
  }
}

/** Новый комментарий — всегда на модерацию (status='pending'). */
export async function insertComment(input: {
  productSlug: string;
  authorName: string;
  authorPhone?: string | null;
  authorEmail?: string | null;
  body: string;
}): Promise<boolean> {
  const url = restUrl();
  if (!url) return false;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: authHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({
        product_slug: input.productSlug,
        author_name: input.authorName,
        author_phone: input.authorPhone ?? null,
        author_email: input.authorEmail ?? null,
        body: input.body,
        status: "pending",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ——— Модерация (админка) ———

/** Комментарии, ожидающие модерации. */
export async function fetchCommentsForModeration(): Promise<ModerationComment[]> {
  const url = restUrl("status=eq.pending&order=created_at.desc&limit=200");
  if (!url) return [];

  try {
    const res = await fetch(url, { headers: authHeaders(), cache: "no-store" });
    if (!res.ok) return [];
    const rows = (await res.json()) as CommentRow[];
    return rows.map((row) => ({ ...toPublic(row), status: row.status }));
  } catch {
    return [];
  }
}

/** Одобрить (published) или скрыть (hidden) комментарий. */
export async function updateCommentStatus(
  id: string,
  status: "published" | "hidden",
): Promise<boolean> {
  const url = restUrl(`id=eq.${encodeURIComponent(id)}`);
  if (!url) return false;

  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: authHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({ status }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
