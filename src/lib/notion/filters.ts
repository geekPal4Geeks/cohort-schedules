import { DateTime } from "luxon";
import type { AppConfig } from "@/lib/config";

/** Today's date in UTC (YYYY-MM-DD) for Notion date filters. */
export function todayUtcIsoDate(): string {
  return DateTime.utc().toISODate()!;
}

/**
 * Notion DB filter aligned with the admissions view:
 * - Start date (prework) on or after today
 * - Status in Enrolling / Unstarted / Ready to Create / Created
 * - Open = Yes
 */
export function buildNotionCohortFilter(config: AppConfig) {
  const today = todayUtcIsoDate();

  return {
    and: [
      {
        property: config.preworkDatePropertyName,
        date: { on_or_after: today },
      },
      {
        or: config.eligibleStatuses.map((status) => ({
          property: config.statusPropertyName,
          select: { equals: status },
        })),
      },
      {
        property: config.openPropertyName,
        select: { equals: config.openYesValue },
      },
    ],
  };
}
