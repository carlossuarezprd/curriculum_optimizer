"""Parse the three historical bid CSVs into per-section prices.

Per CLAUDE.md:
  r1_price_returning (2nd years) = "Phase 1 Price" in every quarter.
  r1_price_new (new students):
    - Autumn -> "Phase 1 New Students Price"
    - Winter/Spring -> equal to "Phase 1 Price"
Column naming differs by file: Autumn uses "Phase 1 New Students Price";
Winter/Spring use "New Students Price". Prices like "CLO"/"" are non-numeric
(closed / no clearing price) and stored as None.
"""
from __future__ import annotations

import csv
import glob
from dataclasses import dataclass


BID_FILES = {
    "Autumn": "2025_autumn_course_bids.csv",
    "Winter": "2026_winter_course_bids.csv",
    "Spring": "2026_spring_course_bids.csv",
}


@dataclass
class Bid:
    course_number: str
    section_code: str
    title: str
    quarter: str
    year: int
    instructor: str
    day_time: str
    r1_price_returning: int | None
    r1_price_new: int | None


def _price(val: str) -> int | None:
    val = (val or "").strip()
    if not val or not val.lstrip("-").isdigit():
        return None
    return int(val)


def parse_bids(files: dict[str, str] = BID_FILES) -> list[Bid]:
    out: list[Bid] = []
    for quarter, fn in files.items():
        with open(fn, encoding="utf-8-sig") as f:
            reader = csv.DictReader(f, delimiter=";")
            for r in reader:
                code = (r.get("Course") or "").strip()
                if not code or not (r.get("Year") or "").strip().isdigit():
                    continue  # blank/padding row
                phase1 = _price(r.get("Phase 1 Price"))
                if quarter == "Autumn":
                    new = _price(r.get("Phase 1 New Students Price"))
                else:
                    # Winter/Spring: new-student price == Phase 1 Price.
                    new = phase1
                out.append(Bid(
                    course_number=r["Course"].split("-")[0],
                    section_code=r["Course"],
                    title=r["Title"],
                    quarter=r["Quarter"],
                    year=int(r["Year"]),
                    instructor=r.get("Instructor", "").strip(),
                    day_time=r.get("Day and Time", "").strip(),
                    r1_price_returning=phase1,
                    r1_price_new=new,
                ))
    return out


if __name__ == "__main__":
    bids = parse_bids()
    print("bid section rows:", len(bids))
    bycode = {}
    for b in bids:
        bycode.setdefault(b.section_code, b)
    print("distinct section codes:", len(bycode))
    print("distinct courses:", len({b.course_number for b in bids}))
    # sanity: in Winter/Spring is the explicit "New Students Price" == Phase 1?
    import csv as _csv
    for q in ("Winter", "Spring"):
        same = diff = 0
        with open(BID_FILES[q], encoding="utf-8-sig") as f:
            for r in _csv.DictReader(f, delimiter=";"):
                a = _price(r.get("Phase 1 Price")); b = _price(r.get("New Students Price"))
                if a is None and b is None:
                    continue
                if a == b: same += 1
                else: diff += 1
        print(f"{q}: Phase1==NewStudents for {same} rows, differ for {diff}")
    # show an Autumn course where new != returning
    for b in bids:
        if b.quarter == "Autumn" and b.r1_price_new is not None and b.r1_price_returning is not None and b.r1_price_new != b.r1_price_returning:
            print("Autumn new!=returning example:", b.section_code, b.title[:30], "ret", b.r1_price_returning, "new", b.r1_price_new)
            break
