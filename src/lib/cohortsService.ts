import { z } from "zod";
import { computeCohortOptions } from "@/lib/computeCohorts";
import { fetchNotionCohorts } from "@/lib/notion/fetchCohorts";

export const cohortsQuerySchema = z.object({
  country: z.string().min(1),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
  duration: z.coerce.number().int().min(1).max(52).default(20),
});

export async function getRawNotionCohorts(forceRefresh = false) {
  return fetchNotionCohorts(forceRefresh);
}

export async function getCohortOptions(input: {
  country: string;
  month: number;
  year: number;
  duration: number;
}) {
  const raw = await fetchNotionCohorts();
  return computeCohortOptions(raw, input);
}
