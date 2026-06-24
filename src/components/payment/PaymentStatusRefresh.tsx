"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function PaymentStatusRefresh() {
  const router = useRouter();

  useEffect(() => {
    const intervalId = window.setInterval(() => router.refresh(), 5000);

    return () => window.clearInterval(intervalId);
  }, [router]);

  return null;
}
