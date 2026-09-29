# OnboardOps

A role-based, server-scored SOP training sandbox for new joiners. A trainee
signs in, sees only the SOPs their role/track has been assigned, practises
each one in a simulated Linux terminal, and gets a completion report. An
admin signs in separately, assigns roles/tracks to users, and authors SOPs
through a form (nothing is hard-coded).

Built for BITS SEWI ZC425T Project Work.

## Quick start

```bash
npm install
npm start
```

Open `http://localhost:4000`. On first run the server seeds a default admin
and 4 sample SOPs automatically.

**Demo accounts** (change these before any real deployment):
| Role    | Username  | Password     |
|---------|-----------|--------------|
| Admin   | `admin`   | `admin123`   |
| Trainee | `trainee` | `trainee123` (assigned the `linux` track) |

New accounts created via "Create account" on the login page start as a
trainee with **no track assigned** — sign in as `admin` and use the
**Users & roles** tab to assign one, which is when SOPs for that track
become visible to them.

## Why this design answers the brief

- **Login + roles.** `POST /api/auth/login` issues a signed JWT containing
  `role` and `tracks`. Every protected route re-verifies that signature
  server-side (`middleware/auth.js`), so nothing the browser caches in
  `localStorage` can be edited to gain admin access or unlock a track.
- **Admin adds SOPs without touching code.** `admin.html` → SOPs tab posts
  to `POST /api/admin/sops` / `PUT /api/admin/sops/:id`, which write
  straight into `db/db.json`. New tracks are just typed into the "Track"
  field — no infra distinction is hard-coded, so the same mechanism scales
  to other infra/roles later (see "Extending" below).
- **Score lives on the server, not the browser.** The trainee UI never
  computes or sends a score. It only ever POSTs the raw command the trainee
  typed to `POST /api/progress/:attemptId/command`; the server looks up the
  *current* step for that attempt, judges the command against the answer
  key (which is never sent to the browser — see `routes/sops.js` vs
  `routes/admin.js`), and returns the *new* authoritative score. Refreshing
  the page just re-fetches `GET /api/progress/:attemptId` from the same
  store, so there is nothing client-side to roll back.
- **Hints degrade the score.** `POST /api/progress/:attemptId/hint`
  deducts `HINT_PENALTY` (default 5 pts, see `config/config.js`) on the
  server and returns the correct command.
- **Report generation.** Once an SOP is finished the attempt is marked
  `completed`; `GET /api/reports/overview` aggregates every attempt for a
  trainee into a grade (EXCELLENT/GOOD/FAIR/POOR — the same scale BITS
  uses) with hints used, errors, safety violations and time taken per SOP.
  Admins can pull the same report for any trainee from the Reports tab.
- **Interactive teaching on wrong commands.** Two layers, both server-side
  (`services/scoring.js`):
  1. **Distractors** — per-step, author-defined "plausible wrong commands"
     (e.g. `systemctl status httpd` on a step that wants `nginx`) return a
     specific explanation of *why* that command is wrong *here*, and cost a
     small penalty (`DISTRACTOR_PENALTY`).
  2. **Global dangerous-command library** (`data/dangerous-commands.json`)
     — `rm -rf /`, `dd` onto a raw disk, a fork bomb, `chmod -R 777 /`,
     etc. — is checked on *every* command regardless of which SOP/step is
     active, blocks the action, and explains the real-world consequence.
  Commands that are neither the right answer nor a known wrong answer
  (typos, plain exploration like `ls`/`pwd`) are logged but never
  penalized, so trainees can explore freely.

## File structure

```
onboardops/
├── server.js                # express app, mounts routes, serves public/
├── config/config.js         # port, JWT secret, scoring constants
├── db/
│   ├── database.js          # tiny JSON-file store (load/save)
│   ├── seed.js               # default admin + 4 sample Linux SOPs
│   └── db.json               # created on first run (git-ignored)
├── middleware/auth.js        # JWT verify + role guard
├── services/scoring.js       # command evaluation, grading, max-score math
├── data/dangerous-commands.json
├── routes/
│   ├── auth.js               # register / login / me
│   ├── sops.js                # trainee-facing SOP list (no answer key)
│   ├── admin.js               # user + SOP CRUD, tracks, reports overview
│   ├── progress.js            # start attempt / submit command / hint
│   └── reports.js             # per-attempt + aggregate reports
└── public/                   # static frontend, plain HTML/CSS/JS
    ├── login.html / js/login.js
    ├── trainee.html / js/trainee.js / js/terminal.js
    ├── admin.html / js/admin.js
    ├── report.html / js/report.js
    ├── css/style.css
    └── js/api.js              # shared fetch wrapper + auth guard
```

`js/terminal.js` is the only piece that runs purely client-side: a fake
Linux filesystem so `ls`/`cd`/`cat`/`df`/`systemctl`/etc. feel real and
respond instantly. It never decides right or wrong — every typed line is
also POSTed to the server, which is the only place that judges it.

## Data storage

Deliberately a flat JSON file (`db/db.json`) via `db/database.js`, not a
real database engine. It keeps `npm install` free of native build tools
(no compiler needed, unlike `sqlite3`/`better-sqlite3`), which matters if
this is graded on a machine you don't control. Swapping in MongoDB or
Postgres later only touches `db/database.js` and `db/seed.js` — every
route already goes through `load()`/`save()`.

## Extending (things the project intentionally leaves open)

- **Different infra per track.** Right now "track" is a free-text string
  (`linux`, `networking`, ...) and the sandbox (`terminal.js`) always
  simulates the same Linux box. To give each track its own simulated
  environment, key the sandbox's starting filesystem off `sop.track` and
  add a matching fake filesystem per track.
- **Multiple tracks per SOP**, not just one.
- **Per-step time limits** or a leaderboard, using the same `attempts`
  data that's already logged.

## Suggested evaluation for the report

Have several new joiners (or classmates unfamiliar with the SOPs) complete
the same 4 SOPs, once with OnboardOps and once by reading the SOPs as a
plain document, and compare: completion time, error/hint count, safety
violations, and a short quiz afterward. The System Usability Scale (10
standard questions) gives you a usability number for the same section.
