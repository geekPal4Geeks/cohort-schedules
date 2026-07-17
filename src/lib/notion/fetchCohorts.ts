import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { loadConfig, type AppConfig } from "@/lib/config";
import type { NotionCohort } from "@/lib/types";
import { resolveAnchorCountry, OPTION_TYPE_FROM_ANCHOR } from "@/lib/timezone/countries";
import { cacheGet, cacheSet, cacheClear } from "@/lib/cache";
import { buildNotionCohortFilter } from "@/lib/notion/filters";

const COHORTS_CACHE_KEY = "notion:cohorts:v5";
const CACHE_TTL_MS = 10 * 60 * 1000;
const NOTION_TIMEOUT_MS = 120_000;

let inFlightFetch: Promise<NotionCohort[]> | null = null;

function createClient(token: string) {
  return new Client({
    auth: token,
    timeoutMs: NOTION_TIMEOUT_MS,
  });
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
  if (prop.type === "formula" && prop.formula.type === "number") {
    return prop.formula.number;
  }
  return null;
}

function openVal(page: PageObjectResponse, name: string, yesValue: string): boolean {
  const prop = getProp(page, name);
  if (!prop) return false;
  if (prop.type === "checkbox") return Boolean(prop.checkbox);
  if (prop.type === "select") return prop.select?.name === yesValue;
  return false;
}

function scheduleValue(page: PageObjectResponse, name: string): string {
  const prop = getProp(page, name);
  if (!prop) return "";
  if (prop.type === "select") return prop.select?.name?.trim() || "";
  if (prop.type === "rich_text") {
    return prop.rich_text.map((t) => t.plain_text).join("").trim();
  }
  return "";
}

function mapPage(page: PageObjectResponse, config: AppConfig): NotionCohort {
  const schedule = scheduleValue(page, config.schedulePropertyName);
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
    isOpen: openVal(page, config.openPropertyName, config.openYesValue),
  };
}

async function queryAllPages(
  notion: Client,
  databaseId: string,
  config: AppConfig
): Promise<PageObjectResponse[]> {
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;
  const filter = buildNotionCohortFilter(config);

  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
      filter,
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

async function loadCohortsFromNotion(): Promise<NotionCohort[]> {
  const config = loadConfig();
  const notion = createClient(config.notionToken);
  const pages = await queryAllPages(notion, config.notionDatabaseId, config);
  return pages.map((p) => mapPage(p, config));
}

export async function fetchNotionCohorts(
  forceRefresh = false
): Promise<NotionCohort[]> {
  if (forceRefresh) {
    invalidateNotionCache();
  } else {
    const cached = cacheGet<NotionCohort[]>(COHORTS_CACHE_KEY);
    if (cached) return cached;
    if (inFlightFetch) return inFlightFetch;
  }

  inFlightFetch = loadCohortsFromNotion()
    .then((cohorts) => {
      cacheSet(COHORTS_CACHE_KEY, cohorts, CACHE_TTL_MS);
      return cohorts;
    })
    .finally(() => {
      inFlightFetch = null;
    });

  return inFlightFetch;
}

export function invalidateNotionCache() {
  cacheClear("notion:");
  inFlightFetch = null;
}
