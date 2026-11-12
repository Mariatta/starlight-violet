---
title: Reference page
description: The front matter of a page on how something works, a runbook or a guide
---

A reference page says how something built works, or is a runbook or guide. (A design for work not yet built is a planning page of type `spec`.) It declares
`kind: reference`. A site can require it of some files with Violet's
`require` option, such as every file at the top of the notes folder; the
build then fails, naming the file, on one that does not declare it, and on
any reference page with a missing field or an unknown status. The fields show as a table at the top of the
page, and `::references` lists every reference page.

## Front matter

| Field     | Required | Meaning                                                                                     |
| --------- | -------- | ------------------------------------------------------------------------------------------- |
| `kind`    | yes      | `reference`                                                                                 |
| `status`  | yes      | `draft`, `in-progress`, `current`, `unreviewed`, `outdated` or `archived`                   |
| `updated` | yes      | `YYYY-MM-DD`, when the page last changed in substance                                       |
| `created` | no       | `YYYY-MM-DD`, when it was first written                                                     |
| `note`    | no       | A qualification of the status, one sentence, inline Markdown                                |
| `issues`  | no       | Tracking issues, shown as a table; see [the planning page](../planning/#issues-and-related) |
| `related` | no       | Related pages, shown as a table; as for planning pages                                      |

`unreviewed` is for a page nobody has checked since it was last changed;
`outdated` for one known to be wrong.

## Skeleton

```markdown
---
kind: reference
status: current
updated: 2026-11-11
---

# <title>
```
