"use client";
// Корневой обработчик ошибок (ловит падения в самом root-layout). Рендерит свой
// <html>/<body>, поэтому стили — инлайн. Репортит ошибку в мониторинг.

import { useEffect } from "react";
import { reportError } from "@/src/lib/monitoring";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { where: "global-error", extra: { digest: error.digest } });
  }, [error]);

  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#faf6f0",
          color: "#2a1e22",
          fontFamily: "-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ maxWidth: 460, textAlign: "center", padding: 24 }}>
          <p style={{ color: "#A81860", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", fontSize: 13 }}>
            DC Bakery
          </p>
          <h1 style={{ fontSize: 26, margin: "8px 0 6px" }}>Что-то пошло не так</h1>
          <p style={{ color: "#7a6b70", fontSize: 15, lineHeight: 1.5 }}>
            Мы уже знаем о проблеме. Обновите страницу или попробуйте ещё раз.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 18,
              border: "none",
              borderRadius: 999,
              background: "#A81860",
              color: "#fff",
              fontWeight: 600,
              fontSize: 15,
              padding: "12px 26px",
              cursor: "pointer",
            }}
          >
            Обновить
          </button>
        </div>
      </body>
    </html>
  );
}
