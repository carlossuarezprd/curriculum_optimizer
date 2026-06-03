import { create } from "zustand";
import { persist } from "zustand/middleware";
import bundleJson from "./data/curriculum.json";
import {
  Bundle, Course, Section, Placement, Term, Year, slotId, SLOT_ORDER,
} from "./types";

export const bundle = bundleJson as unknown as Bundle;

// indices
export const courseByNum = new Map<string, Course>(
  bundle.courses.map((c) => [c.course_number, c]),
);
export const sectionById = new Map<string, Section>(
  bundle.sections.map((s) => [s.section_id, s]),
);
export const sectionsByCourse = new Map<string, Section[]>();
for (const s of bundle.sections) {
  const arr = sectionsByCourse.get(s.course_number) ?? [];
  arr.push(s);
  sectionsByCourse.set(s.course_number, arr);
}
export function flagshipKey(course_number: string, professor: string | null): string {
  return `${course_number}|${professor ?? ""}`;
}
// (course, professor) pairs that are flagship by the seeded default.
export const seedFlagshipKeys = new Set<string>(
  bundle.sections.filter((s) => s.flagship_course).map((s) => flagshipKey(s.course_number, s.professor)),
);
// terms a course is offered in (Autumn/Winter/Spring), ignoring Summer
export function offeredTerms(course_number: string): Set<string> {
  const t = new Set<string>();
  for (const s of sectionsByCourse.get(course_number) ?? []) {
    if (s.quarter && s.quarter !== "Summer") t.add(s.quarter);
  }
  return t;
}

interface PlanState {
  placements: Placement[];
  flagship: Record<string, boolean>;   // overrides on top of the seed
  notice: string | null;
  addSection: (year: Year, term: Term, section_id: string) => void;
  removeSection: (slot: string, section_id: string) => void;
  setBid: (slot: string, section_id: string, bid: number | null) => void;
  movePlacement: (fromSlot: string, sectionId: string, toSlot: string, newSectionId: string) => void;
  toggleFlagship: (course_number: string, professor: string | null) => void;
  setNotice: (msg: string | null) => void;
  clearAll: () => void;
}

export const usePlan = create<PlanState>()(
  persist(
    (set) => ({
      placements: [],
      flagship: {},
      notice: null,
      addSection: (year, term, section_id) =>
        set((st) => {
          const slot = slotId(year, term);
          if (st.placements.some((p) => p.slot === slot && p.section_id === section_id))
            return st;
          return { placements: [...st.placements, { slot, section_id, actual_bid: null }] };
        }),
      removeSection: (slot, section_id) =>
        set((st) => ({
          placements: st.placements.filter(
            (p) => !(p.slot === slot && p.section_id === section_id),
          ),
        })),
      setBid: (slot, section_id, bid) =>
        set((st) => ({
          placements: st.placements.map((p) =>
            p.slot === slot && p.section_id === section_id ? { ...p, actual_bid: bid } : p,
          ),
        })),
      movePlacement: (fromSlot, sectionId, toSlot, newSectionId) =>
        set((st) => {
          const p = st.placements.find((x) => x.slot === fromSlot && x.section_id === sectionId);
          const bid = p?.actual_bid ?? null;
          const rest = st.placements.filter((x) => !(x.slot === fromSlot && x.section_id === sectionId));
          if (rest.some((x) => x.slot === toSlot && x.section_id === newSectionId)) {
            return { placements: rest };
          }
          return { placements: [...rest, { slot: toSlot, section_id: newSectionId, actual_bid: bid }] };
        }),
      toggleFlagship: (course_number, professor) =>
        set((st) => {
          const key = flagshipKey(course_number, professor);
          const current = key in st.flagship ? st.flagship[key] : seedFlagshipKeys.has(key);
          return { flagship: { ...st.flagship, [key]: !current } };
        }),
      setNotice: (msg) => set({ notice: msg }),
      clearAll: () => set({ placements: [] }),
    }),
    { name: "booth-curriculum-plan-v2" },
  ),
);

// ---- flagship helpers (combine seed + user overrides) ----
export function isFlagship(course_number: string, professor: string | null, overrides: Record<string, boolean>): boolean {
  const key = flagshipKey(course_number, professor);
  return key in overrides ? overrides[key] : seedFlagshipKeys.has(key);
}
export function flagshipCourseSet(overrides: Record<string, boolean>): Set<string> {
  const out = new Set<string>();
  for (const s of bundle.sections) {
    if (isFlagship(s.course_number, s.professor, overrides)) out.add(s.course_number);
  }
  return out;
}
// active (course, professor, course_name) flagship pairs for the config panel
export function flagshipPairs(overrides: Record<string, boolean>): { course_number: string; professor: string; course_name: string }[] {
  const seen = new Set<string>();
  const out: { course_number: string; professor: string; course_name: string }[] = [];
  for (const s of bundle.sections) {
    const key = flagshipKey(s.course_number, s.professor);
    if (seen.has(key)) continue;
    seen.add(key);
    if (isFlagship(s.course_number, s.professor, overrides)) {
      out.push({ course_number: s.course_number, professor: s.professor ?? "—", course_name: s.course_name });
    }
  }
  return out.sort((a, b) => a.course_name.localeCompare(b.course_name));
}

