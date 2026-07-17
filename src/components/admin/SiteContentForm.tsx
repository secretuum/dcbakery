"use client";

import { useState } from "react";
import { useSiteEditFlag, writeSiteEditFlag } from "@/src/components/home/SiteEditMode";
import type { SiteContent } from "@/src/lib/site-content";

// Форма суперадмина: контакты, тексты главной и график поставок.
// Сохраняется одним JSON в app_settings (ключ site_content).

type Props = {
  initialContent: SiteContent;
};

const dayOptions = [
  { value: 1, label: "Пн" },
  { value: 2, label: "Вт" },
  { value: 3, label: "Ср" },
  { value: 4, label: "Чт" },
  { value: 5, label: "Пт" },
  { value: 6, label: "Сб" },
  { value: 0, label: "Вс" },
];

const inputClassName =
  "min-h-11 w-full rounded-btn border border-black/10 bg-cream px-3 py-2 text-sm font-medium text-dark outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25";

export function SiteContentForm({ initialContent }: Props) {
  const [content, setContent] = useState(initialContent);
  const [state, setState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const editMode = useSiteEditFlag();

  function toggleEditMode() {
    writeSiteEditFlag(!editMode);
  }

  function update<Key extends keyof SiteContent>(key: Key, value: SiteContent[Key]) {
    setContent((current) => ({ ...current, [key]: value }));
    setState("idle");
  }

  function toggleDay(day: number) {
    const has = content.deliveryDays.includes(day);
    const next = has
      ? content.deliveryDays.filter((d) => d !== day)
      : [...content.deliveryDays, day];
    if (next.length > 0) {
      update("deliveryDays", next);
    }
  }

  async function handleSave() {
    setState("saving");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "site_content", value: JSON.stringify(content) }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Не удалось сохранить");
      }

      setState("success");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : null);
      setState("error");
    }
  }

  return (
    <section className="rounded-card border border-coral/30 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.15em] text-coral">Суперадмин</p>
          <h2 className="mt-1 font-display text-2xl font-semibold">Контент сайта</h2>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={toggleEditMode}
            aria-pressed={editMode}
            className={`min-h-11 rounded-btn border px-5 py-2 text-sm font-bold transition ${
              editMode
                ? "border-coral bg-coral text-white hover:bg-coral-hover"
                : "border-black/15 bg-white text-dark hover:bg-black/5"
            }`}
          >
            ✎ Редактирование на страницах: {editMode ? "включено" : "выключено"}
          </button>
          <p className="max-w-xs text-right text-xs leading-4 text-muted">
            Включите и откройте сайт — у текстов появятся карандашики.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-semibold text-dark">
          WhatsApp (бот заявок)
          <input
            className={inputClassName}
            value={content.contactWhatsapp}
            onChange={(event) => update("contactWhatsapp", event.currentTarget.value)}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-dark">
          Телефон
          <input
            className={inputClassName}
            value={content.contactPhone}
            onChange={(event) => update("contactPhone", event.currentTarget.value)}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-dark">
          Адрес
          <input
            className={inputClassName}
            value={content.address}
            onChange={(event) => update("address", event.currentTarget.value)}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-dark">
          Режим работы
          <input
            className={inputClassName}
            value={content.workHours}
            onChange={(event) => update("workHours", event.currentTarget.value)}
          />
        </label>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
        <div>
          <p className="text-sm font-semibold text-dark">Дни доставки</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {dayOptions.map((day) => {
              const active = content.deliveryDays.includes(day.value);

              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  aria-pressed={active}
                  className={`min-w-12 rounded-btn border px-3 py-2 text-sm font-bold transition ${
                    active
                      ? "border-coral bg-coral text-white"
                      : "border-black/10 bg-white text-muted hover:bg-black/5"
                  }`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">
            Календарь в оформлении заказа и «График поставок» в подвале обновятся автоматически.
          </p>
        </div>
        <label className="grid gap-1.5 text-sm font-semibold text-dark">
          Приём заявок до (час)
          <input
            className={`${inputClassName} w-28`}
            type="number"
            min={0}
            max={23}
            value={content.orderCutoffHour}
            onChange={(event) => {
              const hour = Number(event.currentTarget.value);
              if (Number.isInteger(hour) && hour >= 0 && hour <= 23) {
                update("orderCutoffHour", hour);
              }
            }}
          />
        </label>
      </div>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-1.5 text-sm font-semibold text-dark">
          Заголовок на главной
          <textarea
            className={`${inputClassName} min-h-20`}
            value={content.heroTitle}
            onChange={(event) => update("heroTitle", event.currentTarget.value)}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-dark">
          Подзаголовок на главной
          <textarea
            className={`${inputClassName} min-h-20`}
            value={content.heroSubtitle}
            onChange={(event) => update("heroSubtitle", event.currentTarget.value)}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-dark">
          Заголовок «О компании»
          <input
            className={inputClassName}
            value={content.aboutTitle}
            onChange={(event) => update("aboutTitle", event.currentTarget.value)}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-dark">
          Текст «О компании»
          <textarea
            className={`${inputClassName} min-h-24`}
            value={content.aboutText}
            onChange={(event) => update("aboutText", event.currentTarget.value)}
          />
        </label>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          disabled={state === "saving"}
          onClick={handleSave}
          className="min-h-11 rounded-btn border border-coral bg-coral px-6 py-2 text-sm font-bold text-white transition hover:bg-coral-hover disabled:opacity-50"
        >
          {state === "saving" ? "Сохраняю…" : "Сохранить контент"}
        </button>
        {state === "success" ? (
          <p className="text-sm font-semibold text-coral">Сохранено — сайт обновится сразу.</p>
        ) : null}
        {state === "error" ? (
          <p className="text-sm font-semibold text-burgundy">
            Не удалось сохранить.{errorMessage ? ` ${errorMessage}` : ""}
          </p>
        ) : null}
      </div>
    </section>
  );
}
