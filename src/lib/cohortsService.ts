import { z } from "zod";
import { computeCohortOptions } from "@/lib/computeCohorts";
import { fetchNotionCohorts } from "@/lib/notion/fetchCohorts";

export const cohortsQuerySchema = z.object({
  country: z.string().min(1),
});

export async function getRawNotionCohorts(forceRefresh = false) {
  return fetchNotionCohorts(forceRefresh);
}

export async function getCohortOptions(input: { country: string }) {
  const raw = await fetchNotionCohorts();
  return computeCohortOptions(raw, input);
}
