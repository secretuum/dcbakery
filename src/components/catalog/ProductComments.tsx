"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useToast } from "@/src/contexts/ToastContext";
import { useLocale, useT } from "@/src/i18n/client";
import { formatMediumDate } from "@/src/i18n/date-labels";
import type { Locale } from "@/src/i18n/config";

type Comment = { id: string; authorName: string; body: string; createdAt: string };

function formatDate(iso: string, locale: Locale) {
  try {
    return formatMediumDate(new Date(iso), locale);
  } catch {
    return "";
  }
}

export function ProductComments({ slug }: { slug: string }) {
  const t = useT();
  const locale = useLocale();
  const { showToast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/products/${encodeURIComponent(slug)}/comments`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { comments?: Comment[] }) => setComments(d.comments ?? []))
      .catch(() => undefined);
    fetch("/api/profile/client-session", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { authenticated?: boolean }) => setAuthed(Boolean(d.authenticated)))
      .catch(() => setAuthed(false));
  }, [slug]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = text.trim();
    if (body.length < 2) {
      showToast(t("Напишите комментарий"), "info");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(slug)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok || !data.ok) {
        showToast(data.error ?? t("Не удалось отправить"), "error");
        return;
      }
      setText("");
      showToast(t("Комментарий отправлен на модерацию"), "success");
    } catch {
      showToast(t("Ошибка отправки"), "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-6 border-t border-black/10 pt-5">
      <h3 className="text-[15px] font-semibold text-dark">{t("Комментарии")}</h3>

      {comments.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-md bg-cream px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13.5px] font-semibold text-dark">{comment.authorName}</span>
                <span className="shrink-0 text-[11px] text-muted">{formatDate(comment.createdAt, locale)}</span>
              </div>
              <p className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-muted">{comment.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[13.5px] text-muted">{t("Пока нет комментариев. Будьте первым.")}</p>
      )}

      {authed === false ? (
        <p className="mt-4 rounded-md bg-cream px-3 py-2.5 text-[13.5px] font-semibold text-muted">
          {t("Войдите в аккаунт, чтобы оставить комментарий.")}
        </p>
      ) : authed ? (
        <form onSubmit={submit} className="mt-4">
          <textarea
            value={text}
            onChange={(event) => setText(event.currentTarget.value)}
            maxLength={1000}
            rows={3}
            placeholder={t("Ваш комментарий")}
            className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-[13.5px] text-dark outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted">{t("Появится после проверки модератором")}</span>
            <button
              type="submit"
              disabled={submitting || text.trim().length < 2}
              className="rounded-full bg-coral px-4 py-2 text-[13.5px] font-semibold text-white transition hover:bg-coral-hover active:scale-95 disabled:bg-black/10 disabled:text-muted"
            >
              {submitting ? t("Отправляем...") : t("Отправить")}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
