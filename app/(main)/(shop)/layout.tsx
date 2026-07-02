"use client";

import { usePathname } from "next/navigation";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="pb-52">
      <div key={pathname} className="animate-fadeIn">
        {children}
      </div>
    </div>
  );
}
