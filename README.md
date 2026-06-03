# Curriculum Optimizer

A course-planning and bidding simulator for the University of Chicago Booth MBA. It lets a student assemble a full two-year curriculum, check it against degree requirements and concentrations, and simulate the points-based course-bidding ("iBid") strategy quarter by quarter.

Built by Carlos Suarez (csuarezp@chicagobooth.edu).

## What this project does

Booth students build their schedule across six quarters (Autumn / Winter / Spring in each of two years) and acquire courses through a points-based bidding auction. Planning a good curriculum means juggling several constraints at once:

- Each course is offered only in specific quarters, taught by specific professors, and may have strict prerequisites.
- The degree requires covering a set of foundation and function areas, plus enough electives.
- Concentrations require a threshold of qualifying units.
- Bidding points are finite, accrue over time, and must be spent strategically.
- Some courses are acquired by application, not bidding.

This tool turns all of that into an interactive simulator so the trade-offs are visible and a plan can be validated before the real bidding windows.

## Repository contents

Data sources (uploaded):
- `course_details` — the full Booth course catalog by faculty. Source of truth for courses, sections, professors, quarters, schedules, descriptions, and prerequisite language.
- `2025_autumn_course_bids` / `2026_winter_course_bids` / `2026_spring_course_bids` (`.csv` and `.xlsx`, same data) — historical bid clearing prices and seat/enrollment data for each section in academic year 2025–2026.
- `graduation_requirements` — foundation and function area rules, unit totals, and approved substitutes.
- `concentration_requirements` — the qualifying course list and unit threshold for each concentration.
- `prereq_explanation` — how to read prerequisite language and classify it as **strict** vs **recommended**. Must be read before parsing prerequisites.

Code:
- `simulator_MVP` — an early single-file HTML prototype (built in a planning chat). It demonstrates the intended interactions (drag courses into quarters, term-validity checks, requirement/concentration/flagship checks, prereq popups) but predates the data model and design described here. Treat it as a reference for behavior, **not** as the architecture to extend. The real app is rebuilt on top of the relational database described in `CLAUDE.md`.

Working docs:
- `CLAUDE.md` — the build brief and operating instructions. Read this first if you are an AI agent working on the project.

## Build order

1. Build the consolidated relational database from the data sources (schema in `CLAUDE.md`).
2. Build the simulator UI on top of that database.

Structure before design: do not extend the MVP HTML directly. The database comes first, then the application reads from it.

## Status

Early. The data sources and the MVP prototype exist; the relational database and the production simulator are to be built per `CLAUDE.md`.
