"""Assemble the consolidated relational DB from the four parsers.

Outputs (regenerable; the app consumes only these):
  build/curriculum.sqlite   normalized, inspectable canonical artifact
  build/curriculum.json     compiled bundle the front-end loads
  build/validation_report.md  catalog<->bid reconciliation + flagged TODOs

Run:  python -m data_build.build_db   (from repo root)
"""
from __future__ import annotations

import json
import re
import sqlite3
from dataclasses import asdict
from pathlib import Path

from data_build.parse_catalog import parse_catalog
from data_build.parse_bids import parse_bids
from data_build.parse_requirements import (parse_requirements, UNITS_PER_AREA,
                                           FOUNDATIONS_REQUIRED, FUNCTIONS_REQUIRED,
                                           TOTAL_UNITS, ELECTIVE_UNITS)
from data_build.parse_concentrations import parse_concentrations
from data_build.flagship_seed import FLAGSHIP_SEED, APPLICATION_SEED_NAMES

OUT = Path("build")
# A strict prereq is ONLY one explicitly notated as such, per prereq_explanation
# and the catalog grammar:
#   "<clause>: strict"  | "<course> (strict)"  | "<clause> is/are (a) strict ..."
# The notation attaches to the clause on its LEFT. Lists joined by "or"/"one of"
# are OR-groups (any one satisfies). Everything unnotated is recommended.
STRICT_COLON = re.compile(r"([^.;]*?):\s*\(?strict\b", re.I)
STRICT_PAREN = re.compile(r"([^.;]*?)\(strict\)", re.I)
STRICT_PHRASE = re.compile(r"([^.;]*?)\b(?:is|are)\s+(?:an?\s+)?strict\b", re.I)
OR_RE = re.compile(r"\b(?:or|either|one of|at least one)\b", re.I)
NOTCONC_RE = re.compile(r"cannot\s+(?:enroll|take|bid)[^.;]*?(?:taken previously|previously taken|if\b)", re.I)
ALL_RE = re.compile(r"\b(?:all|both)\b.*\bstrict\b", re.I)


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", s.lower())


# ---------- prerequisite classification ----------

def classify_prereqs(text: str, self_num: str | None = None) -> dict:
    """Split a prereq blob into strict OR-groups / recommended / not-concurrent.

    Returns strict_groups: list of OR-groups (each a list of course numbers; the
    requirement is satisfied if ANY member is taken earlier). A plain AND of two
    strict courses is two singleton groups. strict is the flat union (display)."""
    out = {"strict_groups": [], "strict": [], "recommended": [],
           "not_concurrent": [], "raw": (text or "").strip()}
    if not text:
        return out
    flat = re.sub(r"\s+", " ", text).strip()

    def booth_nums(clause: str) -> list[str]:
        nums: list[str] = []
        for m in re.finditer(r"(ECON|LAWS|Econ)?\s*\b(\d{5})\b", clause):
            if m.group(1):
                continue  # non-Booth (ECON/LAWS) — can't be planned, skip gating
            n = m.group(2)
            if n != self_num and n not in nums:
                nums.append(n)
        return nums

    def add_clause(clause: str, paren: bool):
        if NOTCONC_RE.search(clause):
            out["not_concurrent"].extend(booth_nums(clause))
            return
        nums = booth_nums(clause)
        if not nums:
            return  # population/permission restriction, no course
        if OR_RE.search(clause) and not ALL_RE.search(clause):
            out["strict_groups"].append(nums)            # one OR-group
        elif paren and not ALL_RE.search(clause):
            out["strict_groups"].append([nums[-1]])      # nearest course to the left
        else:
            for n in nums:                               # AND → singleton groups
                out["strict_groups"].append([n])

    for m in STRICT_COLON.finditer(flat):
        add_clause(m.group(1), paren=False)
    for m in STRICT_PAREN.finditer(flat):
        add_clause(m.group(1), paren=True)
    for m in STRICT_PHRASE.finditer(flat):
        add_clause(m.group(1), paren=False)

    # anti-requisites anywhere ("cannot enroll ... if X taken previously")
    for sent in re.split(r"(?<=[.;])\s+", flat):
        if NOTCONC_RE.search(sent):
            out["not_concurrent"].extend(booth_nums(sent))

    # dedup groups
    seen = set()
    groups = []
    for g in out["strict_groups"]:
        key = tuple(sorted(g))
        if g and key not in seen:
            seen.add(key)
            groups.append(g)
    out["strict_groups"] = groups
    strict_union = sorted({n for g in groups for n in g})
    out["strict"] = strict_union
    out["not_concurrent"] = sorted(set(out["not_concurrent"]))

    # everything else mentioned (and not strict/anti-req) → recommended
    strict_set = set(strict_union)
    nc_set = set(out["not_concurrent"])
    rec = [n for n in booth_nums(flat) if n not in strict_set and n not in nc_set]
    out["recommended"] = list(dict.fromkeys(rec))
    return out


