import { useMemo, useState } from "react";
import { bundle, flagshipCourseNums } from "../store";
import { Course } from "../types";
import { Badge } from "./Badges";

export interface Filters {
  search: string;
  concentration: string;
  coreArea: string;
  applicationOnly: boolean;
  flagshipOnly: boolean;
}

const EMPTY: Filters = {
  search: "",
  concentration: "",
  coreArea: "",
  applicationOnly: false,
  flagshipOnly: false,
};

export function Pool({ onSelect }: { onSelect: (c: Course) => void }) {
  const [f, setF] = useState<Filters>(EMPTY);

  const filtered = useMemo(() => {
    const q = f.search.trim().toLowerCase();
    return bundle.courses
      .filter((c) => {
        if (q && !(`${c.course_number} ${c.course_name}`.toLowerCase().includes(q))) return false;
        if (f.concentration && !c.concentrations.includes(f.concentration)) return false;
        if (f.coreArea && c.core_area !== f.coreArea) return false;
        if (f.applicationOnly && !c.independent_application_course) return false;
        if (f.flagshipOnly && !flagshipCourseNums.has(c.course_number)) return false;
        return true;
      })
      .sort((a, b) => a.course_name.localeCompare(b.course_name));
  }, [f]);

  const active = f.concentration || f.coreArea || f.applicationOnly || f.flagshipOnly || f.search;

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-gray-200 p-3">
        <input
          value={f.search}
          onChange={(e) => setF({ ...f, search: e.target.value })}
          placeholder="Search by name or number…"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-1 focus:ring-maroon"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={f.concentration}
            onChange={(e) => setF({ ...f, concentration: e.target.value })}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="">All concentrations</option>
            {bundle.concentrations.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
          <select
            value={f.coreArea}
            onChange={(e) => setF({ ...f, coreArea: e.target.value })}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="">All core areas</option>
            {bundle.core_areas.map((a) => (
              <option key={a.name} value={a.name}>{a.name} ({a.type})</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3 text-xs text-ink-muted">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={f.flagshipOnly}
              onChange={(e) => setF({ ...f, flagshipOnly: e.target.checked })} />
            Flagship
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={f.applicationOnly}
              onChange={(e) => setF({ ...f, applicationOnly: e.target.checked })} />
            Application-based
          </label>
          {active && (
            <button onClick={() => setF(EMPTY)} className="ml-auto text-maroon hover:underline">
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-3 py-1.5 text-[11px] uppercase tracking-wide text-ink-muted">
        <span>Course catalog</span>
        <span>{filtered.length} courses</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {filtered.map((c) => (
          <button
            key={c.course_number}
            onClick={() => onSelect(c)}
            className="mb-1.5 w-full rounded-lg border border-gray-200 bg-white p-2.5 text-left transition hover:border-maroon hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-ink">{titleCase(c.course_name)}</div>
                <div className="text-[11px] text-ink-muted">
                  {c.course_number} · {c.units}u
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                {flagshipCourseNums.has(c.course_number) && <Badge tone="maroon">★ Flagship</Badge>}
                {c.independent_application_course && <Badge tone="blue">Application</Badge>}
              </div>
            </div>
            {(c.core_area || c.concentrations.length > 0) && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {c.core_area && <Badge tone="green">{c.core_area}</Badge>}
                {c.concentrations.slice(0, 2).map((cn) => (
                  <Badge key={cn}>{cn}</Badge>
                ))}
                {c.concentrations.length > 2 && (
                  <Badge>+{c.concentrations.length - 2}</Badge>
                )}
              </div>
            )}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-ink-muted">No courses match these filters.</p>
        )}
      </div>
    </div>
  );
}

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(And|Or|The|Of|In|For|To|A|An)\b/g, (m) => m.toLowerCase())
    .replace(/^([a-z])/, (m) => m.toUpperCase());
}
