import type { Metadata } from "next";
import { fetchWhatsAppClients } from "@/src/lib/whatsapp-client-store";
import { fetchProducts } from "@/src/lib/catalog";
import { NewOrderForm } from "@/src/components/admin/NewOrderForm";

export const metadata: Metadata = {
  title: "Новая заявка | Админка DC Bakery",
};

export default async function NewAdminOrderPage() {
  const [clients, products] = await Promise.all([fetchWhatsAppClients(), fetchProducts()]);

  const clientOptions = clients.map((client) => ({
    chatId: client.chatId,
    label: client.companyName?.trim() || client.customerPhone?.trim() || client.chatId,
  }));
  // v1: товары «по запросу» (без цены) пропускаем — заявка считает сумму по каталогу.
  const productOptions = products
    .filter((product) => product.price > 0)
    .map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      unit: product.unit ?? "шт",
    }));

  return <NewOrderForm clients={clientOptions} products={productOptions} />;
}
