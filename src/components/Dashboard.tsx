"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock3,
  Copy,
  Globe2,
  Info,
  RefreshCw,
  UserMinus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CohortTable, type CohortSortKey } from "@/components/CohortTable";
import { CountrySelect } from "@/components/CountrySelect";
import { cn } from "@/lib/utils";
import { computeCohortOptions } from "@/lib/computeCohorts";
import { GENERIC_PLACEHOLDERS } from "@/lib/genericPlaceholders";
import type { CohortOption, Country, DstCalendarEntry, NotionCohort } from "@/lib/types";

type SortKey = CohortSortKey;

function sortOptions(
  list: CohortOption[],
  sortKey: SortKey,
  sortAsc: boolean
): CohortOption[] {
  const sorted = [...list];
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "option":
        cmp = (a.cohort.cohortName || "").localeCompare(b.cohort.cohortName || "");
        break;
      case "prework":
        cmp = (a.cohort.preworkStartDate || "").localeCompare(
          b.cohort.preworkStartDate || ""
        );
        break;
      case "fin":
        cmp = (a.cohort.courseEndDate || "").localeCompare(
          b.cohort.courseEndDate || ""
        );
        break;
      case "hora":
        cmp = (a.timeBands[0]?.localStartTime || "").localeCompare(
          b.timeBands[0]?.localStartTime || ""
        );
        break;
      case "ancla":
        cmp = a.cohort.anchorCountry.localeCompare(b.cohort.anchorCountry);
        break;
      case "dst":
        cmp = Number(a.hasDSTChange) - Number(b.hasDSTChange);
        break;
      case "inscripcion":
        cmp =
          (a.cohort.studentsCount ?? -1) - (b.cohort.studentsCount ?? -1);
        break;
    }
    return sortAsc ? cmp : -cmp;
  });
  return sorted;
}

function formatIsoDisplay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

function offsetLabel(offset: number): string {
  const sign = offset >= 0 ? "+" : "";
  return `UTC${sign}${offset}`;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
}

