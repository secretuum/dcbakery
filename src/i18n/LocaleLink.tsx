"use client";

import Link from "next/link";
import { forwardRef, type ComponentProps } from "react";
import { useLocale } from "@/src/i18n/client";
import { withLocale } from "@/src/i18n/routing";

type LinkProps = ComponentProps<typeof Link>;

/**
 * next/link, автоматически добавляющий языковой префикс к строковому href
 * (через текущую локаль из контекста). Внешние ссылки и объекты-URL — как есть.
 * Замена импорта `Link from "next/link"` на `{ LocaleLink as Link }` не меняет JSX.
 */
export const LocaleLink = forwardRef<HTMLAnchorElement, LinkProps>(function LocaleLink(
  { href, ...rest },
  ref,
) {
  const locale = useLocale();
  const localizedHref = typeof href === "string" ? withLocale(href, locale) : href;
  return <Link ref={ref} href={localizedHref} {...rest} />;
});
