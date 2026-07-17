"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Country } from "@/lib/types";

type CountrySelectProps = {
  countries: Country[];
  value: string;
  onChange: (country: string) => void;
  className?: string;
};

export function CountrySelect({
  countries,
  value,
  onChange,
  className,
}: CountrySelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const selected = countries.find((c) => c.name === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.abbr.toLowerCase().includes(q) ||
        c.offsetStr.toLowerCase().includes(q)
    );
  }, [countries, query]);

  useEffect(() => {
    if (!open) return;
    setHighlight(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery("");
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[highlight];
      if (item) pick(item.name);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)} onKeyDown={onKeyDown}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm shadow-sm transition",
          "hover:border-slate-300 hover:bg-slate-50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-400",
          open && "border-blue-400 ring-2 ring-blue-500/20"
        )}
      >
        <span className="min-w-0 flex-1">
          {selected ? (
            <span className="flex items-baseline gap-2">
              <span className="truncate font-medium text-slate-900">
                {selected.name}
              </span>
              <span className="shrink-0 text-xs text-slate-500">
                {selected.abbr} · {selected.offsetStr}
              </span>
            </span>
          ) : (
            <span className="text-slate-400">Seleccionar país…</span>
          )}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div
          className="absolute right-0 z-40 mt-1.5 w-full min-w-[280px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/80"
          role="presentation"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              placeholder="Buscar país, huso o UTC…"
              className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              aria-autocomplete="list"
              aria-controls={listId}
            />
          </div>

          <ul
            id={listId}
            role="listbox"
            className="max-h-64 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-slate-500">
                Sin coincidencias para “{query}”
              </li>
            ) : (
              filtered.map((c, idx) => {
                const isSelected = c.name === value;
                const isActive = idx === highlight;
                return (
                  <li key={c.name} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition",
                        isActive && "bg-blue-50",
                        !isActive && "hover:bg-slate-50",
                        isSelected && "font-medium text-blue-900"
                      )}
                      onMouseEnter={() => setHighlight(idx)}
                      onClick={() => pick(c.name)}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0 text-blue-600",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-slate-500">
                        {c.abbr} · {c.offsetStr}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