export function Dashboard() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [country, setCountry] = useState("España");
  const [tab, setTab] = useState<"cohorts" | "dst">("cohorts");
  const [rawCohorts, setRawCohorts] = useState<NotionCohort[]>([]);
  const [dstEntries, setDstEntries] = useState<DstCalendarEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hideFull, setHideFull] = useState(false);
  const [programFilter, setProgramFilter] = useState<string>("Todos");
  const [sortKey, setSortKey] = useState<SortKey>("prework");
  const [sortAsc, setSortAsc] = useState(true);
  const [detail, setDetail] = useState<CohortOption | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadCountries = useCallback(async () => {
    const res = await fetch("/api/countries");
    const data = (await res.json()) as Country[];
    setCountries(data);
  }, []);

  const loadDst = useCallback(async () => {
    const res = await fetch("/api/dst-changes");
    const data = (await res.json()) as DstCalendarEntry[];
    setDstEntries(data);
  }, []);

  const loadRawCohorts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cohorts/raw");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Error cargando cohortes");
      }
      setRawCohorts(data as NotionCohort[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRawCohorts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCountries();
    void loadDst();
  }, [loadCountries, loadDst]);

  useEffect(() => {
    void loadRawCohorts();
  }, [loadRawCohorts]);

  const options = useMemo(() => {
    try {
      return computeCohortOptions(rawCohorts, { country });
    } catch {
      return [];
    }
  }, [rawCohorts, country]);

  const selectedCountry = countries.find((c) => c.name === country);

  const programCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of options) {
      map.set(o.cohort.program, (map.get(o.cohort.program) || 0) + 1);
    }
    return map;
  }, [options]);

  const filteredAvailable = useMemo(() => {
    let list = [...options];

    if (hideFull) {
      // Hide at capacity and over capacity (count >= goal)
      list = list.filter((o) => {
        if (o.cohort.studentsCount == null || o.cohort.studentGoal == null) {
          return o.cohort.isOpen;
        }
        return o.cohort.studentsCount < o.cohort.studentGoal;
      });
    }
    if (programFilter !== "Todos") {
      list = list.filter((o) => o.cohort.program === programFilter);
    }

    return sortOptions(list, sortKey, sortAsc);
  }, [options, hideFull, programFilter, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/refresh", { method: "POST" });
      await loadRawCohorts();
    } finally {
      setRefreshing(false);
    }
  };

  const onCopyCode = async (code: string, id: string) => {
    await copyText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Globe2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">4Geeks Horarios</h1>
              <p className="text-sm text-slate-500">
                Dashboard de visualización horaria internacional
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => void onRefresh()}
            disabled={refreshing || loading}
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            Actualizar datos
          </Button>
        </header>

        <div className="mb-4 flex gap-2 border-b border-slate-200">
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium",
              tab === "cohorts"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
            onClick={() => setTab("cohorts")}
          >
            <Globe2 className="h-4 w-4" />
            Cohortes
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {filteredAvailable.length}
            </span>
          </button>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium",
              tab === "dst"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
            onClick={() => setTab("dst")}
          >
            <Clock3 className="h-4 w-4" />
            Cambios DST
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
            <span className="mt-1 block text-xs text-red-600">
              Si falta NOTION_TOKEN / NOTION_DATABASE_ID, configura `.env.local`.
            </span>
          </div>
        )}

        {tab === "cohorts" ? (
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">
                    Opciones disponibles
                  </h2>
                  <p className="text-xs text-slate-500">
                    Cohortes abiertas en Notion. Horario según país del alumno.
                  </p>
                </div>
                <label className="block text-sm sm:w-72">
                  <span className="mb-1.5 block font-medium text-slate-700">
                    País del alumno
                  </span>
                  <CountrySelect
                    countries={countries}
                    value={country}
                    onChange={setCountry}
                  />
                </label>
              </div>

              {selectedCountry && (
                <p className="flex items-start gap-2 text-xs text-slate-500">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Horarios convertidos a hora local de {selectedCountry.name} (
                  {selectedCountry.abbr}, {selectedCountry.offsetStr})
                  {selectedCountry.hasDST
                    ? " — Este país tiene cambio de horario (DST)."
                    : "."}
                </p>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={hideFull ? "default" : "outline"}
                    onClick={() => setHideFull((v) => !v)}
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                    Ocultar llenas
                  </Button>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <span className="mb-1.5 text-xs font-medium text-slate-500">
                    Sin cohorte:
                  </span>
                  {GENERIC_PLACEHOLDERS.map((p) => (
                    <div key={p.id} className="flex flex-col gap-1">
                      <span className="text-[11px] font-medium text-blue-800">
                        {p.program}
                      </span>
                      <button
                        type="button"
                        onClick={() => void onCopyCode(p.cohortCode, p.id)}
                        title={`Copiar ${p.cohortCode}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-900 px-2 py-1.5 font-mono text-[11px] text-white hover:bg-slate-700"
                      >
                        {p.cohortCode}
                        <Copy className="h-3 w-3 shrink-0 opacity-80" />
                        {copiedId === p.id ? " ✓" : ""}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={programFilter === "Todos" ? "default" : "outline"}
                  onClick={() => setProgramFilter("Todos")}
                  className="gap-1.5"
                >
                  Todos
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                      programFilter === "Todos"
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-700"
                    )}
                  >
                    {options.length}
                  </span>
                </Button>
                {[...programCounts.entries()].map(([program, count]) => (
                  <Button
                    key={program}
                    size="sm"
                    variant={programFilter === program ? "default" : "outline"}
                    onClick={() => setProgramFilter(program)}
                    className="gap-1.5"
                  >
                    {program}
                    <span
                      className={cn(
                        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                        programFilter === program
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 text-slate-700"
                      )}
                    >
                      {count}
                    </span>
                  </Button>
                ))}
              </div>
            </div>

            <CohortTable
              rows={filteredAvailable}
              loading={loading}
              sortKey={sortKey}
              sortAsc={sortAsc}
              onSort={toggleSort}
              copiedId={copiedId}
              onCopyCode={(code, id) => void onCopyCode(code, id)}
              onShowDetail={setDetail}
            />
          </section>
        ) : (
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold">
              Cambios de horario DST — Próximos 6 años
            </h2>
            <p className="mb-4 text-sm text-slate-500">
              Chile, España y Portugal. Fechas exactas de cada transición.
            </p>
            {[...new Set(dstEntries.map((e) => e.year))].map((y) => (
              <div key={y} className="mb-6">
                <h3 className="mb-2 text-sm font-semibold text-slate-800">{y}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                        <th className="px-2 py-2 text-left font-medium">País</th>
                        <th className="px-2 py-2 text-left font-medium">Fecha</th>
                        <th className="px-2 py-2 text-left font-medium">Desde</th>
                        <th className="px-2 py-2 text-left font-medium">Hasta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dstEntries
                        .filter((e) => e.year === y)
                        .map((e) => (
                          <tr
                            key={`${e.year}-${e.country}-${e.changeDate}-${e.from}`}
                            className="border-b border-slate-100"
                          >
                            <td className="px-2 py-2">{e.country}</td>
                            <td className="px-2 py-2">{e.changeDate}</td>
                            <td className="px-2 py-2">
                              {e.from} ({offsetLabel(e.fromOffset)})
                            </td>
                            <td className="px-2 py-2">
                              {e.to} ({offsetLabel(e.toOffset)})
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">
                Cambios de horario: {detail.cohort.cohortName}
              </h2>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100"
                onClick={() => setDetail(null)}
              >
                Close
              </button>
            </div>

            <div className="mb-4 grid gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-2">
              <div>
                <div className="text-xs text-slate-500">Prework</div>
                <div>{formatIsoDisplay(detail.cohort.preworkStartDate)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Fin (course)</div>
                <div>{formatIsoDisplay(detail.cohort.courseEndDate)}</div>
              </div>
            </div>

            {detail.timeBands.length > 1 && (
              <div className="mb-4">
                <h3 className="mb-2 text-sm font-semibold">Horarios (rotativo)</h3>
                <div className="space-y-1 text-sm">
                  {detail.timeBands.map((band) => (
                    <div key={band.label}>
                      <span className="font-medium">{band.label}:</span>{" "}
                      {band.localStartTime} – {band.localEndTime}
                      {band.dayShift ? ` ${band.dayShift}` : ""}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <h3 className="mb-2 text-sm font-semibold">Cambios DST en el rango</h3>
            <div className="mb-4 space-y-2">
              {detail.dstChanges.map((c) => (
                <div
                  key={`${c.date}-${c.cause}`}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <div className="font-medium">{c.date}</div>
                  <div className="text-slate-600">{c.cause}</div>
                  <div className="text-xs text-slate-500">
                    UTC{c.fromOffset >= 0 ? "+" : ""}
                    {c.fromOffset} → UTC{c.toOffset >= 0 ? "+" : ""}
                    {c.toOffset}
                  </div>
                </div>
              ))}
            </div>

            <h3 className="mb-2 text-sm font-semibold">Tramos horarios</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-slate-500">
                    <th className="px-2 py-2 text-left">Desde</th>
                    <th className="px-2 py-2 text-left">Hasta</th>
                    <th className="px-2 py-2 text-left">Huso ancla</th>
                    <th className="px-2 py-2 text-left">Huso alumno</th>
                    <th className="px-2 py-2 text-left">Hora local</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.segments.map((s) => (
                    <tr key={`${s.from}-${s.to}`} className="border-b border-slate-100">
                      <td className="px-2 py-2">{s.from}</td>
                      <td className="px-2 py-2">{s.to}</td>
                      <td className="px-2 py-2">
                        {s.anchorAbbr} ({offsetLabel(s.anchorOffset)})
                      </td>
                      <td className="px-2 py-2">
                        {s.studentAbbr} ({offsetLabel(s.studentOffset)})
                      </td>
                      <td className="px-2 py-2">
                        {s.localStartTime} – {s.localEndTime}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
