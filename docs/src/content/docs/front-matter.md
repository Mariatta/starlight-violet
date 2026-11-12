---
title: Front matter
description: The fields a page's kind gives it, what the header does with them, and how the build checks them
---

Violet treats front matter as the page's data. Anything that is a fact about
the page, rather than its content, has a field: its status, when it changed,
the issues that track it, the pages related to it, a plan's tasks. The
header shows them, the shortcodes list them, and the build checks them.

## The shared fields

Planning and reference pages, and any kind of your own that spreads
`commonFields`, have these:

| Field | Required | Meaning | Shown as |
|---|---|---|---|
| `kind` | yes | The page's kind | Which header and checks apply |
| `status` | yes | Where the page stands; the values depend on the kind | A badge |
| `updated` | yes | `YYYY-MM-DD`, when it last changed in substance | "Last updated" |
| `created` | no | When it was first written, or its data gathered | "Created" |
| `note` | no | One sentence qualifying the status, inline Markdown | "Note" |
| `issues` | no | Tracking issues: `"#12"`, or `{ ref, title, note }` | An Issues table under the header |
| `related` | no | Related pages: `{ title, link, note }`; `link` is a relative Markdown path or a URL | A Related table under the header |
| `split` | no | `true` renders each level-one section as a page of its own | Pages with previous and next links |

A plan adds `stack`, `tasks` and `prs`; a decision has its own fields
(`number`, `ask`, `supersedes`, `history`); a handoff has `from`, `to`,
`inputs`, `open_questions` and `next_steps`. Each kind's
[contract](../guide/kinds/planning/) lists them.

## An example

```yaml
---
kind: planning
type: plan
status: in-progress
updated: 2026-11-11
note: "PR 1 is in review."
issues:
  - ref: "#3"
    title: "Add an export history"
related:
  - title: "Brainstorm"
    link: "brainstorm.md"
    note: "The spec this plan implements"
stack: ["Astro", "Starlight"]
tasks:
  - { number: 1, status: done }
  - { number: 2, status: in-progress }
prs:
  - { number: 1, branch: export/01-foundation, tasks: [1, 2], status: in-review }
---
```

The header then shows the status badge, the dates, progress bars for
"1 of 2 tasks done" and "0 of 1 PRs merged", the stack as a list and the
note, with Issues and Related as tables of their own. See it on the
[example plan](../planning/export-screen/plan/).

## Checked at build time

Every page of a kind is checked against its schema, its required sections
and, for a plan, its task and PR headings. A wrong value fails the build and
says where:

```text
docs/planning/export/plan.md is not a valid planning page:
status: status is required: draft, in-review, approved, in-progress, done, superseded
```

In the dev server, a bad edit keeps the last good pages and logs the error,
so the site stays up while you fix it.

## Starlight's own fields

Starlight's front matter still works on every page: `title`, `description`,
`sidebar`, `prev` and `next`, `template` and `hero`. A page's title defaults
to its first `# heading`, so most notes need no `title`.
