"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MIN_ORDER_AMOUNT } from "@/app/constants";
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
  comment: string;
  oferta_accepted: boolean;
};

type CheckoutFormErrors = Partial<Record<keyof CheckoutFormState, string>>;

const fieldClassName =
  "min-h-12 w-full rounded-btn border border-black/10 bg-white px-4 py-3 text-sm font-medium text-dark outline-none transition placeholder:text-muted focus:border-coral focus:ring-2 focus:ring-coral/25";

const DELIVERY_WINDOW_DAYS = 14;
// Дефолты дублируют defaultSiteContent — используются, пока настройки не загрузились
const DEFAULT_DELIVERY_DAYS = [2, 4, 6];
const DEFAULT_CUTOFF_HOUR = 18;

type DeliverySchedule = {
  /** Дни доставки: 0 = воскресенье … 6 = суббота */
  deliveryDays: number[];
  /** Приём заявок до этого часа накануне дня доставки */
  cutoffHour: number;
};

function toDateString(input: Date) {
  const date = new Date(input);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

type DeliveryDateOption = {
  value: string;
  disabled: boolean;
  reason?: string;
  weekdayLabel: string;
  dayLabel: string;
};

const weekdayFormat = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });
const dayFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
const shortDayLabels = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

export function formatShortDeliveryDays(days: number[]) {
  return days
    .slice()
    .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
    .map((d) => shortDayLabels[d] ?? "")
    .filter(Boolean)
    .join(" · ");
}

// Доставка в день X возможна, если заявка успевает до отсечки накануне:
// сегодня минимум за 2 дня до X, либо ровно накануне и сейчас раньше cutoffHour.
function getDeliveryDateOptions(schedule: DeliverySchedule): DeliveryDateOption[] {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() + 1);

  return Array.from({ length: DELIVERY_WINDOW_DAYS }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const isDeliveryDay = schedule.deliveryDays.includes(date.getDay());
    const beforeCutoff = i >= 1 || now.getHours() < schedule.cutoffHour;

    return {
      value: toDateString(date),
      disabled: !isDeliveryDay || !beforeCutoff,
      reason: !isDeliveryDay
        ? "В этот день доставки нет"
        : !beforeCutoff
          ? `Приём заявок на эту дату закрыт в ${schedule.cutoffHour}:00`
          : undefined,
      weekdayLabel: weekdayFormat.format(date),
      dayLabel: dayFormat.format(date).replace(".", ""),
    };
  });
}

function isDeliveryDayDate(value: string, schedule: DeliverySchedule) {
  return schedule.deliveryDays.includes(new Date(`${value}T00:00:00`).getDay());
}

const emptySubscribe = () => () => {};

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

function validateForm(form: CheckoutFormState, schedule: DeliverySchedule) {
  const errors: CheckoutFormErrors = {};
  const phoneDigits = form.customer_phone.replace(/\D/g, "");
  const minDeliveryDate = getDeliveryDateOptions(schedule).find((option) => !option.disabled)?.value ?? "";

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
  } else if (!isDeliveryDayDate(form.delivery_date, schedule)) {
    errors.delivery_date = `Доставка по этим дням: ${formatShortDeliveryDays(schedule.deliveryDays)}`;
  } else if (!minDeliveryDate || form.delivery_date < minDeliveryDate) {
    errors.delivery_date = "Эта дата уже недоступна, выберите более позднюю";
  }

  if (!form.oferta_accepted) {
    errors.oferta_accepted = "Необходимо принять условия оферты";
  }

  return errors;
}

function FieldError({ children }: { children?: string }) {
  if (!children) {
    return null;
  }

  return <p className="mt-2 text-xs font-bold text-burgundy">{children}</p>;
}

type CheckoutFormProps = {
  deliveryDays?: number[];
  cutoffHour?: number;
};

