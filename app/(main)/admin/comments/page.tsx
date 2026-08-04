import { fetchCommentsForModeration } from "@/src/lib/comments/store";
import { hideCommentAction, publishCommentAction } from "./actions";

// Список всегда свежий — модерация.
export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return "";
  }
}

export default async function AdminCommentsPage() {
  const comments = await fetchCommentsForModeration();

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-dark">Комментарии на модерации</h1>
      <p className="mt-1 text-sm text-muted">
        Новые комментарии клиентов к товарам. «Опубликовать» — покажет на странице товара, «Скрыть» — уберёт.
      </p>

      {comments.length === 0 ? (
        <p className="mt-6 rounded-xl bg-white p-6 text-center text-sm text-muted shadow-xs">
          Нет комментариев на модерации.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-xl bg-white p-4 shadow-xs">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-dark">{comment.authorName}</span>
                <span className="shrink-0 font-data text-xs text-muted">{formatDate(comment.createdAt)}</span>
              </div>
              <p className="mt-0.5 font-data text-xs text-muted">/product/{comment.productSlug}</p>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-dark/80">{comment.body}</p>
              <div className="mt-3 flex gap-2">
                <form action={publishCommentAction}>
                  <input type="hidden" name="id" value={comment.id} />
                  <button
                    type="submit"
                    className="rounded-btn border border-coral bg-coral px-4 py-2 text-xs font-bold text-white transition hover:bg-coral-hover"
                  >
                    Опубликовать
                  </button>
                </form>
                <form action={hideCommentAction}>
                  <input type="hidden" name="id" value={comment.id} />
                  <button
                    type="submit"
                    className="rounded-btn border border-black/15 px-4 py-2 text-xs font-semibold text-muted transition hover:bg-black/5"
                  >
                    Скрыть
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
