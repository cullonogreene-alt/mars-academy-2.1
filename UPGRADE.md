# 2.0 → 2.1

## How to install

Replace these files in the repo root: `app.js`, `content.js`, `styles.css`,
`service-worker.js`, `README.md`. Add `AUTHORING.md` and this file.

**Delete these:**
- `data.js` — 79 KB, referenced by nothing. `index.html` loads `content.js` instead.
- `Mars_Combat_Academy_PWA/` — the entire v1 app, still live at its own URL with its own
  service worker (`mars-combat-academy-v1`) registered at its own scope. If you ever opened
  that path on the phone, open it once more after deleting so the 404 clears the worker.
- `UPDATE_INSTRUCTIONS.txt` — replaced by the deploy section of `README.md`.

Your existing saved data survives: state is merged over defaults on load, so `srs` starts
empty and fills in as you practise. Export a backup from Settings first anyway.

---

## What changed

### Fixed

- **Quick practice no longer traps you.** `resetPracticeQueue(filter, id)` built a queue of
  length 1, and `practiceIndex = (practiceIndex+1) % 1` is always 0 — "Another problem"
  re-served the same card forever. The specific item is now the *first* card of a normal
  session.
- **Service worker was cache-first for `app.js` and `index.html`** with a hardcoded cache
  name. That's why deploying required "wait 3–10 minutes, refresh in Safari, force-quit the
  Home Screen app". Now network-first for HTML/JS/CSS with cache fallback for offline;
  cache-first only for icons. Bump `VERSION` in `service-worker.js` on every deploy.
- **`.sort(() => Math.random() - 0.5)` is not a shuffle** — it's biased and, on some engines,
  unstable. Replaced with Fisher–Yates.
- **Text grading was exact string match.** `p-code-01` accepted only `"3.0"`, so `3` was
  marked wrong. Grading now normalises case, whitespace, brackets and a trailing `.0`, and
  reads both `accepted` and `answerText`.
- **No keyboard handling at all.** Escape now closes search → modal → drawer in that order,
  Enter submits a typed answer, 1–4 pick options, space/N advances.
- **No focus styles anywhere** (`:focus` appeared zero times in `styles.css`) and no
  `prefers-reduced-motion`. Both added, plus 44px minimum tap targets.

### Added — spaced repetition

Completion was two append-only arrays. Answer once, done forever; answer wrong, nothing
happened. There was no mechanism to bring back what you got wrong, which is the entire job
of a practice tool.

Now every attempt is recorded per item:

```
box 1 → due immediately     box 4 → 7 days
box 2 → 1 day               box 5 → 16 days
box 3 → 3 days              box 6 → 35 days
```

Correct promotes one box, wrong drops straight back to box 1. Sessions are 10 items, built
as *due first (oldest due first) → never seen → not yet due*, and they **end** with a summary
instead of cycling forever. Home screen and Settings show due / new / learned counts.
Settings can clear scheduling without wiping notes or lab designs.

The state lives in `state.srs` and is included in JSON backups automatically.

### Added — labs that emit real artifacts

The labs stopped one step short of being useful. Now:

- **Attack Timeline** → *Copy spec* (prose, as before), *Copy AttackData* (a complete
  `Resource` script with `class_name AttackData`, typed `@export`s, `total_duration()`,
  `can_chain()`, `can_cancel()`, plus your values as a const dict), *Copy .tres* (a valid
  resource file). Neither payload contains comments — `.tres` and `.tscn` have no comment
  syntax and a `#` line breaks the parser.
- **Attack Timeline validation** now catches design errors, not just arithmetic ones: chain
  window opening before the active frames end, cancel window overlapping wind-up or active
  instead of recovery, cancel window running past recovery, active window shorter than one
  frame at 60 fps, recovery much shorter than wind-up.
- **Collision Matrix** → *Copy layer values*: the Project Settings layer-name list, plus
  computed `collision_layer` / `collision_mask` integers per object with the layers each one
  sees spelled out, plus a GDScript const block. This is the part that was genuinely painful
  to work out by hand.
- **Node Tree Architect** → *Copy .tscn*: a valid `[gd_scene format=3]` file with correct
  parent paths and de-duplicated sibling names. Save it, open it in Xogot.

### Added — honesty about the content

- New **Beyond lessons** filter surfaces only the 15 original practice items. Every card is
  labelled either "Also a lesson check" or "Beyond lessons", so the 55 stops being a claim
  the app makes about itself.
- Every lesson gets **Godot docs ↗** and **Module docs ↗** buttons and a footer reading
  "Written against Godot 4.4+ — verify in Xogot". Optional `docsQuery` per lesson overrides
  the search term.

---

## Not done — deliberately left to you

- **Content depth.** See `AUTHORING.md`. Code can't fix 43-word lessons.
- **Defense and AI labs don't export yet.** Same pattern as the attack lab if you want them;
  the generators are `attackDataScript` / `attackTres` in `app.js`, right above `attackSpec`.
- **No focus trap in the modal.** Escape closes it, which covers the common case, but Tab
  can still walk behind it.
- **`state` has a `version` field that nothing reads.** If you ever change a shape in
  `initialState()`, write a migration in `loadState()` before you need one.
