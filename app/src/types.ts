export interface Meta {
  units_per_area: number;
  foundations_required: number;
  functions_required: number;
  total_units: number;
  elective_units: number;
  starting_points: number;
  points_per_course_accrual: number;
  min_courses_per_quarter: number;
  max_courses_per_quarter: number;
  min_total_courses: number;
  max_total_courses: number;
}

export interface CoreArea {
  name: string;
  type: "foundation" | "function";
  basic: string[];
  substitutes: string[];
  qualifying: string[];
}

export interface Bucket {
  label: string;
  units_required: number;
  cap: number | null;
  courses: string[];
}

export interface Concentration {
  name: string;
  total_units_required: number;
  buckets: Bucket[];
  qualifying: string[];
  notes: string[];
  special: boolean;
}

export interface Course {
  course_number: string;
  course_name: string;
  units: number;
  description: string;
  core_area: string | null;
  core_areas: string[];
  concentrations: string[];
  independent_application_course: boolean;
  strict_prereqs: string[];
  strict_prereq_groups: string[][];
  recommended_prereqs: string[];
  not_concurrent: string[];
  prereq_text: string;
  professors: string[];
  flags: string[];
}

export interface Section {
  section_id: string;
  course_number: string;
  course_name: string;
  units: number;
  section_code: string;
  quarter: "Autumn" | "Winter" | "Spring" | "Summer" | null;
  year: number | null;
  professor: string | null;
  time: string | null;
  location: string | null;
  format: string | null;
  core_area: string | null;
  concentrations: string[];
  independent_application_course: boolean;
  flagship_course: boolean;
  strict_prereqs: string[];
  recommended_prereqs: string[];
  r1_price_returning: number | null;
  r1_price_new: number | null;
  unavailable_returning: boolean;
  unavailable_new: boolean;
  bid_matched: boolean;
  flags: string[];
}

export interface Bundle {
  meta: Meta;
  core_areas: CoreArea[];
  concentrations: Concentration[];
  flagship_seed: { course_number: string; professor: string; label: string }[];
  courses: Course[];
  sections: Section[];
}

export type Term = "Autumn" | "Winter" | "Spring";
export type Year = 1 | 2;
export const TERMS: Term[] = ["Autumn", "Winter", "Spring"];
export const YEARS: Year[] = [1, 2];

export function slotId(year: Year, term: Term): string {
  return `Y${year}-${term}`;
}
export const SLOT_ORDER: string[] = [
  "Y1-Autumn", "Y1-Winter", "Y1-Spring",
  "Y2-Autumn", "Y2-Winter", "Y2-Spring",
];

// A placed course: a chosen section dropped into a specific quarter slot.
// section_id is the composite (code@quarter+year) key — codes repeat across quarters.
export interface Placement {
  slot: string;
  section_id: string;
  actual_bid: number | null;
}
