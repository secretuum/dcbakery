"use client";

export function DocumentPrintButton() {
  return (
    <button
      className="print-hidden inline-flex min-h-12 items-center justify-center rounded-btn bg-coral px-5 py-3 text-sm font-black text-white transition hover:bg-coral-hover"
      type="button"
      onClick={() => window.print()}
    >
      Скачать или распечатать
    </button>
  );
}
