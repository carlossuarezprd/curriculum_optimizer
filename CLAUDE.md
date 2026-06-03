# CLAUDE.md — Build brief for the Curriculum Optimizer

You are picking up a project with no prior context. This file is your full briefing. Read it completely before doing anything, then read the data files it points you to. Built by and for Carlos Suarez (csuarezp@chicagobooth.edu).

## What you are building

An interactive web simulator for planning a University of Chicago Booth MBA curriculum and its course-bidding strategy across six quarters: Year 1 and Year 2, each with Autumn, Winter, Spring. The user assembles a schedule, and the app continuously checks degree feasibility, concentration progress, prerequisites, and bidding-points strategy.

A previous HTML prototype (`simulator_MVP`) shows the intended *interactions* but is not the architecture. **Do not extend it directly.** Build the data layer first, then the app.

## Order of work (non-negotiable)

1. **Read the source files** listed below, including `prereq_explanation` before parsing any prerequisites.
2. **Build the consolidated relational database** to the schema in section "Relational database".
3. **Build the app** on top of that database, implementing the features in "Application design".

Structure before design. Propose the DB schema and get it right before writing UI.

## Source files and how to read them

### `course_details` (the catalog — source of truth for courses)
A by-faculty course catalog. The grain is important:

- A **course** is identified by a 5-digit course number and a name. A course has a **content description** and a set of **sections**.
- A **section** is characterized by: quarter, schedule (days and times), professor, and prerequisites.
- **Content description**: sometimes identical across sections, sometimes not. **Always use the description from the first section.**
- A course is offered in a quarter iff it has a section in that quarter. Collect all sections to know all quarters a course runs.

When parsing the file, the term for a section appears under the SCHEDULE heading next to the section. A course can appear multiple times (once per section/professor); merge by course number.

### `prereq_explanation` (read before parsing prerequisites)
Defines how to interpret prerequisite language and split it into:
- **strict** prerequisites — hard gates that must be satisfied.
- **recommended** prerequisites — suggested background, not enforced.

Apply these rules per **section** (prereqs live at the section level). Store both classes separately. When a strict prereq names another course, capture the course number(s) so the app can do the missing-prereq check.

### Bid data: `2025_autumn_course_bids`, `2026_winter_course_bids`, `2026_spring_course_bids`
`.csv` and `.xlsx` are the same data. These are historical clearing prices and enrollment/seat data per section for academic year 2025–2026. Columns include phase-by-phase prices and seats. The two price columns the simulator needs:

- **Round 1 price (2nd years)** = the column "Phase 1 Price".
- **Round 1 price (new students)**:
  - For **Winter** and **Spring** quarters: same as "Phase 1 Price".
  - For **Autumn**: new students bid later, so their price is the column "Phase 1 New Students Price" (2nd-year price is still "Phase 1 Price").

Ignore the other phase/seat columns for the core simulator unless useful for context.

### `graduation_requirements`
Foundation areas (3) and function/leadership/environment areas (8), each satisfiable by a basic course **or an approved substitute**. Also the total-units rules. Use this to populate the `core_area` field and the feasibility checks. The 7-of-8 / coverage rules are summarized under "Feasibility checks".

### `concentration_requirements`
For each concentration: the qualifying course list and the **unit threshold** required. Use to populate the per-concentration boolean columns and to store each concentration's required units.

## Relational database (build this first)

Build a consolidated, normalized relational database from the sources. The planning grain is the **section** (a course offered in a given quarter by a given professor), because bidding, prereqs, schedule, and professor all vary by section.

