"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/Button";

export function AdminLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", {
      method: "POST",
    });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" onClick={handleLogout} className="w-full bg-white">
      Выйти
    </Button>
  );
}
