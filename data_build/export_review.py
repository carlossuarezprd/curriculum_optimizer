"""Export human-reviewable CSVs from the built JSON bundle.

Writes to build/review/ so you can open the data in Excel and spot-check it
before any UI is built. Regenerate with:  python -m data_build.export_review
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

OUT = Path("build/review")


def export():
    OUT.mkdir(parents=True, exist_ok=True)
    bundle = json.load(open("build/curriculum.json"))
    conc_names = [c["name"] for c in bundle["concentrations"]]

    # ---- sections.csv : one row per section (CLAUDE.md section-grain schema) ----
    with open(OUT / "sections.csv", "w", newline="") as f:
        cols = ["course_number", "course_name", "units", "section_code", "quarter",
                "year", "professor", "time", "core_area", "application", "flagship",
                "r1_price_new", "r1_price_returning", "bid_matched",
                "strict_prereqs", "recommended_prereqs"] + [f"conc:{n}" for n in conc_names]
        w = csv.writer(f)
        w.writerow(cols)
        for s in bundle["sections"]:
            sconc = set(s["concentrations"])
            w.writerow([
                s["course_number"], s["course_name"], s["units"], s["section_code"],
                s["quarter"], s["year"], s["professor"], s["time"], s["core_area"],
                "Y" if s["independent_application_course"] else "",
                "Y" if s["flagship_course"] else "",
                s["r1_price_new"], s["r1_price_returning"], "Y" if s["bid_matched"] else "",
                " ".join(s["strict_prereqs"]), " ".join(s["recommended_prereqs"]),
            ] + ["Y" if n in sconc else "" for n in conc_names])

    # ---- courses.csv : one row per course with description ----
    with open(OUT / "courses.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["course_number", "course_name", "units", "core_area", "concentrations",
                    "application", "strict_prereqs", "recommended_prereqs", "not_concurrent",
                    "n_sections", "description"])
        nsec = {}
        for s in bundle["sections"]:
            nsec[s["course_number"]] = nsec.get(s["course_number"], 0) + 1
        for c in bundle["courses"]:
            w.writerow([c["course_number"], c["course_name"], c["units"], c["core_area"],
                        "; ".join(c["concentrations"]),
                        "Y" if c["independent_application_course"] else "",
                        " ".join(c["strict_prereqs"]), " ".join(c["recommended_prereqs"]),
                        " ".join(c["not_concurrent"]), nsec.get(c["course_number"], 0),
                        c["description"]])

    # ---- concentrations.csv ----
    with open(OUT / "concentrations.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["concentration", "total_units_required", "n_qualifying_courses",
                    "n_buckets", "special", "buckets", "notes"])
        for c in bundle["concentrations"]:
            buckets = " | ".join(f"{b['label'] or 'list'}:{b['units_required']}u"
                                 + (f" cap{b['cap']}" if b["cap"] else "") for b in c["buckets"])
            w.writerow([c["name"], c["total_units_required"], len(c["qualifying"]),
                        len(c["buckets"]), "Y" if c["special"] else "", buckets,
                        " ".join(c["notes"])])

    # ---- core_areas.csv ----
    with open(OUT / "core_areas.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["area", "type", "n_qualifying", "basic", "substitutes"])
        for a in bundle["core_areas"]:
            w.writerow([a["name"], a["type"], len(a["qualifying"]),
                        " ".join(a["basic"]), " ".join(a["substitutes"])])

    print("wrote:", *(str(p) for p in sorted(OUT.glob("*.csv"))), sep="\n  ")


if __name__ == "__main__":
    export()
