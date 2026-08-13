import "server-only";
// Провайдер валидации адреса: эвристика (маркеры города) + бесплатный OSM-геокодер.
// Логика безопасна для легитимных клиентов:
//  - эвристика уверена (в тексте есть «Алматы» / другой город) → ДОВЕРЯЕМ ей, геокодер не опрокидывает;
//  - эвристика НЕ уверена (клиент написал только улицу) → РЕШАЕМ геокодером: другой город → отказ,
//    Алматы → принимаем; не определил → остаётся uncertain (менеджеру);
//  - на in_almaty ещё и прикладываем координаты от геокодера → точная 2ГИС-точка в заявке.
// Геокодер недоступен/ошибка → просто работает эвристика (как раньше).

import {
  AlmatyHeuristicAddressProvider,
  type AddressValidationProvider,
  type AddressValidationResult,
} from "./provider";
import { combineAddressVerdict } from "./almaty-city";
import { geocodeAddress } from "./geocode";

export class GeocodingAddressProvider implements AddressValidationProvider {
  readonly name = "osm-geocoder+heuristic";
  private readonly heuristic = new AlmatyHeuristicAddressProvider();

  async validate(addressText: string): Promise<AddressValidationResult> {
    const base = await this.heuristic.validate(addressText);

    // Не тратим геокодер там, где эвристика уже дала явный ответ / ввод мусорный.
    if (base.status === "outside_almaty") return base;
    if (base.status === "uncertain" && base.reason === "too_short_or_empty") return base;

    const hit = await geocodeAddress(addressText).catch(() => null);
    return combineAddressVerdict(base, hit);
  }
}
