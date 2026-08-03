# Authoring guide

The app's structure is done. What's thin is the content. Numbers as of 2.1:

- 1,738 words of lesson concept text across 40 lessons — **43 words per lesson**
- 279 words of glossary across 35 terms — **8 words per definition**
- 821 words across 15 missions
- 15 original practice items; the other 40 are the lesson checks re-listed

Total teaching payload: about 3,100 words. Roughly twelve minutes of reading.

That is the real ceiling on how useful this can be. Everything below is about raising it.

---

## The rule that fixes the content problem

**Only write a lesson about something you have already been confused by.**

Generic material ("a node is one object with one job") is available in the official docs,
which are now linked from every lesson, and inside Xogot itself. You cannot beat them and
you should not try. What you have that they don't is the record of what specifically tripped
*you* up in *your* project — the bug that took an hour, the API that behaved differently
than you assumed, the thing you had to look up three times.

Practical loop: when something in Xogot costs you more than 15 minutes, open **Workshop
Notes** right then and write it down raw. Later, on the train, turn it into a lesson. The
notes section already exists for exactly this and is currently the most underused part
of the app.

---

## Lesson template

Add to the relevant module's `lessons` array in `content.js`:

```js
{
  "id": "combat-5",
  "title": "Hitboxes stay enabled one frame too long",
  "summary": "Why a single swing registers twice.",
  "concept": "250-400 words. Not a definition — an explanation of the mechanism, "
           + "written as if to yourself six months ago. Say what you believed, why "
           + "it was wrong, and what is actually happening in the engine.",
  "keyPoints": [
    "Concrete, checkable statements.",
    "Not restatements of the concept paragraph."
  ],
  "example": "Real code you have run, not pseudocode.",
  "exercise": "Something doable in Xogot in under 15 minutes.",
  "check": {
    "q": "...",
    "options": ["...", "...", "...", "..."],
    "answer": 1,
    "explanation": "Why the right answer is right AND why the tempting wrong one is wrong."
  },
  "docsQuery": "Area3D area_entered",   // optional; drives the 'Godot docs' button
  "source": "Project Mars — hitbox double-hit bug, 2026-08"
}
```

Two quality gates:

1. **`concept` under 200 words means you haven't finished thinking about it.** The current
   43-word average is the tell that this content was generated rather than earned.
2. **Distractor options must be plausible.** Current examples include "Move it to Blender"
   and "Remove gravity". Nobody picks those, so the question tests nothing. A good distractor
   is something you might actually have believed.

## Practice item template

Original items live in `content.js` under `practice` and must **not** use a `check-` id
prefix (that prefix marks the duplicated lesson checks) and must **not** have a `lessonId`
if you want them in the "Beyond lessons" filter.

```js
{
  "id": "p-combat-07",
  "category": "Combat Engineering",
  "type": "predict",              // choice | predict | fill | order
  "prompt": "What is printed?",
  "code": "var t := 0.36\nprint(t >= 0.24 and t <= 0.36)",
  "answerText": "true",
  "accepted": ["true", "True"],   // grading now normalises case, spaces, brackets, trailing .0
  "explanation": "..."
}
```

Target: **at least 3 original items per lesson.** That takes the app from 15 real exercises
to 120+, and is the single highest-value content work available.

## Reference entries

Eight-word definitions are a lookup table, not a reference. Aim for 40–60 words plus the
gotcha: not "Delta: time since last frame" but what happens when you forget it, and where
the value comes from in `_process` vs `_physics_process`.

---

## Verify before you publish

The content is not version-pinned. Every lesson now shows "Written against Godot 4.4+ —
verify in Xogot" for exactly that reason. Before adding an API claim, check it in Xogot or
against the linked docs. One example already found: `print(6.0 * 0.5)` gives `3.0` in
Godot 4 but gave `3` in Godot 3.

Also worth a pass: `animation_player.speed_scale` is a player-wide property, so using it to
retime one clip (as lesson `animation-1` suggests) affects every animation on that player.
`play(name, -1.0, custom_speed)` is the per-clip version. That's the kind of correction
that makes a lesson worth reading.
