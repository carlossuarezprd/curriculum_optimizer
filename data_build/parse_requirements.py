"""Parse graduation_requirements.pdf (new 2021 curriculum) into core areas.

Output: ordered list of areas, each with type (foundation|function), the basic
course numbers and approved-substitute course numbers. Foundations: all 3
required. Functions/Leadership/Environment: 7 of 8 required.

The area NAMES and types are the fixed structure of the Booth degree; the
course numbers that satisfy each area are extracted from the PDF text so the
mapping regenerates if the source is updated.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

import fitz

GRAD_PDF = "graduation_requirements.pdf"

# (label in PDF, type). Order matters: used to slice the text between anchors.
AREA_SPEC = [
    ("Financial Accounting", "foundation"),
    ("Microeconomics", "foundation"),
    ("Statistics", "foundation"),
    ("Finance", "function"),
    ("Marketing", "function"),
    ("Operations", "function"),
    ("Strategy", "function"),
    ("Decisions", "function"),
    ("People", "function"),
    ("Economy", "function"),
    ("Society", "function"),
]

UNITS_PER_AREA = 100
FOUNDATIONS_REQUIRED = 3
FUNCTIONS_REQUIRED = 7   # 7 of 8
TOTAL_UNITS = 2000
ELECTIVE_UNITS = 1000


@dataclass
class CoreArea:
    name: str
    type: str
    basic: list = field(default_factory=list)        # best-effort (column wrap)
    substitutes: list = field(default_factory=list)  # best-effort
    qualifying: list = field(default_factory=list)    # union; used by checks


def _new_curriculum_text() -> str:
    txt = "\n".join(p.get_text() for p in fitz.open(GRAD_PDF))
    start = txt.find("MBA PROGRAM OUTLINE 2025-26")
    end = txt.find("MBA PROGRAM OUTLINE 2020-21")
    return txt[start:end if end > 0 else len(txt)]


def _nums(segment: str) -> list[str]:
    """All 5-digit Booth course numbers in a text segment, in order, deduped.
    Also captures ECON/LAWS-prefixed numbers as e.g. 'ECON 30100'."""
    out: list[str] = []
    for m in re.finditer(r"\b(ECON|LAWS)\s+(\d{5})\b|\b(\d{5})\b", segment):
        val = f"{m.group(1)} {m.group(2)}" if m.group(1) else m.group(3)
        if val not in out:
            out.append(val)
    return out


def parse_requirements(pdf: str = GRAD_PDF) -> list[CoreArea]:
    txt = _new_curriculum_text()
    # Find each area label's position; slice basic/substitute numbers between
    # an area anchor and the next area anchor.
    anchors = []
    for label, atype in AREA_SPEC:
        idx = txt.find("\n" + label + "\n")
        if idx < 0:
            idx = txt.find(label)
        anchors.append((idx, label, atype))
    anchors.sort()
    areas: list[CoreArea] = []
    for i, (idx, label, atype) in enumerate(anchors):
        end = anchors[i + 1][0] if i + 1 < len(anchors) else txt.find("Electives")
        if end < 0 or end < idx:
            end = len(txt)
        seg = txt[idx + len(label):end]
        # The line layout is: <basic numbers line>\n<substitute numbers line(s)>.
        lines = [ln.strip() for ln in seg.split("\n") if ln.strip()]
        # first line with digits = basic; remaining digit-lines = substitutes
        basic: list[str] = []
        subs: list[str] = []
        seen_basic = False
        for ln in lines:
            if not re.search(r"\d{5}", ln) and "ECON" not in ln:
                if seen_basic:
                    break  # hit prose / next heading after we have data
                continue
            if not seen_basic:
                basic = _nums(ln)
                seen_basic = True
            else:
                subs.extend(n for n in _nums(ln) if n not in subs)
        qualifying = _nums(seg)
        # Drop pure co-requisite mentions (e.g. "along with enrollment in NNNNN").
        for co in re.findall(r"enrollment in (\d{5})", seg):
            if co in qualifying and co not in basic:
                qualifying.remove(co)
                if co in subs:
                    subs.remove(co)
        areas.append(CoreArea(label, atype, basic, subs, qualifying))
    return areas


if __name__ == "__main__":
    for a in parse_requirements():
        print(f"[{a.type:10}] {a.name:20} basic={a.basic}")
        print(f"{'':33}subs={a.substitutes}")
