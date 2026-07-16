import { NextResponse } from "next/server";
import { buildDstCalendar } from "@/lib/timezone/dstCalendar";

export const dynamic = "force-dynamic";

export async function GET() {
  const year = new Date().getUTCFullYear();
  return NextResponse.json(buildDstCalendar(year, 6));
}