# ---------- core area / concentration membership ----------

def build():
    OUT.mkdir(exist_ok=True)
    courses = parse_catalog()
    bids = parse_bids()
    areas = parse_requirements()
    concs = parse_concentrations()

    report: list[str] = ["# Curriculum DB — validation report", ""]

    # A section is keyed by (code, quarter): the same code recurs across quarters.
    bid_by_key = {(b.section_code, b.quarter): b for b in bids}
    bid_courses = {b.course_number for b in bids}

    # name fallback from bids
    bid_title = {}
    for b in bids:
        bid_title.setdefault(b.course_number, b.title)

    # ---- core area membership: course_number -> [area names] ----
    area_of: dict[str, list[str]] = {}
    for a in areas:
        for num in a.qualifying:
            area_of.setdefault(num, []).append(a.name)

    # ---- concentration membership ----
    conc_of: dict[str, list[str]] = {}
    for c in concs:
        for num in c.qualifying:
            conc_of.setdefault(num, []).append(c.name)

    # ---- application-based detection ----
    def is_application(co) -> bool:
        blob = f"{co.course_name} {co.description} {co.prereq_text}".lower()
        if any(re.search(p, co.course_name, re.I) for p in APPLICATION_SEED_NAMES):
            return True
        return bool(re.search(r"by application|application is required|"
                              r"submit an application|application process|"
                              r"admission by application", blob))

    # ---- flagship resolution: (course_number, prof_lastname|ANY, label) ----
    flagship_pairs = []
    for pat, prof, label in FLAGSHIP_SEED:
        matched = [n for n, co in courses.items()
                   if re.search(pat, co.course_name, re.I)]
        if not matched:
            report.append(f"- ⚠️ flagship unresolved: `{label}` (no catalog name match for /{pat}/)")
            continue
        for n in matched:
            flagship_pairs.append({"course_number": n, "professor": prof, "label": label})

    def section_is_flagship(course_number, professor) -> bool:
        for fp in flagship_pairs:
            if fp["course_number"] != course_number:
                continue
            if fp["professor"] == "ANY":
                return True
            if professor and fp["professor"].lower() in professor.lower():
                return True
        return False

    # ---- assemble courses + sections ----
    course_rows = []
    section_rows = []
    prereq_low_conf = []
    matched_bid_keys: set = set()   # (code, quarter) keys consumed
    bid_only_added: list = []       # bid sections not present in the catalog
    for num, co in sorted(courses.items()):
        name = co.course_name or bid_title.get(num, "")
        if not co.course_name:
            report.append(f"- name from bid fallback: {num} → {name!r}")
        pq = classify_prereqs(co.prereq_text, num)
        if co.prereq_text and not (pq["strict"] or pq["recommended"] or pq["not_concurrent"]) \
                and re.search(r"\d{5}", co.prereq_text):
            prereq_low_conf.append(num)
        app = is_application(co)
        course_rows.append({
            "course_number": num,
            "course_name": name,
            "units": co.units,
            "description": co.description,
            "core_area": (area_of.get(num) or [None])[0],
            "core_areas": area_of.get(num, []),
            "concentrations": conc_of.get(num, []),
            "independent_application_course": app,
            "strict_prereqs": pq["strict"],
            "strict_prereq_groups": pq["strict_groups"],
            "recommended_prereqs": pq["recommended"],
            "not_concurrent": pq["not_concurrent"],
            "prereq_text": pq["raw"],
            "professors": co.professors,
            "flags": list(co.flags),
        })
        # sections: union of catalog sections, enriched with bid prices/instructor.
        # Key on (code, quarter) so the same code in different quarters is distinct.
        for s in co.sections:
            key = (s.section_code, s.quarter)
            b = bid_by_key.get(key)
            matched_bid_keys.add(key)
            prof = (b.instructor if b else None) or (co.professors[0] if len(co.professors) == 1 else None)
            section_rows.append(_section_row(num, name, co.units, _sid(s.section_code, s.quarter, s.year),
                                              s.section_code, s.quarter, s.year, prof, s.time, s.location,
                                              s.fmt, b, app,
                                              section_is_flagship(num, prof),
                                              area_of.get(num, []), conc_of.get(num, []),
                                              pq, bid_matched=b is not None))
        # sections present in the bids but NOT in the catalog → add them (they exist)
        for b in bids:
            key = (b.section_code, b.quarter)
            if b.course_number == num and key not in matched_bid_keys:
                matched_bid_keys.add(key)
                bid_only_added.append(f"{b.section_code} {b.quarter}")
                section_rows.append(_section_row(num, name, co.units, _sid(b.section_code, b.quarter, b.year),
                                                  b.section_code, b.quarter, b.year, b.instructor, b.day_time,
                                                  None, None, b, app,
                                                  section_is_flagship(num, b.instructor),
                                                  area_of.get(num, []), conc_of.get(num, []),
                                                  pq, bid_matched=True,
                                                  extra_flag="bid-only section (not in catalog PDF)"))

    # ---- reconciliation: every bid section must be captured ----
    all_bid_keys = {(b.section_code, b.quarter) for b in bids}
    section_keys = {(s["section_code"], s["quarter"]) for s in section_rows}
    bid_not_captured = sorted(f"{c} {q}" for (c, q) in all_bid_keys - section_keys)
    missing_courses = sorted(bid_courses - set(courses.keys()))
    app_courses = [c["course_number"] for c in course_rows if c["independent_application_course"]]

    report += [
        "", "## Summary", "",
        f"- Courses: **{len(course_rows)}**  |  Sections: **{len(section_rows)}**",
        f"- Core areas: {len(areas)} ({FOUNDATIONS_REQUIRED} foundations + {FUNCTIONS_REQUIRED+1} functions, {FUNCTIONS_REQUIRED} required)",
        f"- Concentrations: {len(concs)} (derived from source)",
        f"- Flagship (course,professor) pairs resolved: {len(flagship_pairs)}",
        f"- Application-based courses: {len(app_courses)} → {app_courses}",
        f"- 50-unit courses: {sorted(n for n,co in courses.items() if co.units==50)}",
        "", "## Catalog ↔ bid reconciliation", "",
        f"- Bid courses not found in catalog: {missing_courses or 'none'}",
        f"- Distinct bid sections (code+quarter): {len(all_bid_keys)}",
        f"- **Bid sections NOT captured in the DB: {bid_not_captured or 'none — every bid section is present ✓'}**",
        f"- Bid-only sections added (in bids but absent from the catalog PDF): {bid_only_added or 'none'}",
        f"- Catalog sections matched to a bid price: {sum(1 for s in section_rows if s['bid_matched'])}",
        f"- Sections with a numeric clearing price: {sum(1 for s in section_rows if s['r1_price_returning'] is not None)}",
        "", "## Flagged TODOs", "",
        f"- Prereq text has course numbers but none classified (low confidence): {prereq_low_conf or 'none'}",
        "", "## Known source discrepancies (surfaced, not patched)", "",
        "- CLAUDE.md states Winter/Spring new-student price equals Phase 1 Price. "
        "The separate `New Students Price` column actually differs in ~60% of rows; "
        "we follow the brief's rule (new = Phase 1 Price in Winter/Spring).",
        "- General Management is defined by reference (all 8 function lines + 300 units) "
        "→ no flat qualifying list; flagged special.",
        "- Basic-vs-substitute split within a core area is best-effort (PDF column wrap); "
        "the qualifying union (what feasibility uses) is exact.",
        "- Strict prereqs listed as alternatives (e.g. '41000 or 41100') are stored as "
        "separate strict entries; the missing-prereq check should treat known "
        "equivalents as a satisfied-if-any group (to wire when building §5 in the app).",
    ]

    # ---- write artifacts ----
    bundle = {
        "meta": {
            "units_per_area": UNITS_PER_AREA,
            "foundations_required": FOUNDATIONS_REQUIRED,
            "functions_required": FUNCTIONS_REQUIRED,
            "total_units": TOTAL_UNITS,
            "elective_units": ELECTIVE_UNITS,
            "starting_points": 8000,
            "points_per_course_accrual": 2000,
            "min_courses_per_quarter": 2,
            "max_courses_per_quarter": 5,
            "min_total_courses": 20,
            "max_total_courses": 22,
        },
        "core_areas": [asdict(a) for a in areas],
        "concentrations": [_conc_dict(c) for c in concs],
        "flagship_seed": flagship_pairs,
        "courses": course_rows,
        "sections": section_rows,
    }
    (OUT / "curriculum.json").write_text(json.dumps(bundle, indent=2))
    write_sqlite(OUT / "curriculum.sqlite", areas, concs, course_rows, section_rows, flagship_pairs)
    (OUT / "validation_report.md").write_text("\n".join(report))
    print(f"wrote {OUT/'curriculum.json'}, {OUT/'curriculum.sqlite'}, {OUT/'validation_report.md'}")
    print(f"courses={len(course_rows)} sections={len(section_rows)} "
          f"concentrations={len(concs)} flagship_pairs={len(flagship_pairs)} "
          f"application={len(app_courses)}")
    return bundle


