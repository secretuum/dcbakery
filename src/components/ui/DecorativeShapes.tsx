import type { CSSProperties } from "react";

type ShapeProps = {
  className?: string;
  style?: CSSProperties;
};

/** Тонкий декоративный слой кругов и геометрии для клиентских страниц.
 *  pointer-events: none, aria-hidden, position: absolute — не влияет на контент.
 */

export function DecorCircle({ className = "", style }: ShapeProps) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute rounded-full ${className}`}
      style={style}
    />
  );
}

export function DecorDiamond({ className = "", style }: ShapeProps) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute ${className}`}
      style={{ clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)", ...style }}
    />
  );
}

export function DecorHex({ className = "", style }: ShapeProps) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute ${className}`}
      style={{ clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)", ...style }}
    />
  );
}

export function DecorTriangle({ className = "", style }: ShapeProps) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute ${className}`}
      style={{ clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)", ...style }}
    />
  );
}

/** Комплект для Hero-секции главной */
export function HeroShapes() {
  return (
    <>
      <DecorCircle
        className="h-64 w-64 bg-coral/15 blur-3xl"
        style={{ top: -40, right: "8%" }}
      />
      <DecorCircle
        className="h-40 w-40 bg-raspberry/12 blur-2xl"
        style={{ bottom: 20, right: "22%" }}
      />
      <DecorDiamond
        className="h-12 w-12 bg-coral/20"
        style={{ top: 60, right: "30%" }}
      />
      <DecorCircle
        className="h-5 w-5 bg-raspberry/30"
        style={{ top: 110, right: "18%" }}
      />
    </>
  );
}

/** Комплект для секций главной (между блоками) */
export function SectionAccentShapes() {
  return (
    <>
      <DecorCircle
        className="h-32 w-32 bg-coral/10 blur-2xl"
        style={{ top: -16, left: "5%" }}
      />
      <DecorHex
        className="h-10 w-10 bg-raspberry/18"
        style={{ top: 20, right: "6%" }}
      />
      <DecorTriangle
        className="h-8 w-8 bg-coral/20"
        style={{ bottom: 10, left: "12%" }}
      />
    </>
  );
}

/** Комплект для страницы каталога */
export function CatalogShapes() {
  return (
    <>
      <DecorCircle
        className="h-80 w-80 bg-coral/10 blur-3xl"
        style={{ top: -60, right: -40 }}
      />
      <DecorCircle
        className="h-48 w-48 bg-raspberry/8 blur-2xl"
        style={{ top: 120, left: -20 }}
      />
      <DecorDiamond
        className="h-10 w-10 bg-coral/15"
        style={{ top: 40, right: "15%" }}
      />
    </>
  );
}

/** Комплект для профиля клиента */
export function ProfileShapes() {
  return (
    <>
      <DecorCircle
        className="h-56 w-56 bg-coral/12 blur-3xl"
        style={{ top: -30, right: "5%" }}
      />
      <DecorCircle
        className="h-28 w-28 bg-raspberry/10 blur-2xl"
        style={{ top: 80, left: "3%" }}
      />
      <DecorHex
        className="h-9 w-9 bg-coral/18"
        style={{ top: 50, right: "20%" }}
      />
      <DecorTriangle
        className="h-7 w-7 bg-raspberry/20"
        style={{ top: 140, left: "18%" }}
      />
    </>
  );
}

/** Один акцент для CartSheet header */
export function CartSheetAccent() {
  return (
    <DecorCircle
      className="h-24 w-24 bg-coral/12 blur-2xl"
      style={{ top: -12, right: 12 }}
    />
  );
}
