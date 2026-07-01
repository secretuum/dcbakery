import { NextResponse } from "next/server";
import { fetchPopularProducts } from "@/src/lib/catalog";

export async function GET() {
  const products = await fetchPopularProducts(4);
  return NextResponse.json({ products });
}
