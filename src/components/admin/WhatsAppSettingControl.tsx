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
  const hasChanges = enabled !== savedValue;

  async function handleSave() {
    setState("saving");

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
      const result = (await response.json()) as {
        setting?: { value?: string | null };
      };

      if (!response.ok || !result.setting) {
        throw new Error("Failed to save setting");
      }

      const nextValue = result.setting.value === "true";
      setEnabled(nextValue);
      setSavedValue(nextValue);
      setState("success");
    } catch {
      setEnabled(savedValue);
      setState("error");
    }
  }

  return (
    <section className="rounded-card bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xl font-black text-dark">{label}</p>
            <span
              className={[
                "rounded-badge px-3 py-1 text-xs font-black",
                enabled ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fee2e2] text-[#991b1b]",
              ].join(" ")}
            >
              {enabled ? "Включено" : "Выключено"}
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-muted">
            {description}
          </p>
          <p className="mt-2 text-xs font-black uppercase text-muted">Ключ: {settingKey}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            className="min-h-11 rounded-xl border border-black/10 bg-cream px-4 py-2 text-sm font-black text-dark outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/25"
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
            className="min-h-11 rounded-btn bg-coral px-5 py-2 text-sm font-black text-white transition hover:bg-coral-hover disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={state === "saving" || !hasChanges}
            onClick={handleSave}
          >
            {state === "saving" ? "Сохраняю..." : "Сохранить"}
          </button>
        </div>
      </div>

      {state === "success" ? (
        <p className="mt-3 text-sm font-bold text-[#166534]">Настройка сохранена.</p>
      ) : null}
      {state === "error" ? (
        <p className="mt-3 text-sm font-bold text-[#991b1b]">
          Не удалось сохранить настройку. Проверьте миграцию app_settings и подключение Supabase.
        </p>
      ) : null}
    </section>
  );
}
