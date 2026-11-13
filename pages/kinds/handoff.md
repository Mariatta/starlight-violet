---
title: Handoff
description: The contract every handoff follows
---

A handoff is what one agent writes at the end of planning or design so the
next agent can start without guessing. The page lives in the notes repo next
to the work it hands off, declares `kind: handoff`, and is checked at build
time: a missing field or a missing section fails the build and names it.

## Front matter

| Field | Required | Meaning |
|---|---|---|
| `kind` | yes | `handoff` |
| `title` | yes | What is handed off, as a noun phrase |
| `from` | yes | The session or role that wrote it |
| `to` | yes | Who picks up |
| `date` | yes | `YYYY-MM-DD` |
| `status` | yes | `draft`, `ready`, `picked-up` or `done` |
| `decisions` | no | Four-digit numbers of the decisions it rests on |
| `inputs` | yes | Files or folders to read, in reading order |
| `open_questions` | no | `id`, `question`, `blocks` (what waits on it), `owner` (default: Violet's `owner` option), `answer` (empty until answered); `question`, `blocks` and `answer` are Markdown |
| `next_steps` | yes | What the receiving agent does, in order; Markdown |

The Markdown fields link as the body does: "Q3", "SPEC 3.2", "PLAN.md §6",
"Stage 1" and "decision 0011" become links. Each question's row has the
anchor of its id (`#q3`), so any page in the handoff's folder can link to it
by writing "Q3". On a handoff, "Q3" is its own question; when two handoffs
share a folder, an id both of them ask links to neither from the folder's
other pages.

`blocks`, `answer` and `next_steps` were plain text before they were
Markdown, so they take inline Markdown only. A `<` in them shows as
written: a placeholder such as &lt;id&gt; stays text rather than becoming
an HTML tag, while a link written as `<https://...>` still links. A line
that starts like a list, heading or quote stays a line of text, so a step
written "1. Run the tests" is not a list inside the step, and blank lines
are joined. Emphasis, code, links and references work as in the body.
`question` takes raw HTML, as the body does.

## Sections

The body has exactly these level-two headings, in this order. Nothing else
at that level; subsections are fine.

1. **Summary**: what this is and what the receiving agent produces first.
2. **Context**: how the work is done here and what was already checked.
3. **What is decided**: the settled design, and where its source of truth is.
4. **What is open**: how the open questions above are answered and where.
5. **First task**: the one thing to do before anything else, and when to stop.
6. **Files**: what is in the folder, and links that need a sign-in.

## Skeleton

Copy this, fill every field, keep the headings as they are.

```markdown
---
kind: handoff
title: <what is handed off>
from: <session or role>
to: <who picks up>
date: <YYYY-MM-DD>
status: ready
decisions: ["<0000>"]
inputs:
  - <path to read first>
open_questions:
  - id: Q1
    question: <the question>
    blocks: <what waits on the answer>
next_steps:
  - <the first thing the receiving agent does>
---

## Summary

## Context

## What is decided

## What is open

## First task

## Files
```

## What the build checks

The schema in `src/kinds/handoff.ts` validates the front matter when the
loader reads the page; the content component in
`src/components/MarkdownContent.astro` compares the body's level-two
headings with the list above. Run `make check` in the site folder before
handing off.
