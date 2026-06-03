import { useMemo, useState } from "react";
import { usePlan, flagshipPairs, bundle, isFlagship } from "../store";
import { titleCase } from "./Pool";

export function FlagshipModal({ onClose }: { onClose: () => void }) {
  const overrides = usePlan((s) => s.flagship);
  const toggle = usePlan((s) => s.toggleFlagship);
  const pairs = useMemo(() => flagshipPairs(overrides), [overrides]);
  const [q, setQ] = useState("");

  // candidate (course, professor) pairs to add, filtered by search
  const candidates = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const seen = new Set<string>();
    const out: { course_number: string; professor: string; course_name: string }[] = [];
    for (const s of bundle.sections) {
      const key = `${s.course_number}|${s.professor ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (isFlagship(s.course_number, s.professor, overrides)) continue;
      if (`${s.course_number} ${s.course_name} ${s.professor ?? ""}`.toLowerCase().includes(term)) {
        out.push({ course_number: s.course_number, professor: s.professor ?? "—", course_name: s.course_name });
      }
    }
    return out.slice(0, 25);
  }, [q, overrides]);

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/60 p-4 sm:p-8" onClick={onClose}>
      <div className="max-h-full w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-start justify-between border-b border-line bg-surface/95 p-5 backdrop-blur">
          <div>
            <h2 className="text-lg font-semibold text-txt">Flagship courses</h2>
            <p className="text-sm text-muted">Your flagship list is per (course, professor). Seeded with Carlos's suggestions — edit freely.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-surface2 hover:text-txt">✕</button>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Your flagships ({pairs.length})</h3>
            <div className="space-y-1.5">
              {pairs.map((p) => (
                <div key={`${p.course_number}|${p.professor}`} className="flex items-center justify-between rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-txt">★ {titleCase(p.course_name)}</div>
                    <div className="text-[11px] text-muted">{p.course_number} · {p.professor}</div>
                  </div>
                  <button onClick={() => toggle(p.course_number, p.professor === "—" ? null : p.professor)}
                    className="rounded-md px-2 py-1 text-xs text-muted ring-1 ring-inset ring-line hover:text-danger">Remove</button>
                </div>
              ))}
              {pairs.length === 0 && <p className="text-sm text-muted">No flagship courses yet.</p>}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Add a flagship</h3>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search course or professor to add…"
              className="w-full rounded-lg border border-line bg-surface2 px-3 py-2 text-sm text-txt outline-none placeholder:text-muted focus:border-maroon-light"
            />
            <div className="mt-2 space-y-1">
              {candidates.map((p) => (
                <div key={`${p.course_number}|${p.professor}`} className="flex items-center justify-between rounded-lg border border-line bg-surface2 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate text-txt">{titleCase(p.course_name)}</div>
                    <div className="text-[11px] text-muted">{p.course_number} · {p.professor}</div>
                  </div>
                  <button onClick={() => toggle(p.course_number, p.professor === "—" ? null : p.professor)}
                    className="rounded-md bg-gold/20 px-2 py-1 text-xs text-gold ring-1 ring-inset ring-gold/40 hover:bg-gold/30">★ Make flagship</button>
                </div>
              ))}
              {q && candidates.length === 0 && <p className="text-xs text-muted">No matching non-flagship sections.</p>}
            </div>
            <p className="mt-2 text-[11px] text-muted">Tip: you can also toggle ★ on any section inside a course's detail popup.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
