import { COUNTRIES } from "@/lib/timezone/countries";

export type AcademyRegion = "spain" | "latam";

const LATAM_COUNTRY_NAMES = COUNTRIES.filter(
  (c) => c.name !== "España" && c.name !== "Portugal"
).map((c) => c.name);

/** Resolve Notion Academy (e.g. 6-Spain, 7-Latam) to a region. */
export function getAcademyRegion(academy: string | null): AcademyRegion {
  if (!academy) return "spain";
  const normalized = academy.toLowerCase();
  if (normalized.includes("latam") || normalized.includes("7-latam")) {
    return "latam";
  }
  if (normalized.includes("spain") || normalized.includes("6-spain")) {
    return "spain";
  }
  return normalized.includes("latam") ? "latam" : "spain";
}

/**
 * Countries whose DST transitions are shown for a cohort, by academy:
 * - Spain → España only
 * - Latam → all student-catalog countries in Latin America
 */
export function getDstCountriesForAcademy(academy: string | null): string[] {
  return getAcademyRegion(academy) === "spain"
    ? ["España"]
    : [...LATAM_COUNTRY_NAMES];
}

/** Infer academy label when Notion field is empty (e.g. estimated rows). */
export function resolveAcademyForDst(
  academy: string | null,
  anchorCountry: string
): string | null {
  if (academy) return academy;
  if (anchorCountry === "España" || anchorCountry === "Portugal") {
    return "6-Spain";
  }
  return "7-Latam";
}
