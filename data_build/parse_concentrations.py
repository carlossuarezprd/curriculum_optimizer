"""Parse concentration_requirements.pdf into structured concentrations.

Concentrations are DERIVED from the source (not hardcoded). We detect each
concentration heading, then per concentration extract:
  - total_units_required
  - buckets: sub-requirements (units_required, optional cap, label, courses)
  - qualifying course numbers (union, for per-course boolean membership)
  - notes / cross-caps / special handling flags

Some concentrations are prose-defined (General Management, Econometrics &
Statistics grade rule, Analytic Finance "must also satisfy Finance"); these are
captured with their threshold + a flag so the app can treat them specially.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

import fitz

CONC_PDF = "concentration_requirements.pdf"

# Lines that are never concentration headings even if Title-Case.
# (Note: "Business" alone is allowed -- two concentrations start with it -- but
#  "Business <number>" is a course list, not a heading.)
_NOT_HEADING_START = re.compile(
    r"^(Business\s+\d|Note|An additional|Complete|Obtain|For|To earn|To complete|Chicago|"
    r"Default|Pre-Autumn|Curriculum|Concentration|Students|At least|Up to|Choose|"
    r"Revised|This|The student|First|second|combination|include|\d|■)")


@dataclass
class Bucket:
    label: str
    units_required: int
    cap: int | None
    courses: list = field(default_factory=list)


@dataclass
class Concentration:
    name: str
    total_units_required: int
    buckets: list = field(default_factory=list)
    qualifying: list = field(default_factory=list)
    notes: list = field(default_factory=list)
    special: bool = False


def _text() -> str:
    txt = "\n".join(p.get_text() for p in fitz.open(CONC_PDF))
    # strip the running footer line
    txt = re.sub(r"\d+/\d+/\d+, \d+:\d+.*?concentration-requirements\s*\d/\d", "", txt, flags=re.S)
    return txt


def _course_numbers(text: str) -> list[str]:
    """Extract qualifying course numbers, expanding '(or NNNNN)' and capturing
    prefixed codes (ECON/LAWS). Skips numbers that are unit thresholds."""
    out: list[str] = []
    # remove 'NNN credit units' / 'NNN units' so thresholds aren't captured
    cleaned = re.sub(r"\b\d{3}\s+(?:credit\s+)?units?\b", " ", text)
    for m in re.finditer(r"\b(ECON|LAWS)\s+(\d{5})\b|\b(\d{5})\b", cleaned):
        val = f"{m.group(1)} {m.group(2)}" if m.group(1) else m.group(3)
        if val not in out:
            out.append(val)
    return out


def _detect_headings(lines: list[str]) -> list[tuple[int, str]]:
    heads: list[tuple[int, str]] = []
    for i, ln in enumerate(lines):
        s = ln.strip()
        if not (3 <= len(s) <= 45) or _NOT_HEADING_START.match(s):
            continue
        if not re.match(r"^[A-Z][A-Za-z]+(?:[\s,&]+[A-Za-z]+)*$", s):
            continue
        # must be followed (within a few lines) by a units requirement.
        # Window is generous: Econometrics opens with GPA bullet rules first.
        look = " ".join(lines[i + 1:i + 10])
        if re.search(r"\bunits?\b", look):
            heads.append((i, s))
    return heads


def parse_concentrations(pdf: str = CONC_PDF) -> list[Concentration]:
    txt = _text()
    lines = txt.split("\n")
    heads = _detect_headings(lines)
    concs: list[Concentration] = []
    for j, (li, name) in enumerate(heads):
        end = heads[j + 1][0] if j + 1 < len(heads) else len(lines)
        body = "\n".join(lines[li + 1:end])
        c = _parse_one(name, body)
        # drop the document title and any non-concentration heading
        if c.total_units_required == 0 and not c.qualifying and not c.buckets:
            continue
        concs.append(c)
    return concs


def _parse_one(name: str, body: str) -> Concentration:
    flat = re.sub(r"\s+", " ", body).strip()
    notes: list[str] = []
    special = False

    markers = list(re.finditer(r"(\d{3,4})\s+(?:credit\s+)?units?\b", flat))
    buckets: list[Bucket] = []
    pending_cap: int | None = None
    for k, m in enumerate(markers):
        seg_end = markers[k + 1].start() if k + 1 < len(markers) else len(flat)
        seg = flat[m.end():seg_end]
        pre = flat[max(0, m.start() - 24):m.start()]
        units = int(m.group(1))
        # Classify the marker from the clause it belongs to. Cross-cap phrasing
        # ("jointly count as N units", "count only N units toward both") sits
        # immediately BEFORE the number; a usage cap is "No more than N units".
        if "No more than" in pre:                      # a cap, not a requirement
            pending_cap = units
            continue
        if re.search(r"jointly count|count only", pre) or "toward both" in seg[:25]:
            notes.append(("…" + flat[max(0, m.start() - 30):m.end() + 20].strip())[:160])
            special = True
            continue
        label_m = re.match(r"\s*(?:in|of)\s+([a-z][a-z \-]+?)\s+(?:from|chosen|credit|of)", seg)
        buckets.append(Bucket(
            label=label_m.group(1).strip() if label_m else "",
            units_required=units,
            cap=None,
            courses=_course_numbers(seg),
        ))
    # attach a trailing cap to the last elective-style bucket
    if pending_cap and buckets:
        buckets[-1].cap = pending_cap

    qualifying = _course_numbers(flat)

    # Additive concentrations (sub-areas summed) vs flat (single headline total).
    additive = bool(re.search(
        r"in (asset pricing|corporate finance|data science|decision models)|"
        r"[Aa]n additional \d+ units", flat))
    if re.search(r"all eight lines|total of \d+ credit units", flat):  # General Management
        special = True
        tot = re.search(r"total of (\d+) credit units", flat)
        total = int(tot.group(1)) if tot else 0
    elif additive:
        total = sum(b.units_required for b in buckets)
    elif buckets:
        total = buckets[0].units_required
        # "Business NNNNN ... and at least NNN units": base course + electives.
        base = re.match(r"Business (\d{5})(?:\s*\(or (\d{5})\))? and at least", flat)
        if base:
            total += 100
            special = True
            notes.append(f"requires base course {base.group(1)} plus {buckets[0].units_required} elective units")
    else:
        total = 0

    for trig, msg in (("must also satisfy", "must also satisfy the Finance requirements"),
                      ("cumulative GPA", "quality-grade / GPA rule applies")):
        if trig in flat:
            special = True
            notes.append(msg)
    return Concentration(name, total, buckets, qualifying, notes, special)


if __name__ == "__main__":
    concs = parse_concentrations()
    print(f"detected {len(concs)} concentrations\n")
    for c in concs:
        flag = " *SPECIAL" if c.special else ""
        print(f"{c.name:32} total={c.total_units_required:4}u  "
              f"buckets={len(c.buckets)}  courses={len(c.qualifying)}{flag}")
    print("\n=== detail: Finance, Business Analytics, Accounting ===")
    for c in concs:
        if c.name in ("Finance", "Business Analytics", "Accounting"):
            print(f"\n{c.name}: total {c.total_units_required}")
            for b in c.buckets:
                print(f"  bucket '{b.label}' need={b.units_required} cap={b.cap} courses={b.courses[:6]}{'...' if len(b.courses)>6 else ''}")
            if c.notes:
                print("  notes:", c.notes)
