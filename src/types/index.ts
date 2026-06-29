export type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parent_id?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  subcategory?: string;
  description: string;
  composition?: string;
  compositionKz?: string;
  category_id: string;
  category?: Category;
  price: number;
  unit: string;
  weight?: string;
  weightLabel?: string;
  weightGrams?: number;
  shelfLife?: string;
  storage?: string;
  packageType?: string;
  isHalal?: boolean;
  isArchived?: boolean;
  isPopular?: boolean;
  isNew?: boolean;
  isPromo?: boolean;
  source?: string;
  notes?: string[];
  min_qty: number;
  step_qty: number;
  stock_qty: number;
  images: string[];
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export type CartItem = {
  product: Product;
  qty: number;
};

export type OrderStatus =
  | "pending_manager_confirmation"
  | "change_proposed"
  | "confirmed_waiting_payment"
  | "paid"
  | "delivering"
  | "completed"
  | "canceled"
  // Legacy statuses are kept so old rows render safely before/after migration.
  | "new"
  | "confirmed"
  | "in_progress"
  | "ready"
  | "delivered"
  | "cancelled";

export type OrderSource = "website" | "whatsapp" | "admin";

export type PaymentStatus =
  | "unpaid"
  | "payment_link_created"
  | "payment_link_sent"
  | "paid"
  | "failed"
  | "expired"
  | "refunded";

export type PaymentProvider = "halyk" | "freedom" | "manual" | "kaspi_later";

export type Order = {
  id: string;
  order_number: string;
  source?: OrderSource;
  company_name: string;
  customer_bin?: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  delivery_address?: string | null;
  delivery_date?: string | null;
  delivery_time?: string | null;
  payment_method?: string | null;
  request_avr?: boolean;
  comment?: string | null;
  cancellation_actor?: string | null;
  cancellation_reason?: string | null;
  revision_note?: string | null;
  revision_payload?: unknown;
  revision_requested_at?: string | null;
  client_response_at?: string | null;
  status: OrderStatus;
  total_amount: number;
  payment_status?: PaymentStatus | null;
  payment_provider?: PaymentProvider | null;
  payment_url?: string | null;
  payment_id?: string | null;
  telegram_message_id?: string | null;
  whatsapp_message_id?: string | null;
  confirmed_at?: string | null;
  payment_link_sent_at?: string | null;
  paid_at?: string | null;
  canceled_at?: string | null;
  created_at: string;
  updated_at?: string;
};

export type OrderItem = {
  category?: string | null;
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  unit: string;
  qty: number;
  price: number;
  total_amount: number;
};

export type OrderItemSummary = {
  id: string;
  product_name: string;
  unit: string;
  qty: number;
  price: number;
  total_amount: number;
};

export type ClientOrderSummary = {
  id: string;
  order_number: string;
  company_name: string;
  status: OrderStatus;
  payment_status?: PaymentStatus | null;
  revision_note?: string | null;
  total_amount: number;
  delivery_date?: string | null;
  payment_url?: string | null;
  created_at: string;
  order_items?: OrderItemSummary[];
};

export type ProductStopEvent = {
  id: string;
  product_id: string;
  product_name: string;
  reason?: string | null;
  source?: string | null;
  reported_by_chat_id?: string | null;
  started_at: string;
  ended_at?: string | null;
  created_at?: string;
  updated_at?: string;
};
