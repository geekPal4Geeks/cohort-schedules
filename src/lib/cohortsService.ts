import { z } from "zod";
import { fetchNotionCohorts } from "@/lib/notion/fetchCohorts";
import { buildCohortOption, filterByDesiredMonth } from "@/lib/timezone/convertSchedule";
import { buildEstimatedCohorts } from "@/lib/timezone/estimatedCohorts";
import { findCountry } from "@/lib/timezone/countries";
import type { CohortOption } from "@/lib/types";

export const cohortsQuerySchema = z.object({
  country: z.string().min(1),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
  duration: z.coerce.number().int().min(1).max(52).default(20),
});

export async function getCohortOptions(input: {
  country: string;
  month: number;
  year: number;
  duration: number;
}): Promise<CohortOption[]> {
  if (!findCountry(input.country)) {
    throw new Error(`Unknown country: ${input.country}`);
  }

  const real = await fetchNotionCohorts();
  const estimated = buildEstimatedCohorts(
    input.month,
    input.year,
    input.duration
  );

  const mapped: CohortOption[] = [];
  for (const cohort of [...real, ...estimated]) {
    const option = buildCohortOption(
      cohort,
      input.country,
      input.month,
      input.year
    );
    if (option) mapped.push(option);
  }

  const filtered = filterByDesiredMonth(
    mapped,
    input.month,
    input.year,
    input.duration
  );

  // Prefer options that have a date badge first, then by start date
  return filtered.sort((a, b) => {
    const badgeDiff = (b.badges.length ? 1 : 0) - (a.badges.length ? 1 : 0);
    if (badgeDiff !== 0) return badgeDiff;
    return a.cohort.startDate.localeCompare(b.cohort.startDate);
  });
}
