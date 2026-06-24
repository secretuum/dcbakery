"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { B2B_PAYMENT_METHODS, MIN_ORDER_AMOUNT } from "@/app/constants";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { useCart } from "@/src/contexts/CartContext";
import { useToast } from "@/src/contexts/ToastContext";
import { formatPrice } from "@/src/lib/format";

type CheckoutFormState = {
  company_name: string;
  customer_bin: string;
  customer_email: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_date: string;
  delivery_time: string;
  payment_method: string;
  request_avr: boolean;
  comment: string;
};

type CheckoutFormErrors = Partial<Record<keyof CheckoutFormState, string>>;

const fieldClassName =
  "min-h-12 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-medium text-dark outline-none transition placeholder:text-muted focus:border-coral focus:ring-2 focus:ring-coral/25";

function getTomorrowDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  const normalized = `${digits.startsWith("8") ? "7" : digits.startsWith("7") ? "" : "7"}${
    digits.startsWith("8") ? digits.slice(1) : digits
  }`.slice(0, 11);
  const code = normalized.slice(1, 4);
  const first = normalized.slice(4, 7);
  const second = normalized.slice(7, 9);
  const third = normalized.slice(9, 11);

  let formatted = "+7";

  if (code) {
    formatted += ` (${code}`;
  }

  if (code.length === 3) {
    formatted += ")";
  }

  if (first) {
    formatted += ` ${first}`;
  }

  if (second) {
    formatted += `-${second}`;
  }

  if (third) {
    formatted += `-${third}`;
  }

  return formatted;
}

function validateForm(form: CheckoutFormState) {
  const errors: CheckoutFormErrors = {};
  const phoneDigits = form.customer_phone.replace(/\D/g, "");
  const tomorrow = getTomorrowDate();

  if (!form.company_name.trim()) {
    errors.company_name = "Укажите название компании или заведения";
  }

  if (!form.customer_name.trim()) {
    errors.customer_name = "Укажите контактное лицо";
  }

  if (phoneDigits.length < 11) {
    errors.customer_phone = "Укажите полный номер телефона";
  }

  if (!form.delivery_date) {
    errors.delivery_date = "Выберите дату доставки";
  } else if (form.delivery_date < tomorrow) {
    errors.delivery_date = "Дата должна быть не раньше завтра";
  }

  return errors;
}

function FieldError({ children }: { children?: string }) {
  if (!children) {
    return null;
  }

  return <p className="mt-2 text-xs font-bold text-burgundy">{children}</p>;
}

