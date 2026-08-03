import "server-only";
// Письмо-подтверждение заказа клиенту (Resend). Best-effort: если нет email или ключа —
// просто не отправится. HTML с инлайн-стилями (требование почтовых клиентов).

import type { Order, OrderItem } from "@/src/types";
import { orderTotalWithDelivery } from "@/app/constants";
import { sendEmail } from "@/src/lib/email";

function tenge(value: number): string {
  const rounded = Math.round(Number(value) || 0);
  return `${rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₸`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function orderConfirmationEmail(order: Order, items: OrderItem[]): { subject: string; html: string } {
  const rows = items
    .map(
      (it) => `
      <tr>
        <td style="padding:7px 0;border-bottom:1px solid #f0e9e0;color:#2a1e22">
          ${escapeHtml(it.product_name)} <span style="color:#7a6b70">× ${it.qty} ${escapeHtml(it.unit ?? "шт")}</span>
        </td>
        <td style="padding:7px 0;border-bottom:1px solid #f0e9e0;text-align:right;color:#2a1e22;font-weight:600;white-space:nowrap">${tenge(it.total_amount)}</td>
      </tr>`,
    )
    .join("");

  const deliveryLine =
    order.delivery_amount && order.delivery_amount > 0 ? tenge(order.delivery_amount) : "бесплатно";

  const html = `
  <div style="margin:0;padding:24px;background:#faf6f0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2a1e22">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e7ddd4;border-radius:16px;overflow:hidden">
      <div style="padding:22px 26px;background:#A81860;color:#fff">
        <div style="font-weight:800;letter-spacing:.12em;text-transform:uppercase;font-size:13px">DC Bakery</div>
        <div style="font-size:20px;font-weight:700;margin-top:6px">Заявка ${escapeHtml(order.order_number)} принята</div>
      </div>
      <div style="padding:24px 26px">
        <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#3c2f33">
          Спасибо за заказ! Менеджер проверит наличие и сумму, подтвердит заявку и пришлёт счёт. Статус — в личном кабинете на сайте.
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px">
          <tr><td style="padding:3px 0;color:#7a6b70">Товары</td><td style="padding:3px 0;text-align:right">${tenge(order.total_amount)}</td></tr>
          <tr><td style="padding:3px 0;color:#7a6b70">Доставка</td><td style="padding:3px 0;text-align:right">${deliveryLine}</td></tr>
          <tr><td style="padding:8px 0 0;font-weight:700;font-size:16px">Итого</td><td style="padding:8px 0 0;text-align:right;font-weight:800;font-size:16px;color:#A81860">${tenge(orderTotalWithDelivery(order))}</td></tr>
        </table>
        ${
          order.delivery_address
            ? `<p style="margin:18px 0 0;font-size:13px;color:#7a6b70">Адрес доставки: <span style="color:#2a1e22">${escapeHtml(order.delivery_address)}</span></p>`
            : ""
        }
        ${
          order.delivery_date
            ? `<p style="margin:4px 0 0;font-size:13px;color:#7a6b70">Дата: <span style="color:#2a1e22">${escapeHtml(order.delivery_date)}${order.delivery_time ? `, ${escapeHtml(order.delivery_time)}` : ""}</span></p>`
            : ""
        }
      </div>
      <div style="padding:16px 26px;border-top:1px solid #e7ddd4;font-size:12px;color:#9a8f93">
        DC Bakery · оптовые поставки · dc-bakery.kz
      </div>
    </div>
  </div>`;

  return { subject: `Заявка ${order.order_number} принята — DC Bakery`, html };
}

export async function sendOrderConfirmationEmail(order: Order, items: OrderItem[]): Promise<boolean> {
  if (!order.customer_email) return false;
  const { subject, html } = orderConfirmationEmail(order, items);
  return sendEmail({ to: order.customer_email, subject, html });
}
