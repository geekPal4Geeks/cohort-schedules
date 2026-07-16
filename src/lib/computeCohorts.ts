import { buildCohortOption } from "@/lib/timezone/convertSchedule";
import { buildEstimatedCohort } from "@/lib/timezone/estimatedCohorts";
import { findCountry } from "@/lib/timezone/countries";
import type { CohortsResponse, NotionCohort } from "@/lib/types";

export type CohortComputeInput = {
  country: string;
  month: number;
  year: number;
  duration: number;
};

/** Pure transform: raw Notion rows → estimated + available options (no I/O). */
export function computeCohortOptions(
  rawCohorts: NotionCohort[],
  input: CohortComputeInput
): CohortsResponse {
  if (!findCountry(input.country)) {
    throw new Error(`Unknown country: ${input.country}`);
  }

  const available = rawCohorts
    .map((cohort) =>
      buildCohortOption(cohort, input.country, input.month, input.year)
    )
    .filter((o): o is NonNullable<typeof o> => o != null)
    .sort((a, b) => a.cohort.startDate.localeCompare(b.cohort.startDate));

  const estimatedRaw = buildEstimatedCohort(
    input.country,
    input.month,
    input.year,
    input.duration
  );
  const estimated =
    buildCohortOption(
      estimatedRaw,
      input.country,
      input.month,
      input.year
    ) ?? null;

  return { estimated, available };
}
