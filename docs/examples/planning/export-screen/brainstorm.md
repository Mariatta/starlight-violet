---
kind: planning
type: brainstorm
status: done
created: 2026-10-22
updated: 2026-10-24
note: "Settled by decisions 0002 and 0003."
related:
  - "[Context](context.md)"
  - title: "Spec"
    link: "spec.md"
    note: "What came out of this"
---

# Export screen brainstorm

## Goal

Organizers get RSVPs, venues and photos out of the club app themselves,
from a screen, without a shell or asking Marcus. The
[context](context.md) has the numbers: RSVPs and venues are quick, photos
are not.

## Decisions so far

- **Lists are CSV, photos a zip** (decision 0001): it opens in the
  spreadsheet, and one format per type keeps the writers few.
- **Every export runs in a background job and arrives as an emailed link**
  (decision 0003): a year of photos cannot finish inside the 30-second
  request limit. It replaced streaming, decision 0002.

## Approaches considered

| Approach | Cost | Outcome |
|---|---|---|
| Stream in the request | Nothing new to run | Lost: a year of photos times out at 30 seconds. See [what we tried first](#what-we-tried-first) |
| Background job, email a link | A worker queue, storage, an email; files to expire | Won: works for every type, ready in about seven minutes for a year of photos |
| Nightly pre-built files | A scheduler and storage | Lost: no date ranges, and tonight's RSVPs would be yesterday's list |

## What we tried first

Streaming was the first choice, written down as decision 0002: no new
moving parts, and RSVPs and venues finish well inside the limit. A spike
streaming the photos from 2026 was cut off at 30 seconds. The browser saved
a 640 MB zip that would not open, and showed no error. A broken file the
night before the December social is worse than an error.

## Where we landed

A background job for every export, not only the slow ones, so there is one
path to test and one screen to explain. The screen starts an export, lists
recent ones, and the link arrives by email:

![Mockup of the export screen: a type, a date range, a Start export button, and a list of recent exports with their status](mockup.svg)

In the plan, :task[4] moves the writers into a job and :task[5] stores
the file; :pr[2] ships both.

## Open questions

- How long should a download link keep working? Sofia answers; the spec
  needs it before the statuses are final.
- Scheduled exports ("every Tuesday, email the welcome host the RSVPs")
  are left for later: nobody asked twice.
