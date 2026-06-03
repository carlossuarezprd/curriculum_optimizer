import {
  bundle, usePlan, placedCourseNumbers, concentrationProgress, areaCoverage,
} from "../store";

export function StatusPanel() {
  const placements = usePlan((s) => s.placements);
  const clearAll = usePlan((s) => s.clearAll);
  const courseNums = placedCourseNumbers(placements);
  const totalCourses = courseNums.length;
  const meta = bundle.meta;

  const concs = concentrationProgress(placements).filter((c) => c.met);
  const areas = areaCoverage(placements);
  const foundations = areas.filter((a) => a.type === "foundation");
  const functions = areas.filter((a) => a.type === "function");
  const foundationsOk = foundations.every((a) => a.covered);
  const functionsUncovered = functions.filter((a) => !a.covered).length;

  const totalBad = totalCourses > 0 && (totalCourses < meta.min_total_courses || totalCourses > meta.max_total_courses);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 text-sm">
      <Section title="Plan">
        <Row label="Courses placed" value={`${totalCourses}`} warn={totalBad}
          hint={`${meta.min_total_courses}–${meta.max_total_courses} required`} />
        {totalBad && <Note>Total must be {meta.min_total_courses}–{meta.max_total_courses} courses.</Note>}
        {placements.length > 0 && (
          <button onClick={clearAll} className="mt-1 text-xs text-maroon hover:underline">Clear plan</button>
        )}
      </Section>

      <Section title="Degree coverage">
        <div className="mb-2">
          <div className="mb-1 text-xs font-medium text-ink-muted">Foundations (all 3 required)</div>
          <div className="flex flex-wrap gap-1">
            {foundations.map((a) => <Pill key={a.name} ok={a.covered}>{a.name}</Pill>)}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-ink-muted">Functions (7 of 8 required)</div>
          <div className="flex flex-wrap gap-1">
            {functions.map((a) => <Pill key={a.name} ok={a.covered}>{a.name}</Pill>)}
          </div>
        </div>
        <div className="mt-2 text-xs">
          {foundationsOk
            ? <span className="text-emerald-600">✓ All foundations covered</span>
            : <span className="text-amber-600">⚠ Missing a foundation</span>}
          {" · "}
          {functionsUncovered <= 1
            ? <span className="text-emerald-600">✓ Functions OK</span>
            : <span className="text-amber-600">⚠ {functionsUncovered} functions uncovered</span>}
        </div>
      </Section>

      <Section title="Concentrations met">
        {concs.length === 0 ? (
          <p className="text-xs text-ink-muted">None yet — they appear here once the unit threshold is reached.</p>
        ) : (
          <div className="space-y-1">
            {concs.map((c) => (
              <div key={c.name} className="flex items-center justify-between rounded-md bg-emerald-50 px-2 py-1 text-xs">
                <span className="font-medium text-emerald-800">{c.name}</span>
                <span className="tabular-nums text-emerald-700">{c.earned}/{c.required}u</span>
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
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</h3>
      {children}
    </div>
  );
}
function Row({ label, value, warn, hint }: { label: string; value: string; warn?: boolean; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-ink">{label}</span>
      <span className={`tabular-nums font-semibold ${warn ? "text-amber-600" : "text-ink"}`}>
        {value} {hint && <span className="text-[10px] font-normal text-ink-muted">/ {hint}</span>}
      </span>
    </div>
  );
}
function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[11px] text-amber-600">{children}</p>;
}
function Pill({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
      ok ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"
    }`}>
      {ok ? "✓ " : ""}{children}
    </span>
  );
}
