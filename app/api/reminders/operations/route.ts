import { NextResponse } from "next/server";
import {
  buildOperationsReminderMessage,
  sendOperationsReminder,
} from "@/src/lib/operations-reminder";

export const dynamic = "force-dynamic";

function getRequestSecret(request: Request) {
  const url = new URL(request.url);

  return (
    request.headers.get("x-reminder-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("secret") ??
    ""
  ).trim();
}

function authorizeReminderRequest(request: Request) {
  const configuredSecret = process.env.OPERATIONS_REMINDER_SECRET?.trim();

  if (!configuredSecret) {
    return {
      error: NextResponse.json(
        { error: "OPERATIONS_REMINDER_SECRET is not configured" },
        { status: 503 },
      ),
    };
  }

  if (getRequestSecret(request) !== configuredSecret) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { error: null };
}

async function handleReminderRequest(request: Request, shouldSend: boolean) {
  const { error } = authorizeReminderRequest(request);

  if (error) {
    return error;
  }

  if (!process.env.GREEN_API_CHAT_ID) {
    return NextResponse.json({ error: "GREEN_API_CHAT_ID is not configured" }, { status: 503 });
  }

  if (!shouldSend) {
    return NextResponse.json({
      message: await buildOperationsReminderMessage(),
      sent: false,
    });
  }

  const messageId = await sendOperationsReminder();

  return NextResponse.json({
    messageId,
    sent: Boolean(messageId),
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const shouldSend = url.searchParams.get("dryRun") !== "1";

  return handleReminderRequest(request, shouldSend);
}

export async function POST(request: Request) {
  return handleReminderRequest(request, true);
}
