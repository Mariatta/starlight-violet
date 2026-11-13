---
title: Kinds
description: The kinds of page Violet knows, what each is for, and how a page declares one
---

A page declares its kind in front matter, `kind: planning`. The kind decides
which fields the page must have, which sections its body must have, how its
header looks and which tables list it. A page with no kind is a plain page,
rendered as it is.

A site turns on the kinds it uses with the `kinds` option, and can require a
kind in a folder with `require`, so a page that forgets its front matter
fails the build instead of rendering bare.

## The four kinds

| Kind | For | Dated by | Sections the body must have | Example |
|---|---|---|---|---|
| `planning` | Work before and while it is done: context, brainstorm, spec and plan, as `type` | `updated` | None | [Export screen plan](../planning/export-screen/plan/) |
| `reference` | How something built works: a design document, a runbook, a guide | `updated` | None | [Architecture](../reference/architecture/) |
| `decision` | One numbered architecture decision | `date` | Context, Decision, Consequences | [Decision 0003](../decisions/0003-build-exports-in-a-background-job/) |
| `handoff` | What one session leaves so the next can start | `date` | Summary, Context, What is decided, What is open, First task, Files, in that order | [Background export jobs](../handoffs/export-jobs/) |

| Kind | Statuses |
|---|---|
| `planning` | `draft`, `in-review`, `approved`, `in-progress`, `done`, `superseded` |
| `reference` | `draft`, `in-progress`, `current`, `unreviewed`, `outdated`, `archived` |
| `decision` | `proposed`, `locked`, `superseded` |
| `handoff` | `draft`, `ready`, `picked-up`, `done` |

Each status has a badge colour, and each kind has a contract page listing
every field, with a skeleton to copy:
[planning](../guide/kinds/planning/), [reference](../guide/kinds/reference/),
[decision](../guide/kinds/decision/) and [handoff](../guide/kinds/handoff/).

## Planning, in more detail

The planning kind follows a piece of work through four types of page, kept
in one folder per piece of work, such as `planning/export-screen/` (the
folder names are yours):

| Type | Answers | Becomes |
|---|---|---|
| `context` | What is true now: the models, the data, the constraints | The facts the brainstorm starts from |
| `brainstorm` | What the options are, and what has been decided so far | The spec, or the plan |
| `spec` | What the feature does, and what it leaves out | The plan |
| `plan` | In which pull requests the work gets done | The work |

The folder reads in that order, in the sidebar and through previous and next
links. A plan lists its tasks and PRs in front matter, so `:task[3]` links to
task 3 from any page and `::tasks` shows them all with their status.

## Kinds of your own

A site can add a kind with its own schema, statuses, sections and header:
the examples' `risk` kind is one, defined in a dozen lines. See
[Extending](../guide/extending/), and the
[risk example](../risks/export-timeouts/).
