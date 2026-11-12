# Changelog

## 0.2.0 (2026-11-12)

- Progress bars: a plan's header shows tasks done and PRs merged as bars, `::planning` has a Progress column, and each PR page of a split plan shows the progress of its own tasks. `progressBar` is exported from `starlight-violet/kinds` for custom kinds.
- Source links: the `sourceLink` option (`'view'` or `'edit'`, which needs `github`) adds a link at the foot of each page to its Markdown file on GitHub, on the branch named by the new `github.branch` (default `main`). With `'view'`, Starlight's edit link reads "View source" (in English). Split plan pages link to the plan's file. Notes kept in another git checkout than the site get no link, with a warning. Generated pages and the guide pages never get an edit link now, `sourceLink` or not, since Starlight's would point at a file that does not exist.

## 0.1.0 (2026-11-11)

First release, as Violet (`starlight-violet`): the notes loader, the planning, reference, decision and handoff kinds, the page header, plans with tasks and PRs, shortcodes, heading links, the folder sidebar, the wide layout, the decisions page and the served-files route, split pages with previous and next links, and steps.
