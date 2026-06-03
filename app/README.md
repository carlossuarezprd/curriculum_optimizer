# Curriculum Optimizer — app (MVP)

React + TypeScript + Vite + Tailwind. Reads the compiled data bundle
(`src/data/curriculum.json`, copied from `build/curriculum.json`). No backend —
the plan is held in the browser (localStorage).

## Run locally

```bash
cd app
npm install
npm run dev      # opens http://localhost:5173
```

Build a static bundle:

```bash
npm run build    # outputs app/dist/
npm run preview  # serves the built bundle
```

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds this app and deploys to Pages on every
push to `main` that touches `app/**`.

**One-time setup:** in the repo on GitHub, go to **Settings → Pages →
Build and deployment → Source → "GitHub Actions"**. After that the workflow
publishes to `https://<owner>.github.io/curriculum_optimizer/`.

## Refreshing the data

When the DB is regenerated, copy it in and rebuild:

```bash
python -m data_build.build_db
cp build/curriculum.json app/src/data/curriculum.json
```

## MVP scope

Implemented: filterable catalog (concentration / core area / flagship /
application / search), course detail modal with section picker, six-quarter
board with add/remove, per-quarter points pool (8,000 start, +2,000/course
accrual, estimated cost, remaining), per-quarter and total course-count flags,
actual-bid inputs with below-cost flag, live degree coverage (3 foundations +
7-of-8 functions), concentrations-met panel, and flagship/application visual
styling. Not yet wired: missing-prereq flags (§5), exact-bid-sum flag, full
sub-bucket concentration math, drag-and-drop, flagship editor UI.
