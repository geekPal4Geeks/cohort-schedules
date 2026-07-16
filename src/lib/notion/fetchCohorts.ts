import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { loadConfig, type AppConfig } from "@/lib/config";
import type { NotionCohort } from "@/lib/types";
import { resolveAnchorCountry, OPTION_TYPE_FROM_ANCHOR } from "@/lib/timezone/countries";
import { cacheGet, cacheSet, cacheClear } from "@/lib/cache";

const COHORTS_CACHE_KEY = "notion:cohorts";
const CACHE_TTL_MS = 5 * 60 * 1000;

function createClient(token: string) {
  return new Client({ auth: token });
}

function getProp(page: PageObjectResponse, name: string) {
  return page.properties[name];
}

function richText(page: PageObjectResponse, name: string): string {
  const prop = getProp(page, name);
  if (!prop || prop.type !== "rich_text") return "";
  return prop.rich_text.map((t) => t.plain_text).join("").trim();
}

function title(page: PageObjectResponse): string {
  const prop = Object.values(page.properties).find((p) => p.type === "title");
  if (!prop || prop.type !== "title") return "(untitled)";
  return prop.title.map((t) => t.plain_text).join("").trim() || "(untitled)";
}

function selectName(page: PageObjectResponse, name: string): string | null {
  const prop = getProp(page, name);
  if (!prop || prop.type !== "select") return null;
  return prop.select?.name ?? null;
}

function dateStart(page: PageObjectResponse, name: string): string | null {
  const prop = getProp(page, name);
  if (!prop || prop.type !== "date") return null;
  const start = prop.date?.start;
  return start ? start.slice(0, 10) : null;
}

function numberVal(page: PageObjectResponse, name: string): number | null {
  const prop = getProp(page, name);
  if (!prop) return null;
  if (prop.type === "number") return prop.number;
  return null;
}

function checkboxVal(page: PageObjectResponse, name: string): boolean {
  const prop = getProp(page, name);
  if (!prop || prop.type !== "checkbox") return true;
  return Boolean(prop.checkbox);
}

function mapPage(page: PageObjectResponse, config: AppConfig): NotionCohort {
  const schedule = richText(page, config.schedulePropertyName);
  const notionTimezone =
    selectName(page, config.timezonePropertyName) || "";
  const anchorCountry = resolveAnchorCountry(notionTimezone, schedule);

  return {
    id: page.id,
    cohortName: title(page),
    program: selectName(page, config.programPropertyName) || "Unknown",
    academy: selectName(page, config.academyPropertyName),
    cohortCode: richText(page, config.idPropertyName) || null,
    preworkStartDate: dateStart(page, config.preworkDatePropertyName),
    contentStartDate: dateStart(page, config.contentDatePropertyName),
    courseEndDate: dateStart(page, config.endDatePropertyName),
    anchorCountry,
    optionType: OPTION_TYPE_FROM_ANCHOR[anchorCountry] || anchorCountry,
    status: selectName(page, config.statusPropertyName) || "Unknown",
    schedule,
    notionTimezone,
    studentsCount: numberVal(page, config.studentsCountPropertyName),
    studentGoal: numberVal(page, config.studentGoalPropertyName),
    isOpen: checkboxVal(page, config.openPropertyName),
    isEstimated: false,
  };
}

async function queryAllPages(
  notion: Client,
  databaseId: string
): Promise<PageObjectResponse[]> {
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const result of response.results) {
      if (result.object === "page" && "properties" in result) {
        pages.push(result as PageObjectResponse);
      }
    }
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return pages;
}

export async function fetchNotionCohorts(
  forceRefresh = false
): Promise<NotionCohort[]> {
  if (!forceRefresh) {
    const cached = cacheGet<NotionCohort[]>(COHORTS_CACHE_KEY);
    if (cached) return cached;
  }

  const config = loadConfig();
  const notion = createClient(config.notionToken);
  const pages = await queryAllPages(notion, config.notionDatabaseId);
  const cohorts = pages.map((p) => mapPage(p, config));
  cacheSet(COHORTS_CACHE_KEY, cohorts, CACHE_TTL_MS);
  return cohorts;
}

export function invalidateNotionCache() {
  cacheClear("notion:");
}
