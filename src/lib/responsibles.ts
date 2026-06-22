import "server-only";
import type { OrderItem } from "@/src/types";

export type ResponsibleRole = "manager" | "dessertLead" | "semiFinishedLead" | "meatLead";
export type ResponsibleCategory = "desserts" | "semiFinished" | "meat";

export type ResponsiblePerson = {
  name: string;
  phone?: string;
  role: ResponsibleRole;
  title: string;
};

type ResponsiblePersonConfig = {
  fallbackName: string;
  nameEnv: string;
  phoneEnv: string;
  title: string;
};

const categoryLabels: Record<ResponsibleCategory, string> = {
  desserts: "Десерты",
  semiFinished: "Полуфабрикаты",
  meat: "Мясо",
};

const responsiblePeopleConfig: Record<ResponsibleRole, ResponsiblePersonConfig> = {
  manager: {
    fallbackName: "Менеджер",
    nameEnv: "DC_RESPONSIBLE_MANAGER_NAME",
    phoneEnv: "DC_RESPONSIBLE_MANAGER_PHONE",
    title: "Менеджер",
  },
  dessertLead: {
    fallbackName: "Руководитель десертного цеха",
    nameEnv: "DC_RESPONSIBLE_DESSERT_LEAD_NAME",
    phoneEnv: "DC_RESPONSIBLE_DESSERT_LEAD_PHONE",
    title: "Десертный цех",
  },
  semiFinishedLead: {
    fallbackName: "Руководитель полуфабрикатного цеха",
    nameEnv: "DC_RESPONSIBLE_SEMI_FINISHED_LEAD_NAME",
    phoneEnv: "DC_RESPONSIBLE_SEMI_FINISHED_LEAD_PHONE",
    title: "Полуфабрикаты",
  },
  meatLead: {
    fallbackName: "Ответственный за мясное направление",
    nameEnv: "DC_RESPONSIBLE_MEAT_LEAD_NAME",
    phoneEnv: "DC_RESPONSIBLE_MEAT_LEAD_PHONE",
    title: "Мясо",
  },
};

const defaultResponsibleEnv = {
  name: "DC_RESPONSIBLE_DEFAULT_NAME",
  phone: "DC_RESPONSIBLE_DEFAULT_PHONE",
};

export const responsibleRules: Record<ResponsibleCategory, ResponsibleRole[]> = {
  desserts: ["manager", "dessertLead"],
  semiFinished: ["manager", "semiFinishedLead"],
  meat: ["manager", "meatLead"],
};

function getEnvValue(key: string) {
  return process.env[key]?.trim() || undefined;
}

function getResponsiblePerson(role: ResponsibleRole): ResponsiblePerson {
  const config = responsiblePeopleConfig[role];

  return {
    name: getEnvValue(config.nameEnv) ?? getEnvValue(defaultResponsibleEnv.name) ?? config.fallbackName,
    phone: getEnvValue(config.phoneEnv) ?? getEnvValue(defaultResponsibleEnv.phone),
    role,
    title: config.title,
  };
}

function getPhoneDigits(phone?: string) {
  return phone?.replace(/\D/g, "") ?? "";
}

function getResponsibleKey(person: ResponsiblePerson) {
  return getPhoneDigits(person.phone) || person.name;
}

function mergeResponsiblePeople(people: ResponsiblePerson[]) {
  const peopleByKey = new Map<string, ResponsiblePerson>();

  for (const person of people) {
    const key = getResponsibleKey(person);
    const existingPerson = peopleByKey.get(key);

    if (!existingPerson) {
      peopleByKey.set(key, person);
      continue;
    }

    if (!existingPerson.title.includes(person.title)) {
      existingPerson.title = `${existingPerson.title}, ${person.title}`;
    }
  }

  return Array.from(peopleByKey.values());
}

function normalizeText(value?: string | null) {
  return value?.toLocaleLowerCase("ru-RU").trim() ?? "";
}

function getResponsibleCategory(item: Pick<OrderItem, "category" | "product_name">) {
  const category = normalizeText(item.category);
  const productName = normalizeText(item.product_name);
  const value = `${category} ${productName}`;

  if (value.includes("десерт") || value.includes("dessert") || value.includes("cat-desserts")) {
    return "desserts";
  }

  if (value.includes("полуфабрикат") || value.includes("semi") || value.includes("cat-semi")) {
    return "semiFinished";
  }

  if (value.includes("мяс") || value.includes("meat") || value.includes("cat-meat")) {
    return "meat";
  }

  return null;
}

function uniqueRoles(roles: ResponsibleRole[]) {
  return Array.from(new Set(roles));
}

export function getAllResponsiblePeople() {
  return mergeResponsiblePeople(
    (["manager", "dessertLead", "semiFinishedLead", "meatLead"] satisfies ResponsibleRole[]).map(
      getResponsiblePerson,
    ),
  );
}

export function getOrderResponsibleContext(items: OrderItem[]) {
  const categories = Array.from(
    new Set(
      items
        .map(getResponsibleCategory)
        .filter((category): category is ResponsibleCategory => Boolean(category)),
    ),
  );
  const roles: ResponsibleRole[] =
    categories.length > 0
      ? uniqueRoles(categories.flatMap((category) => responsibleRules[category]))
      : ["manager"];

  return {
    categories,
    categoryLabels: categories.map((category) => categoryLabels[category]),
    people: mergeResponsiblePeople(roles.map(getResponsiblePerson)),
  };
}

export function formatResponsiblePersonLine(person: ResponsiblePerson) {
  const phoneDigits = getPhoneDigits(person.phone);
  const mentionText = phoneDigits ? `@${phoneDigits}` : `@${person.name}`;
  const phone = person.phone ? `, ${person.phone}` : "";

  return `- ${mentionText} — ${person.name} (${person.title}${phone})`;
}

export function formatResponsibleBlock(items: OrderItem[]) {
  const context = getOrderResponsibleContext(items);
  const categories = context.categoryLabels.length > 0 ? context.categoryLabels.join(", ") : "не указано";

  return [
    `Категории: ${categories}`,
    "",
    "Ответственные:",
    ...context.people.map(formatResponsiblePersonLine),
  ].join("\n");
}
