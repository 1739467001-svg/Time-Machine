import { NextResponse } from "next/server";
import { getAgingProviderInfo } from "@/lib/aging/provider-info";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ provider: getAgingProviderInfo() });
}
