import {
  bundle, usePlan, placedCourseNumbers, concentrationProgress, areaCoverage,
} from "../store";

export function StatusPanel() {
  const placements = usePlan((s) => s.placements);
  const clearAll = usePlan((s) => s.clearAll);
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
        {placements.length > 0 && (
          <button onClick={clearAll} className="mt-2 text-xs text-maroon-light hover:underline">Clear plan</button>
        )}
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
