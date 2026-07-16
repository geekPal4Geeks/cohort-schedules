export function loadConfig() {
  const notionToken = process.env.NOTION_TOKEN?.trim();
  const notionDatabaseId = process.env.NOTION_DATABASE_ID?.trim();

  if (!notionToken) {
    throw new Error("Missing NOTION_TOKEN");
  }
  if (!notionDatabaseId) {
    throw new Error("Missing NOTION_DATABASE_ID");
  }

  return {
    notionToken,
    notionDatabaseId,
    idPropertyName: (process.env.ID_PROPERTY_NAME || "Cohort Code").trim(),
    academyPropertyName: "Academy",
    programPropertyName: "Program",
    preworkDatePropertyName: "Start date (prework)",
    contentDatePropertyName: "Start Date (content)",
    endDatePropertyName: "End Date (course)",
    schedulePropertyName: "Schedule",
    timezonePropertyName: "Time Zone",
    statusPropertyName: "Status",
    studentsCountPropertyName: "Students Count",
    studentGoalPropertyName: "Student Goal",
    openPropertyName: "Open",
    /** Select value meaning cohort is open for enrollment */
    openYesValue: "Yes",
    /** Status values included when syncing from Notion (see DB view filter) */
    eligibleStatuses: [
      "Enrolling",
      "Unstarted",
      "Ready to Create",
      "Created",
    ] as const,
  };
}

export type AppConfig = ReturnType<typeof loadConfig>;