def _sid(code: str, quarter, year) -> str:
    """Unique section id: code is reused across quarters, so qualify it."""
    return f"{code}@{quarter or '?'}{year or ''}"


def _section_row(num, name, units, section_id, code, quarter, year, prof, time, loc, fmt, b, app,
                 flagship, areas, concs, pq, bid_matched, extra_flag=None):
    flags = []
    if prof is None:
        flags.append("professor unknown")
    if extra_flag:
        flags.append(extra_flag)
    return {
        "section_id": section_id,
        "course_number": num,
        "course_name": name,
        "units": units,
        "section_code": code,
        "quarter": quarter,
        "year": year,
        "professor": prof,
        "time": time,
        "location": loc,
        "format": fmt,
        "core_area": (areas or [None])[0],
        "concentrations": concs,
        "independent_application_course": app,
        "flagship_course": flagship,
        "strict_prereqs": pq["strict"],
        "recommended_prereqs": pq["recommended"],
        "r1_price_returning": b.r1_price_returning if b else None,
        "r1_price_new": b.r1_price_new if b else None,
        "bid_matched": bid_matched,
        "flags": flags,
    }


def _conc_dict(c):
    return {
        "name": c.name,
        "total_units_required": c.total_units_required,
        "buckets": [asdict(b) for b in c.buckets],
        "qualifying": c.qualifying,
        "notes": c.notes,
        "special": c.special,
    }


