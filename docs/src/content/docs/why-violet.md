---
title: Why Violet
description: How Violet came out of planning software with AI agents, what it adds to Starlight, and when to use something else
---

## How it started

Violet came out of how I now build software with AI coding agents.

For anything with real architectural weight, I don't hand an agent a
feature and wait for code. The work goes through a design process first,
and it takes many rounds. One session gathers the context: what the models
look like today, what the data says, what the constraints are. Another
brainstorms the options with me. We argue about them, I push back, we
narrow it down, and only when I'm happy with the design does a plan get
written, broken into pull requests small enough to review. Then an agent
implements it.

All of that has to be written down, because an agent remembers nothing
between sessions. And neither, it turns out, do I. The process rarely
happens in one sitting: it stretches over days, sometimes longer. I work on
several projects, so I put one on hold mid-design to deal with another, and
come back to it a week later needing to remember where we were, what we had
decided and why, and what was still open, before I can pick it up again.
The context, the decisions and the reasons behind them live in Markdown
files in the repo. Many of them are handoffs: one agent
does the planning and writes down what it decided and what is still open,
and a different agent picks that up and writes the code.

That works, until the project grows. A few files became dozens, then
hundreds: context reports, brainstorms, specs, plans, numbered decisions,
reviews of each stage, handoffs between sessions. Each one made sense when
it was written. Together they were hard to read and harder to find my way
around. On GitHub they are a long list of file names, with nothing to say
which plan is approved, which decision is locked, or which page is no
longer true.

And decisions build on each other. A new one rests on three old ones. In
the middle of a session an agent asks me something like "this conflicts
with decision 0011, should we amend it?", or "task 12 assumes the API from
task 4, is that still right?". I can't answer from memory. I need to pull
up decision 0011, read what it said and why, and see what it superseded,
quickly enough not to lose the thread. Scrolling a raw Markdown file in an
editor is not that. A rendered page is: the status at the top, the dates,
the related decisions as links, "task 12" linked to the task.

So I started rendering the notes as a site, for one project. Then I was
working on more projects that follow the same process, agents planning and
agents writing code, each with its own folder of notes in the same shapes.
I didn't want to set up the rendering again for each, slightly differently
each time. I wanted the same kinds of page, the same front matter and the
same checks everywhere, so a plan in one repo reads like a plan in another,
for me and for the agents writing them. That became Violet.

## The name

Violet is named after "Violet", a song by Savage Garden.

## What it is

Projects keep notes next to their code: the context gathered before a
feature, the plan an agent works from, the decisions that shaped the design,
the runbook for the next deploy. They are Markdown files in a `docs/`
folder, and on GitHub they read as a pile of files with no index, no status
and no way to tell which are still true.

Violet renders that folder as a documentation site without moving anything.
The notes stay where they are, written for the repo; the site reads them in
place.

## What it adds to Starlight

[Starlight](https://starlight.astro.build/) already gives you navigation,
search, dark mode and good typography. Violet is a Starlight plugin, so you
keep all of that and get:

| Starlight on its own | With Violet |
|---|---|
| Pages live in `src/content/docs/` | Pages are read from your notes folder, wherever it is |
| Front matter is a title and a description | Each [kind](../kinds/) of page has fields the build checks, and the build fails naming the file and the field |
| Every page has the same layout | A page shows a header from its front matter: status badge, dates, progress, tech stack, issues and related pages |
| An index page is written by hand | [Shortcodes](../guide/shortcodes/) build tables of plans, decisions, handoffs and tasks from the notes |
| Links between Markdown files need site paths | `[Plan](plan.md)` links to the page, and "Task 3" or "decision 0011" link on their own |
| Long pages stay long | A plan [splits](../guide/kinds/planning/#a-long-plan-a-page-per-pr) into a page per PR, with previous and next links |

## Written by people and agents

Many of these notes are now written by coding agents. Violet ships its
[writing guide](../guide/writing/) inside the package, at
`node_modules/starlight-violet/pages/writing.md`, so an agent can read it
without the site running. The guide says which kind of page to write, which
fields to fill, and when to use a table, a list or prose. The build then
checks the result.

## When to use something else

- **Docs for your users.** Product documentation is better as plain
  Starlight pages, written for readers rather than for the team.
- **Notes outside a repo.** A wiki or a notes app suits notes that do not
  change with the code.
- **No build step.** Violet checks pages when the site builds; if nobody
  builds it, nothing is checked.
