"use client";

import { type MouseEvent } from "react";
import Link from "next/link";
import { categoryPath } from "@/src/lib/catalog-urls";
import { useLocale, useT } from "@/src/i18n/client";
import type { Category } from "@/src/types";

type Props = {
  categories: Category[];
  popularCount?: number;
};

export function CategoryNavBar({ categories, popularCount }: Props) {
  const t = useT();
  const locale = useLocale();
  function scrollTo(slug: string) {
    document.getElementById(`cat-${slug}`)?.scrollIntoView({ behavior: "smooth" });
  }

  // Разделы каталога — НАСТОЯЩИЕ ссылки на /{locale}/catalog/{slug}: страницы категорий
  // существуют и лежат в карте сайта, но с витрины на них не вело ничего, и вес с
  // /catalog до них не доходил. Поведение на самой витрине не меняем: обычный клик
  // мышью по-прежнему просто прокручивает к разделу. Клавиатура (Enter, click с
  // detail === 0), Ctrl/Cmd/Shift-клик и средняя кнопка уводят на страницу категории.
  function handleCategoryClick(event: MouseEvent<HTMLAnchorElement>, slug: string) {
    if (event.defaultPrevented || event.detail === 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    scrollTo(slug);
  }

  const itemClass =
    "relative shrink-0 whitespace-nowrap pb-1.5 font-display font-bold tracking-[-0.02em] transition-colors";

  return (
    <div className="sticky top-16 z-30 border-b border-black/10 bg-cream/85 backdrop-blur-xl backdrop-saturate-150 lg:top-[72px]">
      <div className="mx-auto w-full max-w-7xl px-5 lg:px-8">
        <nav
          aria-label={t("Разделы каталога")}
          className="no-scrollbar flex gap-6 overflow-x-auto whitespace-nowrap py-4"
          style={{ scrollSnapType: "x proximity" }}
        >
          {popularCount && popularCount > 0 ? (
            <button
              onClick={() => scrollTo("popular")}
              aria-current="page"
              className={`${itemClass} text-dark`}
              style={{ fontSize: "clamp(20px,3.4vw,26px)", scrollSnapAlign: "start" }}
            >
              {t("Популярное")}
              <span
                aria-hidden
                className="absolute bottom-0 left-0 h-1 rounded-full bg-coral"
                style={{ width: 26 }}
              />
            </button>
          ) : null}
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={categoryPath(cat.slug, locale)}
              onClick={(event) => handleCategoryClick(event, cat.slug)}
              // Обычный клик прокручивает, а не переходит — предзагружать страницу
              // категории заранее незачем.
              prefetch={false}
              className={`${itemClass} text-muted-light hover:text-ink-soft focus-visible:text-ink-soft focus-visible:outline-none focus-visible:underline`}
              style={{ fontSize: "clamp(20px,3.4vw,26px)", scrollSnapAlign: "start" }}
            >
              {t(cat.name)}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
