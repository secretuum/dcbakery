import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminLoginForm } from "@/src/components/admin/AdminLoginForm";

export const metadata: Metadata = {
  title: "Вход в админку | DC Bakery",
};

export default function AdminLoginPage() {
  return (
    <main className="min-h-screen bg-cream px-5 py-16 text-dark lg:px-8">
      <section className="mx-auto max-w-md">
        <Suspense>
          <AdminLoginForm />
        </Suspense>
      </section>
    </main>
  );
}
