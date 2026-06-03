import { bundle, usePlan, placementsBySlot, sectionById, priceFor, bidByQuarter } from "../store";
import { TERMS, YEARS, slotId, Section } from "../types";
import { Badge, Flag } from "./Badges";
import { titleCase } from "./Pool";

export function Board() {
  const placements = usePlan((s) => s.placements);
  const bids = bidByQuarter(placements, bundle.meta);
  const bySlot = placementsBySlot(placements);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {YEARS.map((year) =>
        TERMS.map((term) => {
          const slot = slotId(year, term);
          const ps = bySlot.get(slot) ?? [];
          const qb = bids.get(slot)!;
          const countBad = ps.length > 0 && (ps.length < bundle.meta.min_courses_per_quarter || ps.length > bundle.meta.max_courses_per_quarter);
          return (
            <div key={slot} className="flex flex-col rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                <div className="text-sm font-semibold text-ink">
                  Year {year} · {term}
                </div>
                <span className={`text-xs ${countBad ? "font-semibold text-amber-600" : "text-ink-muted"}`}>
                  {ps.length} {countBad && <span title="Quarters allow 2–5 courses">⚠</span>}
                </span>
              </div>

              <div className="min-h-[80px] flex-1 space-y-1.5 p-2">
                {ps.length === 0 && (
                  <p className="px-1 py-6 text-center text-xs text-gray-300">
                    add courses from the catalog
                  </p>
                )}
                {ps.map((p) => {
                  const sec = sectionById.get(p.section_id);
                  if (!sec) return null;
                  return <PlacedCard key={p.section_id} slot={slot} section={sec} bid={p.actual_bid} />;
                })}
              </div>

              <div className="border-t border-gray-100 px-3 py-2 text-[11px]">
                <div className="flex justify-between text-ink-muted">
                  <span>available</span><span className="tabular-nums">{qb.available.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <span>est. cost</span><span className="tabular-nums">{qb.spent.toLocaleString()}</span>
                </div>
                <div className={`flex justify-between font-medium ${qb.remaining < 0 ? "text-amber-600" : "text-ink"}`}>
                  <span>remaining</span><span className="tabular-nums">{qb.remaining.toLocaleString()}</span>
                </div>
              </div>
            </div>
          );
        }),
      )}
    </div>
  );
}

function PlacedCard({ slot, section, bid }: { slot: string; section: Section; bid: number | null }) {
  const remove = usePlan((s) => s.removeSection);
  const setBid = usePlan((s) => s.setBid);
  const price = priceFor(section, slot) ?? 0;
  const bidLow = bid != null && bid < price;
  return (
    <div
      className={`group rounded-lg border p-2 text-xs ${
        section.flagship_course ? "border-maroon-100 bg-maroon-50" :
        section.independent_application_course ? "border-blue-200 border-dashed bg-blue-50/40" :
        "border-gray-200 bg-gray-50"
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <div className="truncate font-semibold text-ink">{titleCase(section.course_name)}</div>
          <div className="text-[10px] text-ink-muted">{section.section_code} · {section.professor ?? "TBD"}</div>
        </div>
        <button
          onClick={() => remove(slot, section.section_id)}
          className="shrink-0 rounded px-1 text-ink-muted opacity-0 transition group-hover:opacity-100 hover:text-maroon"
          title="Remove"
        >✕</button>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {section.flagship_course && <Badge tone="maroon">★</Badge>}
        {section.independent_application_course ? (
          <Badge tone="blue">by application</Badge>
        ) : (
          <span className="text-[10px] text-ink-muted">est. {price.toLocaleString()}</span>
        )}
        {section.core_area && <Badge tone="green">{section.core_area}</Badge>}
      </div>
      {!section.independent_application_course && (
        <div className="mt-1.5 flex items-center gap-1">
          <span className="text-[10px] text-ink-muted">bid</span>
          <input
            type="number"
            value={bid ?? ""}
            placeholder={String(price)}
            onChange={(e) => setBid(slot, section.section_id, e.target.value === "" ? null : Number(e.target.value))}
            className="w-20 rounded border border-gray-300 px-1.5 py-0.5 text-[11px] tabular-nums"
          />
          {bidLow && <Flag label={`Bid below estimated cost (${price.toLocaleString()})`} />}
        </div>
      )}
    </div>
  );
}
