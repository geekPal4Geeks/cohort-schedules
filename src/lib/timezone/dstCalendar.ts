import { DateTime } from "luxon";
import type { DstCalendarEntry } from "@/lib/types";
import { findCountry } from "@/lib/timezone/countries";

type ZoneSpec = {
  country: string;
  iana: string;
  winterAbbr: string;
  summerAbbr: string;
  winterOffset: number;
  summerOffset: number;
};

const DST_ZONES: ZoneSpec[] = [
  {
    country: "España",
    iana: "Europe/Madrid",
    winterAbbr: "CET",
    summerAbbr: "CEST",
    winterOffset: 1,
    summerOffset: 2,
  },
  {
    country: "Portugal",
    iana: "Europe/Lisbon",
    winterAbbr: "WET",
    summerAbbr: "WEST",
    winterOffset: 0,
    summerOffset: 1,
  },
  {
    country: "Chile",
    iana: "America/Santiago",
    winterAbbr: "CLT",
    summerAbbr: "CLST",
    winterOffset: -4,
    summerOffset: -3,
  },
];

function formatDdMmYyyy(dt: DateTime): string {
  return dt.toFormat("dd-MM-yyyy");
}

function collectTransitionsForIana(
  country: string,
  zone: ZoneSpec,
  year: number
): DstCalendarEntry[] {
  const entries: DstCalendarEntry[] = [];
  const start = DateTime.fromObject(
    { year, month: 1, day: 1, hour: 12 },
    { zone: zone.iana }
  );
  const end = DateTime.fromObject(
    { year: year + 1, month: 1, day: 1, hour: 12 },
    { zone: zone.iana }
  );

  let cursor = start;
  let prevOffset = cursor.offset;
  let prevAbbr = cursor.offsetNameShort || zone.winterAbbr;

  while (cursor < end) {
    const next = cursor.plus({ hours: 12 });
    if (next.offset !== prevOffset) {
      let lo = cursor;
      let hi = next;
      while (hi.diff(lo, "minutes").minutes > 1) {
        const mid = lo.plus({
          minutes: Math.floor(hi.diff(lo, "minutes").minutes / 2),
        });
        if (mid.offset === lo.offset) lo = mid;
        else hi = mid;
      }
      const change = hi.setZone(zone.iana);
      const fromOffset = prevOffset / 60;
      const toOffset = change.offset / 60;
      const fromAbbr =
        fromOffset === zone.winterOffset
          ? zone.winterAbbr
          : fromOffset === zone.summerOffset
            ? zone.summerAbbr
            : prevAbbr;
      const toAbbr =
        toOffset === zone.winterOffset
          ? zone.winterAbbr
          : toOffset === zone.summerOffset
            ? zone.summerAbbr
            : change.offsetNameShort || "";

      entries.push({
        year,
        country,
        changeDate: formatDdMmYyyy(change),
        from: fromAbbr,
        to: toAbbr,
        fromOffset,
        toOffset,
      });
      prevOffset = change.offset;
      prevAbbr = toAbbr;
      cursor = change.plus({ hours: 1 });
    } else {
      cursor = next;
    }
  }

  return entries;
}

function zoneSpecForCountry(country: string): ZoneSpec | null {
  const preset = DST_ZONES.find((z) => z.country === country);
  if (preset) return preset;

  const catalog = findCountry(country);
  if (!catalog?.iana) return null;

  const winter = getZoneInfoAt(catalog.iana, "2026-01-15", catalog.abbr, catalog.offset);
  const summer = getZoneInfoAt(catalog.iana, "2026-07-15", catalog.abbr, catalog.offset);
  if (winter.offset === summer.offset) return null;

  return {
    country,
    iana: catalog.iana,
    winterAbbr: winter.abbr,
    summerAbbr: summer.abbr,
    winterOffset: winter.offset,
    summerOffset: summer.offset,
  };
}

/**
 * Build DST transition calendar for the next N years (inclusive of current).
 * Uses Luxon IANA zones so dates stay accurate without hardcoding every year.
 */
export function buildDstCalendar(fromYear = 2026, years = 6): DstCalendarEntry[] {
  return buildDstCalendarForCountries(
    DST_ZONES.map((z) => z.country),
    fromYear,
    years
  );
}

/** DST calendar limited to specific countries (e.g. by academy region). */
export function buildDstCalendarForCountries(
  countries: string[],
  fromYear = 2026,
  years = 6
): DstCalendarEntry[] {
  const unique = [...new Set(countries)];
  const entries: DstCalendarEntry[] = [];

  for (let year = fromYear; year < fromYear + years; year += 1) {
    for (const country of unique) {
      const zone = zoneSpecForCountry(country);
      if (!zone) continue;
      entries.push(...collectTransitionsForIana(country, zone, year));
    }
  }

  return entries.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    const [ad, am] = a.changeDate.split("-").map(Number);
    const [bd, bm] = b.changeDate.split("-").map(Number);
    return am !== bm ? am - bm : ad - bd;
  });
}

export function getZoneInfoAt(
  iana: string,
  isoDate: string,
  fallbackAbbr: string,
  fallbackOffset: number
): { abbr: string; offset: number } {
  const dt = DateTime.fromISO(`${isoDate}T12:00:00`, { zone: iana });
  if (!dt.isValid) {
    return { abbr: fallbackAbbr, offset: fallbackOffset };
  }
  return {
    abbr: dt.offsetNameShort || fallbackAbbr,
    offset: dt.offset / 60,
  };
}
