import type { Metadata } from "next";
import { SITE_URL } from "@/src/lib/site-url";

// Глобальный 404 для НЕсопоставленных путей. В мультикорне (после B3 корневого layout
// нет) эта страница рендерит СВОЙ <html>/<body> — как global-error.tsx, поэтому стили
// инлайн. metadataBase здесь фиксит og:image (иначе резолвился в localhost) и <html lang>.
// Обычные «голые» пути middleware уводит 308 → /{locale}/…, там свой локализованный 404;
// сюда попадают лишь редкие вправду несопоставимые адреса.

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Страница не найдена — DC Bakery",
  robots: { index: false, follow: false },
};

export default function NotFound() {
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
          <h1 style={{ fontSize: 26, margin: "8px 0 6px" }}>Страница не найдена</h1>
          <p style={{ color: "#7a6b70", fontSize: 15, lineHeight: 1.5 }}>
            Такой страницы нет. Вернитесь на главную — там каталог и оформление заказа.
          </p>
          {/* Полная навигация на главную: страница рендерит СВОЙ документ вне SPA-оболочки
              (мультикорень, своего router-контекста нет), поэтому next/link здесь неуместен. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              marginTop: 18,
              display: "inline-block",
              borderRadius: 999,
              background: "#A81860",
              color: "#fff",
              fontWeight: 600,
              fontSize: 15,
              padding: "12px 26px",
              textDecoration: "none",
            }}
          >
            На главную
          </a>
        </div>
      </body>
    </html>
  );
}
