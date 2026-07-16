import { NextResponse } from "next/server";
import { fetchNotionCohorts, invalidateNotionCache } from "@/lib/notion/fetchCohorts";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    invalidateNotionCache();
    const cohorts = await fetchNotionCohorts(true);
    return NextResponse.json({
      ok: true,
      count: cohorts.length,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