export function CheckoutForm({
  deliveryDays = DEFAULT_DELIVERY_DAYS,
  cutoffHour = DEFAULT_CUTOFF_HOUR,
}: CheckoutFormProps) {
  const router = useRouter();
  const { clear, isReady, items, totalAmount, totalItems } = useCart();
  const { showToast } = useToast();
  // Массив с сервера пересоздаётся на каждый рендер — мемоизируем по содержимому
  const deliveryDaysKey = deliveryDays.join(",");
  const schedule = useMemo<DeliverySchedule>(
    () => ({
      deliveryDays: deliveryDaysKey
        ? deliveryDaysKey.split(",").map(Number)
        : DEFAULT_DELIVERY_DAYS,
      cutoffHour,
    }),
    [deliveryDaysKey, cutoffHour],
  );
  // Даты считаем только на клиенте: страница пререндерится статически, и дата из билда
  // не совпала бы с датой клиента при гидрации
  const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const deliveryOptions = useMemo(
    () => (isMounted ? getDeliveryDateOptions(schedule) : null),
    [isMounted, schedule],
  );
  const firstAvailableDate = deliveryOptions?.find((option) => !option.disabled)?.value ?? "";
  const hasQuoteItems = items.some((item) => item.product.price <= 0);
  const canCheckout = totalAmount >= MIN_ORDER_AMOUNT;
  const [errors, setErrors] = useState<CheckoutFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isNavigatingRef = useRef(false);
  const [form, setForm] = useState<CheckoutFormState>({
    company_name: "",
    customer_bin: "",
    customer_email: "",
    customer_name: "",
    customer_phone: "",
    delivery_address: "",
    delivery_date: "",
    delivery_time: "День 12-18",
    payment_method: "Выставить счет",
    comment: "",
    oferta_accepted: false,
  });

  useEffect(() => {
    if (isReady && items.length === 0 && !isNavigatingRef.current) {
      router.replace("/catalog");
    }
  }, [isReady, items.length, router]);

  // Пока пользователь не выбрал дату сам — подставляется ближайшая доступная
  const selectedDeliveryDate = form.delivery_date || firstAvailableDate;

  function updateField<Field extends keyof CheckoutFormState>(
    field: Field,
    value: CheckoutFormState[Field],
  ) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const submission = { ...form, delivery_date: selectedDeliveryDate };
    const nextErrors = validateForm(submission, schedule);

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
          ...submission,
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

      isNavigatingRef.current = true;
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
        <section className="mx-auto max-w-2xl rounded-card border border-black/10 bg-white p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">Оформление</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">Проверяем корзину</h1>
          <p className="mt-4 text-sm leading-6 text-muted">
            Если корзина пуста, вернем вас в каталог.
          </p>
        </section>
      </main>
    );
  }

  if (!canCheckout) {
    return (
      <main className="min-h-screen bg-cream px-5 py-16 text-dark lg:px-8">
        <section className="mx-auto max-w-2xl rounded-card border border-black/10 bg-white p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">Минимальный заказ</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">Нужно добрать корзину</h1>
          <p className="mt-4 text-sm leading-6 text-muted">
            Для B2B-заявки минимальная сумма составляет {formatPrice(MIN_ORDER_AMOUNT)}.
          </p>
          <Link
            href="/cart"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-btn border border-coral bg-coral px-5 py-3 text-sm font-bold text-white transition hover:bg-coral-hover"
          >
            Вернуться в корзину
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream px-5 pb-24 pt-10 text-dark lg:px-8 lg:pb-14 lg:pt-14">
      <section className="mx-auto max-w-7xl">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">Оформление заявки</p>
          <h1 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Контакты и доставка
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
            Заполните контакты и удобное время доставки — менеджер подтвердит заявку и пришлёт
            счёт в WhatsApp.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <form
            onSubmit={handleSubmit}
            className="min-w-0 rounded-card border border-black/10 bg-white p-5 sm:p-6"
          >
            <p className="font-display text-sm font-semibold uppercase tracking-[.05em] text-dark">Контакты</p>
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-sm font-semibold text-dark">Название компании / заведения</span>
                <Input
                  className="mt-2"
                  value={form.company_name}
                  onChange={(event) => updateField("company_name", event.currentTarget.value)}
                  placeholder="Например, Coffee Point"
                />
                <FieldError>{errors.company_name}</FieldError>
              </label>

              <label className="block sm:col-span-2">
                <span className="text-sm font-semibold text-dark">БИН / ИП</span>
                <Input
                  className="mt-2"
                  value={form.customer_bin}
                  onChange={(event) => updateField("customer_bin", event.currentTarget.value)}
                  placeholder="Например, 123456789012"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-dark">Контактное лицо</span>
                <Input
                  className="mt-2"
                  value={form.customer_name}
                  onChange={(event) => updateField("customer_name", event.currentTarget.value)}
                  placeholder="Имя менеджера"
                />
                <FieldError>{errors.customer_name}</FieldError>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-dark">Телефон</span>
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
                <span className="text-sm font-semibold text-dark">Email для документов</span>
                <Input
                  className="mt-2"
                  inputMode="email"
                  type="email"
                  value={form.customer_email}
                  onChange={(event) => updateField("customer_email", event.currentTarget.value)}
                  placeholder="accounting@example.com"
                />
              </label>

            </div>

            <p className="mt-6 border-t border-black/5 pt-6 font-display text-sm font-semibold uppercase tracking-[.05em] text-dark">Доставка</p>
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-sm font-semibold text-dark">Адрес доставки</span>
                <Input
                  className="mt-2"
                  value={form.delivery_address}
                  onChange={(event) => updateField("delivery_address", event.currentTarget.value)}
                  placeholder="Город, улица, дом, точка"
                />
              </label>

              <div className="min-w-0 sm:col-span-2">
                <span className="text-sm font-semibold text-dark">Дата доставки</span>
                {deliveryOptions ? (
                  <div className="no-scrollbar mt-2 flex max-w-full gap-2 overflow-x-auto pb-1">
                    {deliveryOptions.map((option) => {
                      const isSelected = selectedDeliveryDate === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={option.disabled}
                          onClick={() => updateField("delivery_date", option.value)}
                          aria-pressed={isSelected}
                          title={option.reason}
                          className={`flex min-w-16 shrink-0 flex-col items-center rounded-btn border px-3 py-2 transition ${
                            isSelected
                              ? "border-coral bg-coral text-white"
                              : option.disabled
                                ? "cursor-not-allowed border-black/5 bg-black/5 text-muted/50 line-through"
                                : "border-black/10 bg-white text-dark hover:border-coral"
                          }`}
                        >
                          <span className="text-[10px] font-semibold uppercase tracking-[.08em]">
                            {option.weekdayLabel}
                          </span>
                          <span className="mt-0.5 whitespace-nowrap text-sm font-semibold">
                            {option.dayLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-2 h-[3.75rem] rounded-btn border border-black/5 bg-black/5" />
                )}
                <p className="mt-2 text-xs font-semibold leading-5 text-muted">
                  Доставка: {formatShortDeliveryDays(schedule.deliveryDays)}. Приём заявок до{" "}
                  {schedule.cutoffHour}:00 накануне дня доставки.
                </p>
                <FieldError>{errors.delivery_date}</FieldError>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-dark">Время</span>
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

            </div>

            <p className="mt-6 border-t border-black/5 pt-6 font-display text-sm font-semibold uppercase tracking-[.05em] text-dark">Оплата и документы</p>
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* Оплата всегда по счёту — выбор не показываем, значение уходит в заявку по умолчанию */}
              <p className="rounded-btn border border-black/10 bg-cream px-4 py-3 text-sm font-semibold text-dark sm:col-span-2">
                Оплата — по счёту на оплату.
                <span className="mt-1 block text-xs font-semibold leading-5 text-muted">
                  После подтверждения заявки менеджер выставит счёт с реквизитами.
                </span>
              </p>

              <label className="block sm:col-span-2">
                <span className="text-sm font-semibold text-dark">Комментарий</span>
                <textarea
                  className={`${fieldClassName} mt-2 min-h-32 resize-y`}
                  value={form.comment}
                  onChange={(event) => updateField("comment", event.currentTarget.value)}
                  placeholder="Особые условия, удобный контакт, детали доставки"
                />
              </label>
            </div>

            <div className="mt-6 border-t border-black/5 pt-5">
              <label className="flex cursor-pointer items-start gap-3 rounded-btn bg-cream px-4 py-3">
                <input
                  checked={form.oferta_accepted}
                  className="mt-0.5 size-4 shrink-0 accent-coral"
                  type="checkbox"
                  onChange={(event) => updateField("oferta_accepted", event.currentTarget.checked)}
                />
                <span className="text-sm font-semibold leading-6 text-dark">
                  Я ознакомлен(а) и принимаю условия{" "}
                  <a
                    href="/oferta"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-coral hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Публичной оферты
                  </a>{" "}
                  и{" "}
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-coral hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Политики конфиденциальности
                  </a>
                </span>
              </label>
              <FieldError>{errors.oferta_accepted}</FieldError>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link href="/cart" className="inline-flex min-h-11 items-center text-sm font-semibold text-muted transition hover:text-dark">
                Вернуться в корзину
              </Link>
              <Button type="submit" disabled={isSubmitting} className="min-h-12 px-6">
                {isSubmitting ? "Отправляем..." : "Отправить заявку"}
              </Button>
            </div>
          </form>

          <aside className="rounded-card border border-black/10 bg-white p-5 lg:sticky lg:top-28">
            <p className="text-xs font-semibold uppercase tracking-[.15em] text-muted">Сводка</p>
            <h2 className="mt-2 font-display text-lg font-semibold tracking-tight">Ваш заказ</h2>
            <div className="mt-6 space-y-3 text-sm font-semibold">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted">Товаров</span>
                <span className="font-data">{totalItems}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted">Позиций</span>
                <span className="font-data">{items.length}</span>
              </div>
              <div className="flex items-end justify-between gap-4 border-t border-black/10 pt-4">
                <span className="text-muted">Итого</span>
                <span className="font-data text-xl font-semibold text-coral">{formatPrice(totalAmount)}</span>
              </div>
            </div>

            {hasQuoteItems ? (
              <p className="mt-5 rounded-btn bg-coral-light px-4 py-3 text-xs font-semibold leading-5 text-burgundy">
                В заявке есть товары с ценой по запросу. Менеджер подтвердит их стоимость отдельно.
              </p>
            ) : null}
          </aside>
        </div>
      </section>
    </main>
  );
}