// strict-prereq OR-groups not satisfied by an earlier quarter in the plan.
// A group is satisfied if ANY of its alternative courses is taken earlier.
export function missingStrictGroups(course_number: string, slot: string, placements: Placement[]): string[][] {
  const co = courseByNum.get(course_number);
  if (!co || !co.strict_prereq_groups?.length) return [];
  const slotIdx = SLOT_ORDER.indexOf(slot);
  const earlier = new Set<string>();
  for (const p of placements) {
    if (SLOT_ORDER.indexOf(p.slot) < slotIdx) {
      const sec = sectionById.get(p.section_id);
      if (sec) earlier.add(sec.course_number);
    }
  }
  return co.strict_prereq_groups.filter((g) => !g.some((n) => earlier.has(n)));
}

// ---------- derived helpers (pure) ----------

export function placementsBySlot(placements: Placement[]): Map<string, Placement[]> {
  const m = new Map<string, Placement[]>();
  for (const slot of SLOT_ORDER) m.set(slot, []);
  for (const p of placements) {
    const arr = m.get(p.slot) ?? [];
    arr.push(p);
    m.set(p.slot, arr);
  }
  return m;
}

// Price a section pays in a given slot, per CLAUDE.md bidding rules.
export function priceFor(section: Section, slot: string): number | null {
  if (section.independent_application_course) return 0; // not bid on
  const isAutumnY1 = slot === "Y1-Autumn";
  if (isAutumnY1) return section.r1_price_new ?? section.r1_price_returning;
  return section.r1_price_returning ?? section.r1_price_new;
}

export interface QuarterBid {
  available: number;
  spent: number;
  remaining: number;
  bidSum: number; // sum of actual bids
  courseCount: number;
}

// Points pool per quarter: start 8000; each course in prior quarter adds 2000.
export function bidByQuarter(
  placements: Placement[],
  meta: Bundle["meta"],
): Map<string, QuarterBid> {
  const bySlot = placementsBySlot(placements);
  const out = new Map<string, QuarterBid>();
  let prevRemaining = meta.starting_points;
  let prevCourses = 0;
  SLOT_ORDER.forEach((slot, i) => {
    const ps = bySlot.get(slot) ?? [];
    const available =
      i === 0
        ? meta.starting_points
        : prevRemaining + meta.points_per_course_accrual * prevCourses;
    let spent = 0;
    let bidSum = 0;
    for (const p of ps) {
      const sec = sectionById.get(p.section_id);
      if (!sec) continue;
      const price = priceFor(sec, slot) ?? 0;
      spent += price;
      bidSum += p.actual_bid ?? 0;
    }
    const remaining = available - spent;
    out.set(slot, { available, spent, remaining, bidSum, courseCount: ps.length });
    prevRemaining = remaining;
    prevCourses = ps.length;
  });
  return out;
}

// Units a student has, mapped to the courses they've placed (dedup by course).
export function placedCourseNumbers(placements: Placement[]): string[] {
  const set = new Set<string>();
  for (const p of placements) {
    const sec = sectionById.get(p.section_id);
    if (sec) set.add(sec.course_number);
  }
  return [...set];
}

export interface ConcProgress {
  name: string;
  required: number;
  earned: number;
  met: boolean;
  special: boolean;
}

export function concentrationProgress(placements: Placement[]): ConcProgress[] {
  const courses = placedCourseNumbers(placements);
  return bundle.concentrations.map((c) => {
    const qualifying = new Set(c.qualifying);
    let earned = 0;
    for (const num of courses) {
      if (qualifying.has(num)) earned += courseByNum.get(num)?.units ?? 100;
    }
    return {
      name: c.name,
      required: c.total_units_required,
      earned,
      met: earned >= c.total_units_required && c.total_units_required > 0,
      special: c.special,
    };
  });
}

export interface AreaCoverage {
  name: string;
  type: "foundation" | "function";
  covered: boolean;
}

export function areaCoverage(placements: Placement[]): AreaCoverage[] {
  const courses = new Set(placedCourseNumbers(placements));
  return bundle.core_areas.map((a) => ({
    name: a.name,
    type: a.type,
    covered: a.qualifying.some((n) => courses.has(n)),
  }));
}
