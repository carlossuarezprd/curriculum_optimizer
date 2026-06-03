# Curriculum DB — validation report

- name from bid fallback: 33922 → 'Advanced Industrial Organization II'
- name from bid fallback: 35213 → 'Emerging Markets Finance and Entrepreneurship'
- name from bid fallback: 36903 → 'Convex Optimization'
- name from bid fallback: 41100 → 'Applied Regression Analysis'
- name from bid fallback: 41207 → 'Causal Inference for Business Applications'

## Summary

- Courses: **237**  |  Sections: **469**
- Core areas: 11 (3 foundations + 8 functions, 7 required)
- Concentrations: 16 (derived from source)
- Flagship (course,professor) pairs resolved: 15
- Application-based courses: 9 → ['31401', '34104', '34115', '34702', '34715', '37201', '37703', '40206', '42709']
- 50-unit courses: ['30831', '30835', '30840', '30930', '30931', '33903', '33904', '33905', '33920', '33935', '34208', '34214', '34215', '34305', '34308', '34815', '34816', '35144', '35817', '35830', '37820', '37911', '37912', '38820', '38886', '42126', '42132', '42134', '42813', '42830', '43800']

## Catalog ↔ bid reconciliation

- Bid courses not found in catalog: none
- Sections with historical price data: 397

## Flagged TODOs

- Prereq text has course numbers but none classified (low confidence): none

## Known source discrepancies (surfaced, not patched)

- CLAUDE.md states Winter/Spring new-student price equals Phase 1 Price. The separate `New Students Price` column actually differs in ~60% of rows; we follow the brief's rule (new = Phase 1 Price in Winter/Spring).
- General Management is defined by reference (all 8 function lines + 300 units) → no flat qualifying list; flagged special.
- Basic-vs-substitute split within a core area is best-effort (PDF column wrap); the qualifying union (what feasibility uses) is exact.
- Strict prereqs listed as alternatives (e.g. '41000 or 41100') are stored as separate strict entries; the missing-prereq check should treat known equivalents as a satisfied-if-any group (to wire when building §5 in the app).