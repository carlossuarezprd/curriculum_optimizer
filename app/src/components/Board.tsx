import { useState } from "react";
import {
  bundle, usePlan, placementsBySlot, sectionById, sectionsByCourse, courseByNum,
  priceFor, isUnavailable, bidByQuarter, isFlagship, missingStrictGroups,
} from "../store";
import { TERMS, YEARS, slotId, Section, Term, Year, Course } from "../types";
import { parseSchedule, overlaps } from "../schedule";
import { Badge, IconDot } from "./Badges";
import { titleCase } from "./Pool";

export function Board({ onOpenCourse }: { onOpenCourse: (c: Course) => void }) {
  const placements = usePlan((s) => s.placements);
  const bids = bidByQuarter(placements, bundle.meta);
  const bySlot = placementsBySlot(placements);
  const [prereqPopup, setPrereqPopup] = useState<{ course_number: string; slot: string } | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {YEARS.map((year) =>
          TERMS.map((term) => (
            <QuarterColumn
              key={slotId(year, term)}
              year={year}
              term={term}
              placements={bySlot.get(slotId(year, term)) ?? []}
              qb={bids.get(slotId(year, term))!}
              onOpenCourse={onOpenCourse}
              onOpenPrereq={(course_number) => setPrereqPopup({ course_number, slot: slotId(year, term) })}
            />
          )),
        )}
      </div>
      {prereqPopup && (
        <PrereqPopup
          course_number={prereqPopup.course_number}
          slot={prereqPopup.slot}
          onClose={() => setPrereqPopup(null)}
        />
      )}
    </>
  );
}

