import type { OrderItem } from "@/src/types";

export type ResponsibleRole = "manager" | "dessertLead" | "semiFinishedLead" | "meatLead";
export type ResponsibleCategory = "desserts" | "semiFinished" | "meat";

export type ResponsiblePerson = {
  name: string;
  phone?: string;
  role: ResponsibleRole;
  title: string;
  whatsappMentionId?: string;
};

type ResponsiblePersonConfig = {
  fallbackName: string;
  nameEnv: string;
  phoneEnv: string;
  title: string;
  whatsappMentionIdEnv: string;
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
    whatsappMentionIdEnv: "DC_RESPONSIBLE_MANAGER_WHATSAPP_ID",
  },
  dessertLead: {
    fallbackName: "Руководитель десертного цеха",
    nameEnv: "DC_RESPONSIBLE_DESSERT_LEAD_NAME",
    phoneEnv: "DC_RESPONSIBLE_DESSERT_LEAD_PHONE",
    title: "Десертный цех",
    whatsappMentionIdEnv: "DC_RESPONSIBLE_DESSERT_LEAD_WHATSAPP_ID",
  },
  semiFinishedLead: {
    fallbackName: "Руководитель полуфабрикатного цеха",
    nameEnv: "DC_RESPONSIBLE_SEMI_FINISHED_LEAD_NAME",
    phoneEnv: "DC_RESPONSIBLE_SEMI_FINISHED_LEAD_PHONE",
    title: "Полуфабрикаты",
    whatsappMentionIdEnv: "DC_RESPONSIBLE_SEMI_FINISHED_LEAD_WHATSAPP_ID",
  },
  meatLead: {
    fallbackName: "Ответственный за мясное направление",
    nameEnv: "DC_RESPONSIBLE_MEAT_LEAD_NAME",
    phoneEnv: "DC_RESPONSIBLE_MEAT_LEAD_PHONE",
    title: "Мясо",
    whatsappMentionIdEnv: "DC_RESPONSIBLE_MEAT_LEAD_WHATSAPP_ID",
  },
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
    name: getEnvValue(config.nameEnv) ?? config.fallbackName,
    phone: getEnvValue(config.phoneEnv),
    role,
    title: config.title,
    whatsappMentionId: getEnvValue(config.whatsappMentionIdEnv),
  };
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
    people: roles.map(getResponsiblePerson),
  };
}

export function formatResponsiblePersonLine(person: ResponsiblePerson) {
  const phone = person.phone ? `, ${person.phone}` : "";
  const mentionId = person.whatsappMentionId ? `, id: ${person.whatsappMentionId}` : "";

  return `- @${person.name} (${person.title}${phone}${mentionId})`;
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
