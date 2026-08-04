// Триггеры эскалации на менеджера (правило клиентского бота): мат, оскорбления,
// КАПС (крик), жалобы/угрозы → сразу передаём человеку, не пытаясь обработать
// автоматически. Чистая функция (regex по тексту), консервативные паттерны, чтобы
// не ловить ложные срабатывания на обычных словах (рубля/требую/хлеб и т.п.).

import { normalizeText } from "../text/normalize";

export type EscalationReason = "profanity" | "insult" | "complaint" | "shouting";
export type EscalationResult = { escalate: boolean; reason?: EscalationReason };

// Мат — узкие формы (без коротких корней вроде «бля», который есть в «рубля»).
const PROFANITY: readonly RegExp[] = [
  /блят|бляд|блях|бляб/,
  /хуй|хуё|нахуй|похуй|хуев|хуйн|хуя[рмнк]/,
  /пизд/,
  /ебан|ебал|ебат|ебуч|ёбан|заеб|выеб|наеб|уебищ|уебок|съеб|подъеб|разъеб|ебош/,
  /муда[кч]/,
  /пидор|пидар|педик/,
  /долбоеб|долбоёб/,
  /гандон|гондон/,
  /мраз[ья]/,
];

const INSULTS: readonly RegExp[] = [
  /дебил/,
  /идиот/,
  /кретин/,
  /туп(ой|ая|ое|ые|ым|ого|иц)/,
  /ничтожеств/,
  /урод/,
];

const COMPLAINTS: readonly RegExp[] = [
  /жалоб/,
  /обман(ул|ыв|щик|)/,
  /верн(ите|уть|у)\s+деньг/,
  /возврат\s+денег/,
  /(подам|в)\s+суд|засужу/,
  /полици|прокурат|роспотреб/,
  /мошенник/,
  /кидал[аои]|развод(или|ят|няк)/,
  /угрожа|угроз/,
  /отвратительн/,
  /(напишу|оставлю|плохой)\s+отзыв/,
];

function isShouting(raw: string): boolean {
  const letters = [...raw].filter((c) => /\p{L}/u.test(c));
  if (letters.length < 8) return false;
  const upper = letters.filter((c) => c === c.toUpperCase() && c !== c.toLowerCase()).length;
  return upper / letters.length > 0.7;
}

/** Нужна ли эскалация на менеджера по этому сообщению. */
export function detectEscalation(rawText: string): EscalationResult {
  if (!rawText || !rawText.trim()) return { escalate: false };
  if (isShouting(rawText)) return { escalate: true, reason: "shouting" };

  const t = normalizeText(rawText);
  if (PROFANITY.some((re) => re.test(t))) return { escalate: true, reason: "profanity" };
  if (INSULTS.some((re) => re.test(t))) return { escalate: true, reason: "insult" };
  if (COMPLAINTS.some((re) => re.test(t))) return { escalate: true, reason: "complaint" };

  return { escalate: false };
}
