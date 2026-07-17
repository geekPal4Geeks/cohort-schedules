import { DateTime } from "luxon";
import type {
  CohortOption,
  DstChangeInfo,
  NotionCohort,
  ScheduleSegment,
} from "@/lib/types";
import {
  findCountry,
  OPTION_TYPE_FROM_ANCHOR,
  resolveAnchorCountry,
} from "@/lib/timezone/countries";
import { buildDstCalendarForCountries, getZoneInfoAt } from "@/lib/timezone/dstCalendar";
import {
  getDstCountriesForAcademy,
  resolveAcademyForDst,
} from "@/lib/timezone/academyDst";

const TIME_RE = /^(\d{1,2})(?::(\d{2}))?(am|pm)$/i;

/** Spain rotativo = morning + afternoon slots */
const ROTATIVO_SCHEDULES = ["ES-MWF-10am-13pm", "ES-MWF-630pm-930pm"] as const;
const ROTATIVO_LABELS = ["Mañana", "Tarde"] as const;

export function expandScheduleSlots(schedule: string): Array<{
  schedule: string;
  label: string;
}> {
  const normalized = schedule.trim();
  if (/rotativo/i.test(normalized)) {
    return ROTATIVO_SCHEDULES.map((s, i) => ({
      schedule: s,
      label: ROTATIVO_LABELS[i],
    }));
  }
  return [{ schedule: normalized, label: "" }];
}

export function parseScheduleTimes(schedule: string): {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
} | null {
  // e.g. ES-MWF-630pm-930pm or ES-MWF-6:30pm-9:30pm or ES-MWF-10am-13pm
  const parts = schedule.trim().split("-");
  if (parts.length < 4) return null;
  const startRaw = parts[parts.length - 2];
  const endRaw = parts[parts.length - 1];
  const start = parseClock(startRaw);
  const end = parseClock(endRaw);
  if (!start || !end) return null;
  return {
    startHour: start.h,
    startMinute: start.m,
    endHour: end.h,
    endMinute: end.m,
  };
}

function parseClock(raw: string): { h: number; m: number } | null {
  const cleaned = raw.replace(/\s/g, "").toLowerCase();
  // 630pm → 6:30pm; 13pm → 1:00pm (13 already 24h-ish)
  const normalized = cleaned.replace(/^(\d{1,2})(\d{2})(am|pm)$/i, "$1:$2$3");
  const m = normalized.match(TIME_RE);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] || "0");
  const ampm = m[3].toLowerCase();
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  // 13pm → treat as 13:00 (already afternoon in 24h)
  if (ampm === "pm" && h > 12 && h <= 23) {
    // keep as-is
  }
  return { h, m: min };
}

function formatDisplayTime(hour: number, minute: number): string {
  const dt = DateTime.fromObject({ hour, minute });
  return dt.toFormat("h:mm a");
}

function toDisplayDate(iso: string): string {
  const dt = DateTime.fromISO(iso);
  return dt.isValid ? dt.toFormat("dd-MM-yyyy") : iso;
}

function parseDisplayDate(ddmmyyyy: string): DateTime {
  return DateTime.fromFormat(ddmmyyyy, "dd-MM-yyyy");
}

function addDaysIso(iso: string, days: number): string {
  return DateTime.fromISO(iso).plus({ days }).toISODate() || iso;
}

function minutesOfDay(h: number, m: number): number {
  return h * 60 + m;
}

function fromMinutes(total: number): { h: number; m: number; dayShift: number } {
  let dayShift = 0;
  let t = total;
  while (t < 0) {
    t += 24 * 60;
    dayShift -= 1;
  }
  while (t >= 24 * 60) {
    t -= 24 * 60;
    dayShift += 1;
  }
  return { h: Math.floor(t / 60), m: t % 60, dayShift };
}

function dayShiftLabel(shift: number): string {
  if (shift > 0) return `(+${shift}d)`;
  if (shift < 0) return `(${shift}d)`;
  return "";
}

function ianaForCountry(name: string): string | undefined {
  return findCountry(name)?.iana;
}

