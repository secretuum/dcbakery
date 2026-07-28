// Карта «товар сайта (slug) → iiko productId (GUID)» для списания заказа в iiko.
// Сгенерирована из .iiko-cache: IIKO_NUMS (nomenclature-1c.ts) → num, затем
// num→id по iiko-resto-products.json. Все 40 позиций сматчены (0 потерь).
// Тип iiko (DISH/PREPARED/GOODS) в комментарии — для справки: DISH iiko списывает
// по ТТК на ингредиенты, PREPARED/GOODS — напрямую (нам считать не нужно).
// .iiko-cache в git не входит, поэтому карта зафиксирована статически.

export const IIKO_PRODUCT_IDS: Record<string, string> = {
  "pelmeni-s-govyadinoy": "d0613043-5e98-4ad2-9f97-e41d2bd2da20", // DISH
  "vareniki-s-kartofelem": "9a272ffd-3fca-4eac-a70e-141a5c1a879d", // DISH
  "kotlety-govyazhi": "ab923979-8925-413d-8be8-1212b96c9a79", // DISH
  "kotlety-kurinye": "f2b05ee9-ded9-4a40-b0be-1f047fd833f2", // DISH
  "syrniki-s-irimshikom": "e4a77832-e87e-475b-9d02-4ea57381cb47", // DISH
  "syrniki-klassicheskie": "cc32e8f9-ca78-4956-91e2-9a03dc819dad", // DISH
  "manty-s-govyadinoy-i-tykvoy": "e527ca16-6f17-4352-b375-473b1c3f2ce5", // DISH
  "samsa-s-govyadinoy-i-tykvoy": "559785f7-7960-4fa6-b1b3-b76383d670f3", // DISH
  "samsa-s-kuritsey": "97d8a4c4-f0c3-4db2-a9f5-db48f38c47ae", // PREPARED
  "mini-chebureki-s-dzhusaem": "6a77671c-ed12-4896-b504-099c8615af49", // DISH
  "mini-chebureki-s-govyazhim-farshem-i-lukom": "6a77671c-ed12-4896-b504-099c8615af49", // DISH
  "myaso-govyadiny": "e11061b5-df5c-4803-abec-6e4b05c47c15", // PREPARED
  "farsh-govyazhiy": "a307460e-6d47-41f7-9b89-730afc8a287b", // GOODS
  ribay: "bdcc2765-00ae-4f09-ba5a-300dcec80ad5", // DISH
  tibon: "7927cf51-08e1-4fc0-a647-c59e5bc1351f", // DISH
  napoleon: "52f3fb6a-47d7-420a-926c-20d074e0430b", // PREPARED
  medovik: "36ba1677-0e16-4fcc-bf07-e290a7d69a4d", // DISH
  "molochnaya-devochka": "da6977ea-b128-466a-8d3c-d2f0a76323cd", // DISH
  snikers: "4514baf3-9c8c-4a8a-9776-55e0080a90fe", // DISH
  "ispanskiy-chizkeyk": "edabb6ae-1e3a-47ea-a80d-f816cf39cf88", // PREPARED
  "tary-chizkeyk": "3413aef7-b705-4627-b053-ebc4eb4ec5f8", // PREPARED
  sinnabon: "8b87cc43-8ba5-444c-afbd-5abfa2a27778", // DISH
  kartoshka: "5ef2e823-6798-4956-aa8e-6ea10ddaa55b", // DISH
  "merengovyy-rulet-tselnyy": "56fa588e-dfa0-4611-842f-c12b429097c9", // DISH
  "fistashkovyy-rulet": "a5d45613-afa9-46a1-ae42-7cd75c82e084", // DISH
  "fistashkovyy-rulet-tselnyy": "a5d45613-afa9-46a1-ae42-7cd75c82e084", // DISH
  "tartaletka-tvorozhnaya": "f5452e9d-ab44-4052-be16-0b9b3688b050", // DISH
  "tartaletka-bannofi-pay": "ed7f9e0a-56a4-4366-a3b0-d64373d17d45", // PREPARED
  kukis: "9e685ecc-341d-40c1-a8bf-df854e997dce", // PREPARED
  "maffin-shokoladnyy": "23faba81-235b-443e-b968-95966ed6db61", // PREPARED
  "tort-medovik": "c80e8bfa-2495-4581-99ad-42598634769a", // DISH
  "tort-napoleon": "4369b26a-763e-47c0-95b5-4f7fee7f52e9", // DISH
  "tort-molochnaya-devochka": "3329c77f-963e-4e93-92d6-8f6232bff5b1", // DISH
  "tort-snikers": "f4a585d8-10dc-441d-9435-ce723683ae20", // DISH
  "banka-keyk-fistashkovyy": "fde9d653-3c4c-4913-8180-970859ae0164", // DISH
  "banka-keyk-krasnyy-barhat": "c2ce2c3d-ef8c-42ee-ae1c-a1ce5830ff0f", // DISH
  "banka-keyk-tiramisu": "2228dcd8-f643-4317-a444-86bb9b9d9f41", // DISH
  "banka-keyk-oreo": "3ac9014c-5791-414e-95c9-d68d82f7247d", // DISH
  "molochnaya-devochka-banketnaya": "eeb4febf-451b-4602-9e72-4da7349a39e2", // DISH
  "tort-vuppi-banketnyy": "c80e8bfa-2495-4581-99ad-42598634769a", // DISH
};

/** iiko productId по slug товара, или "" если позиция не заведена в iiko. */
export function iikoProductId(slug: string | null | undefined): string {
  return slug ? (IIKO_PRODUCT_IDS[slug] ?? "") : "";
}
