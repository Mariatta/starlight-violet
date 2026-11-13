---
title: Shortcodes
description: Directives that render tables and links from the notes' front matter
---

A shortcode is a directive on a line of its own. At build time it is
replaced by a table generated from the pages' front matter, so the table is
never typed by hand and never stale. They work in any Markdown page of the
notes and in the site's own pages. A table for a kind the site has not
turned on says that nothing matches.

## Planning pages

| Shortcode | Renders |
|---|---|
| `::topics` | One row per folder of planning pages, wherever it is: its pages with their statuses, the latest update, and the issues |
| `::planning` | Every planning page: topic, type, status, a plan's tasks done as a progress bar, last updated, issues; newest change first |
| `::planning{status=draft}` | The planning pages with that status |
| `::planning{topic=export-screen}` | The pages of one planning folder, by its name or its path, such as `work/export-screen` |
| `::planning{in=work}`, `::topics{in=work}` | Only the planning pages in one top-level folder |
| `::planning{type=plan}` | The pages of one type: `context`, `brainstorm`, `spec` or `plan` |

Attributes combine: `::planning{topic=export-screen status=draft}`.

## A plan's tasks and PRs

These read the `tasks` and `prs` of a plan's front matter. On a plan, or a
page in the same folder as one, they use that plan. Elsewhere, name the
folder with `topic`.

| Shortcode | Renders |
|---|---|
| `::prs` | The plan's pull requests: title, branch, tasks, status, issue and pull request |
| `::tasks` | The plan's tasks: title, PR, status, issue |
| `::tasks{pr=2}` | The tasks one PR ships |
| `::tasks{status=todo}` | The tasks with one status |
| `::prs{topic=export-screen}` | The PRs of another folder's plan |

## Reference pages, decisions and handoffs

| Shortcode | Renders |
|---|---|
| `::references` | Every reference page: status, last updated, issues; newest change first |
| `::references{status=current}` | The reference pages with that status |
| `::decisions` | Every decision: number, title, status, date |
| `::decisions{status=locked}` | The decisions with that status |
| `::handoffs` | Every handoff: title, status, date, from, to, open questions |
| `::questions{of=finance}` | The open questions of the handoff with that page id |

## A landing page

`::sections` renders a card per top-level folder of the notes: its name and
a one-line description, linking to the section's page. Nothing else: the
lists live on the section pages, not the landing page. `::sections{hide=hours}`
leaves folders out.

| Part | Comes from |
|---|---|
| A card's description | The site's `sectionDescriptions` option, else the folder README's `description`, else Violet's default for `planning`, `reference`, `decisions` and `handoffs` |
| The page a card leads to | The folder's `README.md`; else `/decisions/` for the decisions; else a page Violet makes, listing the folder's pages (for a folder holding only planning pages, its topics and recent changes). It heads the folder's sidebar group as "Overview" |

The landing page is an `index.md` at the top of the notes folder, kept with
the notes, or else the site's own `src/content/docs/index.md`; one or the
other, not both. It needs no `kind`, and the `require` and `looseFiles`
options leave it alone. Starlight reads its front matter as if the file were
`src/content/docs/index.md`, so a hero image path is relative to that folder,
not to the notes. With Starlight's `template: splash` and `hero` front
matter, it looks like this:

```markdown
---
title: Project docs
template: splash
hero:
  tagline: Design notes, runbooks and plans for the project.
  actions:
    - text: Writing docs
      link: /writing/
      icon: right-arrow
---

::sections
```

Hero links are used as written, so include the site's `base`.
`::folder{name=finance}` is the table a section page shows, for use
elsewhere.

## Links that make themselves

| Write | Renders |
|---|---|
| `:task[3]` | A link "Task 3" to that task's heading in the plan |
| `:pr[2]` | A link "PR 2" to that PR's heading |
| `:task[3]{topic=export-screen}` | The same, for another folder's plan |
| Task 3, Tasks 6, 7, Tasks 1 to 5 | In a plan, or a page in its folder, each number links to its task |
| decision 0011, decisions 0001, 0002 and 0019 | With the decision kind on, each number links to its decision |
| `[HTML](mockup.html){ target=_blank }` | The link with those attributes: here, opening in a new tab. `.class`, `#id` and `key=value` work, as in Python-Markdown and kramdown |

A `:task` or `:pr` with a number the plan does not have fails the build.
Prose that names a number the plan lacks stays plain text. Text inside
headings, links and code is left alone. A relative link to another Markdown
file in the notes becomes that page's address; when the site serves the
notes' other files, a relative link to one of them opens the file.

## Steps

For numbered steps with code or notes between them, in any page, wrap a
numbered list in `:::steps`:

````markdown
:::steps
1. Launch a pod in the cluster:

   ```sh
   kubectl run -it --rm debug --image=debian -- bash
   ```

2. Install the client and connect.
:::
````

It renders like Starlight's Steps component. Anything inside other than one
numbered list fails the build. In a plan, step items (`- [ ] **Step 1: ...**`)
become steps without it; see the planning contract.

## Previous and next

Starlight's previous and next links are off unless a site turns
`pagination` on. Violet adds them where pages are read in order: a
planning folder (context, brainstorm, spec, plan), the pages of a split page,
and the decisions by number. A page's own `prev` and `next` win.

