import { buildCohortOption } from "@/lib/timezone/convertSchedule";
import { findCountry } from "@/lib/timezone/countries";
import type { CohortOption, NotionCohort } from "@/lib/types";

export type CohortComputeInput = {
  country: string;
};

/** Pure transform: raw Notion rows → options for student country (no I/O). */
export function computeCohortOptions(
  rawCohorts: NotionCohort[],
  input: CohortComputeInput
): CohortOption[] {
  if (!findCountry(input.country)) {
    throw new Error(`Unknown country: ${input.country}`);
  }

  return rawCohorts
    .map((cohort) => buildCohortOption(cohort, input.country))
    .filter((o): o is NonNullable<typeof o> => o != null)
    .sort((a, b) =>
      (a.cohort.preworkStartDate || "").localeCompare(
        b.cohort.preworkStartDate || ""
      )
    );
}
