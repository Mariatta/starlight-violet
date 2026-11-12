---
title: Writing notes
description: How to write a page Violet renders well, for people and for agents
---

This is the writing guide for a notes folder rendered with Violet. It is
written for people and for coding agents alike: an agent asked to write or
update an architecture note should read it first and follow it over habits
from elsewhere. A site can add its own rules on top; where they differ, the
site's rules win.

## Pointing your agent here

Add this to the project's `AGENTS.md` (or `CLAUDE.md`), with your own paths.
`docs/` and `docs-site/` are only examples: the notes can be in any folder,
such as `notes/` or `handoffs/`, set by the site's `notes` option.

```markdown
## Writing docs

Docs live in `docs/` and are rendered by the site in `docs-site/`. Before
writing or editing any file under `docs/`, read
`docs-site/node_modules/starlight-violet/pages/writing.md` (this repo's site serves
it at `/guide/writing/`), then the repo's own additions in
`docs-site/src/content/docs/writing.md`. Run `make build` in `docs-site/`
when done: it fails, naming the file, on front matter that breaks its kind.
```

The guide ships inside the package, so an agent can read it from
`node_modules` without the site running. The contracts it links to are next
to it, in `pages/kinds/`.

## Before you write

1. **Pick the kind.** Each [kind below](#the-kinds-and-what-each-page-is-for) has a job. A page that tries to do two
   jobs (a plan that is also a decision record) becomes two pages that link
   to each other.
2. **Copy the skeleton** from the kind's contract page and fill the front
   matter first. The build checks it and names what is missing.
3. **Put data in front matter, not in the body.** Status, dates, issues,
   related pages, a plan's tech stack, tasks and PRs all have fields. The
   page header and the [shortcodes](../shortcodes/) render them; never type
   them again in the body.
4. **Choose the format of each section on purpose**, with the table under
   [Choosing a format](#choosing-a-format). The default is not a bulleted list.

## The kinds, and what each page is for

A site turns on only the kinds it uses; its contract pages, under "Page
kinds" in the sidebar, list each kind's fields. This section is about what
goes in the body.

### Context (`kind: planning`, `type: context`)

What is true now, gathered before anyone decides anything: the current
models and workflow, the data, the constraints, what other branches or
systems already do. It is a snapshot, so date it: `created` is when the
facts were gathered, and every table of data says when it was taken.

- Facts only. Recommendations belong in the brainstorm.
- Quote the source of each fact: the file and line, the query, the issue.
- Data goes in tables (see [Choosing a format](#choosing-a-format)).

### Brainstorm (`kind: planning`, `type: brainstorm`)

The options for the work and what has been decided so far. It reads the
context and ends where a spec or a plan can start.

- **Goal** first, in two or three sentences.
- **Decisions so far**: one bullet each, the decision in bold, then the
  reason.
- **Approaches considered**: a table of each option with its cost and why
  it won or lost.
- **Open questions**: what still needs an answer, and who answers it.

### Spec (`kind: planning`, `type: spec`)

The design the brainstorm settled on, written down before the plan breaks
it into work: what the feature does, the data it changes, the screens and
the rules, and what it deliberately leaves out. A spec answers "what"; the
plan answers "in which pull requests".

- Start with the goal and the non-goals.
- Name the decisions it rests on ("decision 0025") rather than repeating
  them.
- Open questions stay in a section of their own until answered; a spec with
  open questions is `in-review`, one without is `approved`.

### Plan (`kind: planning`, `type: plan`)

How the work gets done, in pull requests small enough to review. It is the
page an implementer, human or agent, works from.

- Start with the **goal**, the **architecture** in a paragraph, and global
  constraints (which branch to start from, what not to touch).
- List the PRs in front matter (`prs`) and show them with `::prs`; list the
  tasks (`tasks`) and show them with `::tasks`. Do not type a PR table by
  hand.
- One heading per PR, `# PR 2: <title>`, and under it one heading per task,
  `### Task 4: <title>`. The build checks that every task and PR in front
  matter has its heading.
- Under each task, steps as `- [ ] **Step 1: <action>**` items, each
  followed by its code and the command that checks it; the site renders
  them as numbered steps.
- A plan longer than a few hundred lines, or with more than three PRs, sets
  `split: true`: each `# PR N` section becomes a page of its own, with
  previous and next links. A note about the whole plan after the last PR is
  a level-one heading of its own, such as `# Self-review notes`.
- Each task says which files it creates or changes, what it produces, and
  how it is tested. Code samples are welcome; keep them to what the
  implementer cannot infer.
- Elsewhere, refer to work as `:task[4]` and `:pr[2]`, so the reference
  links and a wrong number fails the build.
- As work lands, update each task's and PR's `status` and the page's
  `updated`; the header counts progress from them.

### Reference (`kind: reference`)

How something works, for as long as it works that way: a design document for something built, a
runbook, a guide. Unlike a plan it is kept current, so its `status` matters:
`current` while true, `outdated` when known to be wrong, `unreviewed` when
nobody has checked it since it last changed.

- Lead with what the reader is trying to do, then how.
- Steps someone follows go in numbered lists; commands in fenced blocks.
  When steps carry code or notes between them, wrap the list in `:::steps`
  so they read as one sequence (see [Shortcodes](../shortcodes/#steps)).
- When the thing changes, change the page in the same pull request.

### Decision (`kind: decision`)

One architecture decision, numbered, in `decisions/NNNN-<slug>.md`. The body
has **Context**, **Decision** and **Consequences**; the status, dates and
relations to other decisions are front matter.

- One decision per page. "And also" is a second decision.
- A `locked` decision is not edited in substance. A change of mind is a new
  decision that `supersedes` it (or `amends` part of it); the old page gains
  `superseded_by`.
- Refer to a decision as "decision 0011"; Violet links it.

### Handoff (`kind: handoff`)

What one agent or person leaves so the next can start without guessing. Its
sections are fixed (Summary, Context, What is decided, What is open, First
task, Files), and its open questions are front matter with ids, so the next
session can answer them in place.

## Choosing a format

| The content is | Write it as | Not as |
|---|---|---|
| Several records with the same fields (people, models, files, issues, PRs) | A table, one row per record, one column per field | A list with the fields run together in each item |
| Numbers to compare (counts, durations, sizes) | A table with the number in its own column, right after the label | Numbers buried in sentences or list items |
| A ranking (top 5, most recent) | A table with a `#` column | A numbered list with fields in parentheses |
| Steps someone follows in order | A numbered list, one action per step; `:::steps` around it when steps carry code | Prose |
| Options, rules or facts that share no fields | A bulleted list | A table with one column |
| More than three items in one sentence ("Python, Django, HTMX, ...") | A bulleted list, or a front matter field when one exists | A comma-separated run |
| Reasoning, context, a decision and why | Short paragraphs | Fragments in bullets |
| Commands, code, config | A fenced code block with its language | Inline code over several lines |

A quick test: if each list item would read like a row, with the same "name,
then this, then that" shape, it is a table. Two items can stay a sentence;
three or more with shared fields become a table.

### Tables

- Put the identifying column first (name, model, file), then the values.
- One fact per cell. Put a unit in the column heading ("Rows", "Days"), not
  in every cell.
- Say when the data was taken in the heading above the table, such as
  `### Sign-ups (2026-07-01 to 2026-09-30)`.
- Follow a table with a sentence on what it shows, when that is not
  obvious. The table carries the data; the sentence carries the finding.
- Leave out a column that would be empty in every row.

Before:

```markdown
### Row counts (2026-10-23)

- `orders`: 1,204 (980 paid, 224 open)
- `customers`: 311
- `regions`: 12 (2 without a manager)
```

After:

```markdown
### Row counts (2026-10-23)

| Table | Rows | Notes |
|---|---:|---|
| `orders` | 1,204 | 980 paid, 224 open |
| `customers` | 311 | |
| `regions` | 12 | 2 without a manager |
```

## Headings and links

- Every heading is a link target, so keep headings short and unique on the
  page. A heading is a label, not a sentence.
- Link to another note with a relative path to its Markdown file, such as
  `[Plan](plan.md)`; the site turns it into the page's address. A relative
  link to an image or other file in the notes works too, when the site
  serves files.
- Name related pages in `related` front matter, with a `note` saying why,
  rather than in a "See also" paragraph.

## Data and privacy

Notes often quote real data. Counts, dates and identifiers are usually
fine. Personal data (names with email addresses or phone numbers) should be
included only when it helps. When an agent includes it, it should say so in
its reply, naming the sections, so the person who asked can decide whether
it stays. A site may set a stricter rule.

## Style

- Plain, direct sentences, one idea each.
- Dates as `YYYY-MM-DD`.
- Update `updated` in the front matter when a change is more than a typo.

## Check your page

Build the site (or run its dev server and open the page). The build fails,
naming the file, on front matter that breaks its kind, a plan whose tasks
and headings disagree, or a `:task` or `:pr` that points nowhere.