function collectDstBreaksInRange(
  startIso: string,
  endIso: string,
  watchCountries: string[]
): DstChangeInfo[] {
  const start = DateTime.fromISO(startIso);
  const end = DateTime.fromISO(endIso);
  const fromYear = start.isValid ? start.year : new Date().getUTCFullYear();
  const toYear = end.isValid ? end.year : fromYear;
  const years = Math.max(1, toYear - fromYear + 2);

  const calendar = buildDstCalendarForCountries(watchCountries, fromYear, years);
  const out: DstChangeInfo[] = [];

  for (const e of calendar) {
    const change = parseDisplayDate(e.changeDate);
    if (!change.isValid) continue;
    if (change >= start && change <= end) {
      out.push({
        date: e.changeDate,
        from: e.from,
        to: e.to,
        fromOffset: e.fromOffset,
        toOffset: e.toOffset,
        cause: `${e.country}: ${e.from} → ${e.to}`,
      });
    }
  }

  const seen = new Set<string>();
  return out.filter((c) => {
    const key = `${c.date}|${c.cause}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** DST transitions shown in UI — scoped by academy (Spain vs all Latam). */
function collectAcademyDstBreaks(
  startIso: string,
  endIso: string,
  academy: string | null,
  anchorCountry: string
): DstChangeInfo[] {
  const resolved = resolveAcademyForDst(academy, anchorCountry);
  const countries = getDstCountriesForAcademy(resolved);
  return collectDstBreaksInRange(startIso, endIso, countries);
}

/** DST breaks for schedule segments — anchor + student zones only. */
function collectSegmentDstBreaks(
  startIso: string,
  endIso: string,
  studentCountry: string,
  anchorCountry: string
): DstChangeInfo[] {
  return collectDstBreaksInRange(startIso, endIso, [
    studentCountry,
    anchorCountry,
  ]);
}

function convertTimes(
  startH: number,
  startM: number,
  endH: number,
  endM: number,
  anchorOffset: number,
  studentOffset: number
): {
  localStartTime: string;
  localEndTime: string;
  crossesMidnight: boolean;
  dayShift: string;
} {
  const deltaHours = studentOffset - anchorOffset;
  const deltaMinutes = Math.round(deltaHours * 60);
  const start = fromMinutes(minutesOfDay(startH, startM) + deltaMinutes);
  const end = fromMinutes(minutesOfDay(endH, endM) + deltaMinutes);
  const crossesMidnight = end.dayShift > start.dayShift || end.h * 60 + end.m < start.h * 60 + start.m;
  return {
    localStartTime: formatDisplayTime(start.h, start.m),
    localEndTime: formatDisplayTime(end.h, end.m),
    crossesMidnight,
    dayShift: dayShiftLabel(start.dayShift),
  };
}

function buildSegments(
  startIso: string,
  endIso: string,
  schedule: string,
  anchorCountry: string,
  studentCountry: string,
  dstChanges: DstChangeInfo[]
): ScheduleSegment[] {
  const times = parseScheduleTimes(schedule);
  if (!times) {
    return [];
  }

  const student = findCountry(studentCountry);
  const anchor = findCountry(anchorCountry);
  const studentIana = ianaForCountry(studentCountry);
  const anchorIana = ianaForCountry(anchorCountry);

  const breakIsos = dstChanges
    .map((d) => parseDisplayDate(d.date).toISODate())
    .filter((x): x is string => Boolean(x))
    .sort();

  const points = [startIso, ...breakIsos.filter((b) => b > startIso && b < endIso), endIso];
  const segments: ScheduleSegment[] = [];

  for (let i = 0; i < points.length - 1; i += 1) {
    const fromIso = points[i];
    const toIso = points[i + 1];
    // sample midpoint for offsets
    const midIso = fromIso;

    const anchorInfo = studentIana && anchorIana
      ? {
          anchor: getZoneInfoAt(
            anchorIana,
            midIso,
            anchor?.abbr || "UTC",
            anchor?.offset || 0
          ),
          student: getZoneInfoAt(
            studentIana,
            midIso,
            student?.abbr || "UTC",
            student?.offset || 0
          ),
        }
      : {
          anchor: { abbr: anchor?.abbr || "UTC", offset: anchor?.offset || 0 },
          student: { abbr: student?.abbr || "UTC", offset: student?.offset || 0 },
        };

    const local = convertTimes(
      times.startHour,
      times.startMinute,
      times.endHour,
      times.endMinute,
      anchorInfo.anchor.offset,
      anchorInfo.student.offset
    );

    segments.push({
      from: toDisplayDate(fromIso),
      to: toDisplayDate(toIso),
      anchorAbbr: anchorInfo.anchor.abbr,
      anchorOffset: anchorInfo.anchor.offset,
      studentAbbr: anchorInfo.student.abbr,
      studentOffset: anchorInfo.student.offset,
      localStartTime: local.localStartTime,
      localEndTime: local.localEndTime,
      crossesMidnight: local.crossesMidnight,
      dayShift: local.dayShift,
    });
  }

  return segments;
}

function maxBandFromSegments(segments: ScheduleSegment[]): {
  earliestStart: string;
  latestEnd: string;
} {
  if (segments.length === 0) {
    return { earliestStart: "—", latestEnd: "—" };
  }
  const toMin = (label: string) => {
    const dt = DateTime.fromFormat(label, "h:mm a");
    return dt.isValid ? dt.hour * 60 + dt.minute : 0;
  };
  let earliest = segments[0].localStartTime;
  let latest = segments[0].localEndTime;
  for (const s of segments) {
    if (toMin(s.localStartTime) < toMin(earliest)) earliest = s.localStartTime;
    if (toMin(s.localEndTime) > toMin(latest)) latest = s.localEndTime;
  }
  return { earliestStart: earliest, latestEnd: latest };
}

export function buildCohortOption(
  raw: NotionCohort,
  studentCountry: string
): CohortOption | null {
  const startDate = raw.preworkStartDate;
  const endDate = raw.courseEndDate;
  if (!startDate || !endDate) return null;

  const anchorCountry =
    raw.anchorCountry ||
    resolveAnchorCountry(raw.notionTimezone, raw.schedule);
  const optionType =
    raw.optionType || OPTION_TYPE_FROM_ANCHOR[anchorCountry] || anchorCountry;

  const dstChanges = collectAcademyDstBreaks(
    startDate,
    endDate,
    raw.academy,
    anchorCountry
  );
  const segmentBreaks = collectSegmentDstBreaks(
    startDate,
    endDate,
    studentCountry,
    anchorCountry
  );

  const slots = expandScheduleSlots(raw.schedule);
  const timeBands = slots.map(({ schedule, label }) => {
    const segments = buildSegments(
      startDate,
      endDate,
      schedule,
      anchorCountry,
      studentCountry,
      segmentBreaks
    );
    const first = segments[0];
    return {
      label,
      localStartTime: first?.localStartTime || "—",
      localEndTime: first?.localEndTime || "—",
      dayShift: first?.dayShift || "",
      maxBand: maxBandFromSegments(segments),
      segments,
    };
  });

  const primary = timeBands[0];
  const segments = primary?.segments || [];
  const student = findCountry(studentCountry);
  const firstSeg = segments[0];

  const allStarts = timeBands.map((b) => b.maxBand.earliestStart).filter((t) => t !== "—");
  const allEnds = timeBands.map((b) => b.maxBand.latestEnd).filter((t) => t !== "—");

  return {
    cohort: {
      ...raw,
      anchorCountry,
      optionType,
      startDate,
      endDate,
    },
    localStartDate: toDisplayDate(startDate),
    localEndDate: toDisplayDate(endDate),
    studentTimezone: {
      abbr: firstSeg?.studentAbbr || student?.abbr || "UTC",
      offset: firstSeg?.studentOffset ?? student?.offset ?? 0,
    },
    segments,
    timeBands,
    maxBand: {
      earliestStart: allStarts[0] || "—",
      latestEnd: allEnds[allEnds.length - 1] || "—",
    },
    hasDSTChange: dstChanges.length > 0,
    dstChanges,
    badges: [],
  };
}

export { addDaysIso, toDisplayDate };
