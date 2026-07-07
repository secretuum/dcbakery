import { NextResponse } from "next/server";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BUCKET = "product-images";
const MAX_BYTES = 5 * 1024 * 1024;

type ImageMime = "image/jpeg" | "image/png" | "image/webp";

function detectMagicBytes(buf: Uint8Array): ImageMime | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return "image/png";
  // WebP: RIFF (bytes 0-3) + WEBP (bytes 8-11)
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "image/webp";
  return null;
}

function sanitizeSlug(value: string): string {
  return value.replace(/[^a-zA-Z0-9\-_]/g, "_").slice(0, 80);
}

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 5 MB limit" }, { status: 413 });
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  const detectedMime = detectMagicBytes(buf);

  if (!detectedMime) {
    return NextResponse.json(
      { error: "File is not a valid JPEG, PNG, or WebP image" },
      { status: 415 },
    );
  }

  const rawSlug = formData.get("slug");
  const slug = sanitizeSlug(typeof rawSlug === "string" ? rawSlug : "new") || "new";
  const ext = detectedMime === "image/webp" ? "webp" : detectedMime === "image/png" ? "png" : "jpg";
  const path = `products/${slug}_${Date.now()}.${ext}`;

  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": detectedMime,
      "x-upsert": "true",
    },
    body: buf,
  });

  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    return NextResponse.json(
      { error: json.message ?? json.error ?? "Upload failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`,
  });
}
