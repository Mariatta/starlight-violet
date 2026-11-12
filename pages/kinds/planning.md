---
title: Planning page
description: The front matter every planning page carries
---

A planning page is one context report, brainstorm, spec or plan for a piece
of work, in its own folder under `planning/` in the notes. It declares
`kind: planning`. A site can require it of every file in those folders with
Violet's `require` option, such as `'planning/*/*.md': 'planning'`. The
build fails on a page whose front matter is missing a required field or has
a value it does not know. The error names
the file.

The front matter is shown as a table at the top of the page. The body
starts after it. The [shortcodes](../../shortcodes/) build tables from the same fields.

## Front matter

| Field     | Required | Meaning                                                                 |
| --------- | -------- | ----------------------------------------------------------------------- |
| `kind`    | yes      | `planning`                                                              |
| `type`    | yes      | `context`, `brainstorm`, `spec` or `plan`                                       |
| `status`  | yes      | `draft`, `in-review`, `approved`, `in-progress`, `done` or `superseded` |
| `updated` | yes      | `YYYY-MM-DD`, when the page last changed in substance                   |
| `created` | no       | `YYYY-MM-DD`, when it was first written or its data gathered            |
| `note`    | no       | A qualification of the status, one sentence, inline Markdown            |
| `issues`  | no       | Tracking issues, shown as a table under the header; see below           |
| `related` | no       | Related pages, shown as a table under the header; see below             |
| `stack`   | no       | A plan's tech stack, one item each, shown as a list in the header       |
| `split`   | no       | `true` renders each level-one section as a page of its own; see below   |

The title is the page's first `# heading`, as on every other page.

## Issues and related

Both show as tables of their own under the header, and appear in the page's
table of contents.

```yaml
issues:
  - ref: "#12"
    title: "Add the export screen"
    note: "Umbrella issue for this work"
  - "other-repo#34" # a bare reference works too
related:
  - title: "Context"
    link: "context.md"
    note: "Read first"
  - "[Brainstorm](brainstorm.md)" # so does a bare Markdown link
```

An issue is `#12` for this repo or `other-repo#34` for another repo in
the organisation (Violet's `github` option names both); `title` and `note` are optional. A related `link` is a
relative path to a Markdown file in the notes, which becomes that page's
link, or a URL; `note` says why it is related. Quote issue references: in
YAML an unquoted `#` starts a comment.

## Tasks and PRs

A page of type `plan` lists its tasks and pull requests in front matter, so
any page can refer to them by number and the tables are built from data.
Each entry matches a heading in the body: task 3 is the heading that starts
`Task 3` (any level, such as `### Task 3: The download`), PR 2 the
heading that starts `PR 2` (such as `# PR 2: Export download`).
The build fails on a task or PR without its heading, a `Task N` heading
missing from `tasks`, or a PR listing a task that is not in `tasks`.

| Field                       | Required | Meaning                                                           |
| --------------------------- | -------- | ----------------------------------------------------------------- |
| `tasks[].number`            | yes      | The task's number                                                 |
| `tasks[].title`             | no       | Defaults to the heading's words after `Task N:`                   |
| `tasks[].status`            | no       | `todo` (default), `in-progress`, `in-review`, `done` or `dropped` |
| `tasks[].issue`             | no       | The task's own issue, such as `#540`                              |
| `prs[].number`              | yes      | The PR's number in the plan                                       |
| `prs[].tasks`               | no       | The task numbers it ships                                         |
| `prs[].branch`              | no       | Its branch name                                                   |
| `prs[].ships`               | no       | What it ships, one sentence                                       |
| `prs[].title`               | no       | Defaults to the heading's words after `PR N:`                     |
| `prs[].status`              | no       | As for tasks                                                      |
| `prs[].issue`, `prs[].pull` | no       | Its issue and its pull request, such as `#540`                    |

The page header counts tasks done and PRs merged.

```yaml
tasks:
  - { number: 1, status: done }
  - { number: 2, status: in-progress, issue: "#540" }
prs:
  - number: 1
    branch: export-screen/01-foundation
    tasks: [1, 2]
    status: in-review
    pull: "#541"
```

## A long plan, a page per PR

A plan of a few thousand lines is hard to read on one page. With `split:
true`, the site renders it as several pages, from the one file:

| Page | What it holds | Address |
|---|---|---|
| The plan | The header, and everything before the first level-one heading: goal, constraints, the `::prs` table | `plan/` |
| One per PR | A `# PR 2: <title>` section, under a header of its status, branch and tasks | `plan/pr-2/` |
| One per other section | Any other level-one section, such as `# Self-review notes` | `plan/self-review-notes/` |

Each page links to the previous and the next. A section runs to the next
level-one heading, so a note about the whole plan that comes after the last
PR is a level-one heading of its own, or it reads as part of that PR.
Task links, `:task`, `:pr`, `::tasks` and links to `plan.md#an-anchor`
all go to the page that has the heading. Any kind can be split the same way.

## Steps

Under a task, write its steps as items that start with bold "Step N:", each
followed by its code and its "Run:" lines:

````markdown
- [ ] **Step 1: Write the failing test**

```python
def test_is_active_by_default(): ...
```

- [ ] **Step 2: Run it to see it fail**

Run: `uv run pytest tests/test_districts.py -v`
````

They render as numbered steps, like Starlight's Steps component, with each
step's code inside it. The steps end at the next heading or `---`.

## Reading order

The planning pages of a folder read in the order the work happens, in the
sidebar and through their previous and next links: context, brainstorm,
spec, plan, then the plan's own pages. `sidebar.order`, `prev` and `next` in
a page's front matter override this, as in Starlight.

## Referring to a task or PR

| Write                            | Renders                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `:task[3]`                       | A link "Task 3" to that heading in this folder's plan                                              |
| `:pr[2]`                         | A link "PR 2" to that heading                                                                      |
| `:task[3]{topic=other-folder}`   | The same, in the plan of another folder under `planning/` in the notes                                     |
| Task 3, Tasks 6, 7, Tasks 1 to 5 | In a plan, or a page in the same folder as one, plain prose like this links each number on its own |

A `:task` or `:pr` with a number the plan does not have fails the build.
Prose that names a number the plan lacks stays plain text.

## Statuses

| Status        | Use it when                                         |
| ------------- | --------------------------------------------------- |
| `draft`       | Still being written; not ready for anyone to act on |
| `in-review`   | Ready for the team to read and comment on           |
| `approved`    | Agreed; issues can be cut from it                   |
| `in-progress` | Work from it has started                            |
| `done`        | The work it describes has shipped                   |
| `superseded`  | Replaced by another page; say which in `note`       |

## Skeleton

```markdown
---
kind: planning
type: plan
status: draft
updated: 2026-11-11
issues:
  - ref: "#12"
    note: "Umbrella issue"
related:
  - title: "Brainstorm"
    link: "brainstorm.md"
---

# <title>
```

Quote issue numbers: in YAML an unquoted `#` starts a comment.
