// ВРЕМЕННАЯ проба next/root-params для B3 (стадия 0). УДАЛИТЬ после проверки.
// Цель: подтвердить, что (а) проект собирается с experimental.rootParams,
// (б) экспорт называется `locale` (по имени сегмента [locale]),
// (в) locale() возвращает верное значение под сегментом [locale].
import { locale as rootLocale } from "next/root-params";

export default async function RpTest({ params }: { params: Promise<{ locale: string }> }) {
  const fromParams = (await params).locale;
  let fromRootParams: string;
  try {
    fromRootParams = String(await rootLocale());
  } catch (e) {
    fromRootParams = "THROW: " + (e instanceof Error ? e.message : String(e));
  }
  return (
    <pre style={{ padding: 24, fontSize: 16 }}>
      params.locale = {fromParams}
      {"\n"}
      root-params locale() = {fromRootParams}
    </pre>
  );
}
