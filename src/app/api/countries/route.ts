import { NextResponse } from "next/server";
import { COUNTRIES } from "@/lib/timezone/countries";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    COUNTRIES.map(({ name, abbr, offset, offsetStr, hasDST }) => ({
      name,
      abbr,
      offset,
      offsetStr,
      hasDST,
    }))
  );
}
