import type { ReactNode } from "react";
import { AdminShell } from "@/src/components/admin/AdminShell";
import { getCurrentAdminRole } from "@/src/lib/superadmin";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const role = await getCurrentAdminRole();
  return <AdminShell role={role}>{children}</AdminShell>;
}
