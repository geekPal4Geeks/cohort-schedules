"use client";

import { AlertTriangle, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CohortOption } from "@/lib/types";

export type CohortSortKey =
  | "option"
  | "prework"
  | "fin"
  | "hora"
  | "ancla"
  | "dst"
  | "inscripcion";

const COLUMNS: Array<[CohortSortKey, string]> = [
  ["option", "Opción"],
  ["prework", "Prework"],
  ["fin", "Fin"],
  ["hora", "Hora local"],
  ["ancla", "Ancla"],
  ["dst", "Cambia DST"],
  ["inscripcion", "Inscripción"],
];

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

function EnrollmentCell({ cohort }: { cohort: CohortOption["cohort"] }) {
  const { studentsCount, studentGoal } = cohort;
  const hasCount = studentsCount != null;
  const hasGoal = studentGoal != null && studentGoal > 0;
  const remaining =
    hasGoal && hasCount ? studentGoal - studentsCount : null;
  const fillPct =
    hasGoal && hasCount
      ? Math.min(100, Math.round((studentsCount / studentGoal) * 100))
      : null;

  let barColor = "bg-emerald-500";
  let textColor = "text-slate-900";
  if (fillPct != null && hasCount && hasGoal) {
    if (studentsCount! > studentGoal!) {
      barColor = "bg-red-500";
      textColor = "text-red-700";
    } else if (fillPct >= 100) {
      barColor = "bg-blue-500";
      textColor = "text-blue-700";
    } else if (fillPct >= 80) {
      barColor = "bg-emerald-500";
      textColor = "text-emerald-700";
    } else {
      barColor = "bg-amber-500";
      textColor = "text-amber-700";
    }
  }

  return (
    <div className="min-w-[80px] space-y-1">
      {hasCount && hasGoal ? (
        <>
          <div className="flex items-center gap-1">
            <span className={cn("text-sm font-medium tabular-nums", textColor)}>
              {studentsCount}
              <span className="font-normal text-slate-400">/{studentGoal}</span>
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn("h-full rounded-full transition-all", barColor)}
              style={{ width: `${fillPct}%` }}
            />
          </div>
          <p className="text-[10px] tabular-nums text-slate-400">
            {remaining! > 0
              ? `${remaining} cupos libres`
              : remaining === 0
                ? "Completo"
                : `${Math.abs(remaining!)} sobre cupo`}
          </p>
        </>
      ) : hasCount ? (
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium tabular-nums">{studentsCount}</span>
          <span className="text-[10px] text-slate-400">activos</span>
        </div>
      ) : hasGoal ? (
        <div className="flex items-center gap-1">
          <span className="text-sm text-slate-400">
            Meta:{" "}
            <span className="font-medium text-slate-900">{studentGoal}</span>
          </span>
        </div>
      ) : (
        <span className="text-[10px] text-slate-400">—</span>
      )}
    </div>
  );
}

type CohortTableProps = {
  rows: CohortOption[];
  loading?: boolean;
  emptyMessage?: string;
  sortKey: CohortSortKey;
  sortAsc: boolean;
  onSort: (key: CohortSortKey) => void;
  copiedId: string | null;
  onCopyCode: (code: string, id: string) => void;
  onShowDetail: (option: CohortOption) => void;
  showSort?: boolean;
};

export function CohortTable({
  rows,
  loading = false,
  emptyMessage = "No hay cohortes para estos filtros.",
  sortKey,
  sortAsc,
  onSort,
  copiedId,
  onCopyCode,
  onShowDetail,
  showSort = true,
}: CohortTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            {COLUMNS.map(([key, label]) => (
              <th key={key} className="px-2 py-3 font-medium">
                {showSort ? (
                  <button
                    type="button"
                    className="hover:text-slate-800"
                    onClick={() => onSort(key)}
                  >
                    {label}
                    {sortKey === key ? (sortAsc ? " ↑" : " ↓") : ""}
                  </button>
                ) : (
                  label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={7} className="px-2 py-8 text-center text-slate-500">
                <div>Cargando cohortes desde Notion…</div>
                <div className="mt-1 text-xs text-slate-400">
                  La primera consulta puede tardar 20–40 s; las siguientes usan
                  caché.
                </div>
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-2 py-8 text-center text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((o) => {
              const code = o.cohort.cohortCode;
              return (
                <tr
                  key={o.cohort.id}
                  className={cn(
                    "border-b border-slate-100 align-top",
                    o.cohort.isPlaceholder && "bg-slate-50/80"
                  )}
                >
                  <td className="px-2 py-3">
                    <div className="font-medium text-slate-900">
                      {o.cohort.cohortName}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {code ? (
                        <button
                          type="button"
                          onClick={() => onCopyCode(code, o.cohort.id)}
                          className="inline-flex items-center gap-1 rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] text-white hover:bg-slate-700"
                          title="Copiar código"
                        >
                          {code}
                          <Copy className="h-3 w-3" />
                          {copiedId === o.cohort.id ? " ✓" : ""}
                        </button>
                      ) : (
                        !o.cohort.isPlaceholder && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">
                            Sin código
                          </span>
                        )
                      )}
                      {o.cohort.academy && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                          {o.cohort.academy}
                        </span>
                      )}
                      {o.cohort.program && (
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-800">
                          {o.cohort.program}
                        </span>
                      )}
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[11px]",
                          o.cohort.isPlaceholder
                            ? "bg-slate-200 text-slate-700"
                            : "bg-green-50 text-green-800"
                        )}
                      >
                        {o.cohort.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap text-slate-700">
                    {formatIsoDisplay(o.cohort.preworkStartDate)}
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap text-slate-700">
                    {formatIsoDisplay(o.cohort.courseEndDate)}
                  </td>
                  <td className="px-2 py-3">
                    {o.timeBands.length > 0 ? (
                      <div className="space-y-1.5">
                        {o.timeBands.map((band) => (
                          <div key={`${band.label}-${band.localStartTime}`}>
                            {band.label ? (
                              <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                                {band.label}
                              </div>
                            ) : null}
                            <div>
                              {band.localStartTime} – {band.localEndTime}
                              {band.dayShift ? (
                                <span className="ml-1 text-xs text-slate-400">
                                  {band.dayShift}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-slate-400">
                              Franja máx: {band.maxBand.earliestStart} –{" "}
                              {band.maxBand.latestEnd}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    <div>{o.cohort.anchorCountry}</div>
                    <div className="text-xs text-slate-400">
                      {o.segments[0]
                        ? `${o.segments[0].anchorAbbr} (${offsetLabel(o.segments[0].anchorOffset)})`
                        : "—"}
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    {o.hasDSTChange ? (
                      <div className="flex flex-col items-start gap-1">
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Sí
                        </span>
                        <button
                          type="button"
                          className="text-xs text-blue-600 hover:underline"
                          onClick={() => onShowDetail(o)}
                        >
                          ver detalle
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400">No</span>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    <EnrollmentCell cohort={o.cohort} />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