export function CheckoutForm() {
  const router = useRouter();
  const { clear, isReady, items, totalAmount, totalItems } = useCart();
  const { showToast } = useToast();
  const tomorrow = useMemo(() => getTomorrowDate(), []);
  const hasQuoteItems = items.some((item) => item.product.price <= 0);
  const canCheckout = totalAmount >= MIN_ORDER_AMOUNT;
  const [errors, setErrors] = useState<CheckoutFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<CheckoutFormState>({
    company_name: "",
    customer_bin: "",
    customer_email: "",
    customer_name: "",
    customer_phone: "",
    delivery_address: "",
    delivery_date: tomorrow,
    delivery_time: "День 12-18",
    payment_method: "Выставить счет",
    request_avr: false,
    comment: "",
  });

  useEffect(() => {
    if (isReady && items.length === 0) {
      router.replace("/catalog");
    }
  }, [isReady, items.length, router]);

  function updateField<Field extends keyof CheckoutFormState>(
    field: Field,
    value: CheckoutFormState[Field],
  ) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateForm(form);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      showToast("Проверьте обязательные поля", "error");
      return;
    }

    if (!canCheckout) {
      showToast("Минимальная сумма заказа пока не набрана", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          items: items.map((item) => ({
            price: item.product.price,
            product_id: item.product.id,
            product_name: item.product.name,
            qty: item.qty,
            total_amount: item.product.price * item.qty,
            unit: item.product.unit,
          })),
        }),
      });

      if (!response.ok) {
        showToast("Не удалось отправить заявку, проверьте данные", "error");
        return;
      }

      const result = (await response.json()) as { orderId?: string; orderNumber?: string };
      const orderNumber = result.orderNumber ?? "DCB";
      const orderIdParam = result.orderId ? `&id=${encodeURIComponent(result.orderId)}` : "";

      clear();
      showToast("Заявка отправлена", "success");
      router.push(`/order-success?n=${encodeURIComponent(orderNumber)}${orderIdParam}`);
    } catch {
      showToast("Ошибка отправки, попробуйте снова", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isReady || items.length === 0) {
    return (
      <main className="min-h-screen bg-cream px-5 py-16 text-dark lg:px-8">
        <section className="mx-auto max-w-2xl rounded-card bg-white p-8 text-center shadow-[0_18px_60px_rgba(120,51,38,0.10)]">
          <p className="text-sm font-black uppercase text-raspberry">Оформление</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">Проверяем корзину</h1>
          <p className="mt-4 text-sm font-semibold leading-6 text-muted">
            Если корзина пуста, вернем вас в каталог.
          </p>
        </section>
      </main>
    );
  }

  if (!canCheckout) {
    return (
      <main className="min-h-screen bg-cream px-5 py-16 text-dark lg:px-8">
        <section className="mx-auto max-w-2xl rounded-card bg-white p-8 text-center shadow-[0_18px_60px_rgba(120,51,38,0.10)]">
          <p className="text-sm font-black uppercase text-raspberry">Минимальный заказ</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">Нужно добрать корзину</h1>
          <p className="mt-4 text-sm font-semibold leading-6 text-muted">
            Для B2B-заявки минимальная сумма составляет {formatPrice(MIN_ORDER_AMOUNT)}.
          </p>
          <Link
            href="/cart"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-btn bg-coral px-5 py-3 text-sm font-black text-white transition hover:bg-coral-hover"
          >
            Вернуться в корзину
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream px-5 py-10 text-dark lg:px-8 lg:py-14">
      <section className="mx-auto max-w-7xl">
        <div>
          <p className="text-sm font-black uppercase text-raspberry">Оформление заявки</p>
          <h1 className="mt-3 text-5xl font-black leading-tight tracking-tight sm:text-6xl">
            Контакты и доставка
          </h1>
          <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-muted">
            Заявка отправится в локальный API. База данных и админская часть будут подключаться
            отдельными шагами.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          <form
            onSubmit={handleSubmit}
            className="rounded-card bg-white p-5 shadow-[0_18px_60px_rgba(120,51,38,0.10)] sm:p-6"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-sm font-black text-dark">Название компании / заведения</span>
                <Input
                  className="mt-2"
                  value={form.company_name}
                  onChange={(event) => updateField("company_name", event.currentTarget.value)}
                  placeholder="Например, Coffee Point"
                />
                <FieldError>{errors.company_name}</FieldError>
              </label>

              <label className="block sm:col-span-2">
                <span className="text-sm font-black text-dark">БИН / ИП</span>
                <Input
                  className="mt-2"
                  value={form.customer_bin}
                  onChange={(event) => updateField("customer_bin", event.currentTarget.value)}
                  placeholder="Например, 123456789012"
                />
              </label>

              <label className="block">
                <span className="text-sm font-black text-dark">Контактное лицо</span>
                <Input
                  className="mt-2"
                  value={form.customer_name}
                  onChange={(event) => updateField("customer_name", event.currentTarget.value)}
                  placeholder="Имя менеджера"
                />
                <FieldError>{errors.customer_name}</FieldError>
              </label>

              <label className="block">
                <span className="text-sm font-black text-dark">Телефон</span>
                <Input
                  className="mt-2"
                  inputMode="tel"
                  value={form.customer_phone}
                  onChange={(event) =>
                    updateField("customer_phone", formatPhone(event.currentTarget.value))
                  }
                  placeholder="+7 (___) ___-__-__"
                />
                <FieldError>{errors.customer_phone}</FieldError>
              </label>

              <label className="block sm:col-span-2">
                <span className="text-sm font-black text-dark">Email для документов</span>
                <Input
                  className="mt-2"
                  inputMode="email"
                  type="email"
                  value={form.customer_email}
                  onChange={(event) => updateField("customer_email", event.currentTarget.value)}
                  placeholder="accounting@example.com"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="text-sm font-black text-dark">Адрес доставки</span>
                <Input
                  className="mt-2"
                  value={form.delivery_address}
                  onChange={(event) => updateField("delivery_address", event.currentTarget.value)}
                  placeholder="Город, улица, дом, точка"
                />
              </label>

              <label className="block">
                <span className="text-sm font-black text-dark">Дата доставки</span>
                <Input
                  className="mt-2"
                  min={tomorrow}
                  type="date"
                  value={form.delivery_date}
                  onChange={(event) => updateField("delivery_date", event.currentTarget.value)}
                />
                <FieldError>{errors.delivery_date}</FieldError>
              </label>

              <label className="block">
                <span className="text-sm font-black text-dark">Время</span>
                <select
                  className={`${fieldClassName} mt-2`}
                  value={form.delivery_time}
                  onChange={(event) => updateField("delivery_time", event.currentTarget.value)}
                >
                  <option>Утро 8-12</option>
                  <option>День 12-18</option>
                  <option>Договориться с менеджером</option>
                </select>
              </label>

              <label className="block sm:col-span-2">
                <span className="text-sm font-black text-dark">Способ оплаты</span>
                <select
                  className={`${fieldClassName} mt-2`}
                  value={form.payment_method}
                  onChange={(event) => updateField("payment_method", event.currentTarget.value)}
                >
                  {B2B_PAYMENT_METHODS.map((paymentMethod) => (
                    <option key={paymentMethod}>{paymentMethod}</option>
                  ))}
                </select>
                <p className="mt-2 text-xs font-semibold leading-5 text-muted">
                  После подтверждения заявки система подготовит страницу счета.
                </p>
              </label>

              <label className="flex items-start gap-3 rounded-btn bg-cream px-4 py-3 sm:col-span-2">
                <input
                  checked={form.request_avr}
                  className="mt-1 size-4 accent-coral"
                  type="checkbox"
                  onChange={(event) => updateField("request_avr", event.currentTarget.checked)}
                />
                <span>
                  <span className="block text-sm font-black text-dark">Нужен АВР</span>
                  <span className="mt-1 block text-xs font-semibold leading-5 text-muted">
                    Акт выполненных работ станет доступен после завершения заказа.
                  </span>
                </span>
              </label>

              <label className="block sm:col-span-2">
                <span className="text-sm font-black text-dark">Комментарий</span>
                <textarea
                  className={`${fieldClassName} mt-2 min-h-32 resize-y`}
                  value={form.comment}
                  onChange={(event) => updateField("comment", event.currentTarget.value)}
                  placeholder="Особые условия, удобный контакт, детали доставки"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link href="/cart" className="text-sm font-black text-muted transition hover:text-dark">
                Вернуться в корзину
              </Link>
              <Button type="submit" disabled={isSubmitting} className="min-h-12 px-6">
                {isSubmitting ? "Отправляем..." : "Отправить заявку"}
              </Button>
            </div>
          </form>

          <aside className="rounded-card bg-white p-5 shadow-[0_18px_60px_rgba(120,51,38,0.10)] lg:sticky lg:top-28">
            <p className="text-sm font-black uppercase text-raspberry">Сводка</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">Ваш заказ</h2>
            <div className="mt-6 space-y-3 text-sm font-bold">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted">Товаров</span>
                <span>{totalItems}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted">Позиций</span>
                <span>{items.length}</span>
              </div>
              <div className="flex items-end justify-between gap-4 border-t border-black/10 pt-4">
                <span className="text-muted">Итого</span>
                <span className="text-3xl font-black">{formatPrice(totalAmount)}</span>
              </div>
            </div>

            {hasQuoteItems ? (
              <p className="mt-5 rounded-btn bg-coral-light px-4 py-3 text-xs font-bold leading-5 text-burgundy">
                В заявке есть товары с ценой по запросу. Менеджер подтвердит их стоимость отдельно.
              </p>
            ) : null}
          </aside>
        </div>
      </section>
    </main>
  );
}