function QuarterColumn({
  year, term, placements, qb, onOpenCourse, onOpenPrereq,
}: {
  year: Year; term: Term;
  placements: { slot: string; section_id: string; actual_bid: number | null }[];
  qb: { available: number; spent: number; remaining: number; bidSum: number; courseCount: number };
  onOpenCourse: (c: Course) => void;
  onOpenPrereq: (course_number: string) => void;
}) {
  const slot = slotId(year, term);
  const add = usePlan((s) => s.addSection);
  const move = usePlan((s) => s.movePlacement);
  const setNotice = usePlan((s) => s.setNotice);
  const [over, setOver] = useState(false);

  const meta = bundle.meta;
  const n = placements.length;
  const countBad = n > 0 && (n < meta.min_courses_per_quarter || n > meta.max_courses_per_quarter);

  // schedule conflicts within this quarter
  const scheds = placements.map((p) => parseSchedule(sectionById.get(p.section_id)?.time ?? null));
  const conflicted = new Set<string>();
  for (let i = 0; i < placements.length; i++)
    for (let j = i + 1; j < placements.length; j++)
      if (overlaps(scheds[i], scheds[j])) {
        conflicted.add(placements[i].section_id);
        conflicted.add(placements[j].section_id);
      }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setOver(false);
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.kind === "course") {
      const secs = (sectionsByCourse.get(d.course_number) ?? []).filter((s) => s.quarter === term);
      const co = courseByNum.get(d.course_number);
      if (secs.length === 0) setNotice(`${co ? titleCase(co.course_name) : d.course_number} isn't offered in ${term}`);
      else if (secs.length === 1) add(year, term, secs[0].section_id);
      else { if (co) onOpenCourse(co); setNotice(`Multiple ${term} sections — pick one`); }
    } else if (d.kind === "placed") {
      const sec = sectionById.get(d.section_id);
      if (!sec || d.fromSlot === slot) return;
      if (sec.quarter === term) move(d.fromSlot, d.section_id, slot, d.section_id);
      else {
        const alt = (sectionsByCourse.get(sec.course_number) ?? []).find((s) => s.quarter === term);
        if (alt) move(d.fromSlot, d.section_id, slot, alt.section_id);
        else setNotice(`${titleCase(sec.course_name)} isn't offered in ${term}`);
      }
    }
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      className={`flex flex-col rounded-xl border bg-surface transition ${over ? "border-maroon-light ring-1 ring-maroon-light" : "border-line"}`}
    >
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div className="text-sm font-semibold text-txt">Year {year} · {term}</div>
        <span className={`text-xs ${countBad ? "font-semibold text-warn" : "text-muted"}`}>
          {n} course{n === 1 ? "" : "s"} {countBad && <span title="Quarters allow 2–5 courses">⚠</span>}
        </span>
      </div>

      <div className="min-h-[90px] flex-1 space-y-1.5 p-2">
        {n === 0 && <p className="px-1 py-7 text-center text-xs text-muted/50">drag courses here</p>}
        {placements.map((p) => {
          const sec = sectionById.get(p.section_id);
          if (!sec) return null;
          return (
            <PlacedCard
              key={p.section_id}
              slot={slot}
              section={sec}
              bid={p.actual_bid}
              conflict={conflicted.has(p.section_id)}
              onOpenCourse={onOpenCourse}
              onOpenPrereq={onOpenPrereq}
            />
          );
        })}
      </div>

      <div className="space-y-0.5 border-t border-line px-3 py-2 text-xs">
        <Line label="Points available" value={qb.available} />
        <Line label="Estimated cost" value={qb.spent} tone="gold" />
        <Line label="Remaining" value={qb.remaining} bold tone={qb.remaining < 0 ? "warn" : "txt"} />
        {qb.bidSum > 0 && (
          <div className="flex items-center justify-between font-medium">
            <span className="text-muted">Bids placed</span>
            <span className={`flex items-center gap-1 tabular-nums ${qb.bidSum === qb.available ? "text-good" : qb.bidSum > qb.available ? "text-danger" : "text-warn"}`}>
              {qb.bidSum.toLocaleString()} <span className="text-[10px] text-muted">pts</span>
              {qb.bidSum !== qb.available && (
                <IconDot
                  symbol="!"
                  tone={qb.bidSum > qb.available ? "danger" : "warn"}
                  title={`Total bids should equal available points (${qb.available.toLocaleString()}). You've allocated ${qb.bidSum.toLocaleString()} — ${qb.bidSum > qb.available ? "over" : "under"} by ${Math.abs(qb.bidSum - qb.available).toLocaleString()} pts.`}
                />
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function Line({ label, value, bold, tone = "muted" }: { label: string; value: number; bold?: boolean; tone?: string }) {
  const c = { muted: "text-muted", gold: "text-gold", warn: "text-warn", txt: "text-txt" }[tone] ?? "text-muted";
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span className={tone === "muted" ? "text-muted" : "text-muted"}>{label}</span>
      <span className={`tabular-nums ${c}`}>{value.toLocaleString()} <span className="text-[10px] text-muted">pts</span></span>
    </div>
  );
}

function PlacedCard({
  slot, section, bid, conflict, onOpenCourse, onOpenPrereq,
}: {
  slot: string; section: Section; bid: number | null; conflict: boolean;
  onOpenCourse: (c: Course) => void; onOpenPrereq: (course_number: string) => void;
}) {
  const remove = usePlan((s) => s.removeSection);
  const setBid = usePlan((s) => s.setBid);
  const overrides = usePlan((s) => s.flagship);
  const placements = usePlan((s) => s.placements);
  const flag = isFlagship(section.course_number, section.professor, overrides);
  const app = section.independent_application_course;
  const price = priceFor(section, slot) ?? 0;
  const unavailable = isUnavailable(section, slot);
  const bidLow = !app && !unavailable && bid != null && bid < price;
  const sched = parseSchedule(section.time);
  const hasPrereqs = (courseByNum.get(section.course_number)?.strict_prereq_groups.length ?? 0) > 0;
  const missing = hasPrereqs ? missingStrictGroups(section.course_number, slot, placements) : [];

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/json", JSON.stringify({ kind: "placed", section_id: section.section_id, fromSlot: slot }));
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onOpenCourse(courseByNum.get(section.course_number)!)}
      className={`group cursor-pointer rounded-lg border p-2 text-xs ${
        flag ? "border-gold/40 bg-gold/10"
        : app ? "border-sky-500/40 border-dashed bg-sky-500/10"
        : "border-line bg-surface2"
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <div className="truncate font-semibold text-txt">{titleCase(section.course_name)}</div>
          <div className="text-[10px] text-muted">{section.section_code} · {section.professor ?? "TBD"}</div>
        </div>
        <button onClick={(e) => { stop(e); remove(slot, section.section_id); }}
          className="shrink-0 rounded px-1 text-muted opacity-0 transition hover:text-danger group-hover:opacity-100" title="Remove">✕</button>
      </div>

      {/* schedule, always visible */}
      <div className="mt-1 flex items-center gap-1.5">
        <span className="text-[11px] font-medium text-txt/90">🕑 {sched?.compact ?? section.time ?? "schedule TBD"}</span>
        {conflict && <IconDot symbol="!" tone="danger" title="Scheduling conflict with another course this quarter" onClick={stop} />}
        {hasPrereqs && (
          <IconDot
            symbol="P"
            tone={missing.length ? "danger" : "warn"}
            title={missing.length ? `Missing prerequisite(s): ${missing.map((g) => g.join(" or ")).join("; ")}` : "Has prerequisites — click for details"}
            onClick={(e) => { stop(e); onOpenPrereq(section.course_number); }}
          />
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {flag && <Badge tone="gold">★ Flagship</Badge>}
        {app && <Badge tone="blue">by application</Badge>}
      </div>

      {!app && unavailable && (
        <div className="mt-1.5 flex items-center justify-between border-t border-line pt-1.5" onClick={stop}>
          <span className="text-[10px] text-muted">Round-1 cost</span>
          <span className="flex items-center gap-1 font-semibold text-danger">
            Unavailable
            <IconDot symbol="!" tone="danger"
              title={`Closed (CLO) in round 1 with no clearing price — a ${slot.startsWith("Y1") ? "first-year / new" : "second-year"} student couldn't bid this. True cost unknown.`}
              onClick={stop} />
          </span>
        </div>
      )}
      {!app && !unavailable && (
        <div className="mt-1.5 space-y-1 border-t border-line pt-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted">Est. cost</span>
            <span className="font-semibold tabular-nums text-gold">{price.toLocaleString()} pts</span>
          </div>
          <div className="flex items-center justify-between gap-1" onClick={stop}>
            <span className="text-[10px] text-muted">Your bid</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={bid ?? ""}
                placeholder={String(price)}
                onChange={(e) => setBid(slot, section.section_id, e.target.value === "" ? null : Number(e.target.value))}
                className="w-20 rounded border border-line bg-surface px-1.5 py-0.5 text-right text-[11px] tabular-nums text-txt"
              />
              {bidLow && <IconDot symbol="↓" tone="warn" title={`Bid below estimated cost (${price.toLocaleString()} pts) — likely to lose`} onClick={stop} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PrereqPopup({ course_number, slot, onClose }: { course_number: string; slot: string; onClose: () => void }) {
  const placements = usePlan((s) => s.placements);
  const co = courseByNum.get(course_number);
  if (!co) return null;
  const missing = missingStrictGroups(course_number, slot, placements);
  const missingKeys = new Set(missing.map((g) => g.join("+")));
  const label = (n: string) => {
    const nm = courseByNum.get(n)?.course_name;
    return nm ? `${n} ${titleCase(nm).slice(0, 20)}` : n;
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-start justify-between">
          <h3 className="text-sm font-semibold text-txt">Prerequisites — {titleCase(co.course_name)}</h3>
          <button onClick={onClose} className="text-muted hover:text-txt">✕</button>
        </div>
        <p className="mb-3 text-[11px] text-muted">Strict prereqs must be taken in an <em>earlier</em> quarter. A group joined by “or” needs just one. Unmet groups are red.</p>
        {co.strict_prereq_groups.length > 0 ? (
          <div className="mb-3 space-y-1.5">
            <div className="text-xs font-semibold text-maroon-light">Strict</div>
            {co.strict_prereq_groups.map((g, i) => {
              const unmet = missingKeys.has(g.join("+"));
              return (
                <div key={i} className={`rounded-lg px-2 py-1.5 text-[11px] ring-1 ring-inset ${unmet ? "bg-danger/15 text-danger ring-danger/40" : "bg-good/10 text-good ring-good/30"}`}>
                  {unmet ? "✗ " : "✓ "}
                  {g.map(label).join("  or  ")}
                </div>
              );
            })}
          </div>
        ) : <p className="text-xs text-muted">No strict prerequisites.</p>}
        {co.recommended_prereqs.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-semibold text-muted">Recommended</div>
            <div className="flex flex-wrap gap-1">
              {co.recommended_prereqs.map((n) => (
                <span key={n} className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] text-muted ring-1 ring-inset ring-line">{n}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
