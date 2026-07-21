import { ImageResponse } from "next/og";

// Дефолтная OG-картинка сайта (превью при отправке ссылки в WhatsApp/Telegram).
// Латиница намеренно: в next/og без подгрузки шрифта кириллица не рендерится.
// Страницы товара переопределяют это фото товара (см. generateMetadata там).

export const alt = "DC Bakery — B2B wholesale, Almaty";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#fff8f6",
          color: "#2a1512",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 104, fontWeight: 800, letterSpacing: 10 }}>DC BAKERY</div>
        <div style={{ marginTop: 18, fontSize: 36, fontWeight: 600, color: "#c2531f" }}>
          B2B · Almaty
        </div>
        <div style={{ marginTop: 10, fontSize: 26, color: "#7a5c55" }}>
          Desserts · Semi-finished · Meat
        </div>
      </div>
    ),
    { ...size },
  );
}
