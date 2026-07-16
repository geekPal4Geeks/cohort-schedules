import { DateTime } from "luxon";
import type { NotionCohort } from "@/lib/types";
import { addDaysIso } from "@/lib/timezone/convertSchedule";

type AnchorProfile = {
  anchorCountry: string;
  optionType: string;
  schedule: string;
  notionTimezone: string;
  slug: string;
};

const EUROPE_STUDENTS = new Set(["España", "Portugal"]);
const SOUTH_AMERICA_STUDENTS = new Set([
  "Chile",
  "Argentina",
  "Uruguay",
  "Paraguay",
  "Bolivia",
  "Venezuela",
]);

function anchorForStudentCountry(studentCountry: string): AnchorProfile {
  if (EUROPE_STUDENTS.has(studentCountry)) {
    return {
      anchorCountry: "España",
      optionType: "España Tardes",
      schedule: "ES-MWF-630pm-930pm",
      notionTimezone: "Europe/Madrid",
      slug: "es",
    };
  }
  if (SOUTH_AMERICA_STUDENTS.has(studentCountry)) {
    return {
      anchorCountry: "Chile",
      optionType: "Sudamérica",
      schedule: "CL-MWF-630pm-930pm",
      notionTimezone: "Sudamerica",
      slug: "la",
    };
  }
  return {
    anchorCountry: "México",
    optionType: "Centroamérica",
    schedule: "MX-MWF-630pm-930pm",
    notionTimezone: "Centroamerica",
    slug: "mx",
  };
}

/** Mid-month weekday for the desired month (≈ day 13, skip weekends). */
export function estimatedContentStart(month: number, year: number): string {
  let start = DateTime.fromObject({ year, month, day: 13 });
  while (start.weekday > 5) {
    start = start.plus({ days: 1 });
  }
  return start.toISODate()!;
}

/**
 * Single synthetic reference cohort for the desired start month.
 * Anchor schedule follows the student's region (EU / Sudamérica / Centroamérica).
 */
export function buildEstimatedCohort(
  studentCountry: string,
  month: number,
  year: number,
  durationWeeks: number
): NotionCohort {
  const anchor = anchorForStudentCountry(studentCountry);
  const startIso = estimatedContentStart(month, year);
  const endIso = addDaysIso(startIso, durationWeeks * 7);
  const monthLabel = DateTime.fromObject({ month, year })
    .setLocale("es")
    .toFormat("LLLL yyyy");

  return {
    id: `estimated-${anchor.slug}-${year}-${String(month).padStart(2, "0")}`,
    cohortName: `Inicio estimado — ${monthLabel}`,
    program: "Referencia horaria",
    academy: anchor.anchorCountry === "España" ? "6-Spain" : "7-Latam",
    cohortCode: null,
    preworkStartDate: addDaysIso(startIso, -14),
    contentStartDate: startIso,
    courseEndDate: endIso,
    anchorCountry: anchor.anchorCountry,
    optionType: anchor.optionType,
    status: "Estimada",
    schedule: anchor.schedule,
    notionTimezone: anchor.notionTimezone,
    studentsCount: null,
    studentGoal: null,
    isOpen: true,
    isEstimated: true,
  };
}
