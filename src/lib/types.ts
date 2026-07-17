export type Country = {
  name: string;
  abbr: string;
  offset: number;
  offsetStr: string;
  hasDST: boolean;
  /** IANA zone used for DST-aware conversion when available */
  iana?: string;
};

export type NotionCohort = {
  id: string;
  cohortName: string;
  program: string;
  academy: string | null;
  cohortCode: string | null;
  preworkStartDate: string | null;
  contentStartDate: string | null;
  courseEndDate: string | null;
  anchorCountry: string;
  optionType: string;
  status: string;
  schedule: string;
  notionTimezone: string;
  studentsCount: number | null;
  studentGoal: number | null;
  isOpen: boolean;
  /** Fixed generic code row (not from Notion dates) */
  isPlaceholder?: boolean;
};

export type ScheduleSegment = {
  from: string;
  to: string;
  anchorAbbr: string;
  anchorOffset: number;
  studentAbbr: string;
  studentOffset: number;
  localStartTime: string;
  localEndTime: string;
  crossesMidnight: boolean;
  dayShift: string;
};

export type TimeBand = {
  /** e.g. "Mañana" / "Tarde" for rotativo; empty for single schedule */
  label: string;
  localStartTime: string;
  localEndTime: string;
  dayShift: string;
  maxBand: { earliestStart: string; latestEnd: string };
  segments: ScheduleSegment[];
};

export type DstChangeInfo = {
  date: string;
  from: string;
  to: string;
  fromOffset: number;
  toOffset: number;
  cause: string;
};

export type CohortOption = {
  cohort: NotionCohort & {
    /** Alias used by conversion (prework start); empty for placeholders */
    startDate: string;
    endDate: string;
  };
  localStartDate: string;
  localEndDate: string;
  studentTimezone: { abbr: string; offset: number };
  /** Primary segments (first time band) — used by DST modal */
  segments: ScheduleSegment[];
  /** One entry per schedule slot (rotativo → mañana + tarde) */
  timeBands: TimeBand[];
  maxBand: { earliestStart: string; latestEnd: string };
  hasDSTChange: boolean;
  dstChanges: DstChangeInfo[];
  badges: Array<{ type: string; label: string; tooltip: string }>;
};

export type DstCalendarEntry = {
  year: number;
  country: string;
  changeDate: string;
  from: string;
  to: string;
  fromOffset: number;
  toOffset: number;
};
