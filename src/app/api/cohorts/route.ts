import { NextRequest, NextResponse } from "next/server";
import { cohortsQuerySchema, getCohortOptions } from "@/lib/cohortsService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = cohortsQuerySchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Invalid filter parameters",
        errors: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  try {
    const options = await getCohortOptions(parsed.data);
    return NextResponse.json(options);
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
