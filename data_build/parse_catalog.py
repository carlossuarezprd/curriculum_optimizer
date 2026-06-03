"""Parse course_detail.pdf into a structured list of courses + sections.

The PDF's hyperlink "headers" (TITLE (NNNNN[, 50 UNIT COURSE]) - PROF>>) are
internally consistent (title<->number<->units correct) but their reading-order
position is SHIFTED relative to the body text they describe. So we parse in two
independent passes and merge by course_number:

  Pass A (headers): course_number -> {name, units, professors[]}
  Pass B (content): split the doc on CONTENT headings; each unit's SCHEDULE
      carries `Section: NNNNN-XX` codes whose 5-digit prefix is the authoritative
      course number for that unit (verified: no unit's sections span >1 number).
      From each unit we take the description, prerequisite text, and sections.

Course-level fields (name/units/description) follow CLAUDE.md: taken from the
first block/unit seen for a course.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import fitz  # PyMuPDF

CATALOG_PDF = "course_detail.pdf"
PAGE_HEADER = "COURSE DETAIL (COURSE DESCRIPTION BY FACULTY)"
SUBHEADINGS = ["CONTENT", "PREREQUISITES", "MATERIALS", "GRADES",
               "RESTRICTIONS", "SCHEDULE", "SYLLABUS"]

# Header hyperlink token (DOTALL: prof name / 50-UNIT tag may wrap a newline).
HEADER_TOKEN = re.compile(
    r"\(\s*(?P<num>\d{5})\s*(?P<fifty>,\s*50\s+UNIT\s+COURSE)?\s*\)\s*-\s*(?P<prof>[^(>]*?)>>",
    re.DOTALL,
)
TERM_RE = re.compile(r"\b(Autumn|Winter|Spring|Summer)\s+(\d{4})\b")
SECTION_RE = re.compile(r"Section:\s*(\d{5})-(\w+)")

# Leading junk that can share a line with a title in the extracted text.
_LEADING_JUNK = re.compile(
    r"^(?:\s*(?:CONTENT|PREREQUISITES|MATERIALS|GRADES|RESTRICTIONS|SCHEDULE|SYLLABUS"
    r"|In-Person Only|Remote|Hybrid|[A-Z]\d{2}|\d{3}"
    r"|[MTWFSU]{1,6}\s+\d{1,2}:\d{2}\s*[AP]M[^A-Za-z]*?)\s*)+",
)


@dataclass
class Section:
    course_number: str
    section_code: str
    quarter: str | None
    year: int | None
    time: str | None
    location: str | None
    fmt: str | None


@dataclass
class Course:
    course_number: str
    course_name: str = ""
    units: int = 100
    professors: list = field(default_factory=list)
    description: str = ""
    prereq_text: str = ""
    sections: list = field(default_factory=list)
    flags: list = field(default_factory=list)


def load_text(pdf_path: str = CATALOG_PDF) -> str:
    doc = fitz.open(pdf_path)
    txt = "\n".join(p.get_text() for p in doc)
    return txt.replace(PAGE_HEADER, "")


# ---------- Pass A: headers -> names / units / professors ----------

def parse_headers(txt: str) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for m in HEADER_TOKEN.finditer(txt):
        num = m.group("num")
        units = 50 if m.group("fifty") else 100
        prof = re.sub(r"\s+", " ", m.group("prof")).strip().rstrip(",").strip()
        # Title = the trailing run of ALL-CAPS lines immediately before '('.
        paren = txt.rfind("(", 0, m.start() + 1)
        window = txt[max(0, paren - 300):paren]
        title = _clean_title(window)
        rec = out.setdefault(num, {"name": "", "units": units, "professors": []})
        if units == 50:
            rec["units"] = 50
        if title and len(title) > len(rec["name"]):
            rec["name"] = title
        if prof and prof not in rec["professors"] and not prof.isspace():
            rec["professors"].append(prof)
    return out


_TITLE_LINE = re.compile(r"^[A-Z0-9][A-Z0-9 &,\-.'/:()’]*$")
_NOT_TITLE = re.compile(r"\d:\d|\b[AP]M\b|Section:|^\d{1,4}$|^[A-Z]\d{2,3}$")
_SUBHEAD_ONLY = set(SUBHEADINGS) | {"In-Person Only", "Remote", "Hybrid",
                                   "No auditors", "Harper Center", "Gleacher Center"}


def _is_title_line(ln: str) -> bool:
    if not ln or ln in _SUBHEAD_ONLY:
        return False
    if TERM_RE.search(ln) or _NOT_TITLE.search(ln):
        return False
    return bool(_TITLE_LINE.match(ln))


def _clean_title(window: str) -> str:
    """Assemble a wrapped ALL-CAPS title from the trailing lines of `window`."""
    lines = [ln.strip() for ln in window.split("\n")]
    parts: list[str] = []
    for ln in reversed(lines):
        if not ln:
            if parts:
                break
            continue
        if _is_title_line(ln):
            parts.append(ln)
            if len(parts) >= 3:
                break
        else:
            break
    title = " ".join(reversed(parts))
    return re.sub(r"\s{2,}", " ", title).strip()


# ---------- Pass B: CONTENT units -> description / prereqs / sections ----------

def parse_content_units(txt: str) -> dict[str, Course]:
    courses: dict[str, Course] = {}
    units = re.split(r"\nCONTENT\n", txt)
    for unit in units[1:]:
        secs = list(SECTION_RE.finditer(unit))
        if not secs:
            continue  # description-only unit; handled via headers fallback
        num = secs[0].group(1)
        # description = text before the first sub-heading
        desc = _section_before_heading(unit, ("PREREQUISITES", "MATERIALS",
                                              "GRADES", "RESTRICTIONS", "SCHEDULE"))
        pq = _between(unit, "PREREQUISITES",
                      ("MATERIALS", "GRADES", "RESTRICTIONS", "SCHEDULE", "SYLLABUS"))
        c = courses.get(num)
        if c is None:
            c = Course(course_number=num)
            courses[num] = c
            c.description = desc.strip()
            c.prereq_text = pq.strip()
        sched_start = unit.find("SCHEDULE")
        # A section is identified by (code, quarter, year): the SAME section code
        # is reused across quarters (e.g. 43120-01 runs Autumn AND Winter), so we
        # must NOT dedup on code alone.
        seen = {(s.section_code, s.quarter, s.year) for s in c.sections}
        for s in _parse_sections(unit[sched_start:] if sched_start >= 0 else unit):
            key = (s.section_code, s.quarter, s.year)
            if key not in seen:
                c.sections.append(s)
                seen.add(key)
    return courses


def _section_before_heading(unit: str, headings: tuple) -> str:
    idx = len(unit)
    for h in headings:
        p = unit.find("\n" + h)
        if 0 <= p < idx:
            idx = p
    return unit[:idx]


def _between(unit: str, start: str, ends: tuple) -> str:
    s = unit.find("\n" + start + "\n")
    if s < 0:
        s = unit.find("\n" + start)
        if s < 0:
            return ""
    s += len("\n" + start)
    rest = unit[s:]
    idx = len(rest)
    for h in ends:
        p = rest.find("\n" + h)
        if 0 <= p < idx:
            idx = p
    return rest[:idx]


def _parse_sections(schedule_text: str) -> list[Section]:
    sections: list[Section] = []
    lines = [ln.strip() for ln in schedule_text.split("\n")]
    cur = (None, None)
    i = 0
    while i < len(lines):
        ln = lines[i]
        tm = TERM_RE.search(ln)
        if tm and "Section:" not in ln:
            cur = (tm.group(1), int(tm.group(2)))
            i += 1
            continue
        sm = SECTION_RE.search(ln)
        if sm:
            detail = []
            j = i + 1
            while j < len(lines) and len(detail) < 4:
                nxt = lines[j]
                if not nxt:
                    j += 1
                    continue
                # stop at the next section, the next term, or a course header
                if SECTION_RE.search(nxt) or (TERM_RE.search(nxt) and "Section:" not in nxt):
                    break
                if ">>" in nxt or re.search(r"\(\d{5}\)", nxt):
                    break
                detail.append(nxt)
                j += 1
            # accept the first detail line as time only if it looks like a schedule
            time = detail[0] if detail else None
            if time and not re.search(r"\d{1,2}:\d{2}|\b\d{2}/\d{2}\b", time):
                time = None
            sections.append(Section(
                course_number=sm.group(1),
                section_code=f"{sm.group(1)}-{sm.group(2)}",
                quarter=cur[0], year=cur[1],
                time=time,
                location=detail[1] if len(detail) > 1 else None,
                fmt=detail[-1] if len(detail) > 2 else None,
            ))
            i = j
            continue
        i += 1
    return sections


# ---------- Merge ----------

def parse_catalog(pdf_path: str = CATALOG_PDF) -> dict[str, Course]:
    txt = load_text(pdf_path)
    headers = parse_headers(txt)
    courses = parse_content_units(txt)

    for num, h in headers.items():
        c = courses.get(num)
        if c is None:
            c = Course(course_number=num)
            courses[num] = c
            c.flags.append("description-only: no scheduled section parsed")
        c.course_name = h["name"]
        c.units = h["units"]
        c.professors = h["professors"]

    for num, c in courses.items():
        if not c.course_name:
            c.flags.append("no name from header")
        if not c.description:
            c.flags.append("no description")
    return courses


def summary(courses: dict[str, Course]) -> dict:
    byterm: dict[str, int] = {}
    nsec = 0
    for c in courses.values():
        for s in c.sections:
            nsec += 1
            k = f"{s.quarter} {s.year}"
            byterm[k] = byterm.get(k, 0) + 1
    return {
        "courses": len(courses),
        "sections": nsec,
        "fifty_unit_courses": sorted(n for n, c in courses.items() if c.units == 50),
        "sections_by_term": dict(sorted(byterm.items())),
        "description_only": sorted(n for n, c in courses.items() if not c.sections),
        "missing_name": sorted(n for n, c in courses.items() if not c.course_name),
        "missing_desc": sorted(n for n, c in courses.items() if not c.description),
    }


if __name__ == "__main__":
    import json
    courses = parse_catalog()
    print(json.dumps(summary(courses), indent=2))
    print("\n=== samples ===")
    for num in ["30000", "42121", "34106", "41000", "35200", "30840"]:
        c = courses.get(num)
        if not c:
            print(num, "MISSING"); continue
        print(f"\n{num}  {c.course_name}  [{c.units}u]  profs={c.professors[:3]} sections={len(c.sections)}")
        print("  desc:", (c.description[:100] + "...") if c.description else "(NONE)")
        print("  prereq:", repr(c.prereq_text[:90]) if c.prereq_text else "(none)")
        if c.sections:
            s = c.sections[0]
            print("  sec0:", s.section_code, s.quarter, s.year, "|", s.time)
