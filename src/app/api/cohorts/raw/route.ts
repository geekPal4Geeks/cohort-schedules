import { NextResponse } from "next/server";
import { getRawNotionCohorts } from "@/lib/cohortsService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cohorts = await getRawNotionCohorts();
    return NextResponse.json(cohorts);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = message.toLowerCase().includes("timeout");
    return NextResponse.json(
      {
        message: isTimeout
          ? "Notion tardó demasiado en responder. Pulsa «Actualizar datos» de nuevo o espera unos segundos."
          : message,
      },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