Minimum columns (one row per section; course-level fields repeat across a course's sections):

| Column | Meaning |
|---|---|
| course_number | 5-digit course id |
| course_name | from catalog |
| units | number of units (most are 100; some 50 — read from catalog) |
| section_code | section number/code |
| quarter | Autumn / Winter / Spring (+ year if present in the bid data context) |
| professor | section instructor |
| time | days + times of the section |
| strict_prereqs | list of strict prereqs (course numbers where applicable), per `prereq_explanation` |
| recommended_prereqs | list of recommended prereqs |
| core_area | the foundation or function area this course can fulfill, **if** it is a valid course (basic or approved substitute) for that area; else null. From `graduation_requirements`. |
| concentration_1 … concentration_N | one **boolean** column per existing concentration; TRUE iff the course counts toward that concentration. Derive the full set of concentrations from `concentration_requirements` (do not hardcode only three). |
| independent_application_course | boolean; TRUE iff the course is acquired by application rather than bidding (stated in the course description; e.g. PE/VC Lab, Interpersonal Dynamics, NVC). |
| flagship_course | boolean; TRUE iff the section is in the user's flagship list (see "Flagship" — this is user-configurable, default-seeded from the suggested list below). |
| r1_price_new | Round 1 price for new students (Autumn: "Phase 1 New Students Price"; Winter/Spring: "Phase 1 Price"). |
| r1_price_returning | Round 1 price for 2nd years ("Phase 1 Price"). |

Store separately (not per-row):
- **Units required per concentration** (one number per concentration), from `concentration_requirements`.
- The flagship configuration (course + professor pairs — see below).

Notes:
- `core_area` should be filled for every course that is a valid filler (basic course OR approved substitute) for a foundation/function area.
- A course may count toward multiple concentrations → multiple TRUE boolean columns.
- Concentration membership and unit thresholds come straight from `concentration_requirements`; reflect them faithfully rather than from memory.

## Flagship courses

A flagship is **not** the whole course — it is the subset of a course's sections taught by a **particular professor**. Model flagship status as a set of (course, professor) pairs, then mark a *section* as flagship iff its (course, professor) matches.

Flagship status is **user-configurable** in the app (see design). Seed the default suggestion list with the following (provided by the user; these are the ones used in the MVP). Resolve each to its (course, professor) pair from the catalog:

- Cases in Financial Management — Born
- Entrepreneurial Finance and Private Equity — Kaplan (and/or Meadow; the flagship is the Kaplan-taught sections)
- Merger & Acquisition Strategy — Morrissette
- Pricing Strategies — Dubé
- Designing a Good Life — Epley
- Commercializing Innovation — Meadow
- The Study of Behavioral Economics ("Behavioral Econ") — Pope
- Money and Banking — Kroszner
- Business, Politics & Ethics — Bertrand (listed as "Barry" in one user note; confirm against catalog, the course is Business/Politics/Ethics)
- Firm and Non-Market Environment — Bertrand
- Portfolio Management — Pástor
- Advanced Financial Analysis and Valuation for Global Firms — Leuz
- Negotiations (Strategies and Processes of Negotiation) — any professor
- PE/VC Lab
- Interpersonal Dynamics

"Negotiations — any professor" means all sections of that course are flagship regardless of professor. PE/VC Lab and Interpersonal Dynamics are also application-based; flagship and application-based are independent flags.

## Application design

Modern, elegant, minimalistic. Not the over-the-top neon / harsh-shape "vibe-coded" aesthetic. Restrained palette, generous spacing, clean typography. Include a tasteful, professional credit line: created by Carlos Suarez (csuarezp@chicagobooth.edu).

The MVP demonstrated the baseline interactions (drag courses into quarters, reject invalid quarters, live requirement/concentration/flagship checks, prereq popups). Keep those, and implement the changes below. You may propose additional features that make the simulation experience exhaustive and seamless.

### 1. Pre-selection pool
- A **full course list** of every course from `course_details`, filterable (see Filtering).
- Clicking a course opens a popup: course **description**, concentration(s), and core area (if applicable).
- The user moves a course into a **pre-selection area**, then **picks a specific section** and adds that section to a quarter.
- A section can only be added to a quarter where it is offered. Adding to an invalid quarter is blocked or flagged.
- Clicking a section in the pre-selection area opens a popup: quarter, professor, time schedule, and prerequisites (strict and recommended distinguished).

### 2. Application-based courses
- Visually distinct at both the full-list and pre-selection levels.
- Filterable by application-based status.

### 3. Flagship configuration
- A dedicated section where the user configures their own flagship list, **seeded with the suggested list above**.
- Selection is by **course + professor** (not by selecting all sections). Once set, sections matching that (course, professor) show flagship status in the full list and pre-selection.

### 4. Filtering (full course list)
Filter by: concentration, foundation/function (core area), application-based, **flagship status**, and **free-text search by course name**. Filters should be combinable.

### 5. Prerequisite handling
- When a section with a **strict** prereq that is another course is added, and that prerequisite course is **not** present in an **earlier** quarter, raise a flag on the section.
- Clicking the flag shows a popup naming the missing course(s).
- Recommended prereqs do not trigger flags (but can be shown in the section popup).

### 6. Bidding logic (per quarter)
Track, per quarter, a set of bidding variables:

- **Available points.** Everyone starts Quarter 1 with **8,000**. Each course taken adds **2,000** to the *following* quarter's pool. So for any quarter after the first: `available = previous_quarter_remaining_balance + 2000 * (courses_taken_in_previous_quarter)`.
- **Remaining balance** of a quarter = that quarter's starting available points − sum of the **prices** of courses taken that quarter.
- **Which price to use** for a course's cost:
  - **Autumn Year 1** → new-student price (`r1_price_new`).
  - **Autumn Year 2** → returning/2nd-year price (`r1_price_returning`).
  - **Any other quarter** → either column (they are equal); use `r1_price_returning`.
- **Estimated cost vs. actual bid.** Each placed course has two numbers:
  - *Estimated cost* = last year's price (from the DB, per the rule above). Read-only reference.
  - *Actual bid* = user input, for strategy.
- **Flags:**
  - Flag when a course's **actual bid is lower than its price** (estimated cost) — likely to lose the bid.
  - Flag when the **sum of actual bids in a quarter does not equal exactly the available points** for that quarter.
- Application-based courses are acquired by application, not points — exclude them from bid spend (but they still add the +2,000 accrual as courses taken; confirm this assumption with the user if `prereq_explanation`/requirements suggest otherwise).

### 7. Course count per quarter
- Each quarter allows **2–5 courses inclusive**. Flag quarters outside that range.
- Total across all six quarters must be **20–22 inclusive**. Flag totals under 20 or over 22.

### 8. Feasibility checks
- **Foundations & functions coverage.** Show all foundation and function areas with a checked/unchecked state. Warn if any **foundation** is not covered, or if **more than one function** is uncovered. (Booth requires all foundations and 7 of 8 functions → at most one function may be uncovered.)
- **Concentrations.** Show a concentration in the fulfilled list **only when its requirement is met**. At the first-level view, do **not** show unfulfilled concentrations. Clicking through lets the user see the qualifying courses counted out of the total units required for any concentration.

## Engineering guidance

- Keep a clean separation: (a) a data-build step that produces the relational DB from the raw files, (b) the app that consumes it. Regenerating the DB from updated raw files should not require touching the UI.
- Prefer a typed, inspectable DB artifact (e.g. SQLite, or well-structured JSON/Parquet if simpler for the front end) so the data is traceable — traceability is an explicit goal of moving this project to a repo.
- Validate the extracted catalog against the bid data: every section that has bid data should resolve to a section in the catalog. Report mismatches rather than silently dropping them.
- Where source files disagree or a value is missing (e.g. a section with no published term, or a flagship professor not found), surface it as a flagged TODO rather than guessing. Several term/professor values were uncertain in prior work; do not paper over gaps.
- Do not hardcode the concentration set or their unit thresholds — derive them from `concentration_requirements` so the schema scales to all concentrations.

## Known data caveats (from prior analysis)

- Course titles auto-extracted from the PDF can be slightly mis-cased; the course **number** is the reliable key.
- Some courses are description-only in the catalog with no scheduled section in this snapshot; treat their term as unknown and flag it.
- Application-based courses (PE/VC Lab, Interpersonal Dynamics, NVC, Lab in Developing New Products, Hacking for Defense) do not appear in bid price data because they are not bid on. Expect them to be absent from the bid files; that is correct, not an error.
- The "new students" price only diverges from the standard price in **Autumn**; in Winter and Spring the two are equal.

## Definition of done (first milestone)

1. A regenerable relational DB built from the raw files, matching the schema above, with concentrations and thresholds derived from source.
2. The app reads only from that DB.
3. All checks in "Application design" sections 5–8 work live as courses are placed/removed/moved.
4. Flagship configuration works at the (course, professor) grain.
5. The UI is clean and minimal, with the Carlos Suarez credit line.
