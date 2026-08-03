# Mars Combat Academy 2.1

A local-first PWA for Godot study and Project Mars design work on iPhone.
Companion to editor time in Xogot/Godot — not a replacement for it.

## What's here

| Section | What it actually is | Honest state |
|---|---|---|
| Learn | 40 short lessons, 10 modules | ~1,700 words of concept text total. Thin. See `AUTHORING.md`. |
| Practice | 55 items, **15 of which are original**; 40 are the lesson checks re-listed | Now scheduled with a Leitner box system. Use the **Beyond lessons** filter for the original 15. |
| Build | 15 missions (12 Xogot, 3 any phone) | The strongest section. Acceptance-test shaped. |
| Labs | 7 tools; attack timeline, collision matrix, node tree, vector, AI, defense, scratchpad | Attack / collision / tree now export paste-ready Godot artifacts. |
| Reference | 35 glossary terms | Definitions average 8 words. Thin. |
| Notes | Local project journal | Included in JSON backups. |
| Settings | Export / import / reset | Now also shows and resets review scheduling. |

All data is local to the device. No account, no server, no analytics.

## Files

```
index.html              app shell
content.js              all curriculum data (edit this to add content)
app.js                  all application logic
styles.css              all styling
service-worker.js       offline cache — bump VERSION on every deploy
manifest.webmanifest    PWA metadata
icons/                  app icons
```

## Deploying an update

The old zip-and-drag flow is gone. Two options:

**Small edits (typo, one lesson):** edit the file directly on github.com, commit. Done.

**Real work:** install [Working Copy](https://workingcopyapp.com) on the iPhone, clone this repo,
edit, commit, push. Working Copy is also how Xogot imports projects from GitHub, so the same
tool covers both this app and Project Mars.

**Every deploy that changes `app.js`, `content.js`, `styles.css` or `index.html`:**
bump `VERSION` in `service-worker.js`. The worker is network-first for code, so a fresh
build now loads on the next launch with any connectivity — no force-quit ritual required.

## Adding content

See `AUTHORING.md`. Short version: the app's structure is finished; the content is not.
