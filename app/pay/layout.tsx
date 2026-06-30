import Link from "next/link";

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-white">
      <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <span className="font-semibold text-gray-900">DC Bakery</span>
        <Link href="/profile" className="text-sm text-gray-600 hover:text-gray-900">
          Личный кабинет
        </Link>
      </header>
      <main>{children}</main>
    </div>
  );
}
