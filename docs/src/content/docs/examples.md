---
title: Examples
description: The notes of a made-up project, rendered by Violet, with a page of every kind
---

This site renders its own `examples/` folder with Violet, as any project
would render its `docs/`. The notes belong to the app of the
[Lucky Town Foodie Club](https://popular.mariatta.ca/foodie/), the made-up
club from the Popular theme's demo, run by Sofia Bianchi and Marcus Chen.
The club's organizers are getting an export screen for RSVPs, venues and
photos: the work is planned, one pull request is merged and the next is in
review. Every page follows that one piece of work, so the pages link to
each other the way real notes do.

::sections

## Where to look

| To see | Open |
|---|---|
| Progress bars for tasks and PRs, the stack, issues and related tables | The [plan](../planning/export-screen/plan/), and each PR's page: the plan is `split: true` |
| A planning folder read in order, with previous and next links | [Context](../planning/export-screen/context/), then brainstorm, spec and plan |
| An image from the notes folder | The mockup in the [brainstorm](../planning/export-screen/brainstorm/#where-we-landed), and the diagram on [Architecture](../reference/architecture/) |
| `:task[4]`, `:pr[2]` and "Tasks 1 to 3" as links | The [spec](../planning/export-screen/spec/#how-it-is-built) and the plan's [PR 1](../planning/export-screen/plan/pr-1/) |
| "decision 0003" linking itself, and a decision that supersedes another | [Architecture](../reference/architecture/), [decision 0002](../decisions/0002-stream-exports-in-the-request/) and [the list of decisions](../decisions/) |
| Open questions, with links straight to one of them | The [handoff](../handoffs/export-jobs/#open-questions); the spec and plan link to `export-jobs.md#q2` and the like |
| A link to a heading on another page, inside a split plan | The [risk](../risks/export-timeouts/) links to Task 5, which lands on the PR 2 page |
| `::questions` on another page | The foot of the [risk](../risks/export-timeouts/) |
| Steps in a runbook, and in a plan's task | [Architecture](../reference/architecture/#re-running-a-failed-export), and Task 5 on the plan's [PR 2](../planning/export-screen/plan/pr-2/) |
| A kind the site defines itself | The [risk](../risks/export-timeouts/), with its own header |

The issues, such as `foodie-club-app#12`, are written as another
repository's, so they link to a repository that does not exist rather
than to this one's real issues.

The source of every page is in the
[repository](https://github.com/mariatta/starlight-violet/tree/main/docs/examples).
