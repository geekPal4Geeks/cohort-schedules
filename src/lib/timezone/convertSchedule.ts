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
import { buildDstCalendar, getZoneInfoAt } from "@/lib/timezone/dstCalendar";

const TIME_RE = /^(\d{1,2})(?::(\d{2}))?(am|pm)$/i;

export function parseScheduleTimes(schedule: string): {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
} | null {
  // e.g. ES-MWF-630pm-930pm or ES-MWF-6:30pm-9:30pm
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
  // 630pm → 6:30pm
  const normalized = cleaned.replace(/^(\d{1,2})(\d{2})(am|pm)$/i, "$1:$2$3");
  const m = normalized.match(TIME_RE);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] || "0");
  const ampm = m[3].toLowerCase();
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
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

function collectDstBreaks(
  startIso: string,
  endIso: string,
  studentCountry: string,
  anchorCountry: string
): DstChangeInfo[] {
  const calendar = buildDstCalendar(2026, 6);
  const relevant = calendar.filter(
    (e) => e.country === studentCountry || e.country === anchorCountry
  );
  const start = DateTime.fromISO(startIso);
  const end = DateTime.fromISO(endIso);
  const out: DstChangeInfo[] = [];

  for (const e of relevant) {
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

  // unique by date+cause
  const seen = new Set<string>();
  return out.filter((c) => {
    const key = `${c.date}|${c.cause}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

function dateMatchBadge(
  contentStartIso: string,
  month: number,
  year: number
): CohortOption["badges"] {
  const start = DateTime.fromISO(contentStartIso);
  if (!start.isValid) return [];
  const target = DateTime.fromObject({ year, month, day: 1 });
  const diff = Math.abs(start.diff(target, "days").days);
  if (diff <= 45) {
    return [
      {
        type: "date",
        label: "Mejor match por fecha",
        tooltip: `Diferencia: ${Math.round(diff)} días respecto al mes seleccionado (${month}/${year})`,
      },
    ];
  }
  return [];
}

export function buildCohortOption(
  raw: NotionCohort,
  studentCountry: string,
  month: number,
  year: number
): CohortOption | null {
  const startDate = raw.contentStartDate;
  const endDate = raw.courseEndDate;
  if (!startDate || !endDate) return null;

  const anchorCountry =
    raw.anchorCountry ||
    resolveAnchorCountry(raw.notionTimezone, raw.schedule);
  const optionType =
    raw.optionType || OPTION_TYPE_FROM_ANCHOR[anchorCountry] || anchorCountry;

  const dstChanges = collectDstBreaks(
    startDate,
    endDate,
    studentCountry,
    anchorCountry
  );
  const segments = buildSegments(
    startDate,
    endDate,
    raw.schedule,
    anchorCountry,
    studentCountry,
    dstChanges
  );

  const student = findCountry(studentCountry);
  const firstSeg = segments[0];

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
    maxBand: maxBandFromSegments(segments),
    hasDSTChange: dstChanges.length > 0,
    dstChanges,
    badges: dateMatchBadge(startDate, month, year),
  };
}

export function filterByDesiredMonth(
  options: CohortOption[],
  month: number,
  year: number,
  durationWeeks: number
): CohortOption[] {
  const windowStart = DateTime.fromObject({ year, month, day: 1 }).minus({
    days: 20,
  });
  const windowEnd = DateTime.fromObject({ year, month, day: 1 })
    .endOf("month")
    .plus({ days: 45 });

  return options.filter((o) => {
    const start = DateTime.fromISO(o.cohort.startDate);
    if (!start.isValid) return false;
    // keep cohorts that start near the desired month window
    if (start < windowStart || start > windowEnd) {
      // also keep if end is far and duration overlaps — still include near matches
      const approxEnd = start.plus({ weeks: durationWeeks });
      void approxEnd;
      return false;
    }
    return true;
  });
}

export { addDaysIso, toDisplayDate };
