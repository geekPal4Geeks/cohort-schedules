import type { Country } from "@/lib/types";

/** Student-country catalog matching admissions-sync-tool.replit.app/api/countries */
export const COUNTRIES: Country[] = [
  { name: "México", abbr: "CST", offset: -6, offsetStr: "UTC-6", hasDST: false, iana: "America/Mexico_City" },
  { name: "Guatemala", abbr: "CST", offset: -6, offsetStr: "UTC-6", hasDST: false, iana: "America/Guatemala" },
  { name: "Honduras", abbr: "CST", offset: -6, offsetStr: "UTC-6", hasDST: false, iana: "America/Tegucigalpa" },
  { name: "El Salvador", abbr: "CST", offset: -6, offsetStr: "UTC-6", hasDST: false, iana: "America/El_Salvador" },
  { name: "Costa Rica", abbr: "CST", offset: -6, offsetStr: "UTC-6", hasDST: false, iana: "America/Costa_Rica" },
  { name: "Panamá", abbr: "EST", offset: -5, offsetStr: "UTC-5", hasDST: false, iana: "America/Panama" },
  { name: "Colombia", abbr: "COT", offset: -5, offsetStr: "UTC-5", hasDST: false, iana: "America/Bogota" },
  { name: "Ecuador", abbr: "ECT", offset: -5, offsetStr: "UTC-5", hasDST: false, iana: "America/Guayaquil" },
  { name: "Perú", abbr: "PET", offset: -5, offsetStr: "UTC-5", hasDST: false, iana: "America/Lima" },
  { name: "Chile", abbr: "CLT", offset: -4, offsetStr: "UTC-4", hasDST: true, iana: "America/Santiago" },
  { name: "Argentina", abbr: "ART", offset: -3, offsetStr: "UTC-3", hasDST: false, iana: "America/Argentina/Buenos_Aires" },
  { name: "Uruguay", abbr: "UYT", offset: -3, offsetStr: "UTC-3", hasDST: false, iana: "America/Montevideo" },
  { name: "Paraguay", abbr: "PYT", offset: -4, offsetStr: "UTC-4", hasDST: false, iana: "America/Asuncion" },
  { name: "Bolivia", abbr: "BOT", offset: -4, offsetStr: "UTC-4", hasDST: false, iana: "America/La_Paz" },
  { name: "Venezuela", abbr: "VET", offset: -4, offsetStr: "UTC-4", hasDST: false, iana: "America/Caracas" },
  { name: "República Dominicana", abbr: "AST", offset: -4, offsetStr: "UTC-4", hasDST: false, iana: "America/Santo_Domingo" },
  { name: "España", abbr: "CET", offset: 1, offsetStr: "UTC+1", hasDST: true, iana: "Europe/Madrid" },
  { name: "Portugal", abbr: "WET", offset: 0, offsetStr: "UTC+0", hasDST: true, iana: "Europe/Lisbon" },
];

export function findCountry(name: string): Country | undefined {
  return COUNTRIES.find((c) => c.name.toLowerCase() === name.toLowerCase());
}

/** Map Notion Time Zone / schedule prefix → anchor display country */
export const ANCHOR_FROM_TIMEZONE: Record<string, string> = {
  "Europe/Madrid": "España",
  Centroamerica: "México",
  Centroamérica: "México",
  Sudamerica: "Chile",
  Sudamérica: "Chile",
  "America/Mexico_City": "México",
  "America/Santiago": "Chile",
};

export const OPTION_TYPE_FROM_ANCHOR: Record<string, string> = {
  España: "España Tardes",
  México: "Centroamérica",
  Chile: "Sudamérica",
  Colombia: "Centroamérica",
};

export function resolveAnchorCountry(
  notionTimezone: string,
  schedule: string
): string {
  if (ANCHOR_FROM_TIMEZONE[notionTimezone]) {
    return ANCHOR_FROM_TIMEZONE[notionTimezone];
  }
  const prefix = schedule.split("-")[0]?.toUpperCase();
  const byPrefix: Record<string, string> = {
    ES: "España",
    MX: "México",
    CL: "Chile",
    CO: "Colombia",
    PT: "Portugal",
    AR: "Argentina",
  };
  return byPrefix[prefix || ""] || "España";
}
