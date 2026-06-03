import { useRef } from "react";
import {
  bundle, usePlan, placedCourseNumbers, concentrationProgress, areaCoverage,
} from "../store";

function exportPlan() {
  const { placements, flagship } = usePlan.getState();
  const blob = new Blob([JSON.stringify({ version: 1, placements, flagship }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `booth-curriculum-plan-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function StatusPanel() {
  const placements = usePlan((s) => s.placements);
  const clearAll = usePlan((s) => s.clearAll);
  const loadPlan = usePlan((s) => s.loadPlan);
  const setNotice = usePlan((s) => s.setNotice);
  const fileRef = useRef<HTMLInputElement>(null);

  function importPlan(file: File) {
    const r = new FileReader();
    r.onload = () => {
      try {
        loadPlan(JSON.parse(String(r.result)));
      } catch {
        setNotice("Could not read that plan file.");
      }
    };
    r.readAsText(file);
  }
  const totalCourses = placedCourseNumbers(placements).length;
  const meta = bundle.meta;

  const concs = concentrationProgress(placements).filter((c) => c.met);
  const areas = areaCoverage(placements);
  const foundations = areas.filter((a) => a.type === "foundation");
  const functions = areas.filter((a) => a.type === "function");
  const foundationsOk = foundations.every((a) => a.covered);
  const functionsUncovered = functions.filter((a) => !a.covered).length;
  const totalBad = totalCourses > 0 && (totalCourses < meta.min_total_courses || totalCourses > meta.max_total_courses);

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto bg-surface p-4 text-sm">
      <Section title="Plan">
        <div className="flex items-baseline justify-between">
          <span className="text-txt">Courses placed</span>
          <span className={`font-semibold tabular-nums ${totalBad ? "text-warn" : "text-txt"}`}>
            {totalCourses} <span className="text-[10px] font-normal text-muted">/ {meta.min_total_courses}–{meta.max_total_courses}</span>
          </span>
        </div>
        {totalBad && <p className="mt-1 text-[11px] text-warn">Total must be {meta.min_total_courses}–{meta.max_total_courses} courses.</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <button onClick={exportPlan} className="rounded-md bg-surface2 px-2 py-1 text-txt ring-1 ring-inset ring-line hover:border-maroon-light">Export</button>
          <button onClick={() => fileRef.current?.click()} className="rounded-md bg-surface2 px-2 py-1 text-txt ring-1 ring-inset ring-line hover:border-maroon-light">Import</button>
          {placements.length > 0 && <button onClick={clearAll} className="text-maroon-light hover:underline">Clear</button>}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importPlan(f); e.target.value = ""; }}
          />
        </div>
      </Section>

      <Section title="Degree coverage">
        <div className="mb-2">
          <div className="mb-1 text-xs font-medium text-muted">Foundations · all 3 required</div>
          <div className="flex flex-wrap gap-1">{foundations.map((a) => <Pill key={a.name} ok={a.covered}>{a.name}</Pill>)}</div>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-muted">Functions · 7 of 8 required</div>
          <div className="flex flex-wrap gap-1">{functions.map((a) => <Pill key={a.name} ok={a.covered}>{a.name}</Pill>)}</div>
        </div>
        <div className="mt-2 text-xs">
          {foundationsOk ? <span className="text-good">✓ Foundations complete</span> : <span className="text-warn">⚠ Missing a foundation</span>}
          {" · "}
          {functionsUncovered <= 1 ? <span className="text-good">✓ Functions OK</span> : <span className="text-warn">⚠ {functionsUncovered} functions uncovered</span>}
        </div>
      </Section>

      <Section title="Concentrations met">
        {concs.length === 0 ? (
          <p className="text-xs text-muted">None yet — they appear once the unit threshold is reached.</p>
        ) : (
          <div className="space-y-1">
            {concs.map((c) => (
              <div key={c.name} className="flex items-center justify-between rounded-md bg-good/10 px-2 py-1 text-xs ring-1 ring-inset ring-good/30">
                <span className="font-medium text-good">{c.name}</span>
                <span className="tabular-nums text-good">{c.earned}/{c.required}u</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </div>
  );
}
function Pill({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ok ? "bg-good/15 text-good ring-1 ring-inset ring-good/30" : "bg-surface2 text-muted/60"}`}>
      {ok ? "✓ " : ""}{children}
    </span>
  );
}
