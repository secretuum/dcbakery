"use client";

import { useState } from "react";

type WhatsAppSettingControlProps = {
  description: string;
  initialValue: boolean;
  settingKey: string;
  label: string;
};

export function WhatsAppSettingControl({
  description,
  initialValue,
  settingKey,
  label,
}: WhatsAppSettingControlProps) {
  const [enabled, setEnabled] = useState(initialValue);
  const [savedValue, setSavedValue] = useState(initialValue);
  const [state, setState] = useState<"error" | "idle" | "saving" | "success">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasChanges = enabled !== savedValue;

  async function handleSave() {
    setState("saving");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: settingKey,
          value: enabled ? "true" : "false",
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        setting?: { value?: string | null };
        error?: string;
      };

      if (!response.ok || !result.setting) {
        throw new Error(result.error || "Failed to save setting");
      }

      const nextValue = result.setting.value === "true";
      setEnabled(nextValue);
      setSavedValue(nextValue);
      setState("success");
    } catch (error) {
      setEnabled(savedValue);
      setErrorMessage(error instanceof Error ? error.message : null);
      setState("error");
    }
  }

  return (
    <section className="rounded-card border border-black/10 bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-display text-xl font-semibold text-dark">{label}</p>
            <span
              className={[
                "rounded-badge border px-3 py-1 text-xs font-semibold",
                enabled ? "border-coral/30 bg-coral-light text-coral" : "border-black/10 bg-black/5 text-muted",
              ].join(" ")}
            >
              {enabled ? "Включено" : "Выключено"}
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            {description}
          </p>
          <p className="mt-2 font-data text-xs text-muted">Ключ: {settingKey}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            className="min-h-11 rounded-btn border border-black/10 bg-cream px-4 py-2 text-sm font-semibold text-dark outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
            value={enabled ? "true" : "false"}
            onChange={(event) => {
              setEnabled(event.currentTarget.value === "true");
              setState("idle");
            }}
          >
            <option value="true">Включено</option>
            <option value="false">Выключено</option>
          </select>
          <button
            className="min-h-11 rounded-btn border border-coral bg-coral px-5 py-2 text-sm font-bold text-white transition hover:bg-coral-hover disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={state === "saving" || !hasChanges}
            onClick={handleSave}
          >
            {state === "saving" ? "Сохраняю..." : "Сохранить"}
          </button>
        </div>
      </div>

      {state === "success" ? (
        <p className="mt-3 text-sm font-semibold text-coral">Настройка сохранена.</p>
      ) : null}
      {state === "error" ? (
        <p className="mt-3 text-sm font-semibold text-burgundy">
          Не удалось сохранить настройку.
          {errorMessage ? ` Причина: ${errorMessage}` : " Проверьте миграцию app_settings и подключение Supabase."}
        </p>
      ) : null}
    </section>
  );
}
