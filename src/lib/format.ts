export function formatPrice(price: number) {
  return `${new Intl.NumberFormat("ru-KZ").format(price)} ₸`;
}

export function formatProductPrice(price: number) {
  return price > 0 ? formatPrice(price) : "Цена уточняется";
}
