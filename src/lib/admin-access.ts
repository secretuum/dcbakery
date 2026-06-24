import "server-only";

export type AdminIdentity = {
  app_metadata?: {
    role?: string;
  };
  email?: string;
};

function getAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminIdentity(user: AdminIdentity | null | undefined) {
  if (!user) {
    return false;
  }

  if (user.app_metadata?.role === "admin") {
    return true;
  }

  const email = user.email?.trim().toLowerCase();

  if (email && getAdminEmails().has(email)) {
    return true;
  }

  return process.env.PAYMENT_MODE?.trim().toLowerCase() === "demo";
}
