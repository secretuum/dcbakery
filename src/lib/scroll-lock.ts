// Реф-счётчик блокировки прокрутки body. Раньше корзина (CartSheet) и шторка товара
// (ProductSheet) независимо писали document.body.style.overflow; при перекрытии
// оверлеев один снимал блок другого, либо блок «залипал» (страница ощущалась
// зависшей). Теперь единый счётчик: overflow снимаем только когда закрыт последний
// оверлей. Все оверлеи, блокирующие скролл, ДОЛЖНЫ ходить через эти функции.

let lockCount = 0;

export function lockBodyScroll(): void {
  if (typeof document === "undefined") return;
  lockCount += 1;
  document.body.style.overflow = "hidden";
}

export function unlockBodyScroll(): void {
  if (typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = "";
  }
}
