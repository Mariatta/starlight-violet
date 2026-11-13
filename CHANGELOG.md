# Changelog

## Unreleased

- References in a work folder link: "Q3" (and "Q3 to Q9") to that question on the folder's handoff; "SPEC", "PLAN.md §6 and §6.4", "SPEC 3.2", "SPEC section 7" and "SPEC principle 2" to that page and section, for any capitalised page of the folder except README.md; "task 1.2", "Stage 1" and "stages 6 and 7" to that row of the plan's numbered table, whose rows now get anchors (`#task-1-2`, `#stage-1`). "Task 3" also matches in lower case and with dotted numbers.
- A handoff's `blocks`, `answer` and `next_steps` are rendered as Markdown, like `question`, so their references link. They take inline Markdown only, as they were plain text before: the parser reads raw HTML in them as text, so a placeholder such as `<id>` is not lost, and a step written "1. Run the tests" stays text rather than becoming a list. A custom kind's `render` can ask for the same with `inline(text, { html: false })`; the `Inline` type is exported from `starlight-violet/kinds`.
- A handoff's next steps are numbered like Starlight's Steps (`sl-steps`); before, the list had a class no style matched.
- A reference inside emphasis inside a link (`[the **SPEC**](SPEC.md)`), or anywhere inside a reference-style link (`[SPEC][spec]`), is no longer linked a second time; only text directly in an inline link was skipped before.
- "Task 3" no longer links after "this", "that", "these", "those", "each", "every", "any", "which" or "what", so "run each Task 3 check twice" stays text. 0.2.2 linked it after any word.

## 0.2.2 (2026-11-13)

- An `index.md` at the top of the notes folder is the site's landing page, so it can live with the notes instead of in the site's `src/content/docs/`. It needs no `kind`, and the `require` and `looseFiles` options leave it alone; it is not listed among the loose pages. Having both is an error naming the two files. Its front matter is read as if it were `src/content/docs/index.md`, so a hero image path is relative to that folder. A generated page (`extraPages`) at `index.md` is the landing page too.

## 0.2.1 (2026-11-12)

- Planning pages can live in any folder. A plan's topic is the folder that holds it, wherever it is, and pages directly in a top-level folder (`finance/PLAN.md`) have that folder as their topic. `topic=` in `:task`, `:pr`, `::prs`, `::tasks` and `::planning` finds the planning folder of that name anywhere in the notes, or takes its path when two folders share a name (the build names the page and both folders); for a plan whose pages declare no kind, it still finds the folder by path, or under `planning/` as before. `::topics` groups by folder and tells folders that share a name apart by path. A top folder holding only planning pages gets its own topics and recent changes on its section page, not just one named `planning`; `::topics` and `::planning` take `in=<folder>` for that. A subfolder inside a plan's folder (`planning/big/research/`) is now a topic of its own.
- The docs say plainly that the notes folder can have any name.

## 0.2.0 (2026-11-12)

- Progress bars: a plan's header shows tasks done and PRs merged as bars, `::planning` has a Progress column, and each PR page of a split plan shows the progress of its own tasks. `progressBar` is exported from `starlight-violet/kinds` for custom kinds.
- Source links: the `sourceLink` option (`'view'` or `'edit'`; it needs `github`) adds a link at the foot of each page to its Markdown file on GitHub, on the branch named by the new `github.branch` (default `main`). With `'view'`, Starlight's edit link reads "View source" (in English). Split plan pages link to the plan's file. Notes kept in another git checkout than the site get no link, with a warning. Generated pages and the guide pages never get an edit link now, `sourceLink` or not, since Starlight's would point at a file that does not exist.

## 0.1.0 (2026-11-11)

First release, as Violet (`starlight-violet`): the notes loader, the planning, reference, decision and handoff kinds, the page header, plans with tasks and PRs, shortcodes, heading links, the folder sidebar, the wide layout, the decisions page and the served-files route, split pages with previous and next links, and steps.