def write_sqlite(path, areas, concs, course_rows, section_rows, flagship_pairs):
    if path.exists():
        path.unlink()
    db = sqlite3.connect(path)
    cur = db.cursor()
    cur.executescript("""
        CREATE TABLE course(course_number TEXT PRIMARY KEY, course_name TEXT, units INT,
            description TEXT, core_area TEXT, independent_application_course INT,
            prereq_text TEXT);
        CREATE TABLE section(section_id TEXT PRIMARY KEY, section_code TEXT, course_number TEXT,
            quarter TEXT, year INT, professor TEXT, time TEXT, location TEXT, format TEXT,
            flagship_course INT, r1_price_new INT, r1_price_returning INT, bid_matched INT);
        CREATE TABLE prereq(course_number TEXT, kind TEXT, prereq_course_number TEXT);
        CREATE TABLE core_area(name TEXT, type TEXT);
        CREATE TABLE core_area_course(area TEXT, course_number TEXT, role TEXT);
        CREATE TABLE concentration(name TEXT PRIMARY KEY, total_units_required INT, special INT);
        CREATE TABLE concentration_bucket(concentration TEXT, label TEXT, units_required INT, cap INT);
        CREATE TABLE concentration_course(concentration TEXT, course_number TEXT);
        CREATE TABLE flagship_seed(course_number TEXT, professor TEXT, label TEXT);
    """)
    for c in course_rows:
        cur.execute("INSERT INTO course VALUES(?,?,?,?,?,?,?)",
                    (c["course_number"], c["course_name"], c["units"], c["description"],
                     c["core_area"], int(c["independent_application_course"]), c["prereq_text"]))
        for kind in ("strict_prereqs", "recommended_prereqs", "not_concurrent"):
            for p in c[kind]:
                cur.execute("INSERT INTO prereq VALUES(?,?,?)",
                            (c["course_number"], kind.replace("_prereqs", ""), p))
    for s in section_rows:
        cur.execute("INSERT OR IGNORE INTO section VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (s["section_id"], s["section_code"], s["course_number"], s["quarter"], s["year"],
                     s["professor"], s["time"], s["location"], s["format"],
                     int(s["flagship_course"]), s["r1_price_new"], s["r1_price_returning"],
                     int(s["bid_matched"])))
    for a in areas:
        cur.execute("INSERT INTO core_area VALUES(?,?)", (a.name, a.type))
        for n in a.basic:
            cur.execute("INSERT INTO core_area_course VALUES(?,?,?)", (a.name, n, "basic"))
        for n in a.substitutes:
            cur.execute("INSERT INTO core_area_course VALUES(?,?,?)", (a.name, n, "substitute"))
    for c in concs:
        cur.execute("INSERT INTO concentration VALUES(?,?,?)",
                    (c.name, c.total_units_required, int(c.special)))
        for b in c.buckets:
            cur.execute("INSERT INTO concentration_bucket VALUES(?,?,?,?)",
                        (c.name, b.label, b.units_required, b.cap))
        for n in c.qualifying:
            cur.execute("INSERT INTO concentration_course VALUES(?,?)", (c.name, n))
    for fp in flagship_pairs:
        cur.execute("INSERT INTO flagship_seed VALUES(?,?,?)",
                    (fp["course_number"], fp["professor"], fp["label"]))
    db.commit()
    db.close()


if __name__ == "__main__":
    build()
