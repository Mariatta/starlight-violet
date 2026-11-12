---
title: Decision
description: The contract every decision follows
---

A decision is one numbered entry of the architecture decision record. Its
status, dates, the owner's words and its relations to other decisions are
front matter, rendered one line each at the top of the page; the reasoning
stays in the body. The [list of decisions](../../../decisions/) filters by status.

## Front matter

| Field | Required | Meaning |
|---|---|---|
| `kind` | yes | `decision` |
| `number` | yes | Four digits, the same as the file name's |
| `title` | yes | The heading, number included |
| `status` | yes | `proposed`, `locked` or `superseded` |
| `date` | yes | `YYYY-MM-DD`, when the status took effect |
| `proposed` | no | `YYYY-MM-DD`, when it was proposed, if before `date` |
| `ask` | no | The owner's words that started it, quoted |
| `confirmed` | no | How the status was confirmed, the owner's words when there are some |
| `reason` | no | Why the decision was written, or where it came from |
| `note` | no | A qualification of the status itself, one sentence |
| `supersedes`, `superseded_by`, `amends`, `amended_by` | no | Lists of `decision` (four digits) and `what` (the part concerned) |
| `history` | no | Dated notes: `date` and `note`, oldest first |

`ask`, `confirmed`, `reason`, `note`, every `what` and every history `note`
are inline Markdown.

`superseded` is for a decision replaced whole, and it names what replaced
it in `superseded_by`. A decision replaced in part stays `locked` and adds
`superseded_by` with the part named.

## Sections

The body has at least these level-two headings: **Context**, **Decision**,
**Consequences**. Addenda and other sections may follow.

## Skeleton

```markdown
---
kind: decision
number: "0025"
title: "0025. <the decision, as a sentence>"
status: proposed
date: <YYYY-MM-DD>
ask: <the words that started it>
---

# 0025. <the decision, as a sentence>

## Context

## Decision

## Consequences
```

A decision file under `decisions/` must declare the kind; the build refuses
one that does not. When the owner confirms it, `status` becomes `locked`, `date`
the day they said so, `proposed` the earlier date, and `confirmed` their words. A later decision that
replaces part of it adds `supersedes` on its own page and `superseded_by`
here, each naming the part.
