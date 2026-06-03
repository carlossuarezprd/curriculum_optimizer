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
RECOMMEND_RE = re.compile(r"recommend|would benefit|helpful|familiar|background|"
                          r"exposure|suggested|prior knowledge", re.I)
STRICT_RE = re.compile(r"\bstrict\b|\(strict\)|is required|are required|"
                       r"must have (?:taken|completed)|prerequisite is", re.I)
NOTCONC_RE = re.compile(r"cannot enroll.*?if.*?taken previously", re.I)


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", s.lower())


# ---------- prerequisite classification ----------

def classify_prereqs(text: str) -> dict:
    """Split a prereq blob into strict / recommended / not-concurrent course
    numbers + raw text, per prereq_explanation. Heuristic; low-confidence cases
    are flagged by the caller when nothing is classified but numbers exist."""
    out = {"strict": [], "recommended": [], "not_concurrent": [], "raw": text.strip()}
    if not text or re.match(r"\s*none\b", text, re.I) and not re.search(r"\d{5}", text):
        return out
    sentences = re.split(r"(?<=[.;])\s+|\n", text)
    has_strict_word = bool(re.search(r"\bstrict\b", text, re.I))
    for s in sentences:
        nums = _expand_numbers(s)
        if not nums:
            continue
        if NOTCONC_RE.search(s):
            out["not_concurrent"].extend(nums)
        elif STRICT_RE.search(s):
            out["strict"].extend(nums)
        elif RECOMMEND_RE.search(s):
            out["recommended"].extend(nums)
        elif has_strict_word:
            # course listed alongside a strict requirement elsewhere → treat strict
            out["strict"].extend(nums)
        else:
            out["recommended"].extend(nums)  # unnotated → recommended
    for k in ("strict", "recommended", "not_concurrent"):
        out[k] = list(dict.fromkeys(out[k]))  # dedup, keep order
    # a course can't be both strict and recommended; strict wins
    out["recommended"] = [n for n in out["recommended"] if n not in out["strict"]]
    return out


def _expand_numbers(s: str) -> list[str]:
    nums: list[str] = []
    for m in re.finditer(r"\b(\d{5})\b", s):
        nums.append(m.group(1))
    return nums


# ---------- core area / concentration membership ----------

def build():
    OUT.mkdir(exist_ok=True)
    courses = parse_catalog()
    bids = parse_bids()
    areas = parse_requirements()
    concs = parse_concentrations()

    report: list[str] = ["# Curriculum DB — validation report", ""]

    # bid lookup by section code + by course
    bid_by_code = {b.section_code: b for b in bids}
    bid_courses = {b.course_number for b in bids}
    bid_instructor = {b.section_code: b.instructor for b in bids}

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
    for num, co in sorted(courses.items()):
        name = co.course_name or bid_title.get(num, "")
        if not co.course_name:
            report.append(f"- name from bid fallback: {num} → {name!r}")
        pq = classify_prereqs(co.prereq_text)
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
            "recommended_prereqs": pq["recommended"],
            "not_concurrent": pq["not_concurrent"],
            "prereq_text": pq["raw"],
            "professors": co.professors,
            "flags": list(co.flags),
        })
        # sections: union of catalog sections, enriched with bid prices/instructor
        seen_codes = set()
        for s in co.sections:
            seen_codes.add(s.section_code)
            b = bid_by_code.get(s.section_code)
            prof = bid_instructor.get(s.section_code) or (co.professors[0] if len(co.professors) == 1 else None)
            section_rows.append(_section_row(num, name, co.units, s.section_code,
                                              s.quarter, s.year, prof, s.time, s.location,
                                              s.fmt, b, app,
                                              section_is_flagship(num, prof),
                                              area_of.get(num, []), conc_of.get(num, []),
                                              pq, bid_matched=b is not None))
        # sections only in bids (catalog missed/truncated) → add with flag
        for b in bids:
            if b.course_number == num and b.section_code not in seen_codes:
                section_rows.append(_section_row(num, name, co.units, b.section_code,
                                                  b.quarter, b.year, b.instructor, b.day_time,
                                                  None, None, b, app,
                                                  section_is_flagship(num, b.instructor),
                                                  area_of.get(num, []), conc_of.get(num, []),
                                                  pq, bid_matched=True,
                                                  extra_flag="bid-only section (not in catalog)"))

    # ---- reconciliation: bid courses/sections missing from catalog ----
    cat_codes = {s["section_code"] for s in section_rows}
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
        f"- Sections with historical price data: {sum(1 for s in section_rows if s['r1_price_returning'] is not None)}",
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


def _section_row(num, name, units, code, quarter, year, prof, time, loc, fmt, b, app,
                 flagship, areas, concs, pq, bid_matched, extra_flag=None):
    flags = []
    if prof is None:
        flags.append("professor unknown")
    if extra_flag:
        flags.append(extra_flag)
    return {
        "section_id": code,
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
        CREATE TABLE section(section_code TEXT PRIMARY KEY, course_number TEXT, quarter TEXT,
            year INT, professor TEXT, time TEXT, location TEXT, format TEXT,
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
        cur.execute("INSERT OR IGNORE INTO section VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                    (s["section_code"], s["course_number"], s["quarter"], s["year"],
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
