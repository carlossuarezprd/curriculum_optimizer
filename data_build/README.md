# Data build

Regenerates the consolidated relational DB from the raw source files. The app
consumes only the artifacts in `build/`; it never reads the raw files.

## Run

```bash
pip install -r data_build/requirements.txt
python -m data_build.build_db        # from the repo root
```

Outputs (written to `build/`):

| File | Purpose |
|---|---|
| `curriculum.sqlite` | Normalized, inspectable canonical DB (open with any SQLite tool) |
| `curriculum.json` | Compiled bundle the front-end loads |
| `validation_report.md` | Catalog↔bid reconciliation + flagged TODOs and source discrepancies |

## Pipeline

| Module | Source file | Produces |
|---|---|---|
| `parse_catalog.py` | `course_detail.pdf` | courses, descriptions, units, sections, prereq text |
| `parse_bids.py` | `*_course_bids.csv` | per-section Round-1 prices (returning / new) |
| `parse_requirements.py` | `graduation_requirements.pdf` | core areas (3 foundations + 8 functions) |
| `parse_concentrations.py` | `concentration_requirements.pdf` | concentrations, thresholds, sub-buckets (derived from source) |
| `flagship_seed.py` | — | default flagship (course, professor) seed list |
| `build_db.py` | all of the above | the three `build/` artifacts |

## Notes on the parse

- The catalog PDF's `>>` hyperlink headers are reading-order-shifted relative to
  their body text, so descriptions/sections are keyed off the self-identifying
  `Section: NNNNN-XX` codes; names/units/professors come from the headers.
- Concentrations are **derived** from the source (not hardcoded), including
  sub-bucket minimums and caps. Concentrations defined by reference
  (General Management) or with non-standard structure are flagged `special`.
- Known source discrepancies and low-confidence extractions are surfaced in
  `validation_report.md` rather than silently patched.
