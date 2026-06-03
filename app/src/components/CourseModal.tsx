import { sectionsByCourse, priceFor, usePlan } from "../store";
import { Course, Section, Term, Year, TERMS } from "../types";
import { Badge } from "./Badges";
import { titleCase } from "./Pool";

export function CourseModal({ course, onClose }: { course: Course; onClose: () => void }) {
  const sections = (sectionsByCourse.get(course.course_number) ?? []).filter(
    (s) => s.quarter && s.quarter !== "Summer",
  );
  const byTerm: Record<string, Section[]> = {};
  for (const s of sections) {
    (byTerm[s.quarter as string] ??= []).push(s);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 p-4 sm:p-8" onClick={onClose}>
      <div
        className="max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-gray-100 bg-white/95 p-5 backdrop-blur">
          <div>
            <h2 className="text-lg font-semibold text-ink">{titleCase(course.course_name)}</h2>
            <p className="text-sm text-ink-muted">{course.course_number} · {course.units} units</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {course.core_area && <Badge tone="green">{course.core_area}</Badge>}
              {course.independent_application_course && <Badge tone="blue">Application-based</Badge>}
              {course.concentrations.map((c) => <Badge key={c}>{c}</Badge>)}
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-muted hover:bg-gray-100">✕</button>
        </div>

        <div className="space-y-5 p-5">
          {course.description && (
            <p className="text-sm leading-relaxed text-gray-700">{course.description}</p>
          )}

          {(course.strict_prereqs.length > 0 || course.recommended_prereqs.length > 0) && (
            <div className="rounded-lg bg-gray-50 p-3 text-xs">
              {course.strict_prereqs.length > 0 && (
                <div><span className="font-semibold text-maroon">Strict prerequisites:</span> {course.strict_prereqs.join(", ")}</div>
              )}
              {course.recommended_prereqs.length > 0 && (
                <div className="mt-1"><span className="font-semibold text-ink-muted">Recommended:</span> {course.recommended_prereqs.join(", ")}</div>
              )}
            </div>
          )}

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Sections — add to a quarter
            </h3>
            <div className="space-y-2">
              {TERMS.filter((t) => byTerm[t]?.length).map((term) => (
                <div key={term}>
                  <div className="mb-1 text-xs font-medium text-gray-500">{term}</div>
                  {byTerm[term].map((s) => (
                    <SectionRow key={s.section_code} section={s} term={term as Term} />
                  ))}
                </div>
              ))}
              {sections.length === 0 && (
                <p className="text-sm text-ink-muted">No bid-able sections (offered by application or not scheduled this year).</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionRow({ section, term }: { section: Section; term: Term }) {
  const add = usePlan((s) => s.addSection);
  const priceY1 = priceFor(section, term === "Autumn" ? "Y1-Autumn" : `Y1-${term}`);
  return (
    <div className="mb-1.5 flex items-center gap-3 rounded-lg border border-gray-200 p-2.5 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{section.section_code}</span>
          {section.flagship_course && <Badge tone="maroon">★</Badge>}
        </div>
        <div className="text-xs text-ink-muted">
          {section.professor ?? "TBD"} · {section.time ?? "time TBD"}
        </div>
      </div>
      <div className="text-right text-xs text-ink-muted">
        <div>est. {priceY1 != null ? priceY1.toLocaleString() : "—"}</div>
      </div>
      <div className="flex gap-1">
        {([1, 2] as Year[]).map((y) => (
          <button
            key={y}
            onClick={() => add(y, term, section.section_id)}
            className="rounded-md bg-maroon px-2 py-1 text-xs font-medium text-white hover:bg-maroon-600"
          >
            + Y{y}
          </button>
        ))}
      </div>
    </div>
  );
}
