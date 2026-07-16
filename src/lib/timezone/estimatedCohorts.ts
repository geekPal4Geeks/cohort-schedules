import { DateTime } from "luxon";
import type { NotionCohort } from "@/lib/types";
import { addDaysIso } from "@/lib/timezone/convertSchedule";

type EstimatedTemplate = {
  program: string;
  anchorCountry: string;
  optionType: string;
  schedule: string;
  notionTimezone: string;
  namePrefix: string;
};

const TEMPLATES: EstimatedTemplate[] = [
  {
    program: "Full Stack (Python)",
    anchorCountry: "España",
    optionType: "España Tardes",
    schedule: "ES-MWF-630pm-930pm",
    notionTimezone: "Europe/Madrid",
    namePrefix: "spain-fs-est",
  },
  {
    program: "Full Stack (Python)",
    anchorCountry: "Chile",
    optionType: "Sudamérica",
    schedule: "CL-MWF-630pm-930pm",
    notionTimezone: "Sudamerica",
    namePrefix: "latam-fs-est",
  },
  {
    program: "AI Engineering",
    anchorCountry: "España",
    optionType: "España Tardes",
    schedule: "ES-MWF-630pm-930pm",
    notionTimezone: "Europe/Madrid",
    namePrefix: "spain-aie-est",
  },
  {
    program: "Cybersecurity",
    anchorCountry: "México",
    optionType: "Centroamérica",
    schedule: "MX-MWF-630pm-930pm",
    notionTimezone: "Centroamerica",
    namePrefix: "latam-cyb-est",
  },
  {
    program: "Data Science/ML",
    anchorCountry: "España",
    optionType: "España Tardes",
    schedule: "ES-MWF-630pm-930pm",
    notionTimezone: "Europe/Madrid",
    namePrefix: "spain-ds-est",
  },
];

/**
 * Synthetic cohort options for months without a real Notion row.
 * start = 2nd Monday of the desired month (approx), end = +duration weeks.
 */
export function buildEstimatedCohorts(
  month: number,
  year: number,
  durationWeeks: number
): NotionCohort[] {
  const secondMonday = DateTime.fromObject({ year, month, day: 1 })
    .set({ weekday: 1 })
    .plus({ weeks: DateTime.fromObject({ year, month, day: 1 }).weekday <= 1 ? 1 : 2 });

  // Prefer a stable mid-month Monday-ish date close to Replit samples (e.g. 13)
  let start = DateTime.fromObject({ year, month, day: 13 });
  while (start.weekday > 5) {
    start = start.plus({ days: 1 });
  }
  void secondMonday;

  const startIso = start.toISODate()!;
  const endIso = addDaysIso(startIso, durationWeeks * 7);

  return TEMPLATES.map((t) => ({
    id: `estimated-${t.program}-${t.anchorCountry === "España" ? "ES" : "LA"}-${startIso}`,
    cohortName: `${t.namePrefix}-${startIso}`,
    program: t.program,
    academy: null,
    cohortCode: null,
    preworkStartDate: addDaysIso(startIso, -14),
    contentStartDate: startIso,
    courseEndDate: endIso,
    anchorCountry: t.anchorCountry,
    optionType: t.optionType,
    status: "Estimada",
    schedule: t.schedule,
    notionTimezone: t.notionTimezone,
    studentsCount: null,
    studentGoal: null,
    isOpen: true,
    isEstimated: true,
  }));
}
